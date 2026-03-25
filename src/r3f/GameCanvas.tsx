import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Court } from './Court';
import { Hoop } from './Hoop';
import { Player } from './Player';
import { Ball } from './Ball';
import { Lighting } from './Lighting';
import { ThirdPersonCamera } from './ThirdPersonCamera';

interface GameCanvasProps {
  playerPosition?: [number, number, number];
  ballPosition?: [number, number, number];
  ballVisible?: boolean;
  isDribbling?: boolean;
  animationState?: 'idle' | 'dribbling' | 'gathering' | 'shooting';
  triggerNetSwish?: boolean;
}

function LoadingFallback() {
  return (
    <mesh position={[0, 1, 0]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color="#ff6b35" wireframe />
    </mesh>
  );
}

export function GameCanvas({
  playerPosition = [0, 0, 5],
  ballPosition = [0, 1, 5],
  ballVisible = true,
  isDribbling = false,
  animationState = 'idle',
  triggerNetSwish = false,
}: GameCanvasProps) {
  return (
    <Canvas
      shadows
      camera={{ fov: 55, near: 0.1, far: 120, position: [0, 8, 15] }}
      style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #b0d4e8 40%, #d4c4a8 100%)' }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <Lighting />
        <fog attach="fog" args={['#c0d8e8', 35, 70]} />

        <Court />
        <Hoop position={[0, 3.05, -13]} triggerNetAnimation={triggerNetSwish} />

        <Player
          position={playerPosition}
          animationState={animationState}
        />
        <Ball
          position={ballPosition}
          visible={ballVisible}
          isDribbling={isDribbling}
        />

        <ThirdPersonCamera
          target={playerPosition}
          offset={[0, 4.5, 9]}
          lookAtOffset={[0, 1.5, -3]}
          smoothness={4}
        />
      </Suspense>
    </Canvas>
  );
}
