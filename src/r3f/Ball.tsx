import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BallProps {
  position: [number, number, number];
  visible?: boolean;
  isDribbling?: boolean;
}

function createBallTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e87530';
  ctx.fillRect(0, 0, size, size);

  const gradient = ctx.createRadialGradient(size * 0.35, size * 0.35, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,180,100,0.3)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, size / 2, size * 0.35, -0.8, 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size, size / 2, size * 0.35, Math.PI - 0.8, Math.PI + 0.8);
  ctx.stroke();

  for (let i = 0; i < size; i += 2) {
    for (let j = 0; j < size; j += 2) {
      if (Math.random() < 0.15) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
        ctx.fillRect(i, j, 2, 2);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Ball({ position, visible = true, isDribbling = false }: BallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef(0);

  const texture = useMemo(() => createBallTexture(), []);

  useEffect(() => {
    return () => { texture.dispose(); };
  }, [texture]);

  useFrame((_, delta) => {
    if (!meshRef.current || !visible) return;

    phaseRef.current += delta;

    if (isDribbling) {
      meshRef.current.position.set(
        position[0],
        position[1] + Math.abs(Math.sin(phaseRef.current * 8)) * 0.15,
        position[2],
      );
      meshRef.current.rotation.x += delta * 6;
      meshRef.current.rotation.z += delta * 2;
    } else {
      meshRef.current.position.set(...position);
      meshRef.current.rotation.x += delta * 0.5;
    }
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[0.12, 24, 24]} />
      <meshStandardMaterial map={texture} roughness={0.75} metalness={0.05} />
    </mesh>
  );
}
