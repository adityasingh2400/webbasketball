interface LightingProps {
  shadowQuality?: number;
  ambientIntensity?: number;
}

export function Lighting({ shadowQuality = 2048, ambientIntensity = 0.5 }: LightingProps) {
  return (
    <>
      <ambientLight intensity={ambientIntensity} color="#fff8f0" />

      {/* Main key light */}
      <directionalLight
        position={[8, 18, 5]}
        intensity={1.3}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={shadowQuality}
        shadow-mapSize-height={shadowQuality}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={18}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
        shadow-bias={-0.001}
      />

      {/* Fill light */}
      <directionalLight
        position={[-6, 12, -8]}
        intensity={0.35}
        color="#e0eaff"
      />

      {/* Rim/back light for depth */}
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
