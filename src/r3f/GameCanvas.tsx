import { useRef } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { Sky, Environment as DreiEnvironment } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Court } from './Court';
import { Hoop } from './Hoop';
import { Player } from './Player';
import { Ball } from './Ball';
import { Lighting } from './Lighting';
import type { QualityLevel } from './Lighting';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { FrontViewPip } from './FrontViewPip';
import { FpsCapDriver } from './FpsCapDriver';
import { Environment } from './Environment';
import type { GameRuntime, RuntimeControls } from '../engine/GameRuntime';

export interface RenderDiagnostics {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
}

interface GameCanvasProps {
  runtime: GameRuntime;
  getControls: () => RuntimeControls;
  quality?: QualityLevel;
  onRenderSample?: (sample: RenderDiagnostics) => void;
  /** Inset front-facing camera (same scene, second pass). Default true. */
  frontViewPip?: boolean;
}

function PostProcessingHigh() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.28}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <N8AO
        aoRadius={0.4}
        distanceFalloff={0.45}
        intensity={0.8}
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
        intensity={0.16}
        luminanceThreshold={0.86}
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
    </EffectComposer>
  );
}

function PostProcessing({ quality = 'medium' }: { quality?: QualityLevel }) {
  if (quality === 'high') return <PostProcessingHigh />;
  if (quality === 'medium') return <PostProcessingMedium />;
  return <PostProcessingLow />;
}

function SceneDriver({
  runtime,
  getControls,
  onRenderSample,
}: {
  runtime: GameRuntime;
  getControls: () => RuntimeControls;
  onRenderSample?: (sample: RenderDiagnostics) => void;
}) {
  const smoothedFrameMs = useRef(16.7);
  const lastReportTime = useRef(0);

  useFrame((state, delta) => {
    runtime.advance(delta, getControls());

    if (!onRenderSample) return;

    smoothedFrameMs.current = THREE.MathUtils.lerp(smoothedFrameMs.current, delta * 1000, 0.16);
    if (state.clock.elapsedTime - lastReportTime.current >= 0.2) {
      onRenderSample({
        fps: 1000 / Math.max(smoothedFrameMs.current, 0.001),
        frameMs: smoothedFrameMs.current,
        drawCalls: state.gl.info.render.calls,
        triangles: state.gl.info.render.triangles,
      });
      lastReportTime.current = state.clock.elapsedTime;
    }
  }, -100);

  return null;
}

function SceneContent({
  runtime,
  getControls,
  quality = 'medium',
  onRenderSample,
  frontViewPip = true,
}: {
  runtime: GameRuntime;
  getControls: () => RuntimeControls;
  quality?: QualityLevel;
  onRenderSample: (sample: RenderDiagnostics) => void;
  frontViewPip?: boolean;
}) {
  return (
    <>
      <FpsCapDriver />
      <SceneDriver runtime={runtime} getControls={getControls} onRenderSample={onRenderSample} />

      <Lighting quality={quality} />
      <fog attach="fog" args={['#d4c4a0', 52, 96]} />

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
      <DreiEnvironment preset="sunset" environmentIntensity={quality === 'high' ? 0.32 : quality === 'medium' ? 0.27 : 0.2} />

      <Environment quality={quality} />
      <Court />
      <Hoop runtime={runtime} position={[0, 3.05, -13]} />
      <Player runtime={runtime} />
      <Ball runtime={runtime} />
      <ThirdPersonCamera runtime={runtime} offset={[0, 1.85, 3.4]} lookAtOffset={[0, 1.35, -4]} smoothness={5} />

      <PostProcessing quality={quality} />
      {frontViewPip ? <FrontViewPip runtime={runtime} /> : null}
    </>
  );
}

export function GameCanvas({
  runtime,
  getControls,
  quality = 'medium',
  onRenderSample,
  frontViewPip = true,
}: GameCanvasProps) {
  return (
    <div className="r3f-canvas-wrap">
      <Canvas
        frameloop="never"
        dpr={quality === 'high' ? [1, 1.75] : [1, 1.5]}
        shadows={quality === 'low' ? false : 'soft'}
        camera={{ fov: 55, near: 0.1, far: 120, position: [0, 8, 15] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        style={{
          background: 'linear-gradient(180deg, #5b9ed6 0%, #87CEEB 25%, #a8d8ea 50%, #d4e8d0 80%, #e8e0c8 100%)',
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      >
        <SceneContent
          runtime={runtime}
          getControls={getControls}
          quality={quality}
          onRenderSample={onRenderSample ?? (() => {})}
          frontViewPip={frontViewPip}
        />
      </Canvas>
      {frontViewPip ? (
        <div className="front-view-pip-hud" aria-hidden>
          <span className="front-view-pip-hud__title">Front</span>
        </div>
      ) : null}
    </div>
  );
}
