import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface ThirdPersonCameraProps {
  target: [number, number, number];
  offset?: [number, number, number];
  lookAtOffset?: [number, number, number];
  smoothness?: number;
}

const DEFAULT_OFFSET: [number, number, number] = [0, 4, 8];
const DEFAULT_LOOK_AT_OFFSET: [number, number, number] = [0, 1, 0];
const DEFAULT_SMOOTHNESS = 5;

export default function ThirdPersonCamera({
  target,
  offset = DEFAULT_OFFSET,
  lookAtOffset = DEFAULT_LOOK_AT_OFFSET,
  smoothness = DEFAULT_SMOOTHNESS,
}: ThirdPersonCameraProps) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const targetPos = new THREE.Vector3(
      target[0] + offset[0],
      target[1] + offset[1],
      target[2] + offset[2]
    );

    const lookAtPos = new THREE.Vector3(
      target[0] + lookAtOffset[0],
      target[1] + lookAtOffset[1],
      target[2] + lookAtOffset[2]
    );

    const lerpFactor = 1 - Math.exp(-smoothness * delta);

    currentPos.current.lerp(targetPos, lerpFactor);
    currentLookAt.current.lerp(lookAtPos, lerpFactor);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
