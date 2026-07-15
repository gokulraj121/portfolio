"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

// ─── Particle counts ──────────────────────────────────────────────────────────
const STRAND_PER   = 280;   // per DNA strand  (×3 strands = 840)
const RUNG_COUNT   = 140;   // cross-rung connector particles
const BACTERIA     = 14;    // number of alien microorganisms
const BODY_PER     = 10;    // body particles per bacterium
const TAIL_PER     = 7;     // flagellum particles per bacterium
const BAC_TOTAL    = BACTERIA * (BODY_PER + TAIL_PER);
const TOTAL        = STRAND_PER * 3 + RUNG_COUNT + BAC_TOTAL;

// DNA helix constants
const TURNS  = 3.8;
const HEIGHT = 4.5;
const RADIUS = 0.75;

// ─── Vertex Shader ────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMouse;

  attribute vec3  aOffset;    // encodes position params
  attribute float aType;      // 0/1/2=strand, 3=rung, 4=bacteria
  attribute float aScale;
  attribute float aSeed;      // random [0,1] seed

  varying vec3  vColor;
  varying float vAlpha;

  const float PI     = 3.14159265;
  const float TAU    = 6.28318530;
  const float TURNS  = 3.8;
  const float HEIGHT = 4.5;
  const float RADIUS = 0.75;

  // ── Y-axis rotation ────────────────────────────────────────────────────────
  mat3 rotY(float a) {
    return mat3( cos(a), 0.0, sin(a),
                 0.0,    1.0, 0.0,
                -sin(a), 0.0, cos(a));
  }

  // ── Hash ───────────────────────────────────────────────────────────────────
  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec3  pos   = vec3(0.0);
    vec3  col   = vec3(1.0);
    float alpha = 0.85;

    // ── Global slow rotation for the whole DNA structure ──────────────────
    float rotation = uTime * 0.18 + uMouse.x * 0.4;
    mat3  rot = rotY(rotation);

    // ══ DNA Strand 0, 1, 2 ═══════════════════════════════════════════════
    if (aType < 3.0) {
      // aOffset.x = helix parameter t ∈ [0, TAU*TURNS]
      // aOffset.y = strand index (0/1/2) — used for phase offset
      float t     = aOffset.x;
      float sIdx  = aOffset.y;
      float phase = sIdx * TAU / 3.0;   // 0°, 120°, 240° between strands

      float y = (t / (TAU * TURNS)) * HEIGHT - HEIGHT * 0.5;

      // Slight breathing of the helix radius over time
      float breathe = 1.0 + sin(uTime * 0.65 + t * 0.5) * 0.06;

      vec3 helixStatic = vec3(
        RADIUS * cos(t + phase) * breathe,
        y,
        RADIUS * sin(t + phase) * breathe
      );

      // Mouse Y tilts the helix a little (leans toward cursor)
      helixStatic.y += uMouse.y * 0.25;

      pos = rot * helixStatic;

      // Color per strand: white → blue-white → cyan-white
      if (sIdx < 0.5)      col = vec3(1.00, 1.00, 1.00);       // strand 0: pure white
      else if (sIdx < 1.5) col = vec3(0.75, 0.90, 1.00);       // strand 1: blue-white
      else                 col = vec3(0.60, 0.95, 1.00);       // strand 2: cyan-white

      // Brightness pulses up the helix like a signal traveling through DNA
      float wave = smoothstep(0.3, 0.0, abs(fract(t / (TAU * TURNS) - uTime * 0.15) - 0.5) * 2.0);
      col = mix(col, vec3(1.0), wave * 0.9);
      alpha = 0.80 + wave * 0.15;
    }

    // ══ Rung / base-pair connectors ═══════════════════════════════════════
    else if (aType < 4.0) {
      // aOffset.x = t along helix
      // aOffset.y = which strand pair (0→1 or 1→2)
      // aOffset.z = interpolation [0,1] between the two strand points
      float t     = aOffset.x;
      float pair  = aOffset.y;
      float lerpt = aOffset.z;

      float phase1 = pair       * TAU / 3.0;
      float phase2 = (pair + 1.0) * TAU / 3.0;
      float y      = (t / (TAU * TURNS)) * HEIGHT - HEIGHT * 0.5;

      vec3 p1 = vec3(RADIUS * cos(t + phase1), y, RADIUS * sin(t + phase1));
      vec3 p2 = vec3(RADIUS * cos(t + phase2), y, RADIUS * sin(t + phase2));

      vec3 rungStatic = mix(p1, p2, lerpt);
      rungStatic.y += uMouse.y * 0.25;

      pos = rot * rungStatic;
      col = vec3(1.0, 0.95, 0.65);   // warm gold for the base pairs
      alpha = 0.55 + lerpt * 0.3;
    }

    // ══ Alien bacteria microorganisms ══════════════════════════════════════
    else {
      // aOffset.x = bacterium group ID (0..BACTERIA-1)
      // aOffset.y = role: 0=body, 1=flagellum
      // aOffset.z = local parameter (body: angle, tail: t∈[0,1])
      float gID   = aOffset.x;
      float role  = aOffset.y;
      float param = aOffset.z;

      // ── Each bacterium moves on a unique Lissajous path ──────────────
      float sp   = 0.28 + gID * 0.062;
      float ph   = gID * 0.534;

      // Spread them across the whole screen (±3.5 in X, ±2.0 in Y, ±1.0 in Z)
      vec3 center = vec3(
        sin(uTime * sp       + ph)        * 3.5,
        cos(uTime * sp * 0.7 + ph * 1.4) * 2.0,
        sin(uTime * sp * 0.4 + ph * 0.9) * 1.2
      );

      if (role < 0.5) {
        // ── Body: elongated oval cluster ──────────────────────────────
        float angle = param * TAU;
        // Slightly irregular oval (not a perfect ellipse)
        float jitter = hash(gID * 7.3 + param * 13.1) * 0.04;
        pos = center + vec3(
          cos(angle) * (0.09 + jitter),
          sin(angle) * 0.20,
          sin(angle * 1.5) * (0.07 + jitter)
        );
      } else {
        // ── Flagellum: two spinning spiral arms ───────────────────────
        float armPhase = floor(param * 2.0) * PI; // arm 0 or 1
        float tLen     = fract(param * 2.0);       // 0→tip along arm

        float spin = uTime * 2.5 + gID * 1.1;
        pos = center + vec3(
          cos(armPhase + spin) * tLen * 0.30,
          tLen * 0.45 - 0.22,
          sin(armPhase + spin) * tLen * 0.25
        );
      }

      // ── Bioluminescent green-cyan, pulses like a living cell ─────────
      float lifePulse = sin(uTime * (2.0 + gID * 0.5) + param * TAU) * 0.4 + 0.6;
      col   = mix(vec3(0.2, 1.0, 0.5), vec3(0.0, 0.8, 0.6), hash(gID + param));
      col  *= lifePulse;
      alpha = 0.70 + lifePulse * 0.25;
    }

    vColor = col;
    vAlpha = alpha;

    // Scale the sphere instance
    vec3 finalPos = position * aScale + pos;
    gl_Position   = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
  }
