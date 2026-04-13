import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';
import { createPlayerPose, solvePlayerPose } from './playerAnimation';
import {
  createHairTexture,
  createJerseyFabricTexture,
  createShortsFabricTexture,
  createShoeLeatherTexture,
  createSkinTexture,
} from './playerTextures';

interface PlayerProps {
  runtime: GameRuntime;
  visible?: boolean;
}

const JERSEY_TRIM = '#f8fafc';
const SHOE_SOLE = '#111827';
/** Temporary: obvious hand pass so updates are visible (swap back to skin map later). */
const HAND_DEBUG_COLOR = '#00e0ff';

/** Shoulder socket: higher on torso + slightly wider for longer arms */
const SHOULDER_Y = 1.3;
const SHOULDER_X = 0.28;
/** Upper arm capsule (radius, cylindrical length) + mesh center offset from shoulder */
const UPPER_ARM_LEN = 0.32;
const UPPER_ARM_R = 0.052;
const UPPER_ARM_MESH_Y = -UPPER_ARM_LEN * 0.66;
/** Elbow pivot distance down from shoulder (must match upper-arm reach) */
const ELBOW_OFFSET_Y = -(UPPER_ARM_LEN * 0.95 + UPPER_ARM_R * 1.15);
/** Forearm + hand chain */
const FOREARM_LEN = 0.3;
const FOREARM_R = 0.045;
const FOREARM_MESH_Y = -FOREARM_LEN * 0.55;
const FOREARM_TO_HAND_Y = -(FOREARM_LEN * 0.92 + FOREARM_R * 1.05);

