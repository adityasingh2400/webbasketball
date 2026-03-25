import { useRef } from 'react';
import * as THREE from 'three';

export default function Lighting() {
  const directionalRef = useRef<THREE.DirectionalLight>(null);

  return (
    <>
      <ambientLight intensity={0.4} color="#ffffff" />
      
      <directionalLight
        ref={directionalRef}
        position={[10, 20, 5]}
        intensity={1.2}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      <directionalLight
        position={[-5, 10, -10]}
        intensity={0.3}
        color="#e6f0ff"
      />
      
      <hemisphereLight
        args={['#87ceeb', '#8b4513', 0.3]}
      />
    </>
  );
}
