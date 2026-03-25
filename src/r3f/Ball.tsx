import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BallProps {
  position: [number, number, number];
  visible?: boolean;
  isDribbling?: boolean;
}

const BALL_RADIUS = 0.12;
const BALL_COLOR = '#ff6b35';
const SEAM_COLOR = '#1a1a1a';

export default function Ball({ position, visible = true, isDribbling = false }: BallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const dribblePhase = useRef(0);

  const seamTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = BALL_COLOR;
    ctx.fillRect(0, 0, 256, 256);
    
    ctx.strokeStyle = SEAM_COLOR;
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(128, 128, 60, 0, Math.PI * 2);
    ctx.stroke();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    return texture;
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current || !visible) return;
    
    if (isDribbling) {
      dribblePhase.current += delta * 8;
      const bounce = Math.abs(Math.sin(dribblePhase.current)) * 0.3;
      meshRef.current.position.y = position[1] + bounce;
      
      meshRef.current.rotation.x += delta * 5;
    } else {
      meshRef.current.position.set(...position);
    }
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={position} castShadow>
      <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
      <meshStandardMaterial 
        map={seamTexture}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}