export function Player({ runtime, visible = true }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const leftForeArmRef = useRef<THREE.Group>(null);
  const leftHandRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const rightForeArmRef = useRef<THREE.Group>(null);
  const rightHandRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const shadowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const poseRef = useRef(createPlayerPose());

  const jerseyMap = useMemo(() => createJerseyFabricTexture(), []);
  const shortsMap = useMemo(() => createShortsFabricTexture(), []);
  const skinMap = useMemo(() => createSkinTexture(), []);
  const shoeMap = useMemo(() => createShoeLeatherTexture(), []);
  const hairMap = useMemo(() => createHairTexture(), []);

  useEffect(() => {
    return () => {
      jerseyMap.dispose();
      shortsMap.dispose();
      skinMap.dispose();
      shoeMap.dispose();
      hairMap.dispose();
    };
  }, [jerseyMap, shortsMap, skinMap, shoeMap, hairMap]);

  useFrame((state) => {
    if (!visible || !groupRef.current) return;

    const snapshot = runtime.getRenderState();
    const t = state.clock.elapsedTime;

    const group = groupRef.current;
    const torso = torsoRef.current;
    const head = headRef.current;
    const leftArm = leftArmRef.current;
    const leftForeArm = leftForeArmRef.current;
    const leftHand = leftHandRef.current;
    const rightArm = rightArmRef.current;
    const rightForeArm = rightForeArmRef.current;
    const rightHand = rightHandRef.current;
    const leftLeg = leftLegRef.current;
    const rightLeg = rightLegRef.current;

    if (!torso || !head || !leftArm || !leftForeArm || !leftHand || !rightArm || !rightForeArm || !rightHand || !leftLeg || !rightLeg) {
      return;
    }

    solvePlayerPose(poseRef.current, snapshot, t);
    const pose = poseRef.current;

    group.position.set(snapshot.playerPosition[0], pose.rootY, snapshot.playerPosition[2]);
    group.rotation.y = Math.PI + pose.bodyYaw;

    torso.position.y = pose.torsoY;
    torso.rotation.set(pose.torsoPitch, pose.torsoYaw, pose.torsoRoll);

    head.position.y = pose.headY;
    head.rotation.set(pose.headPitch, 0, pose.headRoll);

    leftArm.rotation.set(pose.leftArm.x, pose.leftArm.y, pose.leftArm.z);
    leftForeArm.rotation.set(pose.leftForeArm.x, pose.leftForeArm.y, pose.leftForeArm.z);
    leftHand.rotation.set(pose.leftHand.x, pose.leftHand.y, pose.leftHand.z);
    rightArm.rotation.set(pose.rightArm.x, pose.rightArm.y, pose.rightArm.z);
    rightForeArm.rotation.set(pose.rightForeArm.x, pose.rightForeArm.y, pose.rightForeArm.z);
    rightHand.rotation.set(pose.rightHand.x, pose.rightHand.y, pose.rightHand.z);
    leftLeg.rotation.set(pose.leftLeg.x, pose.leftLeg.y, pose.leftLeg.z);
    rightLeg.rotation.set(pose.rightLeg.x, pose.rightLeg.y, pose.rightLeg.z);

    if (shadowRef.current) {
      shadowRef.current.scale.set(pose.shadowScale, pose.shadowScale, 1);
    }
    if (shadowMaterialRef.current) {
      shadowMaterialRef.current.opacity = pose.shadowOpacity;
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      <group ref={torsoRef}>
        <mesh position={[0, 1.03, 0]} castShadow>
          <capsuleGeometry args={[0.16, 0.5, 8, 16]} />
          <meshStandardMaterial map={jerseyMap} roughness={0.62} metalness={0.04} envMapIntensity={0.85} />
        </mesh>

        <mesh position={[0, 0.82, 0.13]} castShadow>
          <boxGeometry args={[0.14, 0.14, 0.02]} />
          <meshStandardMaterial color={JERSEY_TRIM} roughness={0.5} />
        </mesh>

        <mesh position={[0, 0.68, 0]} castShadow>
          <boxGeometry args={[0.38, 0.24, 0.24]} />
          <meshStandardMaterial map={shortsMap} roughness={0.78} metalness={0.04} envMapIntensity={0.65} />
        </mesh>

        <group ref={headRef} position={[0, 1.58, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.15, 20, 20]} />
            <meshStandardMaterial map={skinMap} roughness={0.58} metalness={0.02} envMapIntensity={0.5} />
          </mesh>
          <mesh position={[0, 0.05, -0.01]}>
            <sphereGeometry args={[0.145, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial map={hairMap} roughness={0.92} metalness={0.02} envMapIntensity={0.35} />
          </mesh>
        </group>

        <group ref={leftArmRef} position={[-SHOULDER_X, SHOULDER_Y, 0]}>
          <mesh position={[0, UPPER_ARM_MESH_Y, 0]} castShadow>
            <capsuleGeometry args={[UPPER_ARM_R, UPPER_ARM_LEN, 6, 10]} />
            <meshStandardMaterial map={skinMap} roughness={0.58} metalness={0.02} envMapIntensity={0.5} />
          </mesh>
          <group ref={leftForeArmRef} position={[0, ELBOW_OFFSET_Y, 0]}>
            <mesh position={[0, FOREARM_MESH_Y, 0]} castShadow>
              <capsuleGeometry args={[FOREARM_R, FOREARM_LEN, 6, 10]} />
              <meshStandardMaterial map={skinMap} roughness={0.6} metalness={0.02} envMapIntensity={0.5} />
            </mesh>
            <group ref={leftHandRef} position={[0, FOREARM_TO_HAND_Y, 0.018]}>
              <mesh castShadow receiveShadow scale={[1.2, 1.55, 1.05]}>
                <sphereGeometry args={[0.044, 16, 20]} />
                <meshStandardMaterial
                  color={HAND_DEBUG_COLOR}
                  roughness={0.42}
                  metalness={0.12}
                  envMapIntensity={0.85}
                />
              </mesh>
              <mesh position={[0.045, -0.034, 0.038]} castShadow scale={[1.1, 1.25, 1.05]}>
                <sphereGeometry args={[0.022, 8, 8]} />
                <meshStandardMaterial
                  color={HAND_DEBUG_COLOR}
                  roughness={0.44}
                  metalness={0.1}
                  envMapIntensity={0.8}
                />
              </mesh>
            </group>
          </group>
        </group>

        <group ref={rightArmRef} position={[SHOULDER_X, SHOULDER_Y, 0]}>
          <mesh position={[0, UPPER_ARM_MESH_Y, 0]} castShadow>
            <capsuleGeometry args={[UPPER_ARM_R, UPPER_ARM_LEN, 6, 10]} />
            <meshStandardMaterial map={skinMap} roughness={0.58} metalness={0.02} envMapIntensity={0.5} />
          </mesh>
          <group ref={rightForeArmRef} position={[0, ELBOW_OFFSET_Y, 0]}>
            <mesh position={[0, FOREARM_MESH_Y, 0]} castShadow>
              <capsuleGeometry args={[FOREARM_R, FOREARM_LEN, 6, 10]} />
              <meshStandardMaterial map={skinMap} roughness={0.6} metalness={0.02} envMapIntensity={0.5} />
            </mesh>
            <group ref={rightHandRef} position={[0, FOREARM_TO_HAND_Y, 0.018]}>
              <mesh castShadow receiveShadow scale={[1.2, 1.55, 1.05]}>
                <sphereGeometry args={[0.044, 16, 20]} />
                <meshStandardMaterial
                  color={HAND_DEBUG_COLOR}
                  roughness={0.42}
                  metalness={0.12}
                  envMapIntensity={0.85}
                />
              </mesh>
              <mesh position={[-0.045, -0.034, 0.038]} castShadow scale={[1.1, 1.25, 1.05]}>
                <sphereGeometry args={[0.022, 8, 8]} />
                <meshStandardMaterial
                  color={HAND_DEBUG_COLOR}
                  roughness={0.44}
                  metalness={0.1}
                  envMapIntensity={0.8}
                />
              </mesh>
            </group>
          </group>
        </group>

        <group ref={leftLegRef} position={[-0.11, 0.55, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.34, 6, 10]} />
            <meshStandardMaterial map={skinMap} roughness={0.6} metalness={0.02} envMapIntensity={0.5} />
          </mesh>
          <mesh position={[0, -0.46, 0.03]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.24]} />
            <meshStandardMaterial map={shoeMap} roughness={0.52} metalness={0.07} envMapIntensity={0.55} />
          </mesh>
          <mesh position={[0, -0.49, 0.07]}>
            <boxGeometry args={[0.14, 0.03, 0.22]} />
            <meshStandardMaterial color={SHOE_SOLE} roughness={0.95} />
          </mesh>
        </group>

        <group ref={rightLegRef} position={[0.11, 0.55, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.34, 6, 10]} />
            <meshStandardMaterial map={skinMap} roughness={0.6} metalness={0.02} envMapIntensity={0.5} />
          </mesh>
          <mesh position={[0, -0.46, 0.03]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.24]} />
            <meshStandardMaterial map={shoeMap} roughness={0.52} metalness={0.07} envMapIntensity={0.55} />
          </mesh>
          <mesh position={[0, -0.49, 0.07]}>
            <boxGeometry args={[0.14, 0.03, 0.22]} />
            <meshStandardMaterial color={SHOE_SOLE} roughness={0.95} />
          </mesh>
        </group>
      </group>

      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial
          ref={shadowMaterialRef}
          color={0x000000}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
