import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';

interface ThirdPersonCameraProps {
  runtime: GameRuntime;
  offset?: [number, number, number];
  lookAtOffset?: [number, number, number];
  smoothness?: number;
}

export function ThirdPersonCamera({
  runtime,
  offset = [0, 1.8, 3.5],
  lookAtOffset = [0, 1.3, -4],
  smoothness = 5,
}: ThirdPersonCameraProps) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());
  const targetPos = useRef(new THREE.Vector3());
  const lookAtPos = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useFrame((_, delta) => {
    const snapshot = runtime.getRenderState();
    const target = snapshot.playerPosition;

    targetPos.current.set(
      target[0] + offset[0],
      target[1] + offset[1],
      target[2] + offset[2],
    );
    lookAtPos.current.set(
      target[0] + lookAtOffset[0],
      target[1] + lookAtOffset[1],
      target[2] + lookAtOffset[2],
    );

    if (!initialized.current) {
      currentPos.current.copy(targetPos.current);
      currentLookAt.current.copy(lookAtPos.current);
      initialized.current = true;
    }

    const factor = 1 - Math.exp(-smoothness * delta);
    currentPos.current.lerp(targetPos.current, factor);
    currentLookAt.current.lerp(lookAtPos.current, factor);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
