import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Player, type ArmOverride } from '../r3f/Player';
import { Lighting } from '../r3f/Lighting';
import { GameRuntime, type RuntimeControls } from '../engine/GameRuntime';
import { useBasketballMaterialMaps } from '../r3f/basketballTexture';
import { BASKETBALL_RADIUS } from '../r3f/playerRig';
import {
  SHOT_PHASE_DEPTH_RANGE,
  SHOT_PHASES,
  lerpPhaseAngles,
} from '../data/shotPhases';
import {
  cloneBallPose,
  clonePhaseAngles,
  cloneShotPhase,
  lerpBallPose,
  measureBallSnapGap,
  savePhaseProgression,
  snapArmToBall,
  type ArmAngles,
  type BallPose,
  type PhaseAngles,
  type RigArmSide,
  type ShotPhase,
} from './poseMirrorState';
import './PoseMirror.css';

interface PoseMirrorProps {
  onBack: () => void;
}

function anglesToOverride(a: PhaseAngles): ArmOverride {
  return {
    leftArm: { x: a.right.shoulderX, y: a.right.shoulderY, z: a.right.shoulderZ },
    leftForeArm: { x: a.right.elbowX, y: a.right.elbowY, z: a.right.elbowZ },
    leftHand: { x: a.right.wristX, y: a.right.wristY, z: a.right.wristZ },
    rightArm: { x: a.left.shoulderX, y: a.left.shoulderY, z: a.left.shoulderZ },
    rightForeArm: { x: a.left.elbowX, y: a.left.elbowY, z: a.left.elbowZ },
    rightHand: { x: a.left.wristX, y: a.left.wristY, z: a.left.wristZ },
  };
}

function editorSideToRigSide(side: ArmSide): RigArmSide {
  return side === 'right' ? 'left' : 'right';
}

const PLAYER_CENTER = new THREE.Vector3(0, 1.15, -4);
const CAM_DIST = 2.4;

const VIEWS: { label: string; camPos: [number, number, number] }[] = [
  { label: 'Front',       camPos: [0, 1.3, -4 - CAM_DIST] },
  { label: '¾ Right',     camPos: [CAM_DIST * 0.7, 1.35, -4 - CAM_DIST * 0.7] },
  { label: 'Right Side',  camPos: [CAM_DIST, 1.3, -4] },
  { label: 'Back',        camPos: [0, 1.35, -4 + CAM_DIST] },
];

function FixedCamera({ position }: { position: [number, number, number] }) {
  useFrame(({ camera }) => {
    camera.position.set(...position);
    camera.lookAt(PLAYER_CENTER);
  });
  return null;
}

function IdleDriver({ runtime }: { runtime: GameRuntime }) {
  const controls = useRef<RuntimeControls>({
    webcamActive: false,
    hand: { hasHand: false, playerX: 0, playerZ: 0, velocity: { x: 0, y: 0 }, handedness: 'Right', released: false },
    moveX: 0, moveZ: 0, dribblePressed: false, shootHeld: false, shootReleased: false,
  });
  useFrame((_s, delta) => { runtime.advance(Math.min(delta, 0.05), controls.current); }, -100);
  return null;
}

