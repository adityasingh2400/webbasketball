import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';
import type { BallHandlingState } from '../engine/BallStateMachine';
import { useBasketballMaterialMaps } from './basketballTexture';
import { BASKETBALL_RADIUS } from './playerRig';
import { BALL_TOON } from './toonMaterial';

interface BallProps {
  runtime: GameRuntime;
  visible?: boolean;
}

function isDribblingState(state: BallHandlingState): boolean {
  return (
    state === 'DRIBBLE_RIGHT_DOWN' ||
    state === 'DRIBBLE_RIGHT_UP' ||
    state === 'DRIBBLE_LEFT_DOWN' ||
    state === 'DRIBBLE_LEFT_UP' ||
    state === 'CROSSOVER_R2L' ||
    state === 'CROSSOVER_L2R'
  );
}

function isShootingMotionState(state: BallHandlingState): boolean {
  return state === 'SHOOTING' || state === 'FOLLOW_THROUGH';
}

export function Ball({ runtime, visible = true }: BallProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { map } = useBasketballMaterialMaps();
  const ballMat = useMemo(() => BALL_TOON(map), [map]);
  useEffect(() => () => { ballMat.dispose(); }, [ballMat]);
  const lastPosition = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!visible || !meshRef.current) return;

    const snapshot = runtime.getRenderState();
    const [x, y, z] = snapshot.ballPosition;
    const nextPosition = new THREE.Vector3(x, y, z);
    const velocity = nextPosition.clone().sub(lastPosition.current);

    meshRef.current.position.copy(nextPosition);

    const state = snapshot.ballState;
    const inFlight = snapshot.ballInFlight;
    const travelSpin = isDribblingState(state) ? 16 : isShootingMotionState(state) || inFlight ? 11 : 6;
    const authoredSpin = snapshot.ballSpinRate * delta * 1.6;
    meshRef.current.rotation.x += velocity.length() * travelSpin + delta * 0.85;
    meshRef.current.rotation.z += velocity.x * 5.2 + authoredSpin * 0.72;
    meshRef.current.rotation.y += velocity.z * 5.2 + authoredSpin * 0.42;

    lastPosition.current.copy(nextPosition);
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[BASKETBALL_RADIUS, 48, 40]} />
      <primitive object={ballMat} attach="material" />
    </mesh>
  );
}
