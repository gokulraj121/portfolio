"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Environment, useGLTF } from "@react-three/drei";

const PARTICLE_COUNT = 6000;

// Box-Muller transform for Gaussian distribution
function gaussianRandom(mean = 0, std = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── GLSL Vertex Shader ───────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMouse;

  attribute vec3  aOffset;
  attribute float aSpeed;
  attribute float aScale;
  attribute float aBrightnessSeed;

  varying float vBrightness;
  varying float vScale;
  varying float vColorSeed;

  // ── Hash & noise ──────────────────────────────────────────────────────────
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0 + i.z * 113.0;
    return mix(
      mix(mix(hash(n),       hash(n + 1.0),  f.x),
          mix(hash(n + 57.0),hash(n + 58.0), f.x), f.y),
      mix(mix(hash(n + 113.0),hash(n + 114.0),f.x),
          mix(hash(n + 170.0),hash(n + 171.0),f.x), f.y), f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 4; i++) {
      v += a * noise3(p);
      p  = p * 2.1 + shift;
      a *= 0.5;
    }
    return v;
  }

  // ── Curl noise — divergence-free, creates swirling organic streams ────────
  vec3 curl(vec3 p) {
    const float e = 0.01;
    vec3 dx = vec3(e, 0, 0);
    vec3 dy = vec3(0, e, 0);
    vec3 dz = vec3(0, 0, e);
    float x = fbm(p + dy) - fbm(p - dy) - fbm(p + dz) + fbm(p - dz);
    float y = fbm(p + dz) - fbm(p - dz) - fbm(p + dx) + fbm(p - dx);
    float z = fbm(p + dx) - fbm(p - dx) - fbm(p + dy) + fbm(p - dy);
    return normalize(vec3(x, y, z) / (2.0 * e));
  }

  void main() {
    float t = uTime * aSpeed * 0.18;

    // ── 1. Sample curl at the particle's HOME position (evolving slowly) ──
    vec3 noiseCoord = aOffset * 0.7 + vec3(t * 0.12, t * 0.08, t * 0.05);
    vec3 flow = curl(noiseCoord);

    // ── 2. Oscillating spring — particle swings around its seed point ─────
    float swingAmt = 0.45 + 0.35 * sin(t * 0.4 + aBrightnessSeed * 6.28);
    vec3 displacement = flow * swingAmt;

    // ── 3. Final world position ───────────────────────────────────────────
    vec3 pos = aOffset + displacement;

    // ── 4. Subtle mouse push (particles near cursor scatter slightly) ─────
    vec2 toMouse = uMouse - aOffset.xy * 0.25;
    float mouseDist = length(toMouse);
    float mousePush = smoothstep(0.8, 0.0, mouseDist) * 0.35;
    pos.xy -= normalize(toMouse + 0.001) * mousePush;

    // ── 5. Brightness — bright in dense centre, dimmer at edges ──────────
    float centerDist = length(aOffset.xy) / 2.5;
    float baseBright = fbm(noiseCoord * 1.8);
    vBrightness = mix(baseBright, 1.0, smoothstep(1.0, 0.0, centerDist));
    vBrightness = clamp(vBrightness, 0.15, 1.0);

    vScale = aScale;
    vColorSeed = aBrightnessSeed;

    // Scale the sphere and position it
    vec3 transformed = position * aScale + pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

// ─── GLSL Fragment Shader ─────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
  varying float vBrightness;
  varying float vScale;
  varying float vColorSeed;

  void main() {
    vec3 baseGreen = vec3(0.05, 0.6, 0.25);
    vec3 hotGreen  = vec3(0.3, 1.0, 0.6);
    float alpha = 0.9;
    vec3 col;

    if (vColorSeed < 0.70) {
      // 70% chance: Grey
      col = vec3(vBrightness * 0.8);
      col = mix(col, vec3(1.0), smoothstep(0.65, 1.0, vBrightness));
    } else if (vColorSeed < 0.90) {
      // 20% chance: Thick Green
      col = vec3(0.0, 0.35, 0.15);
      alpha = 1.0; // Fully opaque for a thick look
    } else {
      // 10% chance: Black / Very Dark Grey
      col = vec3(vBrightness * 0.10);
    }

    // Soft alpha falloff at sphere edges (spherical silhouette) for non-green particles
    float edge = mix(0.85, 0.7, clamp(vScale / 0.06, 0.0, 1.0));
    
    // If it's a green particle, force it to be 100% solid and opaque (no edge fade)
    if (vColorSeed >= 0.70 && vColorSeed < 0.90) {
      edge = 1.0;
      alpha = 1.0;
    }
    
    gl_FragColor = vec4(col, alpha * edge);
  }
`;

// ─── Particle Mesh Component ──────────────────────────────────────────────────
function NebulaParticles({ mouse }) {
  const meshRef = useRef();

  const { geometry } = useMemo(() => {
    const offsets        = new Float32Array(PARTICLE_COUNT * 3);
    const speeds         = new Float32Array(PARTICLE_COUNT);
    const scales         = new Float32Array(PARTICLE_COUNT);
    const brightSeeds    = new Float32Array(PARTICLE_COUNT);

    const tiltAngle = Math.PI / 5.5;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const along  = gaussianRandom(0, 2.0);
      const across = gaussianRandom(0, 0.55);
      const depth  = gaussianRandom(0, 0.7);

      const x = along * Math.cos(tiltAngle) - across * Math.sin(tiltAngle);
      const y = along * Math.sin(tiltAngle) + across * Math.cos(tiltAngle);
      const z = depth;

      offsets[i * 3]     = x;
      offsets[i * 3 + 1] = y;
      offsets[i * 3 + 2] = z;

      speeds[i] = 0.25 + Math.random() * 0.75;
      const t = Math.pow(Math.random(), 2.5);
      scales[i] = 0.008 + t * 0.065;
      brightSeeds[i] = Math.random();
    }

    const geo = new THREE.SphereGeometry(1, 5, 5); // low-poly sphere for perf
    geo.setAttribute("aOffset",         new THREE.InstancedBufferAttribute(offsets,     3));
    geo.setAttribute("aSpeed",          new THREE.InstancedBufferAttribute(speeds,      1));
    geo.setAttribute("aScale",          new THREE.InstancedBufferAttribute(scales,      1));
    geo.setAttribute("aBrightnessSeed", new THREE.InstancedBufferAttribute(brightSeeds, 1));

    return { geometry: geo };
  }, []);

  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material;
    mat.uniforms.uTime.value = state.clock.elapsedTime;

    const target = mouse.current;
    mat.uniforms.uMouse.value.x = THREE.MathUtils.lerp(mat.uniforms.uMouse.value.x, target.x, 0.04);
    mat.uniforms.uMouse.value.y = THREE.MathUtils.lerp(mat.uniforms.uMouse.value.y, target.y, 0.04);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, null, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

// ─── Alien Tech Wireframe Monoliths ───────────────────────────────────────────
function WireframeMonoliths() {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    // Slow, ominous rotation
    groupRef.current.rotation.y = t * 0.04;
    groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.1;
    groupRef.current.rotation.z = Math.cos(t * 0.06) * 0.05;
  });

  // Pre-calculate random positions for the fragments so they don't jump on re-renders
  const fragments = useMemo(() => {
    return Array.from({ length: 12 }).map(() => ({
      pos: [
        (Math.random() - 0.5) * 14, 
        (Math.random() - 0.5) * 14, 
        -2 + (Math.random() - 0.5) * 6
      ],
      rot: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
      scale: 0.2 + Math.random() * 0.6
    }));
  }, []);

  return (
    <group ref={groupRef} position={[0, 0, -3]}>
      {/* Central massive glowing box */}
      <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <boxGeometry args={[4.5, 4.5, 4.5]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.12} />
      </mesh>
      
      {/* Outer massive rotating cage */}
      <mesh rotation={[0, Math.PI / 3, 0]}>
        <boxGeometry args={[7, 7, 7]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.06} />
      </mesh>

      {/* Floating geometric fragments */}
      {fragments.map((frag, i) => (
        <mesh key={i} position={frag.pos} rotation={frag.rot}>
          <boxGeometry args={[frag.scale, frag.scale, frag.scale]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Animated Liquid Tube ───────────────────────────────────────────────────
function AnimatedLiquidTube() {
  const groupRef = useRef();
  const liquidMaterialRef = useRef();

  // Create the exact path mimicking the image (top-left down to the widget dot)
  const tubeGeometry = useMemo(() => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.0, 3.0, -1.0), // Top left
      new THREE.Vector3(-1.0, 0.5, 0),    // Mid curve
      new THREE.Vector3(2.5, -1.2, 0),    // Exactly behind the "Available for Work" widget dot
      new THREE.Vector3(3.5, -3.0, 0)     // Offscreen bottom right
    ], false, 'catmullrom', 0.5);
    
    // Outer glass radius 0.15
    return new THREE.TubeGeometry(path, 128, 0.15, 32, false);
  }, []);

  const innerTubeGeometry = useMemo(() => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.0, 3.0, -1.0),
      new THREE.Vector3(-1.0, 0.5, 0),
      new THREE.Vector3(2.5, -1.2, 0),
      new THREE.Vector3(3.5, -3.0, 0)
    ], false, 'catmullrom', 0.5);
    
    // Inner liquid core slightly smaller (radius 0.10)
    return new THREE.TubeGeometry(path, 128, 0.10, 16, false);
  }, []);

  const liquidShader = useMemo(() => {
    return {
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color("#00ff66") } // Alien liquid green
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
          // Creates distinct blobs/pulses of liquid moving rapidly along the tube
          float liquid = sin(vUv.x * 30.0 - time * 8.0);
          liquid = smoothstep(0.7, 0.9, liquid); // Make the liquid chunks sharp and bright
          
          gl_FragColor = vec4(color * liquid * 1.5, liquid * 0.9);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (liquidMaterialRef.current) {
      liquidMaterialRef.current.uniforms.time.value = t;
    }
  });

  return (
    // Positioned absolutely in the world to align with the UI corner
    <group ref={groupRef} position={[0, 0, -1]}>
      {/* Outer Glass Shell */}
      <mesh>
        <bufferGeometry attach="geometry" {...tubeGeometry} />
        <meshPhysicalMaterial 
          transmission={1.0}
          opacity={1.0}
          transparent={true}
          roughness={0.02}
          metalness={0.05}
          ior={1.4}
          thickness={0.2}
          color="#ddffff"
          envMapIntensity={2.0}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
        />
      </mesh>
      
      {/* Inner Animated Liquid Core */}
      <mesh>
        <bufferGeometry attach="geometry" {...innerTubeGeometry} />
        <shaderMaterial ref={liquidMaterialRef} args={[liquidShader]} />
      </mesh>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ mouse }) {
  return (
    <>
      <NebulaParticles mouse={mouse} />
      
      {/* Environment map is absolutely required for any remaining physical materials to refract light */}
      <Environment background={false} resolution={256}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <pointLight intensity={2} position={[5, 5, 5]} color="#ffffff" />
          <pointLight intensity={5} position={[-5, 5, -5]} color="#00ff66" />
        </group>
      </Environment>

      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.85}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────
export default function ParticleField({ style = {} }) {
  const mouse = useRef(new THREE.Vector2(0, 0));
  const click = useRef({ x: 0, y: 0, time: -1 });

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth)  * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onClick = (e) => {
      click.current = {
        x: (e.clientX / window.innerWidth)  * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
        time: performance.now(),
      };
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        ...style,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent", width: "100%", height: "100%" }}
      >
        <Scene mouse={mouse} />
      </Canvas>
    </div>
  );
}
