"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { MeshTransmissionMaterial, Environment } from "@react-three/drei";

function StraightGlassPipe() {
  const meshRef = useRef();

  const tubeGeometry = useMemo(() => {
    // A completely straight pipe going diagonally behind the text
    const path = new THREE.LineCurve3(
      new THREE.Vector3(0.5, -3.0, 0),
      new THREE.Vector3(0.5, 3.0, 0)
    );

    // Thick, hollow glass pipe
    return new THREE.TubeGeometry(path, 64, 0.3, 32, false);
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    // Gentle floating
    meshRef.current.position.y = Math.sin(t * 0.5) * 0.1;
  });

  return (
    <mesh ref={meshRef}>
      <bufferGeometry attach="geometry" {...tubeGeometry} />
      {/* Hyper-realistic glass material */}
      <MeshTransmissionMaterial 
        backside
        backsideThickness={0.15}
        thickness={0.8} // Very thick glass
        roughness={0.05} // Smooth, but slightly frosted
        transmission={1} // 100% glass
        ior={1.5} // Glass index of refraction
        chromaticAberration={0.06} // Rainbow refraction edges
        color="#ffffff" // Pure clear glass
        clearcoat={1}
        clearcoatRoughness={0.1}
      />
    </mesh>
  );
}

export default function AlienTubeWidget() {
  return (
    <div style={{
      position: "absolute",
      bottom: "20px",
      right: "20px",
      width: "350px",
      height: "250px",
      pointerEvents: "none",
      zIndex: 5,
    }}>
      <Canvas 
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.5} />
        <pointLight position={[2, 2, 2]} intensity={8} color="#ffffff" />
        <pointLight position={[-2, -2, 2]} intensity={4} color="#00ff66" />
        
        <StraightGlassPipe />
        
        {/* Environment map gives the glass something to reflect */}
        <Environment preset="city" />
        
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.7}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
