import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const MoonSphere = ({ illumination, phaseName }) => {
  const meshRef = useRef();
  
  // Load standard high-res moon texture from a reliable CDN
  const colorMap = useTexture('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg');

  // Custom Shader Material for Phase rendering
  const uniforms = useMemo(() => ({
    uColorMap: { value: colorMap },
    uIllumination: { value: illumination / 100.0 }, // 0.0 to 1.0
    uSunDirection: { value: new THREE.Vector3(1, 0, 0) }, // Default sun direction
  }), [colorMap, illumination]);

  // Update uniforms when illumination or phase changes
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uIllumination.value = illumination / 100.0;
      
      // Determine if it is waxing or waning to light the correct side
      const name = (phaseName || '').toLowerCase();
      const isWaning = name.includes('waning') || name.includes('last quarter') || name.includes('3rd quarter');
      const sign = isWaning ? -1.0 : 1.0;
      
      // We interpolate the sun direction vector slightly so the phase shading wraps correctly 
      // around the 3D sphere when combined with the terminator smoothstep logic.
      meshRef.current.material.uniforms.uSunDirection.value.set(sign, 0, 0);
    }
  });

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D uColorMap;
    uniform float uIllumination;
    uniform vec3 uSunDirection;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() {
      // Sample the photorealistic diffuse map
      vec4 texColor = texture2D(uColorMap, vUv);
      vec3 normal = normalize(vNormal);
      vec3 sunDir = normalize(uSunDirection);
      
      // Calculate dot product lighting
      float lighting = dot(normal, sunDir);
      
      // Correct threshold for illuminated percentage (uIllumination is 0.0 to 1.0)
      // 0.0 (New Moon) -> limit = 1.0 (0% lit)
      // 0.5 (Quarter Moon) -> limit = 0.0 (50% lit)
      // 1.0 (Full Moon) -> limit = -1.0 (100% lit)
      float limit = 1.0 - 2.0 * uIllumination;
      
      // Smooth terminator line transition
      float terminator = smoothstep(-0.06, 0.06, lighting - limit);
      
      // Earthshine (faint bluish-gray light reflecting off Earth onto the moon's dark side)
      vec3 earthshine = texColor.rgb * vec3(0.12, 0.15, 0.22) * (1.0 - terminator) * 0.45;
      
      // Direct sunlight with warm realistic lunar surface lighting
      vec3 sunLight = texColor.rgb * vec3(1.0, 0.98, 0.95) * terminator;
      
      // Combine
      vec3 finalColor = sunLight + earthshine;
      
      // Subtle atmospheric glow/halo at the edges (Fresnel effect) 
      float fresnel = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
      vec3 glow = vec3(0.7, 0.8, 1.0) * fresnel * (1.0 - uIllumination) * 0.2;
      
      gl_FragColor = vec4(finalColor + glow, 1.0);
    }
  `;

  return (
    <mesh ref={meshRef} rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[2, 64, 64]} />
      <shaderMaterial 
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export default function ThreeMoon({ illumination, phaseName }) {
  return (
    <div className="w-full h-56 cursor-grab active:cursor-grabbing relative">
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
        <ambientLight intensity={0.1} />
        <React.Suspense fallback={
          <mesh>
            <sphereGeometry args={[2, 32, 32]} />
            <meshBasicMaterial color="#1a2535" wireframe />
          </mesh>
        }>
          <MoonSphere illumination={illumination} phaseName={phaseName} />
        </React.Suspense>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
      {/* Decorative gradient overlay at the bottom to blend into the card */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-panel to-transparent pointer-events-none" />
    </div>
  );
}
