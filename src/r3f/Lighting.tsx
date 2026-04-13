export type QualityLevel = 'high' | 'medium' | 'low';

const SHADOW_QUALITY: Record<QualityLevel, number> = {
  high: 2048,
  medium: 1280,
  low: 512,
};

interface LightingProps {
  shadowQuality?: number;
  ambientIntensity?: number;
  quality?: QualityLevel;
}

export function Lighting({ shadowQuality, ambientIntensity = 0.5, quality = 'high' }: LightingProps) {
  const mapSize = shadowQuality ?? SHADOW_QUALITY[quality];

  return (
    <>
      <ambientLight intensity={ambientIntensity} color="#fff8f0" />

      <directionalLight
        position={[8, 18, 5]}
        intensity={1.38}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={18}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
        shadow-bias={-0.00055}
        shadow-normalBias={0.028}
      />

      <directionalLight
        position={[-6, 12, -8]}
        intensity={0.42}
        color="#e8eeff"
      />

      <directionalLight
        position={[0, 10, -16]}
        intensity={0.32}
        color="#fff0e0"
      />

      <hemisphereLight
        args={['#9ec8f0', '#6b5a2a', 0.34]}
      />
    </>
  );
}
