import { Suspense, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Environment as DreiEnvironment } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Court } from './Court';
import { Hoop } from './Hoop';
import { Player } from './Player';
import { Ball } from './Ball';
import { Lighting } from './Lighting';
import type { QualityLevel } from './Lighting';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { Environment } from './Environment';
import * as THREE from 'three';

interface GameCanvasProps {
  playerPosition?: [number, number, number];
  ballPosition?: [number, number, number];
  ballVisible?: boolean;
  isDribbling?: boolean;
  animationState?: 'idle' | 'dribbling' | 'gathering' | 'shooting';
  triggerNetSwish?: boolean;
  isPerfectSwish?: boolean;
  jumpProgress?: number;
  useBallFromHand?: boolean;
  quality?: QualityLevel;
}

function LoadingFallback() {
  return (
    <mesh position={[0, 1, 0]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color="#ff6b35" wireframe />
    </mesh>
  );
}

function PostProcessingHigh() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.4}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <N8AO
        aoRadius={0.5}
        distanceFalloff={0.5}
        intensity={1.0}
        halfRes
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}

function PostProcessingMedium() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.2}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}

function PostProcessingLow() {
  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}

function PostProcessing({ quality = 'high' }: { quality?: QualityLevel }) {
  if (quality === 'high') return <PostProcessingHigh />;
  if (quality === 'medium') return <PostProcessingMedium />;
  return <PostProcessingLow />;
}

function SceneContent({
  playerPosition,
  ballPosition,
  ballVisible,
  isDribbling,
  animationState,
  triggerNetSwish,
  isPerfectSwish,
  jumpProgress,
  useBallFromHand,
  quality,
}: Required<GameCanvasProps>) {
  const handBallPos = useRef<[number, number, number]>(ballPosition);
  const isInFlight = useRef(false);

  const shouldTrackHand = animationState === 'dribbling' || animationState === 'idle' || animationState === 'gathering';

  if (!shouldTrackHand) {
    isInFlight.current = true;
  }
  if (animationState === 'dribbling' || animationState === 'idle') {
    isInFlight.current = false;
  }

  const handleHandPosition = useCallback((worldPos: THREE.Vector3) => {
    handBallPos.current = [worldPos.x, worldPos.y, worldPos.z];
  }, []);

  const effectiveBallPos = (useBallFromHand && shouldTrackHand && !isInFlight.current)
    ? handBallPos.current
    : ballPosition;

  return (
    <>
      <Lighting quality={quality} />
      <fog attach="fog" args={['#d4c4a0', 50, 100]} />

      <Sky
        distance={450000}
        sunPosition={[25, 30, -20]}
        inclination={0.52}
        azimuth={0.25}
        rayleigh={1.5}
        turbidity={8}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <DreiEnvironment preset="sunset" environmentIntensity={0.3} />

      <Environment />
      <Court />
      <Hoop position={[0, 3.05, -13]} triggerNetAnimation={triggerNetSwish} isPerfectSwish={isPerfectSwish} />

      <Player
        position={playerPosition}
        animationState={animationState}
        jumpProgress={jumpProgress}
        onHandPosition={handleHandPosition}
      />
      <Ball
        position={effectiveBallPos}
        visible={ballVisible}
        isDribbling={isDribbling}
      />

      <ThirdPersonCamera
        target={playerPosition}
        offset={[0, 1.8, 3.5]}
        lookAtOffset={[0, 1.3, -4]}
        smoothness={4}
      />

      <PostProcessing quality={quality} />
    </>
  );
}

export function GameCanvas({
  playerPosition = [0, 0, -4],
  ballPosition = [0, 1, -4],
  ballVisible = true,
  isDribbling = false,
  animationState = 'idle',
  triggerNetSwish = false,
  isPerfectSwish = false,
  jumpProgress = 0,
  useBallFromHand = true,
  quality = 'high',
}: GameCanvasProps) {
  return (
    <Canvas
      shadows
      camera={{ fov: 55, near: 0.1, far: 120, position: [0, 8, 15] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      style={{ background: 'linear-gradient(180deg, #5b9ed6 0%, #87CEEB 25%, #a8d8ea 50%, #d4e8d0 80%, #e8e0c8 100%)' }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <SceneContent
          playerPosition={playerPosition}
          ballPosition={ballPosition}
          ballVisible={ballVisible}
          isDribbling={isDribbling}
          animationState={animationState}
          triggerNetSwish={triggerNetSwish}
          isPerfectSwish={isPerfectSwish}
          jumpProgress={jumpProgress}
          useBallFromHand={useBallFromHand}
          quality={quality}
        />
      </Suspense>
    </Canvas>
  );
}
