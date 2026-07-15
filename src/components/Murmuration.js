"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Html } from "@react-three/drei";
import { useRouter, usePathname } from "next/navigation";
import { globalStore } from "@/utils/store";
import gsap from "gsap";

const TOTAL = 15000;

// Fixed world positions for each constellation cluster
const CLUSTER_POSITIONS = [
  new THREE.Vector3(-2.8,  1.2, 0), // 0 = Work    (top-left)
  new THREE.Vector3( 2.8,  1.2, 0), // 1 = About   (top-right)
  new THREE.Vector3( 0.0, -1.8, 0), // 2 = Contact (bottom-center)
];
const CLUSTER_ROUTES = ["/work", "/about", "/contact"];
const CLUSTER_LABELS = ["WORK",  "ABOUT",  "CONTACT"];

// ─── Vertex Shader ────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uMorphState;      // 0 → 1  VGR load animation
  uniform float uExplodeState;    // 0 → 1  constellation explosion
  uniform vec3  uExplosionOrigin; // swarm center at click time

  attribute vec3  aOffset;
  attribute vec3  aTargetOffset;   // VGR text target
  attribute vec3  aClusterOffset;  // position inside cluster sphere
  attribute float aClusterGroup;   // 0 = Work, 1 = About, 2 = Contact
  attribute float aScale;

  varying float vAlpha;
  varying float vClusterGroup;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  mat3 rotY(float a) {
    float s = sin(a), c = cos(a);
    return mat3(c, 0.0, s,  0.0, 1.0, 0.0,  -s, 0.0, c);
  }
  mat3 rotX(float a) {
    float s = sin(a), c = cos(a);
    return mat3(1.0, 0.0, 0.0,  0.0, c, -s,  0.0, s, c);
  }

  void main() {
    vec3 pos = rotY(uTime * 0.2) * rotX(uTime * 0.15) * aOffset;
    float originalLen = length(pos);

    float wobble = sin(pos.x * 2.0 + uTime * 1.5)
                 * cos(pos.y * 1.8 + uTime * 1.2)
                 * sin(pos.z * 2.2 - uTime * 1.4);
    pos += normalize(pos + 0.001) * wobble * 0.45;

    vec3 jitter = vec3(
      sin(uTime * 15.0 + aOffset.y * 10.0),
      cos(uTime * 16.0 + aOffset.z * 10.0),
      sin(uTime * 17.0 + aOffset.x * 10.0)
    ) * 0.02;
    pos += jitter;

    vec3 center = vec3(
      sin(uTime * 0.14) * 2.8,
      cos(uTime * 0.09) * 1.2,
      sin(uTime * 0.07) * 0.4
    );
    vec3 worldPos = center + pos;

    // ── Portal Transition ─────────────────────────────────────────────────────
    float warp = uTransitionProgress;
    float stableAngle = atan(aOffset.y, aOffset.x);
    float particleId = hash(aOffset.x * 123.4 + aOffset.y * 567.8);
    float isRing = step(0.5, particleId);

    float formRing = smoothstep(0.0, 0.3, warp);
    float ringRadius = 3.5;
    float normalizedId = (particleId - 0.5) * 2.0;
    float angleWobble = sin(stableAngle * 2.0) * 0.3 + cos(stableAngle * 5.0) * 0.15;
    float baseThickness = 0.5 + angleWobble;
    float splatterArea = pow(sin(stableAngle * 3.0 + 1.0) * 0.5 + 0.5, 8.0);
    float tentacle = splatterArea * pow(normalizedId, 4.0) * 2.5;
    float rDistance = ringRadius + (normalizedId - 0.5) * baseThickness + tentacle;
    vec3 ringPos = vec3(cos(stableAngle) * rDistance, sin(stableAngle) * rDistance, 0.0);
    ringPos += vec3(
      sin(uTime * 2.0 + stableAngle * 4.0),
      cos(uTime * 2.2 + stableAngle * 4.0),
      sin(uTime * 1.5 + stableAngle * 2.0)
    ) * 0.08;
    vec3 ringParticlePos = mix(worldPos, ringPos, formRing);

    float diverNormId = particleId * 2.0;
    float diveDelay = diverNormId * 0.4;
    float particleDive = smoothstep(0.1 + diveDelay, 0.6 + diveDelay, warp);
    float diveSpin = particleDive * 40.0;
    float funnelTargetAngle = 1.0;
    float streamVariance = (diverNormId - 0.5) * 2.0 * (1.0 - particleDive);
    float currentAngle = mix(stableAngle, funnelTargetAngle + diveSpin + streamVariance, particleDive);
    float startRadius = length(worldPos.xy);
    float diveRadius = mix(startRadius, 0.0, particleDive);
    vec3 divePos = vec3(
      cos(currentAngle) * diveRadius,
      sin(currentAngle) * diveRadius,
      mix(worldPos.z, -50.0, particleDive)
    );
    vec3 diverParticlePos = mix(worldPos, divePos, particleDive);

    float ringDelay = (1.0 - normalizedId) * 0.3;
    float ringCollapse = smoothstep(0.6 + ringDelay, 0.95 + ringDelay, warp);
    float ringCollapseSpin = ringCollapse * 30.0;
    float collapsingRadius = rDistance * (1.0 - ringCollapse);
    vec3 collapsedRingPos = vec3(
      cos(stableAngle + ringCollapseSpin) * collapsingRadius,
      sin(stableAngle + ringCollapseSpin) * collapsingRadius,
      mix(0.0, -50.0, ringCollapse)
    );
    ringParticlePos = mix(ringParticlePos, collapsedRingPos, ringCollapse);
    worldPos = mix(diverParticlePos, ringParticlePos, isRing);

    // ── VGR Morphing ─────────────────────────────────────────────────────────
    worldPos = mix(worldPos, aTargetOffset, uMorphState);

    // ── Constellation Explosion ─────────────────────────────────────────────────
    // Clusters open relative to where the swarm was when clicked
    vec3 relOffset = vec3(0.0);
    if      (aClusterGroup < 0.5) relOffset = vec3(-1.5,  0.9, 0.0); // Work
    else if (aClusterGroup < 1.5) relOffset = vec3( 1.5,  0.9, 0.0); // About
    else                          relOffset = vec3( 0.0, -0.9, 0.0); // Contact

    // Gentle breathing pulse within each cluster
    float pulse = 1.0 + sin(uTime * 1.8 + aClusterGroup * 2.1) * 0.07 * uExplodeState;
    vec3 explodedPos = uExplosionOrigin + relOffset + aClusterOffset * pulse;

    worldPos = mix(worldPos, explodedPos, uExplodeState);

    vClusterGroup = aClusterGroup;

    // ── Alpha ─────────────────────────────────────────────────────────────────
    float diverAlphaFade = (1.0 - smoothstep(0.5 + diveDelay, 0.6 + diveDelay, warp));
    float ringAlphaFade  = smoothstep(0.0, 0.2, normalizedId) * smoothstep(1.0, 0.8, normalizedId);
    ringAlphaFade = mix(1.0, ringAlphaFade, formRing);
    ringAlphaFade *= (1.0 - smoothstep(0.8 + ringDelay, 0.95 + ringDelay, warp));
    float alphaFade = mix(diverAlphaFade, ringAlphaFade, isRing);
    vAlpha = smoothstep(2.5, 0.5, originalLen + wobble) * alphaFade;
    vAlpha = mix(vAlpha, 1.0, uMorphState);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * aScale + worldPos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uColor, vAlpha * 0.88);
  }
