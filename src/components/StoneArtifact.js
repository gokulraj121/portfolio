"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { globalStore } from "@/utils/store";

// Procedurally distort a BoxGeometry into a highly detailed jagged, diamond-like shape
function createJaggedGeometry() {
  // Optimized segments for high performance while retaining jagged detail
  const geometry = new THREE.BoxGeometry(1.0, 2.5, 0.6, 16, 48, 12);
  const positionAttribute = geometry.attributes.position;
  const noise3D = createNoise3D();
  
  for (let i = 0; i < positionAttribute.count; i++) {
    let x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    let z = positionAttribute.getZ(i);
    
    // Taper the top and bottom to create an octahedron (diamond) shape
    const taper = 1.0 - (Math.abs(y) / 1.3); 
    x *= (taper * 0.9 + 0.1);
    z *= (taper * 0.9 + 0.1);
    
    // Fractal Brownian Motion (fBm) - Multiple layers of noise for extreme detail
    const noise1 = noise3D(x * 1.5, y * 1.5, z * 1.5) * 0.08;  // Large, structural chunks
    const noise2 = noise3D(x * 5.0, y * 5.0, z * 5.0) * 0.025; // Medium rocky crags
    const noise3 = noise3D(x * 12.0, y * 12.0, z * 12.0) * 0.01; // Tiny, sharp cracks and micro-details
    
    const displacement = noise1 + noise2 + noise3;
    
    // Displace outward
    const dir = new THREE.Vector3(x, y * 0.1, z).normalize();
    positionAttribute.setX(i, x + dir.x * displacement);
    positionAttribute.setY(i, y + dir.y * displacement);
    positionAttribute.setZ(i, z + dir.z * displacement);
  }
  
  geometry.computeVertexNormals();
  return geometry;
}

// Procedurally generate a texture map for the glowing runes
function createRuneTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  // Black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Exactly 4 Tamil characters
  const chars = ["க", "ச", "ட", "த"];

  // White glowing letters so we can tint them via material emissive color
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 20;
  ctx.font = "bold 120px serif"; 
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw them in a straight vertical line down the center
  for (let i = 0; i < 4; i++) {
    const yPos = 250 + (i * 170); // Evenly spaced vertically
    
    ctx.save();
    ctx.translate(canvas.width / 2, yPos);
    ctx.fillText(chars[i], 0, 0);
    ctx.fillText(chars[i], 0, 0); // Double draw for intense glow
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  // Ensure it stretches perfectly across the front face
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedurally generate a high-frequency noise texture for the bump map (stone grain)
function createBumpTexture() {
  const canvas = document.createElement("canvas");
  // Optimized texture resolution for performance
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  
  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const val = Math.random() * 255;
    data[i] = val; data[i+1] = val; data[i+2] = val; data[i+3] = 255;
  }
  
  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function RuneMonolith() {
  const meshRef = useRef();
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    // Notify the global loading manager that this page has heavy 3D assets to calculate
    globalStore.isCanvasReady = false;

    // Defer the heavy procedural generation so it doesn't block the page transition
    const timer = setTimeout(() => {
      const geometry = createJaggedGeometry();
      const emissiveMap = createRuneTexture();
      const bumpMap = createBumpTexture();

      const stoneMat = new THREE.MeshStandardMaterial({
        color: "#333333",
        roughness: 0.95,
        metalness: 0.1,
        bumpMap: bumpMap,
        bumpScale: 0.04,
        flatShading: true
      });

      const createRuneMat = (glowColor) => new THREE.MeshStandardMaterial({
        color: "#333333",
        roughness: 0.95,
        metalness: 0.1,
        bumpMap: bumpMap,
        bumpScale: 0.04,
        emissive: glowColor,
        emissiveMap: emissiveMap,
        emissiveIntensity: 4.0,
        flatShading: true
      });

      const materials = [
        createRuneMat("#ff00ff"), // Right - Magenta
        createRuneMat("#00ff00"), // Left - Green
        stoneMat,                 // Top
        stoneMat,                 // Bottom
        createRuneMat("#00e5ff"), // Front - Sky Blue
        createRuneMat("#ffaa00")  // Back - Orange
      ];

      setGeoData({ geometry, materials });
      
      // Notify the global loading manager that the heavy 3D assets are completely ready!
      globalStore.isCanvasReady = true;
    }, 50); // 50ms delay allows the routing transition to finish instantly

    return () => clearTimeout(timer);
  }, []);

  if (!geoData) return null;

  return (
    <mesh 
      ref={meshRef} 
      geometry={geoData.geometry}
      material={geoData.materials}
      castShadow 
      receiveShadow
      scale={[0.7, 0.7, 0.7]} // Adjust scale as needed
    >
    </mesh>
  );
}

export default function StoneArtifact() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 45 }}
        shadows
      >
        <color attach="background" args={['#ffffff']} />
        
        {/* Soft Ambient Light */}
        <ambientLight intensity={0.4} />
        
        {/* Cinematic Key Light mimicking the bright rim light in the reference */}
        <directionalLight 
          position={[5, 10, -5]} 
          intensity={4} 
          castShadow
          shadow-mapSize={1024}
        />
        
        {/* Fill light to see the dark front of the stone */}
        <directionalLight 
          position={[-5, 2, 5]} 
          intensity={1.5} 
          color="#ffffff" 
        />

        {/* OrbitControls configured for purely automatic cinematic rotation */}
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          enableRotate={false}
          autoRotate={true}
          autoRotateSpeed={1.5}
          makeDefault 
        />
        
        <RuneMonolith />

        {/* Bloom creates the intense cyan glow on the runes */}
        <EffectComposer>
          <Bloom luminanceThreshold={1.5} mipmapBlur intensity={1.5} />
        </EffectComposer>
      </Canvas>

    </div>
  );
}
