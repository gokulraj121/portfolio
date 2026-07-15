"use client";

import { useRef, useEffect, useMemo, useCallback, Suspense, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Stars, Html, MeshDistortMaterial } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
  N8AO,
  DepthOfField,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import gsap from "gsap";


// ─── Easing helpers ───────────────────────────────────────────────────────────
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function smoothLerp(cur, target, alpha) {
  return cur + (target - cur) * alpha;
}
function lerpVal(a, b, t) { return a + (b - a) * t; }

// ─────────────────────────────────────────────────────────────────────────────
// createLunarMaterial  (landscape — starts pitch black, uReveal brightens it)
// ─────────────────────────────────────────────────────────────────────────────
function createLunarMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    // Stone gray — diffuseColor in shader will be this value.
    // The stone color variation in GLSL multiplies outgoingLight by (sc / diffuseColor)
    // which only works correctly when diffuseColor is non-zero.
    color: new THREE.Color("#C9CCD1"),
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    reflectivity: 0.1,
    envMapIntensity: 0.5,
  });
  mat.userData.uniforms = { uReveal: { value: 0.0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    mat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n varying vec3 vWP;`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n vWP=worldPosition.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
       varying vec3 vWP; uniform float uReveal;
       float hl(vec3 p){p=fract(p*vec3(127.1,311.7,74.7));p+=dot(p.zxy,p.yxz+19.19);return fract(p.x*p.y*p.z);}
       float vNl(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(mix(hl(i),hl(i+vec3(1,0,0)),u.x),mix(hl(i+vec3(0,1,0)),hl(i+vec3(1,1,0)),u.x),u.y),mix(mix(hl(i+vec3(0,0,1)),hl(i+vec3(1,0,1)),u.x),mix(hl(i+vec3(0,1,1)),hl(i+vec3(1,1,1)),u.x),u.y),u.z);}
       float fbml(vec3 p){float v=0.,a=.5;vec3 s=p;for(int i=0;i<4;i++){v+=a*vNl(s);s=s*2.03+vec3(3.1,1.7,5.3);a*=.5;}return v;}
       float mgl(vec3 p){float v=0.,a=.5;vec3 s=p+vec3(91.3,45.7,33.1);for(int i=0;i<3;i++){v+=a*vNl(s);s=s*2.5+vec3(1.1,8.9,2.7);a*=.5;}return v;}`)
      .replace("#include <output_fragment>", `
       float ln=fbml(vWP*.18);
       vec3 cA=vec3(.749,.765,.784),cB=vec3(.788,.8,.82),cC=vec3(.839,.855,.875);
       vec3 sc=mix(cA,cB,smoothstep(.35,.55,ln)); sc=mix(sc,cC,smoothstep(.6,.8,ln));
       sc=mix(sc*.88,sc*1.06,smoothstep(-2.,4.,vWP.y));
       sc=clamp(sc+(mgl(vWP*6.)-.5)*.08,0.,1.);
       outgoingLight=outgoingLight*(sc/max(diffuseColor.rgb,vec3(.001)));
       float rv=fbml(vWP*2.5),lr=.78+rv*.15;
       outgoingLight=mix(outgoingLight*(1.-(lr-.78)*1.5),outgoingLight,.5);
       outgoingLight*=uReveal;
       #include <output_fragment>`);
  };
  return mat;
}
// ─────────────────────────────────────────────────────────────────────────────
// CameraRig — 3-phase cinematic trajectory
//
// SCENE 1 (0–35%):  Crystal fills frame in darkness. Camera stationary.
//   pos=(0, 0.5, 4.5)  lookAt=tracks crystal Y as it drifts 0→1.6
//
// SCENE 2 (35–75%):  Drone pulls back, rises, terrain fades in.
//   pos goes 4.5→14 (z), 0.5→3.5 (y)
//   lookAt drifts from crystal Y toward world 0.5
//
// SCENE 3 (75–100%):  Descend to ground, look UP at crystal.
//   Camera drops from y=3.5 → y=0.3 (near-ground).
//   Camera moves forward slightly z=14→12.
//   lookAt Y rises from 0.5 → 2.4 — viewer looks upward toward crystal.
//   pitch ≈ atan((2.4-0.3)/12) ≈ 10° UPWARD — grounded sci-fi perspective.
// ─────────────────────────────────────────────────────────────────────────────
function CameraRig({ scrollRef }) {
  const { camera } = useThree();
  const basePos = useRef(new THREE.Vector3(0, 0.5, 4.5));
  const baseTgt = useRef(new THREE.Vector3(0, 0.2, 0));
  const mouseOffset = useRef(new THREE.Vector3(0, 0, 0));
  const targetOffset = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((state, dt) => {
    const sp    = scrollRef.current;
    
    // Slow, heavy lerp for scrolling (like a cinematic drone)
    const scrollAlpha = Math.min(dt * 1.6, 1);
    
    // Fast, responsive lerp for mouse movement
    const mouseAlpha = Math.min(dt * 4.0, 1);

    const wantPos = new THREE.Vector3();
    const wantTgt = new THREE.Vector3();

    // Crystal Y mirrors CrystalScene: easeInOutCubic(sp) * 1.6
    const crystalY = easeInOutCubic(sp) * 1.6;

    if (sp < 0.35) {
      // ─── SCENE 1: Hero ────────────────────────────────────
      wantPos.set(0, 0.5, 4.5);
      wantTgt.set(0, crystalY, 0);
    } else if (sp < 0.75) {
      // ─── SCENE 2: Pullback ────────────────────────────────
      const t2 = easeInOutCubic((sp - 0.35) / 0.40);
      wantPos.set(
        0,
        lerpVal(0.5, 3.5, t2),
        lerpVal(4.5, 14.0, t2)
      );
      wantTgt.set(0, lerpVal(crystalY, 0.5, t2), 0);
    } else {
      // ─── SCENE 3: Ground-level, looking UP ──────────────────
      const t3 = easeInOutCubic((sp - 0.75) / 0.25);
      wantPos.set(
        0,
        lerpVal(3.5, 0.3, t3),
        lerpVal(14.0, 12.0, t3)
      );
      wantTgt.set(0, lerpVal(0.5, 2.4, t3), 0);
    }

    // Update base scroll positions
    basePos.current.lerp(wantPos, scrollAlpha);
    baseTgt.current.lerp(wantTgt, scrollAlpha);

    // ─── PARALLAX: Strong Mouse movement offsets ────────────────────
    const mouseX = state.pointer.x;
    const mouseY = state.pointer.y;

    // Dramatically shift camera position based on mouse (moves opposite to mouse)
    const targetMouseOffset = new THREE.Vector3(mouseX * 5.0, -mouseY * 2.0, 0);
    
    // Shift the target slightly less to create a massive 3D pivoting feel
    const targetTgtOffset = new THREE.Vector3(mouseX * 1.2, -mouseY * 0.4, 0);

    // Update mouse offsets independently for snappy response
    mouseOffset.current.lerp(targetMouseOffset, mouseAlpha);
    targetOffset.current.lerp(targetTgtOffset, mouseAlpha);

    // Combine base scroll position with live mouse offset
    camera.position.copy(basePos.current).add(mouseOffset.current);
    
    const finalTgt = baseTgt.current.clone().add(targetOffset.current);
    camera.lookAt(finalTgt);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DynamicLighting
//
// Terrain was overexposed: key light max was 3.1. Reduced to max 1.3.
// Crystal pointLight stays bright (it's the only light in Scene 1).
// Rim fills mountains from back-left in Scene 3 without washing them out.
// ─────────────────────────────────────────────────────────────────────────────
function DynamicLighting({ scrollRef }) {
  const ambRef = useRef();
  const keyRef = useRef();
  const rimRef = useRef();
  const focusRef = useRef();

  useFrame(() => {
    const sp = scrollRef.current;
    
    // Scene 1: 1.0 at start, fades to 0 by 35%
    const t1 = 1.0 - easeInOutCubic(Math.min(1, sp / 0.35)); 
    const t2 = easeInOutCubic(Math.max(0, (sp - 0.35) / 0.40)); // Scene 2 ramp
    const t3 = easeInOutCubic(Math.max(0, (sp - 0.75) / 0.25)); // Scene 3 ramp
    
    // Key light: was 3.1 max — reduced to 1.3 max to prevent white-out
    if (ambRef.current) ambRef.current.intensity = 0.02 + t2 * 0.18 + t3 * 0.10;
    if (keyRef.current) keyRef.current.intensity = 0.25 + t2 * 0.70 + t3 * 0.35;
    
    // Rim only in Scene 3, kept subtle (0.3 max)
    if (rimRef.current) rimRef.current.intensity = t3 * 0.30;

    // Focus light exclusively for Scene 1 (zoom in mode) to give crystal bright reflections
    if (focusRef.current) focusRef.current.intensity = t1 * 12.0; 
  });
  return (
    <>
      <ambientLight ref={ambRef} intensity={0.02} color="#d8e8ff" />
      <directionalLight ref={keyRef} position={[6, 18, 10]} intensity={0.25} color="#f0e8d8"
        castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003}
        shadow-camera-near={1} shadow-camera-far={150}
        shadow-camera-left={-50} shadow-camera-right={50}
        shadow-camera-top={50} shadow-camera-bottom={-50} />
      
      {/* Subtle back-rim from upper-left to separate mountains from sky */}
      <directionalLight ref={rimRef} position={[-10, 6, -10]} intensity={0} color="#a0c0e8" />
      
      {/* Base Crystal-only fill — close range, high decay */}
      <pointLight position={[0, 2, 3]} intensity={2.8} color="#ffffff" distance={12} decay={2.5} />

      {/* Intense Focus/Reflection Light for Zoom-In View (Scene 1) — perfectly centered */}
      <pointLight ref={focusRef} position={[0, 1, 4]} intensity={12.0} color="#ffffff" distance={15} decay={2.0} />
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// DustParticles
//
// 3 000 tiny points that drift slowly through the air.
// They are extremely dim in open space but become luminous when they
// enter the spotlight cone — creating the Lusion-signature effect where
// you can see the beam of light only through the dust it illuminates.
//
// Implementation:
//   • Random positions in a sphere of radius DUST_RADIUS around origin
//   • Each particle has a random drift velocity stored in an attribute
//   • ShaderMaterial computes dot(particleDir, spotDir) to determine
//     whether the particle is inside the spotlight cone
//   • Particles inside the cone get a brightness boost (uSpotBoost)
//   • A per-particle random lifetime offset prevents synchronised blinking
//   • Revealed same timing as terrain (scroll > 35%)
// ─────────────────────────────────────────────────────────────────────────────

const DUST_COUNT  = 4000;
const DUST_RADIUS = 8;   // cylinder radius around scene centre

function DustParticles({ scrollRef }) {
  const meshRef = useRef();

  // Generate geometry once: positions + drift velocities + random phase
  const [geometry, velBuffer] = useMemo(() => {
    const pos   = new Float32Array(DUST_COUNT * 3);
    const vel   = new Float32Array(DUST_COUNT * 3);
    const phase = new Float32Array(DUST_COUNT);
    const size  = new Float32Array(DUST_COUNT);

    for (let i = 0; i < DUST_COUNT; i++) {
      // Cylindrical distribution — wide XZ, tall Y, matches valley shape
      const angle  = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * DUST_RADIUS; // uniform radial
      pos[i*3]   = Math.cos(angle) * radius;
      pos[i*3+1] = (Math.random() * 2 - 1) * 5;  // Y: -5 to +5
      pos[i*3+2] = Math.sin(angle) * radius;

      // Very slow drift — tiny upward bias so particles float upward
      vel[i*3]   = (Math.random() - 0.5) * 0.005;
      vel[i*3+1] = Math.random() * 0.003 + 0.0005;
      vel[i*3+2] = (Math.random() - 0.5) * 0.005;

      phase[i] = Math.random() * Math.PI * 2;
      size[i]  = 1.5 + Math.random() * 2.5; // 1.5–4 px per particle
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(size,  1));
    return [geo, vel];
  }, []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime:     { value: 0 },
      uOpacity:  { value: 1.0 },
      uSpotPos:  { value: new THREE.Vector3(0, 14, 4) },
      uSpotDir:  { value: new THREE.Vector3(0, -1, -0.28).normalize() },
      uCosAngle: { value: Math.cos(0.22) },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime, uOpacity, uCosAngle;
      uniform vec3  uSpotPos, uSpotDir;
      varying float vAlpha;
      varying vec3  vColor;

      void main() {
        vec3  toP    = normalize(position - uSpotPos);
        float cosA   = dot(toP, uSpotDir);
        float inCone = smoothstep(uCosAngle - 0.06, uCosAngle + 0.04, cosA);
        float dFall  = 1.0 - smoothstep(4.0, 16.0, length(position - uSpotPos));
        float beam   = inCone * dFall;

        // Base brightness visible even outside beam (0.28 minimum)
        float twinkle = 0.75 + 0.25 * sin(uTime * 1.2 + aPhase);
        vAlpha = (0.28 + 0.72 * beam) * twinkle * uOpacity;
        vColor = mix(vec3(0.55, 0.65, 0.80), vec3(0.95, 0.97, 1.0), beam);

        gl_PointSize = aSize * (1.0 + beam * 1.8);
        gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying float vAlpha;
      varying vec3  vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float soft = 1.0 - smoothstep(0.3, 1.0, d);
        gl_FragColor = vec4(vColor, soft * vAlpha);
      }`,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  }), []);

  useFrame((state) => {
    const sp = scrollRef.current;
    material.uniforms.uTime.value    = state.clock.elapsedTime;
    // Always at least 40% visible so particles show from scroll=0
    material.uniforms.uOpacity.value = 0.4 + easeInOutCubic(sp) * 0.6;

    const pos = geometry.attributes.position;
    const vel = velBuffer;
    for (let i = 0; i < DUST_COUNT; i++) {
      let x = pos.array[i*3]   + vel[i*3];
      let y = pos.array[i*3+1] + vel[i*3+1];
      let z = pos.array[i*3+2] + vel[i*3+2];
      // Radial wrap
      if (x*x + z*z > DUST_RADIUS * DUST_RADIUS) { x *= -0.95; z *= -0.95; }
      // Vertical loop: particles float up and reappear at bottom
      if (y > 5.5)  y = -5.0;
      if (y < -5.5) y =  5.0;
      pos.array[i*3]   = x;
      pos.array[i*3+1] = y;
      pos.array[i*3+2] = z;
    }
    pos.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneFog — begins at Scene 2 boundary (35%), peaks in Scene 3
// Low density creates atmospheric depth without blocking the scene.
// ─────────────────────────────────────────────────────────────────────────────
function SceneFog({ scrollRef }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2("#0b0d11", 0.0);
    return () => { scene.fog = null; };
  }, [scene]);
  useFrame(() => {
    if (!scene.fog) return;
    const sp = scrollRef.current;
    const t = easeInOutCubic(Math.max(0, (sp - 0.35) / 0.65));
    // Tripled fog density for a thicker, more atmospheric landscape
    scene.fog.density = t * 0.045; 
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GroundFog
//
// 4 large horizontal planes with procedural noise-based transparency.
// They sit at valley-floor level and drift slowly to simulate real mist.
// Uses AdditiveBlending so the fog catches the spotlight and creates
// subtle light-shaft effects without blocking objects behind it.
//
// Layer layout (world Y relative to valley floor at ≈0):
//   -1.5  dense ground-hugging mist
//   -0.4  rising wisps
//    0.5  thin upper haze (near crystal base)
//    1.2  faint trailing tendrils at crystal height
//
// Each layer has independent noise scale, drift speed, and opacity.
// Revealed together with the terrain (scroll > 35%).
// ─────────────────────────────────────────────────────────────────────────────

const FOG_VERT = `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FOG_FRAG = `
uniform float uTime;
uniform float uReveal;
uniform vec3  uFogColor;
uniform float uOpacity;
uniform float uNoiseScale;
uniform float uDriftX;
uniform float uDriftZ;
varying vec2 vUv;
varying vec3 vWorldPos;

// Improved hash and noise for softer, more realistic clouds
float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// 5-octave Fractal Brownian Motion
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.0 + vec2(1.7, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

void main(){
  // Soft drifting in world space
  vec2 uv = vWorldPos.xz * uNoiseScale + vec2(uTime * uDriftX, uTime * uDriftZ);
  
  // Domain Warping for highly realistic swirling mist
  float n1 = fbm(uv);
  float n2 = fbm(uv + vec2(n1 * 1.5, uTime * 0.05));
  float density = fbm(uv + n2 * 2.0);
  
  // Soften the density curve to look like thick, fluffy clouds
  density = smoothstep(0.2, 0.8, density);
  
  // Smooth circular fade at the edges of the plane
  float dist = length(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.4, 1.0, dist);
  
  float alpha = density * edgeFade * uOpacity * uReveal;
  gl_FragColor = vec4(uFogColor, alpha);
  if(alpha < 0.001) discard;
}`;

const FOG_LAYERS = [
  // { worldY, planeSize, noiseScale, driftX, driftZ, opacity, color }
  // Massively increased opacity and brighter colors for thick visible mist
  { y: -1.5, size: 80, ns: 0.06, dx:  0.015, dz:  0.010, op: 0.65, col: "#4a6d95" },
  { y: -0.4, size: 70, ns: 0.09, dx: -0.018, dz:  0.012, op: 0.45, col: "#3c5a7d" },
  { y:  0.5, size: 60, ns: 0.13, dx:  0.020, dz: -0.015, op: 0.28, col: "#314b69" },
  { y:  1.2, size: 50, ns: 0.18, dx: -0.012, dz:  0.018, op: 0.18, col: "#283f58" },
];

function GroundFog({ scrollRef }) {
  // Build one ShaderMaterial per layer; store in stable ref
  const materials = useRef(
    FOG_LAYERS.map(l => new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uReveal:     { value: 0 },
        uFogColor:   { value: new THREE.Color(l.col) },
        uOpacity:    { value: l.op },
        uNoiseScale: { value: l.ns },
        uDriftX:     { value: l.dx },
        uDriftZ:     { value: l.dz },
      },
      vertexShader:   FOG_VERT,
      fragmentShader: FOG_FRAG,
      transparent:    true,
      depthWrite:     false,       // never block depth buffer
      blending:       THREE.AdditiveBlending,
      side:           THREE.DoubleSide,
    }))
  ).current;

  useFrame((state) => {
    const sp  = scrollRef.current;
    const rev = easeInOutCubic(Math.max(0, (sp - 0.35) / 0.65));
    const t   = state.clock.elapsedTime;
    materials.forEach(m => {
      m.uniforms.uTime.value   = t;
      m.uniforms.uReveal.value = rev;
    });
  });

  return (
    <>
      {FOG_LAYERS.map((layer, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}   // lie flat on the XZ plane
          position={[0, layer.y, 0]}
          renderOrder={i}                    // stack layers cleanly
        >
          <planeGeometry args={[layer.size, layer.size, 1, 1]} />
          <primitive object={materials[i]} attach="material" />
        </mesh>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// LiquidStones (Falling Cluster)
//
// ~15 stones that fall from the sky. When they hit the ground, they 
// scatter/shatter by exploding their vertices outward before looping.
// ─────────────────────────────────────────────────────────────────────────────
const LIQUID_STONE_COUNT = 15;
const LIQUID_RADIUS = 3.5;

function LiquidStones({ scrollRef }) {
  const meshRef = useRef();
  
  // Custom material injecting curl noise into vertex displacement
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#C9CCD1"),
      roughness: 0.85,
      metalness: 0.2,
      clearcoat: 0.1,
      reflectivity: 0.2,
      envMapIntensity: 0.8,
    });
    
    m.userData = { uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } } };
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, m.userData.uniforms);
      m.userData.shader = shader;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uTime;
           uniform float uReveal;
           attribute vec3 aOffset;
           attribute float aSpeed;
           varying vec3 vWP;
           
           // Noise functions
           float hash(float n) { return fract(sin(n) * 43758.5453123); }
           float noise3(vec3 x) {
             vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
             float n = i.x + i.y * 57.0 + i.z * 113.0;
             return mix(mix(mix(hash(n), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                        mix(mix(hash(n + 113.0), hash(n + 114.0), f.x), mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
           }
           float fbm(vec3 p) {
             float v = 0.0, a = 0.5; vec3 shift = vec3(100.0);
             for (int i = 0; i < 3; i++) { v += a * noise3(p); p = p * 2.1 + shift; a *= 0.5; }
             return v;
           }
           vec3 curl(vec3 p) {
             const float e = 0.05;
             vec3 dx = vec3(e, 0, 0); vec3 dy = vec3(0, e, 0); vec3 dz = vec3(0, 0, e);
             float x = fbm(p + dy) - fbm(p - dy) - fbm(p + dz) + fbm(p - dz);
             float y = fbm(p + dz) - fbm(p - dz) - fbm(p + dx) + fbm(p - dx);
             float z = fbm(p + dx) - fbm(p - dx) - fbm(p + dy) + fbm(p - dy);
             return normalize(vec3(x, y, z) / (2.0 * e));
           }
          `
        )
        .replace(
          "#include <begin_vertex>",
          `
           // Time-based cycle (goes from 0.0 to 1.0 as it falls)
           // Reduced speed multiplier from 0.35 to 0.05 for a slow, smooth fall
           float cycle = fract(aOffset.y + uTime * aSpeed * 0.05); 
           
           // Smooth linear drop instead of heavy gravity acceleration
           float drop = cycle;
           
           // Map to world Y: 20.0 (high sky) down to -2.5 (underground)
           float currentY = mix(20.0, -2.5, drop);
           
           // Slowed down tumbling rotation
           float rotAngle = uTime * aSpeed * 2.0 + aOffset.x * 5.0;
           float s = sin(rotAngle);
           float c = cos(rotAngle);
           vec3 rotatedPos = vec3(position);
           
           // Simple 2-axis rotation for tumbling
           rotatedPos.xy = mat2(c, -s, s, c) * rotatedPos.xy;
           rotatedPos.yz = mat2(c, -s, s, c) * rotatedPos.yz;
           
           // Impact logic: shrink away when hitting ground level (-1.0)
           float vanishAmount = smoothstep(-1.0, -2.5, currentY); // 0 at surface, 1 underground
           
           vec3 transformed = rotatedPos;
           
           // Simply shrink the stone away cleanly as it sinks into the ground
           float coreScale = (0.2 + uReveal * 0.8) * (1.0 - vanishAmount);
           transformed *= coreScale;
           
           // Straight drop - push Z back an additional -2.0 units so it's deep in the background
           transformed += vec3(aOffset.x, currentY, aOffset.z - 2.0);
          `
        )
        .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n vWP=worldPosition.xyz;`);

      // Add a vertical fade so stones don't clip harshly through the terrain
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n varying vec3 vWP; uniform float uReveal;`)
        .replace("#include <dithering_fragment>", `
          #include <dithering_fragment>
          // Fade in at the top (15.0 to 20.0) and fade out quickly as it hits the ground
          float alphaFade = smoothstep(-2.0, -1.0, vWP.y) * (1.0 - smoothstep(15.0, 20.0, vWP.y)) * uReveal;
          if (alphaFade < 0.01) discard;
          gl_FragColor = vec4(gl_FragColor.rgb, gl_FragColor.a * alphaFade);
        `);
      m.transparent = true;
    };
    return m;
  }, []);

  const [geometry, offsetBuffer, speedBuffer] = useMemo(() => {
    // A bit larger so we can see the geometry shatter clearly
    const geo = new THREE.DodecahedronGeometry(0.18, 0); 
    const offsets = new Float32Array(LIQUID_STONE_COUNT * 3);
    const speeds = new Float32Array(LIQUID_STONE_COUNT);
    
    for (let i = 0; i < LIQUID_STONE_COUNT; i++) {
      // Restrict angle between PI and 2*PI (negative Z) so they only fall BEHIND the crystal
      const angle = Math.PI + Math.random() * Math.PI;
      // Clustered tightly around the crystal in the distance
      const radius = 0.5 + Math.random() * LIQUID_RADIUS; 
      
      // Store a normalized starting phase (0 to 1) in the Y component of aOffset
      offsets[i*3]   = Math.cos(angle) * radius;
      offsets[i*3+1] = Math.random(); // phase 0..1
      offsets[i*3+2] = Math.sin(angle) * radius;
      
      // Randomize falling speed
      speeds[i] = 0.5 + Math.random() * 1.5;
    }
    
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
    return [geo, offsets, speeds];
  }, []);

  useFrame((state) => {
    const sp = scrollRef.current;
    const rev = easeInOutCubic(Math.max(0, (sp - 0.35) / 0.65));
    
    if (mat.userData.shader) {
      mat.userData.shader.uniforms.uTime.value = state.clock.elapsedTime;
      mat.userData.shader.uniforms.uReveal.value = rev;
    }
    
    if (meshRef.current) {
      meshRef.current.visible = sp >= 0.28;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, mat, LIQUID_STONE_COUNT]} castShadow receiveShadow />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SphereObject
// ─────────────────────────────────────────────────────────────────────────────
function SphereObject({ scrollRef }) {
  const smoothY = useRef(0);
  const meshRef = useRef();

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const sp = easeInOutCubic(scrollRef.current);
    smoothY.current = smoothLerp(smoothY.current, sp * 1.6, Math.min(dt * 2.5, 1));
    if (meshRef.current) {
      meshRef.current.position.set(0, smoothY.current + Math.sin(t * 0.55) * 0.04, 0);
      meshRef.current.rotation.y += dt * 0.15;
      meshRef.current.rotation.x += dt * 0.05;
    }
  });

  return (
    <Center>
      <mesh ref={meshRef} scale={[0.8, 0.8, 0.8]}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color="#ffffff"
          roughness={0.08}
          metalness={0.9}
          distort={0.45}
          speed={3.5}
        />
      </mesh>
    </Center>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LandscapeScene
//
// Composition target:
//   Crystal floats at world y ≈ 1.6 (CRYSTAL_FINAL_Y).
//   Valley floor should be at world y ≈ 0 → -1.
//   Terrain peaks should sit at y ≈ +2 to -2 so mountains frame the crystal.
//   Terrain edges must extend far beyond screen — scale generously.
//
// GLB is ~3000-5000 native units wide.
// scale 0.55 → 1650-2750 world units wide.
// ─────────────────────────────────────────────────────────────────────────────

// Large uniform scale — 1.2 makes the GLB overwhelm the frame in all directions
const LS_SCALE = 1.2;

// LS_REST_Y: world Y of the group origin when fully revealed.
// Raised to -2 so the terrain surface (which is above the GLB origin)
// sits at approximately world y=0, directly beneath the crystal (y≈1.6).
const LS_REST_Y  = -2.0;
const LS_START_Y = -9.0;  // starts deep below, rises as Scene 2 begins

function LandscapeScene({ scrollRef }) {
  const gltf      = useGLTF("/models/landscape.glb");
  const groupRef  = useRef(null);
  const mat       = useMemo(() => createLunarMaterial(), []);
  const smoothRev = useRef(0);
  const smoothY   = useRef(LS_START_Y);

  // Apply material once
  useEffect(() => {
    gltf.scene.traverse((child) => {
      if (!child.isMesh) return;
      child.material = mat;
      child.castShadow = child.receiveShadow = true;
    });
  }, [gltf.scene, mat]);

  useFrame((_, dt) => {
    const sp  = scrollRef.current;

    // Completely hide during Scene 1 so terrain can't occlude the crystal.
    // THREE visibility culls the draw call entirely — no shader needed.
    if (groupRef.current) {
      groupRef.current.visible = sp >= 0.28;
    }

    // uReveal: 0 until 35%, then ramps to 1 at 100%
    // Slower alpha (0.9) so terrain fades in gently rather than popping.
    const rev = easeInOutCubic(Math.max(0, (sp - 0.35) / 0.65));
    const a   = Math.min(dt * 0.9, 1);

    smoothRev.current = smoothLerp(smoothRev.current, rev, a);
    const shader = mat.userData.shader;
    if (shader?.uniforms?.uReveal) shader.uniforms.uReveal.value = smoothRev.current;

    // Terrain rises from below as it reveals
    const targetY = LS_START_Y + (LS_REST_Y - LS_START_Y) * rev;
    smoothY.current = smoothLerp(smoothY.current, targetY, Math.min(dt * 1.2, 1));
    if (groupRef.current) groupRef.current.position.y = smoothY.current;
  });

  return (
    <group
      ref={groupRef}
      position={[0, LS_START_Y, 0]}
      scale={[LS_SCALE, LS_SCALE, LS_SCALE]}
      rotation={[0, -Math.PI / 2, 0]}
    >
      <primitive object={gltf.scene} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BackgroundStars
// Tiny distant particles that are visible in the zoom in view.
// ─────────────────────────────────────────────────────────────────────────────
function BackgroundStars({ scrollRef }) {
  const groupRef = useRef();
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0005; // extremely slow rotation
      
      // Update opacity on the Stars material to remain fully bright
      groupRef.current.children.forEach(child => {
        if (child.material) {
          child.material.transparent = true;
          child.material.opacity = 1.0; 
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {/* Increased count to 8000 and factor slightly to make them brighter and denser */}
      <Stars radius={150} depth={50} count={8000} factor={4} saturation={0} fade speed={1} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OverlayText
// Cinematic typography with staggered scroll-linked text motion.
// Includes details about VGR creativity in the landscape view.
// ─────────────────────────────────────────────────────────────────────────────
function OverlayText({ scrollRef }) {
  // Top section refs
  const tContainerRef = useRef(null);
  const tTitleRef = useRef(null);
  const tHeadRef = useRef(null);

  // Bottom section refs
  const bContainerRef = useRef(null);
  const bTitleRef = useRef(null);
  const bHead1Ref = useRef(null);
  const bHead2Ref = useRef(null);
  const bDescRef = useRef(null);
  
  useFrame(() => {
    const sp = scrollRef.current;
    
    // Helper to calculate a 0-1 fade within a specific scroll range
    const calcReveal = (start, end) => easeInOutCubic(Math.max(0, Math.min(1, (sp - start) / (end - start))));

    // --- TOP SECTION (Zoom-In View): Fades out staggeringly from 0.0 -> 0.3 ---
    const t1 = 1.0 - calcReveal(0.00, 0.20);
    const t2 = 1.0 - calcReveal(0.05, 0.25);

    if (tContainerRef.current) tContainerRef.current.style.display = sp > 0.3 ? 'none' : 'block';
    
    if (tTitleRef.current) {
      tTitleRef.current.style.opacity = t1;
      tTitleRef.current.style.transform = `translateY(${(1 - t1) * -40}px)`;
    }
    if (tHeadRef.current) {
      tHeadRef.current.style.opacity = t2;
      tHeadRef.current.style.transform = `translateY(${(1 - t2) * -40}px)`;
    }
    
    // --- BOTTOM SECTION (Landscape View): Fades in staggeringly from 0.40 -> 0.65 ---
    const b1 = calcReveal(0.40, 0.50);
    const b2 = calcReveal(0.45, 0.55);
    const b3 = calcReveal(0.50, 0.60);
    const b4 = calcReveal(0.55, 0.65);

    if (bContainerRef.current) bContainerRef.current.style.display = 'block';

    if (bTitleRef.current) {
      bTitleRef.current.style.opacity = b1;
      bTitleRef.current.style.transform = `translateY(${(1 - b1) * 40}px)`;
    }
    if (bHead1Ref.current) {
      bHead1Ref.current.style.opacity = b2;
      bHead1Ref.current.style.transform = `translateY(${(1 - b2) * 40}px)`;
    }
    if (bHead2Ref.current) {
      bHead2Ref.current.style.opacity = b3;
      bHead2Ref.current.style.transform = `translateY(${(1 - b3) * 40}px)`;
    }
    if (bDescRef.current) {
      bDescRef.current.style.opacity = b4;
      bDescRef.current.style.transform = `translateY(${(1 - b4) * 40}px)`;
    }
  });

  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 20 }}>
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        
        {/* Zoom-In View — left side, vertically centred */}
        <div ref={tContainerRef} style={{ position: 'absolute', top: '50%', left: '7%', transform: 'translateY(-50%)', color: 'white', fontFamily: 'var(--font-nevera)' }}>
          <div ref={tTitleRef} style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: 'clamp(10px, 0.75vw, 12px)', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: '0 0 16px 0', fontFamily: 'var(--font-nevera)' }}>VGR / DIGITAL CRAFTSMAN</p>
          </div>
          <div ref={tHeadRef}>
            <h1 style={{ fontSize: 'clamp(2.5rem, 5.5vw, 90px)', fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 0.9, margin: '0 0 24px 0', color: '#ffffff', textTransform: 'uppercase', fontFamily: 'var(--font-nevera)' }}>
              I BUILD<br />
              WHAT<br />
              <em style={{ fontStyle: 'normal', color: 'rgba(255,255,255,0.45)' }}>OTHERS</em><br />
              IMAGINE.
            </h1>
            <p style={{ fontSize: 'clamp(11px, 1vw, 15px)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em', lineHeight: 1.7, maxWidth: '24ch', fontWeight: 300, margin: 0, fontFamily: 'var(--font-nevera)' }}>
              Creative developer. WebGL artist.<br />
              Turning interfaces into experiences.
            </p>
          </div>
        </div>

      </div>
    </Html>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LandscapeTextOverlay
//
// A pure React component (NOT inside Canvas) that renders HTML text over the
// 3D scene. Uses requestAnimationFrame to read scrollRef and drives opacity +
// translateY animations. Text appears when scroll passes ~0.35 (landscape view).
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ZoomInTextOverlay
//
// Pure React HTML overlay for the initial zoom-in view (scroll ≈ 0).
// Visible on load, fades out as user scrolls past ~0.25.
// ─────────────────────────────────────────────────────────────────────────────
function ZoomInTextOverlay({ scrollRef }) {
  const wrapRef  = useRef(null);
  const eyeRef   = useRef(null);
  const h1Ref    = useRef(null);
  const subRef   = useRef(null);

  useEffect(() => {
    let rafId;
    const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    // Fade OUT as user scrolls (1 at sp=0, 0 at sp=0.25)
    const fadeOut = (sp, start, end) => 1 - ease(clamp01((sp - start) / (end - start)));
    // Initial fade IN on mount (just opacity transition via CSS)
    const fadeIn  = (sp, start, end) => ease(clamp01((sp - start) / (end - start)));

    const tick = () => {
      const sp = scrollRef.current;
      const fo = fadeOut(sp, 0.10, 0.30);

      if (wrapRef.current)  wrapRef.current.style.opacity  = String(fo);
      if (wrapRef.current)  wrapRef.current.style.pointerEvents = fo < 0.05 ? 'none' : 'none';

      // Stagger slide-up on scroll out
      if (eyeRef.current)  eyeRef.current.style.transform  = `translateY(${(1 - fo) * -20}px)`;
      if (h1Ref.current)   h1Ref.current.style.transform   = `translateY(${(1 - fo) * -28}px)`;
      if (subRef.current)  subRef.current.style.transform  = `translateY(${(1 - fo) * -14}px)`;

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [scrollRef]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'absolute',
        top: '50%',
        left: '7%',
        transform: 'translateY(-50%)',
        zIndex: 5,
        pointerEvents: 'none',
        color: 'white',
        fontFamily: 'var(--font-nevera)',
        // Fade in on mount via CSS animation
        animation: 'zoomInFadeIn 1.2s ease forwards',
      }}
    >
      <style>{`
        @keyframes zoomInFadeIn {
          from { opacity: 0; transform: translateY(calc(-50% + 20px)); }
          to   { opacity: 1; transform: translateY(-50%); }
        }
      `}</style>

      {/* Eyebrow */}
      <p
        ref={eyeRef}
        style={{
          fontSize: 'clamp(9px, 0.72vw, 12px)',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.38)',
          margin: '0 0 18px 0',
        }}
      >
        VGR / DIGITAL CRAFTSMAN
      </p>

      {/* Big headline */}
      <h1
        ref={h1Ref}
        style={{
          fontSize: 'clamp(2.4rem, 5.2vw, 86px)',
          fontWeight: 400,
          letterSpacing: '-0.045em',
          lineHeight: 0.88,
          margin: '0 0 22px 0',
          color: '#ffffff',
          textTransform: 'uppercase',
        }}
      >
        I BUILD<br />
        WHAT<br />
        <span style={{ color: 'rgba(255,255,255,0.38)' }}>OTHERS</span><br />
        IMAGINE.
      </h1>

      {/* Sub-line */}
      <p
        ref={subRef}
        style={{
          fontSize: 'clamp(10px, 0.95vw, 15px)',
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.04em',
          lineHeight: 1.7,
          maxWidth: '22ch',
          fontWeight: 300,
          margin: 0,
        }}
      >
        Creative developer. WebGL artist.<br />
        Turning interfaces into experiences.
      </p>
    </div>
  );
}

function LandscapeTextOverlay({ scrollRef }) {

  const wrapRef    = useRef(null);
  const labelRef   = useRef(null);
  const line1Ref   = useRef(null);
  const line2Ref   = useRef(null);
  const descRef    = useRef(null);

  useEffect(() => {
    let rafId;
    const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const reveal = (sp, start, end) => ease(clamp01((sp - start) / (end - start)));

    const tick = () => {
      const sp = scrollRef.current;

      const r1 = reveal(sp, 0.35, 0.50);
      const r2 = reveal(sp, 0.40, 0.55);
      const r3 = reveal(sp, 0.45, 0.60);
      const r4 = reveal(sp, 0.50, 0.65);

      // Show/hide the whole wrapper
      if (wrapRef.current) {
        wrapRef.current.style.opacity = sp < 0.32 ? '0' : '1';
      }

      if (labelRef.current) {
        labelRef.current.style.opacity  = String(r1);
        labelRef.current.style.transform = `translateY(${(1 - r1) * 30}px)`;
      }
      if (line1Ref.current) {
        line1Ref.current.style.opacity  = String(r2);
        line1Ref.current.style.transform = `translateY(${(1 - r2) * 30}px)`;
      }
      if (line2Ref.current) {
        line2Ref.current.style.opacity  = String(r3);
        line2Ref.current.style.transform = `translateY(${(1 - r3) * 30}px)`;
      }
      if (descRef.current) {
        descRef.current.style.opacity  = String(r4);
        descRef.current.style.transform = `translateY(${(1 - r4) * 30}px)`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [scrollRef]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'absolute',
        bottom: '10%',
        right: '6%',
        maxWidth: '42vw',
        textAlign: 'right',
        zIndex: 5,
        pointerEvents: 'none',
        color: 'white',
        fontFamily: 'var(--font-nevera)',
        opacity: 0,
      }}
    >
      {/* Eyebrow */}
      <p
        ref={labelRef}
        style={{
          fontSize: 'clamp(9px, 0.75vw, 12px)',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.38)',
          margin: '0 0 14px 0',
          opacity: 0,
        }}
      >
        The Work / The Vision
      </p>

      {/* Headline line 1 */}
      <h2
        ref={line1Ref}
        style={{
          fontSize: 'clamp(28px, 4.5vw, 76px)',
          fontWeight: 400,
          letterSpacing: '-0.04em',
          lineHeight: 0.9,
          margin: 0,
          color: '#ffffff',
          textTransform: 'uppercase',
          opacity: 0,
        }}
      >
        EVERY PIXEL
      </h2>

      {/* Headline line 2 */}
      <h2
        ref={line2Ref}
        style={{
          fontSize: 'clamp(28px, 4.5vw, 76px)',
          fontWeight: 400,
          letterSpacing: '-0.04em',
          lineHeight: 0.9,
          margin: '0 0 20px 0',
          color: 'rgba(255,255,255,0.42)',
          textTransform: 'uppercase',
          opacity: 0,
        }}
      >
        IS INTENTIONAL.
      </h2>

      {/* Description */}
      <p
        ref={descRef}
        style={{
          fontSize: 'clamp(11px, 1vw, 16px)',
          lineHeight: 1.7,
          color: 'rgba(255,255,255,0.5)',
          fontWeight: 300,
          margin: 0,
          maxWidth: '36ch',
          marginLeft: 'auto',
          letterSpacing: '0.02em',
          opacity: 0,
        }}
      >
        I don&apos;t decorate screens — I engineer presence.<br />
        Every project I ship is a calculated statement.
      </p>
    </div>
  );
}

function SceneBackground() {

  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color("#060d1f");
    scene.fog = new THREE.FogExp2("#060d1f", 0.018);
  }, [scene]);
  return (
    <>
      {/* Blue hemisphere — sky from above, deep blue from ground */}
      <hemisphereLight
        skyColor="#1a3a6e"
        groundColor="#0a1a3a"
        intensity={0.6}
      />
      {/* Low blue fill lights on the horizon to simulate sky glow */}
      <pointLight position={[-20, -2, -30]} color="#1040ff" intensity={4.0} distance={80} decay={2} />
      <pointLight position={[ 20, -2, -30]} color="#0066ff" intensity={3.0} distance={80} decay={2} />
      <pointLight position={[  0,  8, -50]} color="#204090" intensity={5.0} distance={100} decay={1.5} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// About Page
// Uses a self-contained scroll container so Lenis never interferes.
// The container itself scrolls (not the body), so no page navigation occurs.
// ─── ProfileSection (Animated Layout) ───────────────────────────────────────────
function ProfileSection() {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Trigger animation when 30% of the section is visible
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
          
          // Wait for the CSS reveal to finish, then start a continuous float animation
          setTimeout(() => {
            if (titleRef.current) {
              gsap.to(titleRef.current, { y: "-=15", duration: 3, yoyo: true, repeat: -1, ease: "sine.inOut" });
            }
            if (leftRef.current) {
              gsap.to(leftRef.current, { y: "-=10", duration: 4, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.5 });
            }
            if (rightRef.current) {
              gsap.to(rightRef.current, { y: "-=10", duration: 3.5, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1.2 });
            }
          }, 1500);
        }
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div 
      ref={sectionRef}
      style={{ 
        minHeight: "100vh", 
        width: "100%", 
        backgroundColor: "#000000",
        position: "relative",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end", // image at bottom
        alignItems: "center",
        padding: "0", 
        boxShadow: "0 -20px 40px rgba(0,0,0,0.5)",
        overflow: "hidden"
      }}
    >
      {/* Top Greeting */}
      <div
        ref={titleRef}
        style={{
          position: "absolute",
          top: "10%",
          zIndex: 3,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(40px)",
          transition: "opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.1s, transform 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.1s"
        }}
      >
        <h2 style={{
          fontFamily: "var(--font-nevera)",
          fontSize: "clamp(3rem, 7vw, 7rem)",
          color: "#ffffff",
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
          lineHeight: "1.1",
        }}>
          Hi, I am Gokulraj.
        </h2>
      </div>

      {/* Left Text Block */}
      <div 
        ref={leftRef}
        style={{
          position: "absolute",
          left: "8%",
          top: "40%",
          width: "25%",
          minWidth: "250px",
          zIndex: 3,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateX(0)" : "translateX(-40px)",
          transition: "opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s, transform 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s"
        }}
      >
        <h3 style={{ color: "#ffffff", fontSize: "1.5rem", marginBottom: "1rem", fontFamily: "var(--font-mono)" }}>Digital Craftsman</h3>
        <p style={{
          fontFamily: "var(--font-sans)",
          fontWeight: "300",
          fontSize: "1.1rem",
          color: "#9ca3af",
          lineHeight: "1.8",
        }}>
          I am a creative developer dedicated to building premium web experiences. I blend code, motion, and design to create interfaces that leave a lasting impression.
        </p>
      </div>

      {/* Right Text Block */}
      <div 
        ref={rightRef}
        style={{
          position: "absolute",
          right: "8%",
          top: "45%",
          width: "25%",
          minWidth: "250px",
          textAlign: "right",
          zIndex: 3,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateX(0)" : "translateX(40px)",
          transition: "opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s, transform 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s"
        }}
      >
        <h3 style={{ color: "#ffffff", fontSize: "1.5rem", marginBottom: "1rem", fontFamily: "var(--font-mono)" }}>The Playground</h3>
        <p style={{
          fontFamily: "var(--font-sans)",
          fontWeight: "300",
          fontSize: "1.1rem",
          color: "#9ca3af",
          lineHeight: "1.8",
        }}>
          Welcome to my digital playground. Every animation, transition, and layout is meticulously crafted to break the boundaries of traditional web design.
        </p>
      </div>

      {/* The Image */}
      <img 
        src="/images/VGR.png" 
        alt="Gokulraj" 
        style={{ 
          maxWidth: "100%", 
          maxHeight: "85vh", // Big and clear at the bottom
          objectFit: "contain",
          zIndex: 2, 
          pointerEvents: "none",
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(80px)",
          transition: "all 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s"
        }} 
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The main About Page
// ─────────────────────────────────────────────────────────────────────────────
export default function About() {
  const scrollRef    = useRef(0);
  const containerRef = useRef(null);

  return (
    // height:100vh + overflow:hidden on this element means it doesn't
    // contribute to the body scroll height that Lenis manages.
    <div
      style={{
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#060d1f",
      }}
    >
      
      {/* Invisible scroll capture: sits above the canvas, reads its own scrollTop */}
      <div
        ref={containerRef}
        data-lenis-prevent          // tell Lenis to leave this element alone
        onScroll={(e) => {
          const el = e.currentTarget;
          // Calculate progress only over the first 300vh.
          // This ensures the 3D scene finishes exactly before the new section slides up.
          const max3DScroll = el.clientHeight * 3; 
          const prog = el.scrollTop / max3DScroll;
          scrollRef.current = isNaN(prog) ? 0 : Math.min(1, Math.max(0, prog));
        }}
        style={{
          position:   "absolute",
          inset:      0,
          overflowY:  "scroll",
          zIndex:     10,
          // Hide scrollbar visually but keep functionality
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Spacer creates scroll distance without visible content for the 3D animation */}
        <div style={{ height: "300vh", pointerEvents: "none" }} />
        
        {/* Extra pause so the user can admire the landscape view before the next page slides up */}
        <div style={{ height: "50vh", pointerEvents: "none" }} />

        {/* NEW PAGE SECTION: VGR Image & Intro */}
        <ProfileSection />
      </div>

      {/* Canvas is behind the scroll container but listens to it for pointer events */}
      <Canvas
        eventSource={containerRef}
        eventPrefix="client"
        shadows="soft"
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        camera={{ position: [0, 0.5, 4.5], fov: 52, near: 0.1, far: 500 }}
        gl={{
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.85,
        }}
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      >
        <SceneBackground />
        <CameraRig        scrollRef={scrollRef} />
        <SceneFog         scrollRef={scrollRef} />
        <DynamicLighting  scrollRef={scrollRef} />
        <DustParticles    scrollRef={scrollRef} />
        <GroundFog        scrollRef={scrollRef} />
        <LiquidStones     scrollRef={scrollRef} />
        <SphereObject     scrollRef={scrollRef} />

        <Suspense fallback={null}>
          <LandscapeScene scrollRef={scrollRef} />
        </Suspense>

        {/* New Elements */}
        <BackgroundStars scrollRef={scrollRef} />

        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />

        <EffectComposer multisampling={8}>
          <N8AO aoRadius={0.5} intensity={2.4} distanceFalloff={1.0} aoSamples={16} denoiseSamples={4} halfRes />
          <DepthOfField
            focusDistance={0.012}    // normalised [0,1] — focus on crystal
            focalLength={0.022}      // smaller = shallower depth of field
            bokehScale={3.5}         // bokeh disc size
            height={480}
          />
          <Bloom luminanceThreshold={0.88} luminanceSmoothing={0.3} mipmapBlur intensity={0.9} radius={0.65} />
          <ChromaticAberration
            offset={[0.0006, 0.0006]}  // subtle RGB split at edges
            radialModulation
            modulationOffset={0.18}
          />
          <Vignette eskil={false} offset={0.25} darkness={0.75} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>

      {/* HTML Landscape Text Overlay — always above canvas, driven by scrollRef via RAF */}
      <ZoomInTextOverlay    scrollRef={scrollRef} />
      <LandscapeTextOverlay scrollRef={scrollRef} />
    </div>
  );
}

useGLTF.preload("/models/landscape.glb");
