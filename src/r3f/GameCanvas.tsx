import { useEffect, useRef } from 'react';
import { useFrame, Canvas, useThree } from '@react-three/fiber';
import { Environment as DreiEnvironment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, ToneMapping, SMAA, Vignette } from '@react-three/postprocessing';
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
import { Environment } from './Environment';
import type { GameRuntime, RuntimeControls } from '../engine/GameRuntime';
import { renderSunsetFrame } from '../components/SunsetSky';

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
        intensity={0.22}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      <N8AO
        aoRadius={0.52}
        distanceFalloff={0.55}
        intensity={0.3}
        halfRes
      />
      <Vignette
        offset={0.35}
        darkness={0.28}
      />
      <ToneMapping mode={ToneMappingMode.REINHARD} />
      <SMAA />
    </EffectComposer>
  );
}

function PostProcessingMedium() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.14}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.REINHARD} />
      <SMAA />
    </EffectComposer>
  );
}

function PostProcessingLow() {
  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={ToneMappingMode.REINHARD} />
    </EffectComposer>
  );
}

function PostProcessing({ quality = 'medium' }: { quality?: QualityLevel }) {
  if (quality === 'high') return <PostProcessingHigh />;
  if (quality === 'medium') return <PostProcessingMedium />;
  return <PostProcessingLow />;
}

const MAX_SIM_FPS = 120;
const MIN_SIM_INTERVAL = 1 / MAX_SIM_FPS;

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
  const simAccumulator = useRef(0);

  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 0.1);

    simAccumulator.current += clampedDelta;
    if (simAccumulator.current >= MIN_SIM_INTERVAL) {
      runtime.advance(simAccumulator.current, getControls());
      simAccumulator.current = 0;
    }

    if (!onRenderSample) return;

    smoothedFrameMs.current = THREE.MathUtils.lerp(smoothedFrameMs.current, clampedDelta * 1000, 0.16);
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

function SunsetBackground() {
  const { scene } = useThree();
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    canvasEl.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    texRef.current = tex;
    scene.background = tex;
    return () => {
      tex.dispose();
      if (scene.background === tex) scene.background = null;
    };
  }, [scene]);

  useFrame((state) => {
    const c = canvasEl.current;
    const tex = texRef.current;
    if (!c || !tex) return;
    const ctx = c.getContext('2d', { alpha: false });
    if (!ctx) return;
    renderSunsetFrame(ctx, c.width, c.height, state.clock.elapsedTime);
    tex.needsUpdate = true;
  });

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
  const envIntensity = 0.2;

  return (
    <>
      <SceneDriver runtime={runtime} getControls={getControls} onRenderSample={onRenderSample} />

      <SunsetBackground />
      <Lighting quality={quality} />
      <fog attach="fog" args={['#d4a0a0', 55, 100]} />

      {/* Custom environment with Lightformers: shapes the cubemap so that
          reflections on glossy surfaces (court floor, ball, shoes) show warm
          sun on one side and cool sky on the other — the "2K floor shader"
          effect where wood grain color varies by camera angle. */}
      <DreiEnvironment
        preset="sunset"
        environmentIntensity={envIntensity}
      >
        {/* Sun-side warm area light — large warm panel from the sun direction.
            Shows up as warm highlight streaks on the court when viewed at
            glancing angles toward the sun. */}
        <Lightformer
          form="rect"
          intensity={quality === 'high' ? 2.0 : 1.4}
          color="#ffb070"
          position={[8, 12, 6]}
          scale={[10, 6, 1]}
          target={[0, 0, -6]}
        />
        {/* Sky fill — large cool blue overhead panel.
            Makes up-facing reflections (puddles, wet surfaces, court polish)
            pick up sky color instead of uniform gray. */}
        <Lightformer
          form="rect"
          intensity={quality === 'high' ? 0.8 : 0.55}
          color="#c890c0"
          position={[0, 20, -6]}
          scale={[18, 18, 1]}
          target={[0, 0, -6]}
        />
        {/* Ground bounce warm panel — below horizon.
            Simulates warm light bouncing off grass/court hitting
            the underside of objects. */}
        <Lightformer
          form="rect"
          intensity={quality === 'high' ? 0.4 : 0.25}
          color="#d8a860"
          position={[0, -2, -6]}
          scale={[14, 4, 1]}
          target={[0, 3, -6]}
        />
      </DreiEnvironment>

      <Environment quality={quality} />
      <Court quality={quality} />
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
      <div className="sky-birds-overlay" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="sky-bird"
            style={{
              '--bird-y': `${12 + (i * 7) % 35}%`,
              '--bird-speed': `${22 + i * 4}s`,
              '--bird-delay': `${-i * 3.2}s`,
              '--bird-size': `${12 + (i % 3) * 5}px`,
              '--bird-opacity': `${0.25 + (i % 4) * 0.08}`,
              '--flap-speed': `${0.6 + (i % 3) * 0.15}s`,
            } as React.CSSProperties}
          >
            <svg
              width="var(--bird-size)"
              height="calc(var(--bird-size) * 0.55)"
              viewBox="0 0 24 14"
              fill="none"
              style={{ overflow: 'visible' }}
            >
              <path
                className="bird-wing-l"
                d="M12 8.1 Q9.2 6.9 6.1 5.5 Q3.7 4.6 1.2 4.9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
                style={{ transformOrigin: '12px 8px' }}
              />
              <path
                className="bird-wing-r"
                d="M12 8.1 Q14.8 6.9 17.9 5.5 Q20.3 4.6 22.8 4.9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
                style={{ transformOrigin: '12px 8px' }}
              />
              <ellipse cx="12" cy="8.5" rx="1.8" ry="1" fill="currentColor" opacity="0.52" />
            </svg>
          </div>
        ))}
      </div>
      <Canvas
        dpr={quality === 'high' ? [1, 1.75] : [1, 1.5]}
        shadows={quality === 'low' ? false : 'soft'}
        camera={{ fov: 55, near: 0.1, far: 120, position: [0, 8, 15] }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping,
        }}
        style={{
          background: '#0c0c18',
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