`;

// ─── VGR Text Coordinates ─────────────────────────────────────────────────────
function getTextCoordinates(text, count) {
  if (typeof window === "undefined") return new Float32Array(count * 3);
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "black"; ctx.fillRect(0, 0, 512, 256);
  ctx.font = "900 160px Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "white"; ctx.fillText(text, 256, 128);
  const { data } = ctx.getImageData(0, 0, 512, 256);
  const px = [];
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 512; x++)
      if (data[(y * 512 + x) * 4] > 128)
        px.push({ x: (x / 512 - 0.5) * 6, y: -(y / 256 - 0.5) * 3 });
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = px[Math.floor(Math.random() * px.length)] || { x: 0, y: 0 };
    out[i*3]   = p.x + (Math.random()-0.5)*0.06;
    out[i*3+1] = p.y + (Math.random()-0.5)*0.06;
    out[i*3+2] = (Math.random()-0.5)*0.15;
  }
  return out;
}

// ─── Nav Label Text Coordinates (smaller scale than VGR) ────────────────────
function getNavTextCoordinates(text, count) {
  if (typeof window === "undefined") return new Float32Array(count * 3);
  const W = 380, H = 120;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "black"; ctx.fillRect(0, 0, W, H);
  ctx.font = "900 64px Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "white"; ctx.fillText(text, W / 2, H / 2);
  const { data } = ctx.getImageData(0, 0, W, H);
  const px = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[(y * W + x) * 4] > 128)
        px.push({ x: (x / W - 0.5) * 2.2, y: -(y / H - 0.5) * 0.75 });
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = px[Math.floor(Math.random() * px.length)] || { x: 0, y: 0 };
    out[i*3]   = p.x + (Math.random()-0.5)*0.04;
    out[i*3+1] = p.y + (Math.random()-0.5)*0.04;
    out[i*3+2] = (Math.random()-0.5)*0.07;
  }
  return out;
}

// ─── Geometry Builder ─────────────────────────────────────────────────────────
function buildGeometry() {
  const offsets         = new Float32Array(TOTAL * 3);
  const scales          = new Float32Array(TOTAL);
  const clusterGroups   = new Float32Array(TOTAL);
  const clusterOffsets  = new Float32Array(TOTAL * 3);
  const clusterSize     = Math.floor(TOTAL / 3);

  // Rounded-rectangle button dimensions (world units)
  const BTN_HW = 0.72;  // half-width  → total width  ~1.44
  const BTN_HH = 0.22;  // half-height → total height ~0.44
  const BTN_R  = 0.12;  // corner radius
  // Inner rect to clamp against (shrunk by radius)
  const IW = BTN_HW - BTN_R;
  const IH = BTN_HH - BTN_R;

  function insideRoundedRect(x, y) {
    // nearest point on the inner rectangle
    const cx = Math.max(-IW, Math.min(IW, x));
    const cy = Math.max(-IH, Math.min(IH, y));
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) <= BTN_R;
  }

  // Pre-generate positions for all three button shapes via rejection sampling
  const buttonPoints = [];
  let attempts = 0;
  while (buttonPoints.length < TOTAL && attempts < TOTAL * 10) {
    attempts++;
    const x = (Math.random() - 0.5) * BTN_HW * 2;
    const y = (Math.random() - 0.5) * BTN_HH * 2;
    if (insideRoundedRect(x, y)) {
      buttonPoints.push(x, y);
    }
  }

  for (let i = 0; i < TOTAL; i++) {
    const r = Math.cbrt(Math.random()) * 0.8;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    offsets[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    offsets[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    offsets[i*3+2] = r * Math.cos(phi);
    scales[i] = 0.005 + Math.random() * 0.015;

    // Assign to cluster by sequential index
    clusterGroups[i] = Math.min(Math.floor(i / clusterSize), 2);

    // Pick a point from the pre-sampled rounded rect pool
    const pIdx = (i % buttonPoints.length) * 2;
    clusterOffsets[i*3]   = buttonPoints[pIdx]   ?? 0;
    clusterOffsets[i*3+1] = buttonPoints[pIdx+1] ?? 0;
    clusterOffsets[i*3+2] = (Math.random() - 0.5) * 0.04; // tiny z depth
  }

  // Start with empty cluster offsets – filled dynamically via useEffect
  const geo = new THREE.SphereGeometry(1, 4, 3);
  geo.setAttribute("aOffset",        new THREE.InstancedBufferAttribute(offsets,                          3));
  geo.setAttribute("aTargetOffset",  new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 3),      3));
  geo.setAttribute("aClusterGroup",  new THREE.InstancedBufferAttribute(clusterGroups,                    1));
  geo.setAttribute("aClusterOffset", new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 3),      3));
  geo.setAttribute("aScale",         new THREE.InstancedBufferAttribute(scales,                           1));
  return geo;
}

// ─── Swarm Mesh ───────────────────────────────────────────────────────────────
function FlexibleSphereMesh({ transitionRef, isExploded, showVGR, explosionOrigin, clockRef, swarmColor }) {
  const meshRef = useRef();
  const geo     = useMemo(() => buildGeometry(), []);
  const [vgrTargets,     setVgrTargets]     = useState(null);
  const [clusterTargets, setClusterTargets] = useState(null);

  const uniforms = useMemo(() => ({
    uTime:               { value: 0 },
    uTransitionProgress: { value: 0 },
    uMorphState:         { value: 0.0 },
    uExplodeState:       { value: 0.0 },
    uExplosionOrigin:    { value: new THREE.Vector3(0, 0, 0) },
    uColor:              { value: new THREE.Color(swarmColor || "#000000") },
  }), []);

  // Update color uniform dynamically
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uColor.value.set(swarmColor || "#000000");
    }
  }, [swarmColor]);

  // Update uExplosionOrigin in uniforms when state changes
  useEffect(() => {
    if (explosionOrigin) {
      meshRef.current.material.uniforms.uExplosionOrigin.value.copy(explosionOrigin);
    }
  }, [explosionOrigin]);

  // Load VGR + nav label text targets on mount
  useEffect(() => {
    setVgrTargets(getTextCoordinates("VGR", TOTAL));

    // Generate particle-text for each nav label, split by cluster
    const cSize = Math.floor(TOTAL / 3);
    const navLabels = ["WORK", "ABOUT", "CONTACT"];
    const navCoords = navLabels.map((lbl, gi) => {
      const count = gi < 2 ? cSize : TOTAL - cSize * 2;
      return getNavTextCoordinates(lbl, count);
    });

    // Stitch into a single combined buffer
    const combined = new Float32Array(TOTAL * 3);
    for (let i = 0; i < TOTAL; i++) {
      const g       = Math.min(Math.floor(i / cSize), 2);
      const src     = navCoords[g];
      const localI  = i - g * cSize;
      const srcIdx  = localI % (src.length / 3);
      combined[i*3]   = src[srcIdx*3];
      combined[i*3+1] = src[srcIdx*3+1];
      combined[i*3+2] = src[srcIdx*3+2];
    }
    setClusterTargets(combined);
  }, []);

  // Push VGR coords to GPU + run VGR animation (home page only)
  useEffect(() => {
    if (!meshRef.current || !vgrTargets) return;
    meshRef.current.geometry.setAttribute(
      "aTargetOffset",
      new THREE.InstancedBufferAttribute(vgrTargets, 3)
    );
    meshRef.current.geometry.attributes.aTargetOffset.needsUpdate = true;

    // VGR text morphing disabled per user request
    // if (!showVGR) return;
    // gsap.to(meshRef.current.material.uniforms.uMorphState, {
    //   value: 1.0, duration: 1.5, ease: "power3.inOut"
    // });
  }, [vgrTargets, showVGR]);

  // Push cluster text coords to GPU
  useEffect(() => {
    if (!meshRef.current || !clusterTargets) return;
    meshRef.current.geometry.setAttribute(
      "aClusterOffset",
      new THREE.InstancedBufferAttribute(clusterTargets, 3)
    );
    meshRef.current.geometry.attributes.aClusterOffset.needsUpdate = true;
  }, [clusterTargets]);

  // Explode / collapse
  useEffect(() => {
    if (!meshRef.current) return;
    gsap.to(meshRef.current.material.uniforms.uExplodeState, {
      value: isExploded ? 1.0 : 0.0,
      duration: 1.4,
      ease: isExploded ? "power3.out" : "power3.inOut",
    });
  }, [isExploded]);

  useFrame(({ clock, camera }) => {
    if (!meshRef.current) return;
    if (clockRef) clockRef.current = clock.elapsedTime;
    const m = meshRef.current.material;
    m.uniforms.uTime.value = clock.elapsedTime;
    m.uniforms.uTransitionProgress.value = transitionRef.current.progress;
    camera.fov = 55 + 70 * Math.pow(transitionRef.current.progress, 2.0);
    camera.updateProjectionMatrix();
  });

  return (
    <instancedMesh ref={meshRef} args={[geo, null, TOTAL]} frustumCulled={false}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

// ─── Constellation Click Nodes ────────────────────────────────────────────────
const CLUSTER_REL = [
  new THREE.Vector3(-1.5,  0.9, 0),
  new THREE.Vector3( 1.5,  0.9, 0),
  new THREE.Vector3( 0.0, -0.9, 0),
];

function ConstellationNodes({ isExploded, onNavigate, explosionOrigin }) {
  if (!explosionOrigin) return null;
  return (
    <>
      {CLUSTER_REL.map((rel, i) => {
        const pos = [explosionOrigin.x + rel.x, explosionOrigin.y + rel.y, rel.z];
        return (
          <group key={i} position={pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                if (isExploded) onNavigate(CLUSTER_ROUTES[i]);
              }}
            >
              <planeGeometry args={[2.4, 0.85]} />
              <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ transitionRef, isExploded, onNavigate, showVGR, explosionOrigin, clockRef, swarmColor }) {
  return (
    <group>
      <FlexibleSphereMesh 
        transitionRef={transitionRef} 
        isExploded={isExploded} 
        showVGR={showVGR} 
        explosionOrigin={explosionOrigin}
        clockRef={clockRef}
        swarmColor={swarmColor}
      />
      {isExploded && <ConstellationNodes isExploded={isExploded} onNavigate={onNavigate} explosionOrigin={explosionOrigin} />}
      <EffectComposer>
        <Bloom intensity={3.5} luminanceThreshold={0.5} luminanceSmoothing={0.8} mipmapBlur radius={0.8} />
      </EffectComposer>
    </group>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export default function Murmuration({ style = {} }) {
  const router       = useRouter();
  const pathname     = usePathname();

  const transitionRef = useRef({ progress: 0 });
  const [isExploded,    setIsExploded]    = useState(false);
  const [explosionOrigin, setExplosionOrigin] = useState(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const clockRef = useRef(null);

  useEffect(() => {
    let hasPushed = false;
    const onTrigger = () => {
      hasPushed = false;
      globalStore.isRouteReady = false;
      globalStore.isCanvasReady = true;
      setIsLoading(true);

      gsap.to(transitionRef.current, {
        progress: 1, duration: 1.5, ease: "power2.inOut",
        onUpdate: () => {
          if (transitionRef.current.progress > 0.8 && !hasPushed) {
            hasPushed = true;
            if (globalStore.targetRoute) router.push(globalStore.targetRoute);
          }
        },
      });
    };
    window.addEventListener("triggerPortalTransition", onTrigger);
    return () => window.removeEventListener("triggerPortalTransition", onTrigger);
  }, [router]);

  useEffect(() => {
    if (isLoading) globalStore.isRouteReady = true;
  }, [pathname, isLoading]);

  useEffect(() => {
    setIsExploded(false);
  }, [pathname]);

  const [progressValue, setProgressValue] = useState(0);
  useEffect(() => {
    if (!isLoading) { setProgressValue(0); return; }
    let cur = 0;
    const iv = setInterval(() => {
      const ready = globalStore.isRouteReady && globalStore.isCanvasReady;
      cur += ((ready ? 100 : 85) - cur) * 0.1;
      if (cur >= 99 && ready) {
        cur = 100; clearInterval(iv);
        globalStore.portalState = "expanding";
        setIsLoading(false);
        gsap.to(transitionRef.current, {
          progress: 0, duration: 1.5, ease: "power3.out",
          onComplete: () => { globalStore.portalState = "idle"; },
        });
      }
      setProgressValue(Math.floor(cur));
    }, 30);
    return () => clearInterval(iv);
  }, [isLoading]);

  const handleNavigate = (route) => {
    setIsExploded(false);
    router.push(route);
  };

  const isLightMode = pathname !== "/about";
  const swarmColor = isLightMode ? "#000000" : "#ffffff";

  return (
    <div
      style={{ 
        position: "fixed", 
        inset: 0, 
        pointerEvents: pathname === "/about" || pathname === "/work" || pathname === "/contact" ? "none" : "auto", 
        zIndex: 1, 
        ...style 
      }}
      onClick={() => {
        if (!isExploded) {
          const t = clockRef.current ?? 0;
          setExplosionOrigin(new THREE.Vector3(
            Math.sin(t * 0.14) * 2.8,
            Math.cos(t * 0.09) * 1.2,
            Math.sin(t * 0.07) * 0.4
          ));
        }
        setIsExploded((v) => !v);
      }}
    >
      <div style={{ display: pathname === "/about" || pathname === "/work" || pathname === "/contact" ? "none" : "block", width: "100%", height: "100%" }}>
        <Canvas
          camera={{ position: [0, 0, 7], fov: 55 }}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          style={{
            background: "transparent",
            width: "100%", height: "100%",
            cursor: isExploded ? "default" : "pointer",
          }}
        >
          <Scene
            transitionRef={transitionRef}
            isExploded={isExploded}
            onNavigate={handleNavigate}
            showVGR={pathname === "/" || pathname === "/work"}
            explosionOrigin={explosionOrigin}
            clockRef={clockRef}
            swarmColor={swarmColor}
          />
        </Canvas>
      </div>

      {/* Loading overlay */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        color: isLightMode ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)", fontFamily: "monospace",
        fontSize: "0.8rem", letterSpacing: "4px",
        opacity: isLoading ? 1 : 0, transition: "opacity 0.6s ease-in-out",
        pointerEvents: "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
      }}>
        <div>LOADING...</div>
        <div style={{ fontSize: "1.4rem", fontWeight: "bold", letterSpacing: "2px" }}>
          {progressValue}%
        </div>
      </div>
    </div>
  );
}