`;

// ─── Fragment Shader ──────────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

// ─── Geometry builder ─────────────────────────────────────────────────────────
function buildGeometry() {
  const offsets = new Float32Array(TOTAL * 3);
  const types   = new Float32Array(TOTAL);
  const scales  = new Float32Array(TOTAL);
  const seeds   = new Float32Array(TOTAL);

  let idx = 0;

  // ── DNA strands ───────────────────────────────────────────────────────────
  for (let strand = 0; strand < 3; strand++) {
    for (let i = 0; i < STRAND_PER; i++) {
      const t = (i / STRAND_PER) * (Math.PI * 2 * TURNS);
      offsets[idx * 3]     = t;
      offsets[idx * 3 + 1] = strand;
      offsets[idx * 3 + 2] = 0;
      types[idx]  = strand;
      scales[idx] = 0.016 + Math.random() * 0.014;
      seeds[idx]  = Math.random();
      idx++;
    }
  }

  // ── Rungs connecting adjacent strand pairs ────────────────────────────────
  // Place rungs at regular intervals; 2 pairs × RUNG_COUNT/2 each
  const rungsPerPair = Math.floor(RUNG_COUNT / 2);
  for (let pair = 0; pair < 2; pair++) {
    for (let i = 0; i < rungsPerPair; i++) {
      // Rung at helix parameter t (spaced evenly along the helix)
      const t     = (i / rungsPerPair) * (Math.PI * 2 * TURNS);
      const lerpt = Math.random(); // position along the rung
      offsets[idx * 3]     = t;
      offsets[idx * 3 + 1] = pair;
      offsets[idx * 3 + 2] = lerpt;
      types[idx]  = 3;
      scales[idx] = 0.008 + Math.random() * 0.008;
      seeds[idx]  = Math.random();
      idx++;
    }
  }

  // ── Alien bacteria ────────────────────────────────────────────────────────
  for (let b = 0; b < BACTERIA; b++) {
    // Body particles
    for (let j = 0; j < BODY_PER; j++) {
      offsets[idx * 3]     = b;
      offsets[idx * 3 + 1] = 0;                      // role = body
      offsets[idx * 3 + 2] = j / BODY_PER;           // angle param
      types[idx]  = 4;
      scales[idx] = 0.018 + Math.random() * 0.016;
      seeds[idx]  = Math.random();
      idx++;
    }
    // Flagellum particles
    for (let j = 0; j < TAIL_PER; j++) {
      offsets[idx * 3]     = b;
      offsets[idx * 3 + 1] = 1;                      // role = tail
      offsets[idx * 3 + 2] = j / TAIL_PER;           // position along tail
      types[idx]  = 4;
      scales[idx] = 0.008 + Math.random() * 0.008;
      seeds[idx]  = Math.random();
      idx++;
    }
  }

  const geo = new THREE.SphereGeometry(1, 5, 5);
  geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute("aType",   new THREE.InstancedBufferAttribute(types,   1));
  geo.setAttribute("aScale",  new THREE.InstancedBufferAttribute(scales,  1));
  geo.setAttribute("aSeed",   new THREE.InstancedBufferAttribute(seeds,   1));
  return geo;
}

// ─── Main mesh ────────────────────────────────────────────────────────────────
function DNAScene({ mouse }) {
  const meshRef = useRef();

  const geometry = useMemo(() => buildGeometry(), []);

  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uMouse.value.x = THREE.MathUtils.lerp(mat.uniforms.uMouse.value.x, mouse.current.x, 0.05);
    mat.uniforms.uMouse.value.y = THREE.MathUtils.lerp(mat.uniforms.uMouse.value.y, mouse.current.y, 0.05);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, null, TOTAL]}
      frustumCulled={false}
    >
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

// ─── Scene wrapper ────────────────────────────────────────────────────────────
function Scene({ mouse }) {
  return (
    <>
      <DNAScene mouse={mouse} />
      <EffectComposer>
        <Bloom
          intensity={2.5}
          luminanceThreshold={0.20}
          luminanceSmoothing={0.85}
          mipmapBlur
          radius={0.6}
        />
      </EffectComposer>
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
export default function AIOrb({ style = {} }) {
  const mouse = useRef(new THREE.Vector2(0, 0));

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        ...style,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 7], fov: 55 }}
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