function AnimatorBasketball({ ballRef }: { ballRef: React.RefObject<BallPose> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { map, bumpMap, roughnessMap } = useBasketballMaterialMaps();

  useFrame(() => {
    if (!meshRef.current) return;
    const { x, y, z } = ballRef.current;
    meshRef.current.position.set(x, y, z);
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[BASKETBALL_RADIUS, 40, 32]} />
      <meshPhysicalMaterial
        color="#f2d8c8"
        map={map}
        bumpMap={bumpMap}
        bumpScale={0.014}
        roughness={0.84}
        roughnessMap={roughnessMap}
        metalness={0.02}
        clearcoat={0.08}
        clearcoatRoughness={0.74}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

function ViewScene({ runtime, armRef, ballRef, showDriver }: {
  runtime: GameRuntime;
  armRef: React.RefObject<ArmOverride | null>;
  ballRef: React.RefObject<BallPose>;
  showDriver?: boolean;
}) {
  return (
    <>
      {showDriver && <IdleDriver runtime={runtime} />}
      <Lighting quality="medium" ambientIntensity={0.34} />
      <Player runtime={runtime} armOverride={armRef} torsoAccessory={<AnimatorBasketball ballRef={ballRef} />} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#242434" roughness={0.96} />
      </mesh>
    </>
  );
}

function ViewPanel({ label, camPos, runtime, armRef, ballRef, showDriver }: {
  label: string; camPos: [number, number, number]; runtime: GameRuntime;
  armRef: React.RefObject<ArmOverride | null>;
  ballRef: React.RefObject<BallPose>;
  showDriver?: boolean;
}) {
  return (
    <div className="pose-view">
      <Canvas
        camera={{ fov: 34, near: 0.1, far: 30, position: camPos }}
        gl={{ antialias: true }}
        shadows="soft"
        style={{ background: '#131320' }}
      >
        <FixedCamera position={camPos} />
        <ViewScene runtime={runtime} armRef={armRef} ballRef={ballRef} showDriver={showDriver} />
      </Canvas>
      <span className="pose-view__label">{label}</span>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, color }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color?: string;
}) {
  return (
    <div className="pose-slider">
      <label className="pose-slider__label">
        <span>{label}</span>
        <span className="pose-slider__value" style={color ? { color } : undefined}>{value.toFixed(2)}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="pose-slider__input" />
    </div>
  );
}

type ArmSide = 'right' | 'left';

export default function PoseMirror({ onBack }: PoseMirrorProps) {
  const armRef = useRef<ArmOverride | null>(null);
  const ballRef = useRef<BallPose>(cloneBallPose(SHOT_PHASES[0].ball));
  const runtimeRef = useRef<GameRuntime | null>(null);
  const [phases, setPhases] = useState<ShotPhase[]>(() => SHOT_PHASES.map(cloneShotPhase));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [angles, setAngles] = useState<PhaseAngles>(() => clonePhaseAngles(SHOT_PHASES[0].angles));
  const [ballPosition, setBallPosition] = useState<BallPose>(() => cloneBallPose(SHOT_PHASES[0].ball));
  const [activeSide, setActiveSide] = useState<ArmSide>('right');
  const [playing, setPlaying] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(0);
  const [seedNextPhaseOnSave, setSeedNextPhaseOnSave] = useState(true);
  const playRafRef = useRef(0);

  if (!runtimeRef.current) runtimeRef.current = new GameRuntime();

  const applyPreview = useCallback((nextAngles: PhaseAngles, nextBall: BallPose) => {
    armRef.current = anglesToOverride(nextAngles);
    ballRef.current = cloneBallPose(nextBall);
  }, []);

  useEffect(() => { applyPreview(angles, ballPosition); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectPhase = useCallback((idx: number) => {
    const nextAngles = clonePhaseAngles(phases[idx].angles);
    const nextBall = cloneBallPose(phases[idx].ball);
    setSelectedIdx(idx);
    setAngles(nextAngles);
    setBallPosition(nextBall);
    applyPreview(nextAngles, nextBall);
  }, [phases, applyPreview]);

  const updateSlider = useCallback((side: ArmSide, field: keyof ArmAngles, value: number) => {
    setAngles((prev) => {
      const next = { ...prev, [side]: { ...prev[side], [field]: value } };
      applyPreview(next, ballPosition);
      return next;
    });
  }, [applyPreview, ballPosition]);

  const updateBallPosition = useCallback((field: keyof BallPose, value: number) => {
    setBallPosition((prev) => {
      const next = { ...prev, [field]: value };
      applyPreview(angles, next);
      return next;
    });
  }, [angles, applyPreview]);

  const snapActiveHandToBall = useCallback(() => {
    setAngles((prev) => {
      const snappedArm = snapArmToBall(editorSideToRigSide(activeSide), prev[activeSide], ballPosition);
      const next = { ...prev, [activeSide]: snappedArm };
      applyPreview(next, ballPosition);
      return next;
    });
  }, [activeSide, applyPreview, ballPosition]);

  const saveCurrentPhase = useCallback(() => {
    const result = savePhaseProgression(phases, selectedIdx, angles, ballPosition, seedNextPhaseOnSave);
    setPhases(result.phases);
    setSelectedIdx(result.selectedIdx);
    setAngles(result.angles);
    setBallPosition(result.ball);
    applyPreview(result.angles, result.ball);
  }, [phases, selectedIdx, angles, ballPosition, seedNextPhaseOnSave, applyPreview]);

  const updateDuration = useCallback((idx: number, dur: number) => {
    setPhases((prev) => prev.map((p, i) => i === idx ? { ...p, duration: dur } : p));
  }, []);

  const stopPlayback = useCallback(() => {
    setPlaying(false);
    if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
    playRafRef.current = 0;
  }, []);

  const startPlayback = useCallback((fromIdx = 0) => {
    stopPlayback();
    setPlaying(true);
    setPlayingIdx(fromIdx);

    const phasesSnapshot = phases.map(cloneShotPhase);
    let currentPhaseIdx = fromIdx;
    let phaseStartTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const phaseElapsed = (now - phaseStartTime) / 1000;
      const phaseDur = phasesSnapshot[currentPhaseIdx].duration;

      if (phaseElapsed >= phaseDur) {
        currentPhaseIdx++;
        if (currentPhaseIdx >= phasesSnapshot.length) {
          setPlaying(false);
          setPlayingIdx(phasesSnapshot.length - 1);
          const lastPhase = phasesSnapshot[phasesSnapshot.length - 1];
          applyPreview(lastPhase.angles, lastPhase.ball);
          return;
        }
        phaseStartTime = now;
        setPlayingIdx(currentPhaseIdx);
        playRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const t = Math.min(1, phaseElapsed / phaseDur);
      const nextIdx = Math.min(currentPhaseIdx + 1, phasesSnapshot.length - 1);
      const blendedAngles = lerpPhaseAngles(phasesSnapshot[currentPhaseIdx].angles, phasesSnapshot[nextIdx].angles, t);
      const blendedBall = lerpBallPose(phasesSnapshot[currentPhaseIdx].ball, phasesSnapshot[nextIdx].ball, t);
      applyPreview(blendedAngles, blendedBall);
      playRafRef.current = requestAnimationFrame(tick);
    };

    playRafRef.current = requestAnimationFrame(tick);
  }, [phases, applyPreview, stopPlayback]);

  useEffect(() => {
    return () => { if (playRafRef.current) cancelAnimationFrame(playRafRef.current); };
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(phases, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shot-phases-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [phases]);

  const totalDuration = phases.reduce((s, p) => s + p.duration, 0);
  const rt = runtimeRef.current;
  const currentArm = angles[activeSide];
  const snapGap = measureBallSnapGap(editorSideToRigSide(activeSide), currentArm, ballPosition);
  const hasNextPhase = selectedIdx < phases.length - 1;
  const saveButtonLabel = seedNextPhaseOnSave && hasNextPhase
    ? `Save + Next (#${selectedIdx + 2})`
    : `Save Phase #${selectedIdx + 1}`;
  const seedHint = hasNextPhase
    ? `Saving phase ${selectedIdx + 1} copies this pose into phase ${selectedIdx + 2} so you can keep iterating forward.`
    : 'This is the last phase, so saving keeps you on the current pose.';

  return (
    <div className="pose-editor">
      <div className="pose-editor__views">
        {VIEWS.map((v, i) => (
          <ViewPanel key={v.label} label={v.label} camPos={v.camPos} runtime={rt} armRef={armRef} ballRef={ballRef} showDriver={i === 0} />
        ))}
      </div>

      <div className="pose-editor__sidebar">
        <h2>Shot Animator</h2>

        <div className="pose-editor__transport">
          <button className="pose-editor__btn pose-editor__btn--play" onClick={() => startPlayback(0)} disabled={playing}>Play All</button>
          <button className="pose-editor__btn" onClick={() => startPlayback(selectedIdx)} disabled={playing}>From #{selectedIdx + 1}</button>
          {playing && <button className="pose-editor__btn pose-editor__btn--stop" onClick={stopPlayback}>Stop</button>}
          <span className="pose-editor__total">{totalDuration.toFixed(2)}s</span>
        </div>

        <div className="pose-editor__phase-list">
          {phases.map((p, i) => (
            <button key={i}
              className={`pose-editor__phase ${i === selectedIdx ? 'pose-editor__phase--selected' : ''} ${playing && i === playingIdx ? 'pose-editor__phase--playing' : ''}`}
              onClick={() => { if (!playing) selectPhase(i); }}
            >
              <span className="pose-editor__phase-name">{p.name}</span>
              <input type="number" className="pose-editor__phase-dur" value={p.duration} min={0.01} max={2} step={0.01}
                onClick={(e) => e.stopPropagation()} onChange={(e) => updateDuration(i, parseFloat(e.target.value) || 0.05)} />
              <span className="pose-editor__phase-unit">s</span>
            </button>
          ))}
        </div>

        <div className="pose-editor__seed">
          <label className="pose-editor__seed-toggle">
            <input
              type="checkbox"
              checked={seedNextPhaseOnSave}
              onChange={(e) => setSeedNextPhaseOnSave(e.target.checked)}
            />
            Seed next phase from saved pose
          </label>
          <p className="pose-editor__seed-hint">{seedHint}</p>
        </div>

        <div className="pose-editor__arm-tabs">
          <button className={`pose-editor__arm-tab ${activeSide === 'right' ? 'pose-editor__arm-tab--active' : ''}`} onClick={() => setActiveSide('right')}>
            Right Arm (shooting)
          </button>
          <button className={`pose-editor__arm-tab ${activeSide === 'left' ? 'pose-editor__arm-tab--active' : ''}`} onClick={() => setActiveSide('left')}>
            Left Arm (guide)
          </button>
        </div>

        <div className="pose-editor__section">
          <h3>Ball — Phase #{selectedIdx + 1}</h3>
          <SliderRow label="Side (X)" value={ballPosition.x} min={-0.4} max={0.4} step={0.005} onChange={(v) => updateBallPosition('x', v)} color="#ffb347" />
          <SliderRow label="Height (Y)" value={ballPosition.y} min={0.75} max={1.9} step={0.005} onChange={(v) => updateBallPosition('y', v)} color="#ffd56b" />
          <SliderRow
            label="Depth (Z)"
            value={ballPosition.z}
            min={SHOT_PHASE_DEPTH_RANGE.min}
            max={SHOT_PHASE_DEPTH_RANGE.max}
            step={0.005}
            onChange={(v) => updateBallPosition('z', v)}
            color="#ff8c42"
          />
          <div className="pose-editor__ball-actions">
            <button className="pose-editor__btn pose-editor__btn--snap" onClick={snapActiveHandToBall} disabled={playing}>
              Snap {activeSide === 'right' ? 'Right' : 'Left'} Hand To Ball
            </button>
            <span className="pose-editor__ball-hint">Current gap: {snapGap.toFixed(3)}</span>
          </div>
        </div>

        <div className="pose-editor__section">
          <h3>Shoulder — {activeSide === 'right' ? 'Right' : 'Left'} — Phase #{selectedIdx + 1}</h3>
          <SliderRow label="Pitch (X)" value={currentArm.shoulderX} min={-3.14} max={3.14} step={0.01} onChange={(v) => updateSlider(activeSide, 'shoulderX', v)} color="#ff6b6b" />
          <SliderRow label="Yaw (Y)" value={currentArm.shoulderY} min={-1.5} max={1.5} step={0.01} onChange={(v) => updateSlider(activeSide, 'shoulderY', v)} color="#6bff6b" />
          <SliderRow label="Roll (Z)" value={currentArm.shoulderZ} min={-3.14} max={3.14} step={0.01} onChange={(v) => updateSlider(activeSide, 'shoulderZ', v)} color="#6b9fff" />
        </div>

        <div className="pose-editor__section">
          <h3>Elbow — {activeSide === 'right' ? 'Right' : 'Left'} — Phase #{selectedIdx + 1}</h3>
          <SliderRow label="Pitch (X)" value={currentArm.elbowX} min={-3.14} max={3.14} step={0.01} onChange={(v) => updateSlider(activeSide, 'elbowX', v)} color="#ff6b6b" />
          <SliderRow label="Yaw (Y)" value={currentArm.elbowY} min={-1.5} max={1.5} step={0.01} onChange={(v) => updateSlider(activeSide, 'elbowY', v)} color="#6bff6b" />
          <SliderRow label="Roll (Z)" value={currentArm.elbowZ} min={-3.14} max={3.14} step={0.01} onChange={(v) => updateSlider(activeSide, 'elbowZ', v)} color="#6b9fff" />
        </div>

        <div className="pose-editor__section">
          <h3>Wrist — {activeSide === 'right' ? 'Right' : 'Left'} — Phase #{selectedIdx + 1}</h3>
          <SliderRow label="Pitch (X)" value={currentArm.wristX} min={-2.0} max={2.0} step={0.01} onChange={(v) => updateSlider(activeSide, 'wristX', v)} color="#ff6b6b" />
          <SliderRow label="Yaw (Y)" value={currentArm.wristY} min={-1.0} max={1.0} step={0.01} onChange={(v) => updateSlider(activeSide, 'wristY', v)} color="#6bff6b" />
          <SliderRow label="Roll (Z)" value={currentArm.wristZ} min={-1.5} max={1.5} step={0.01} onChange={(v) => updateSlider(activeSide, 'wristZ', v)} color="#6b9fff" />
        </div>

        <div className="pose-editor__actions">
          <button className="pose-editor__btn pose-editor__btn--save" onClick={saveCurrentPhase}>{saveButtonLabel}</button>
          <button className="pose-editor__btn" onClick={handleDownload}>Export JSON</button>
        </div>

        <button className="pose-editor__btn pose-editor__btn--back" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
