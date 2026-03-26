export type QualityLevel = 'high' | 'medium' | 'low';

const SHADOW_QUALITY: Record<QualityLevel, number> = {
  high: 2048,
  medium: 1024,
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
        intensity={1.3}
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
        shadow-bias={-0.001}
      />

      <directionalLight
        position={[-6, 12, -8]}
        intensity={0.35}
        color="#e0eaff"
      />

      <directionalLight
        position={[0, 10, -16]}
        intensity={0.25}
        color="#ffeedd"
      />

      <hemisphereLight
        args={['#87ceeb', '#8b6914', 0.3]}
      />
    </>
  );
}
