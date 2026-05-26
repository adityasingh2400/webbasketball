import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AccumulativeShadows, RandomizedLight } from '@react-three/drei';

export type QualityLevel = 'high' | 'medium' | 'low';

const SUN_DIR: [number, number, number] = [12, 8, -30];

const SHADOW_MAP: Record<QualityLevel, number> = {
  high: 2048,
  medium: 1280,
  low: 512,
};

interface LightingProps {
  shadowQuality?: number;
  ambientIntensity?: number;
  quality?: QualityLevel;
}

export function Lighting({ shadowQuality, ambientIntensity = 0.35, quality = 'high' }: LightingProps) {
  const mapSize = shadowQuality ?? SHADOW_MAP[quality];
  const sunRef = useRef<THREE.DirectionalLight>(null);

  useFrame(({ camera }) => {
    if (!sunRef.current) return;
    const cam = camera.position;
    sunRef.current.position.set(cam.x + SUN_DIR[0], SUN_DIR[1], cam.z + SUN_DIR[2]);
    sunRef.current.target.position.set(cam.x, 0, cam.z - 4);
    sunRef.current.target.updateMatrixWorld();
  });

  const isHigh = quality === 'high';
  const isMedium = quality === 'medium';

  return (
    <>
      {/* Low ambient — most illumination comes from directional + hemisphere
          so surfaces facing the sky vs ground get naturally different tinting */}
      <ambientLight intensity={ambientIntensity} color="#e8c8b0" />

      {/* Strong hemisphere separation: cool sky blue above, warm court-bounce below.
          This is the single biggest contributor to "surfaces change color based on
          where the sun is" — up-facing surfaces get blue sky fill while down-facing
          surfaces (underside of arms, rim) get warm reflected court light. */}
      <hemisphereLight
        args={[
          '#d090b0',
          '#c08040',
          isHigh ? 0.8 : isMedium ? 0.7 : 0.55,
        ]}
      />

      {/* Key light (sun) — warm directional, follows camera for shadow quality.
          High intensity with warm tint creates the "sunlit side vs shadow side"
          color temperature difference on every surface. */}
      <directionalLight
        ref={sunRef}
        intensity={isHigh ? 2.8 : isMedium ? 2.4 : 1.9}
        color="#ffe0b0"
        castShadow
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={20}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-bias={-0.0004}
        shadow-normalBias={0.032}
        shadow-radius={isHigh ? 2.8 : isMedium ? 2.0 : 1}
      />

      {/* Fill light — cool sky bounce from opposite side of sun.
          Creates the blue-tinted shadow fill that makes shadows look realistic
          instead of just "darker". */}
      <directionalLight
        position={[-10, 16, -12]}
        intensity={isHigh ? 0.65 : isMedium ? 0.5 : 0.35}
        color="#b0cce8"
      />

      {/* Rim / back light — warm edge separation on player silhouette.
          Creates the bright rim outline you see on NBA broadcasts. */}
      <directionalLight
        position={[2, 14, -20]}
        intensity={isHigh ? 0.5 : isMedium ? 0.38 : 0.25}
        color="#ffe0b8"
      />

      {/* Ground bounce — simulates sunlight bouncing off the warm hardwood
          court back up onto player's legs, the ball underside, rim underside.
          This is the "color bleeding" from the court surface. */}
      <directionalLight
        position={[0, -3, -6]}
        intensity={isHigh ? 0.2 : 0.14}
        color="#d4a060"
      />

      {/* Secondary ground bounce — red paint area reflects slightly red-tinted
          light onto objects above the key/paint zone. */}
      <pointLight
        position={[0, 0.3, -10]}
        intensity={isHigh ? 0.15 : 0.08}
        color="#c88060"
        distance={8}
        decay={2}
      />

      {/* Accumulated soft shadows — dramatically better than ContactShadows.
          Jitters many lights across frames to build up raytraced-quality soft
          shadows with proper penumbra (crisp near feet, soft far away).
          Zero runtime cost after accumulation completes. */}
      {quality !== 'low' && (
        <AccumulativeShadows
          temporal
          frames={isHigh ? 60 : 35}
          scale={22}
          position={[0, 0.003, -6.5]}
          opacity={isHigh ? 0.7 : 0.5}
          alphaTest={0.7}
          color="#1a0e04"
          colorBlend={2.5}
          resolution={isHigh ? 1024 : 512}
        >
          <RandomizedLight
            amount={isHigh ? 8 : 5}
            radius={isHigh ? 4 : 3}
            ambient={0.4}
            position={SUN_DIR}
            intensity={isHigh ? 2.5 : 2.0}
            bias={0.001}
            mapSize={isHigh ? 512 : 256}
            size={12}
          />
        </AccumulativeShadows>
      )}
    </>
  );
}
