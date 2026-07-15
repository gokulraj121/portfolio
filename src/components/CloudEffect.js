"use client";
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Raw screen space position to perfectly cover the entire canvas
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform vec2 uMouse;
varying vec2 vUv;

// Classic noise function
float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u*u*(3.0-2.0*u);
    
    float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
    return res*res;
}

// Fractional Brownian Motion for clouds
float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    // Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < 6; ++i) {
        v += a * noise(x);
        x = rot * x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    // Add mouse parallax to the UV coordinates
    vec2 uv = (vUv * 3.0) + uMouse; 
    
    // Animate the clouds moving faster for a stormy feel
    vec2 movement = vec2(uTime * 0.15, uTime * 0.08);
    
    vec2 q = vec2(0.);
    q.x = fbm(uv + movement);
    q.y = fbm(uv + vec2(1.0));

    // The inner layers shift slightly more based on mouse (deep parallax)
    vec2 r = vec2(0.);
    r.x = fbm(uv + 1.0*q + vec2(1.7,9.2)+ movement * 2.0 + (uMouse * 0.5));
    r.y = fbm(uv + 1.0*q + vec2(8.3,2.8)+ movement * 0.5 + (uMouse * 0.5));

    float f = fbm(uv + r);

    // Much brighter cloud colors to ensure they are visible
    vec3 color1 = vec3(0.1, 0.12, 0.18); 
    vec3 color2 = vec3(0.25, 0.28, 0.35);  
    vec3 color3 = vec3(0.45, 0.50, 0.60);  
    
    vec3 color = mix(color1, color2, clamp((f*f)*4.0,0.0,1.0));
    color = mix(color, color3, clamp(length(q),0.0,1.0));
    color = mix(color, color1, clamp(length(r.x),0.0,1.0));

    // Increase contrast slightly
    color = pow(color, vec3(1.1));

    gl_FragColor = vec4(color, 1.0);
}
`;

const CloudMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) }
  },
  vertexShader,
  fragmentShader
};

function CloudPlane() {
  const materialRef = useRef();

  useFrame((state) => {
    if (materialRef.current) {
      // Update time for the cloud animation
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      
      // Smoothly interpolate the mouse position for a realistic parallax effect
      // state.pointer holds normalized mouse coordinates (-1 to +1)
      const targetX = state.pointer.x * -0.3; // Negative for natural opposite-direction movement
      const targetY = state.pointer.y * -0.3;
      
      materialRef.current.uniforms.uMouse.value.x = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uMouse.value.x, 
        targetX, 
        0.05
      );
      materialRef.current.uniforms.uMouse.value.y = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uMouse.value.y, 
        targetY, 
        0.05
      );
    }
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial 
        ref={materialRef}
        args={[CloudMaterial]}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export default function CloudEffect() {
  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0,
      width: '100%',
      height: '40vh', // Only cover the header area
      pointerEvents: 'none', 
      zIndex: 1,
      // Create a smooth, premium fade-out at the bottom of the header
      maskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)'
    }}>
      <Canvas 
        gl={{ alpha: false, antialias: false }}
        camera={{ position: [0, 0, 1] }}
      >
        <CloudPlane />
      </Canvas>
    </div>
  );
}
