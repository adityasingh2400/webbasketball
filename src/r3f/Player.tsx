import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlayerProps {
  position: [number, number, number];
  visible?: boolean;
  animationState?: 'idle' | 'dribbling' | 'gathering' | 'shooting';
}

const CAPSULE_RADIUS = 0.3;
const CAPSULE_HEIGHT = 1.2;
const PLAYER_COLOR = '#4a90d9';
const SKIN_COLOR = '#e8c4a0';

export default function Player({ 
  position, 
  visible = true, 
  animationState = 'idle' 
}: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const animPhase = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current || !visible) return;

    animPhase.current += delta;

    groupRef.current.position.set(...position);

    if (bodyRef.current) {
      switch (animationState) {
        case 'dribbling':
          bodyRef.current.position.y = CAPSULE_HEIGHT / 2 + Math.sin(animPhase.current * 6) * 0.05;
          break;
        case 'gathering':
          bodyRef.current.position.y = CAPSULE_HEIGHT / 2 - 0.1;
          bodyRef.current.rotation.x = -0.2;
          break;
        case 'shooting':
          bodyRef.current.position.y = CAPSULE_HEIGHT / 2 + 0.1 + Math.sin(animPhase.current * 10) * 0.05;
          bodyRef.current.rotation.x = 0.1;
          break;
        default:
          bodyRef.current.position.y = CAPSULE_HEIGHT / 2;
          bodyRef.current.rotation.x = 0;
      }
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={position}>
      <mesh 
        ref={bodyRef}
        position={[0, CAPSULE_HEIGHT / 2, 0]}
        castShadow
      >
        <capsuleGeometry args={[CAPSULE_RADIUS, CAPSULE_HEIGHT - CAPSULE_RADIUS * 2, 8, 16]} />
        <meshStandardMaterial color={PLAYER_COLOR} roughness={0.7} />
      </mesh>

      <mesh position={[0, CAPSULE_HEIGHT + 0.15, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
      </mesh>

      <mesh 
        position={[0, 0.01, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[CAPSULE_RADIUS * 1.5, 32]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
