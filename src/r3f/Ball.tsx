import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';
import type { BallHandlingState } from '../engine/BallStateMachine';

interface BallProps {
  runtime: GameRuntime;
  visible?: boolean;
}

function isDribblingState(state: BallHandlingState): boolean {
  return (
    state === 'DRIBBLE_RIGHT_DOWN' ||
    state === 'DRIBBLE_RIGHT_UP' ||
    state === 'DRIBBLE_LEFT_DOWN' ||
    state === 'DRIBBLE_LEFT_UP' ||
    state === 'CROSSOVER_R2L' ||
    state === 'CROSSOVER_L2R' ||
    state === 'BEHIND_BACK' ||
    state === 'BETWEEN_LEGS'
  );
}

function isShootingMotionState(state: BallHandlingState): boolean {
  return state === 'SHOOTING' || state === 'FOLLOW_THROUGH';
}

/** Procedural pebbled leather + seams — 1024 for crisp UV on sphere */
function createBallTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const base = '#c85a22';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const shade = ctx.createRadialGradient(size * 0.28, size * 0.22, 0, size * 0.5, size * 0.5, size * 0.72);
  shade.addColorStop(0, 'rgba(255, 200, 140, 0.22)');
  shade.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(1, 'rgba(40, 15, 0, 0.28)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
  for (let i = 0; i < 14000; i++) {
    const h = Math.sin(i * 17.13) * 43758.5453;
    const px = (h - Math.floor(h)) * size;
    const h2 = Math.cos(i * 11.29) * 23421.1421;
    const py = (h2 - Math.floor(h2)) * size;
    const h3 = Math.sin(i * 3.7) * 31415.9265;
    const r = 0.35 + (h3 - Math.floor(h3)) * 0.55;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#141008';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.29, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, size / 2, size * 0.34, -0.75, 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size, size / 2, size * 0.34, Math.PI - 0.75, Math.PI + 0.75);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function Ball({ runtime, visible = true }: BallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => createBallTexture(), []);
  const lastPosition = useRef(new THREE.Vector3());

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useFrame((_, delta) => {
    if (!visible || !meshRef.current) return;

    const snapshot = runtime.getRenderState();
    const [x, y, z] = snapshot.ballPosition;
    const nextPosition = new THREE.Vector3(x, y, z);
    const velocity = nextPosition.clone().sub(lastPosition.current);

    meshRef.current.position.copy(nextPosition);

    const state = snapshot.ballState;
    const inFlight = snapshot.ballInFlight;
    const travelSpin = isDribblingState(state) ? 16 : isShootingMotionState(state) || inFlight ? 11 : 6;
    const authoredSpin = snapshot.ballSpinRate * delta * 1.6;
    meshRef.current.rotation.x += velocity.length() * travelSpin + delta * 0.85;
    meshRef.current.rotation.z += velocity.x * 5.2 + authoredSpin * 0.72;
    meshRef.current.rotation.y += velocity.z * 5.2 + authoredSpin * 0.42;

    lastPosition.current.copy(nextPosition);
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[0.12, 48, 40]} />
      <meshPhysicalMaterial
        map={texture}
        roughness={0.48}
        metalness={0.06}
        clearcoat={0.22}
        clearcoatRoughness={0.38}
        envMapIntensity={1.15}
      />
    </mesh>
  );
}
