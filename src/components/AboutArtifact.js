"use client";

import { useEffect, useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls, ScrollControls, useScroll } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { globalStore } from "@/utils/store";

// Preload the GLTF models
useGLTF.preload("/models/artifact.glb");

function ShardModel() {
  const { scene } = useGLTF("/models/artifact.glb");
  const modelRef = useRef();
  
  // useScroll gives us the current scroll progress from ScrollControls
  const scroll = useScroll();

  useFrame((state) => {
    if (modelRef.current) {
      // Constant gentle rotation
      modelRef.current.rotation.y += 0.005;

      // Scroll-based effects:
      // scroll.offset goes from 0 (top) to 1 (bottom)
      const offset = scroll.offset;

      // 1. Rotate the artifact dramatically when scrolling
      modelRef.current.rotation.x = offset * Math.PI * 2;
      modelRef.current.rotation.z = offset * Math.PI;

      // 2. Scale the artifact up and down as you scroll
      const scale = 2.0 + Math.sin(offset * Math.PI) * 1.5;
      modelRef.current.scale.set(scale, scale, scale);

      // 3. Move it slightly up and down based on scroll
      modelRef.current.position.y = Math.sin(offset * Math.PI * 2) * 1.5;
    }
  });

  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={[2.0, 2.0, 2.0]}
      position={[0, 0, 0]} 
    />
  );
}

function LoaderManager() {
  useEffect(() => {
    // Notify the global loading manager that the 3D assets are completely ready!
    globalStore.isCanvasReady = true;
  }, []);
  
  return null;
}

export default function AboutArtifact() {
  useEffect(() => {
    // On mount, notify the global loading manager that this page has heavy 3D assets to load
    globalStore.isCanvasReady = false;
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        shadows
        style={{ pointerEvents: "auto" }}
      >
        <color attach="background" args={['#ffffff']} />
        
        {/* Lighting setup to enhance the shard */}
        <ambientLight intensity={0.5} />
        
        <directionalLight 
          position={[5, 10, -5]} 
          intensity={2} 
          castShadow
          shadow-mapSize={1024}
        />
        
        <directionalLight 
          position={[-5, 2, 5]} 
          intensity={1} 
          color="#ffaa00"
        />
        
        <spotLight 
          position={[0, 5, 0]} 
          intensity={2} 
          angle={0.6} 
          penumbra={1} 
          color="#ff4400"
        />

        <OrbitControls 
          enableZoom={false} 
          enablePan={false}
          enableRotate={true}
          autoRotate={false}
          makeDefault 
        />
        
        {/* 
          ScrollControls creates a virtual scroll area.
          pages={3} means the scroll area is 3x the height of the screen.
          damping={0.1} makes the scroll animation smooth.
        */}
        <ScrollControls pages={3} damping={0.1}>
          <Suspense fallback={null}>
            <ShardModel />
            <LoaderManager />
          </Suspense>
        </ScrollControls>

        {/* Bloom creates the intense glow on the model */}
        <EffectComposer>
          <Bloom luminanceThreshold={1.2} mipmapBlur intensity={1.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
