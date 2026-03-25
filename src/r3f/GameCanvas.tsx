import { Canvas } from '@react-three/fiber';
import { useState, useCallback } from 'react';
import Court from './Court';
import Ball from './Ball';
import Hoop from './Hoop';
import Player from './Player';
import Lighting from './Lighting';
import ThirdPersonCamera from './ThirdPersonCamera';

interface GameCanvasProps {
  playerPosition?: [number, number, number];
  ballPosition?: [number, number, number];
  ballVisible?: boolean;
  isDribbling?: boolean;
  animationState?: 'idle' | 'dribbling' | 'gathering' | 'shooting';
}

export default function GameCanvas({
  playerPosition = [0, 0, 5],
  ballPosition = [0, 1, 5],
  ballVisible = true,
  isDribbling = false,
  animationState = 'idle',
}: GameCanvasProps) {
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>(playerPosition);

  const updateCameraTarget = useCallback((pos: [number, number, number]) => {
    setCameraTarget(pos);
  }, []);

  return (
    <Canvas
      shadows
      camera={{ 
        fov: 60, 
        near: 0.1, 
        far: 100,
        position: [0, 8, 15]
      }}
      style={{ 
        width: '100%', 
        height: '100%',
        background: 'linear-gradient(180deg, #87CEEB 0%, #E0E7E9 100%)'
      }}
      onCreated={() => {
        updateCameraTarget(playerPosition);
      }}
    >
      <Lighting />
      
      <Court />
      
      <Hoop position={[0, 3.05, -13]} />
      <Hoop position={[0, 3.05, 13]} />
      
      <Player 
        position={playerPosition}
        visible={true}
        animationState={animationState}
      />
      
      <Ball 
        position={ballPosition}
        visible={ballVisible}
        isDribbling={isDribbling}
      />
      
      <ThirdPersonCamera 
        target={cameraTarget}
        offset={[0, 4, 8]}
        lookAtOffset={[0, 1, -2]}
        smoothness={4}
      />
      
      <fog attach="fog" args={['#E0E7E9', 30, 60]} />
    </Canvas>
  );
}
