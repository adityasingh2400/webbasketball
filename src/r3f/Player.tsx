import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';
import { createPlayerPose, solvePlayerPose } from './playerAnimation';

export interface ArmOverride {
  leftArm?: { x: number; y: number; z: number };
  leftForeArm?: { x: number; y: number; z: number };
  leftHand?: { x: number; y: number; z: number };
  rightArm?: { x: number; y: number; z: number };
  rightForeArm?: { x: number; y: number; z: number };
  rightHand?: { x: number; y: number; z: number };
}

import {
  createHairTexture,
  createJerseyFabricTexture,
  createPantsFabricTexture,
  createShoeLeatherTexture,
  createSkinTexture,
} from './playerTextures';
import {
  BASE_HEAD_Y,
  NECK_Y,
  NECK_RADIUS,
  NECK_LENGTH,
  ELBOW_OFFSET_Y,
  FOREARM_LEN,
  FOREARM_MESH_Y,
  FOREARM_R,
  FOREARM_TO_HAND_Y,
  HAND_PIVOT_Z,
  SHOULDER_X,
  SHOULDER_Y,
  UPPER_ARM_LEN,
  UPPER_ARM_MESH_Y,
  UPPER_ARM_R,
} from './playerRig';
import {
  SKIN_TOON,
  HAND_TOON,
  JERSEY_TOON,
  PANTS_TOON,
  HAIR_TOON,
  SHOE_TOON,
  SOCK_TOON,
  SHOE_SOLE_TOON,
  SHOE_MIDSOLE_TOON,
  TRIM_TOON,
} from './toonMaterial';

interface PlayerProps {
  runtime: GameRuntime;
  visible?: boolean;
  armOverride?: React.RefObject<ArmOverride | null>;
  torsoAccessory?: ReactNode;
}

const EYE_COLOR = '#1a1a2e';
const BROW_COLOR = '#3a251a';
const MOUTH_COLOR = '#a0522d';

const HIP_X = 0.115;
const THIGH_LEN = 0.27;
const THIGH_R = 0.072;
const THIGH_MESH_Y = -THIGH_LEN * 0.54;
const KNEE_OFFSET_Y = -(THIGH_LEN * 0.92 + THIGH_R);
const SHIN_LEN = 0.255;
const SHIN_MESH_Y = -SHIN_LEN * 0.55;
const ANKLE_OFFSET_Y = -(SHIN_LEN * 0.9 + 0.062);

export function Player({ runtime, visible = true, armOverride, torsoAccessory }: PlayerProps) {
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
  const leftShinRef = useRef<THREE.Group>(null);
  const leftFootRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);
  const rightFootRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const shadowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const poseRef = useRef(createPlayerPose());

  const jerseyMap = useMemo(() => createJerseyFabricTexture(), []);
  const pantsMap = useMemo(() => createPantsFabricTexture(), []);
  const skinMap = useMemo(() => createSkinTexture(), []);
  const shoeMap = useMemo(() => createShoeLeatherTexture(), []);
  const hairMap = useMemo(() => createHairTexture(), []);

  const skinMat = useMemo(() => { const m = SKIN_TOON(); m.map = skinMap; return m; }, [skinMap]);
  const handMat = useMemo(() => { const m = HAND_TOON(); m.map = skinMap; return m; }, [skinMap]);
  const jerseyMat = useMemo(() => JERSEY_TOON(jerseyMap), [jerseyMap]);
  const pantsMat = useMemo(() => PANTS_TOON(pantsMap), [pantsMap]);
  const hairMat = useMemo(() => HAIR_TOON(hairMap), [hairMap]);
  const shoeMat = useMemo(() => SHOE_TOON(shoeMap), [shoeMap]);
  const sockMat = useMemo(() => SOCK_TOON(), []);
  const soleMat = useMemo(() => SHOE_SOLE_TOON(), []);
  const midsoleMat = useMemo(() => SHOE_MIDSOLE_TOON(), []);
  const trimMat = useMemo(() => TRIM_TOON(), []);

  useEffect(() => {
    return () => {
      jerseyMap.dispose(); pantsMap.dispose(); skinMap.dispose();
      shoeMap.dispose(); hairMap.dispose();
      skinMat.dispose(); handMat.dispose(); jerseyMat.dispose();
      pantsMat.dispose(); hairMat.dispose(); shoeMat.dispose();
      sockMat.dispose(); soleMat.dispose(); midsoleMat.dispose();
      trimMat.dispose();
    };
  }, [jerseyMap, pantsMap, skinMap, shoeMap, hairMap,
      skinMat, handMat, jerseyMat, pantsMat, hairMat,
      shoeMat, sockMat, soleMat, midsoleMat, trimMat]);

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
    const leftShin = leftShinRef.current;
    const leftFoot = leftFootRef.current;
    const rightLeg = rightLegRef.current;
    const rightShin = rightShinRef.current;
    const rightFoot = rightFootRef.current;

    if (
      !torso || !head || !leftArm || !leftForeArm || !leftHand ||
      !rightArm || !rightForeArm || !rightHand ||
      !leftLeg || !leftShin || !leftFoot ||
      !rightLeg || !rightShin || !rightFoot
    ) {
      return;
    }

    solvePlayerPose(poseRef.current, snapshot, t, snapshot.bodyInputFrame);
    const pose = poseRef.current;

    const armOvr = armOverride?.current ?? null;
    if (armOvr) {
      if (armOvr.leftArm) pose.leftArm = { ...armOvr.leftArm };
      if (armOvr.leftForeArm) pose.leftForeArm = { ...armOvr.leftForeArm };
      if (armOvr.leftHand) pose.leftHand = { ...armOvr.leftHand };
      if (armOvr.rightArm) pose.rightArm = { ...armOvr.rightArm };
      if (armOvr.rightForeArm) pose.rightForeArm = { ...armOvr.rightForeArm };
      if (armOvr.rightHand) pose.rightHand = { ...armOvr.rightHand };
    }

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

    leftShin.rotation.set(pose.leftShin.x, pose.leftShin.y, pose.leftShin.z);
    rightShin.rotation.set(pose.rightShin.x, pose.rightShin.y, pose.rightShin.z);
    leftFoot.rotation.set(pose.leftFoot.x, pose.leftFoot.y, pose.leftFoot.z);
    rightFoot.rotation.set(pose.rightFoot.x, pose.rightFoot.y, pose.rightFoot.z);

    if (shadowRef.current) {
      shadowRef.current.scale.set(pose.shadowScale, pose.shadowScale, 1);
    }
    if (shadowMaterialRef.current) {
      shadowMaterialRef.current.opacity = pose.shadowOpacity;
    }
  });

  if (!visible) return null;

  function renderLeg(side: 'left' | 'right', legRef: React.RefObject<THREE.Group | null>, shinRef: React.RefObject<THREE.Group | null>, footRef: React.RefObject<THREE.Group | null>) {
    return (
      <group ref={legRef} position={[side === 'left' ? -HIP_X : HIP_X, 0.695, 0.01]}>
        <mesh position={[0, -0.01, 0.004]} castShadow scale={[1.02, 1, 0.92]}>
          <capsuleGeometry args={[0.064, 0.08, 8, 12]} />
          <primitive object={pantsMat} attach="material" />
        </mesh>
        <mesh position={[0, THIGH_MESH_Y, 0.005]} castShadow scale={[0.98, 1, 0.94]}>
          <capsuleGeometry args={[0.058, THIGH_LEN * 0.78, 8, 12]} />
          <primitive object={pantsMat} attach="material" />
        </mesh>
        <mesh position={[0, KNEE_OFFSET_Y - 0.008, 0.01]} castShadow scale={[1.04, 0.92, 1]}>
          <sphereGeometry args={[0.058, 12, 12]} />
          <primitive object={pantsMat} attach="material" />
        </mesh>
        <group ref={shinRef} position={[0, KNEE_OFFSET_Y - 0.015, 0]}>
          <mesh position={[0, SHIN_MESH_Y, 0.01]} castShadow scale={[0.96, 1, 0.92]}>
            <capsuleGeometry args={[0.05, SHIN_LEN * 0.72, 8, 12]} />
            <primitive object={pantsMat} attach="material" />
          </mesh>
          <mesh position={[0, -0.13, 0.014]} castShadow>
            <cylinderGeometry args={[0.053, 0.058, 0.065, 12]} />
            <primitive object={sockMat} attach="material" />
          </mesh>
          <group ref={footRef} position={[0, ANKLE_OFFSET_Y + 0.004, 0.03]}>
            <mesh position={[0, 0, 0.082]} castShadow scale={[1.04, 1, 0.96]}>
              <capsuleGeometry args={[0.044, 0.12, 8, 10]} />
              <primitive object={shoeMat} attach="material" />
            </mesh>
            <mesh position={[0, 0.002, 0.165]} castShadow scale={[1.2, 0.84, 1.18]}>
              <sphereGeometry args={[0.056, 12, 10]} />
              <primitive object={shoeMat} attach="material" />
            </mesh>
            <mesh position={[0, -0.048, 0.09]}>
              <boxGeometry args={[0.13, 0.026, 0.2]} />
              <primitive object={midsoleMat} attach="material" />
            </mesh>
            <mesh position={[0, -0.064, 0.09]}>
              <boxGeometry args={[0.136, 0.016, 0.208]} />
              <primitive object={soleMat} attach="material" />
            </mesh>
          </group>
        </group>
      </group>
    );
  }

  function renderArm(side: 'left' | 'right', armRef: React.RefObject<THREE.Group | null>, foreArmRef: React.RefObject<THREE.Group | null>, handRef: React.RefObject<THREE.Group | null>) {
    const sign = side === 'left' ? -1 : 1;
    return (
      <group ref={armRef} position={[sign * SHOULDER_X, SHOULDER_Y, 0.01]}>
        <mesh castShadow scale={[1.08, 0.94, 1.0]}>
          <sphereGeometry args={[0.088, 16, 16]} />
          <primitive object={jerseyMat} attach="material" />
        </mesh>
        <mesh position={[0, -0.04, 0]} castShadow scale={[1.0, 0.92, 0.96]}>
          <sphereGeometry args={[0.076, 14, 14]} />
          <primitive object={skinMat} attach="material" />
        </mesh>
        <mesh position={[0, UPPER_ARM_MESH_Y, 0]} castShadow scale={[1.02, 1, 0.9]}>
          <capsuleGeometry args={[UPPER_ARM_R, UPPER_ARM_LEN, 6, 10]} />
          <primitive object={skinMat} attach="material" />
        </mesh>
        <group ref={foreArmRef} position={[0, ELBOW_OFFSET_Y, 0]}>
          <mesh position={[sign * 0.002, -0.005, 0]} castShadow scale={[1.02, 0.9, 1.02]}>
            <sphereGeometry args={[0.048, 12, 12]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <mesh position={[0, FOREARM_MESH_Y, 0]} castShadow scale={[0.96, 1, 0.88]}>
            <capsuleGeometry args={[FOREARM_R, FOREARM_LEN, 6, 10]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <group ref={handRef} position={[0, FOREARM_TO_HAND_Y, HAND_PIVOT_Z]}>
            <mesh castShadow receiveShadow rotation={[0.04, 0, Math.PI / 2]} scale={[1.16, 1.8, 0.86]}>
              <sphereGeometry args={[0.034, 16, 18]} />
              <primitive object={handMat} attach="material" />
            </mesh>
            <mesh position={[sign * 0.056, -0.008, 0.034]} rotation={[0.2, 0, sign * 0.7]} castShadow scale={[0.78, 1.18, 0.72]}>
              <sphereGeometry args={[0.02, 12, 12]} />
              <primitive object={handMat} attach="material" />
            </mesh>
          </group>
        </group>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      <group ref={torsoRef}>
        {/* Main torso */}
        <mesh position={[0, 0.98, -0.01]} castShadow scale={[0.98, 0.86, 0.84]}>
          <capsuleGeometry args={[0.15, 0.34, 8, 16]} />
          <primitive object={jerseyMat} attach="material" />
        </mesh>

        {/* Jersey number plate */}
        <mesh position={[0, 0.79, 0.12]} castShadow>
          <boxGeometry args={[0.14, 0.13, 0.02]} />
          <primitive object={trimMat} attach="material" />
        </mesh>

        {/* Lower jersey overlap */}
        <mesh position={[0, 0.74, 0.01]} castShadow scale={[1.02, 0.84, 0.82]}>
          <capsuleGeometry args={[0.118, 0.1, 8, 14]} />
          <primitive object={jerseyMat} attach="material" />
        </mesh>

        {/* Shorts */}
        <mesh position={[0, 0.63, 0.005]} castShadow scale={[1.0, 1.0, 0.9]}>
          <capsuleGeometry args={[0.12, 0.14, 8, 14]} />
          <primitive object={pantsMat} attach="material" />
        </mesh>

        {/* Waistband trim */}
        <mesh position={[0, 0.545, 0.02]} castShadow scale={[0.94, 0.54, 0.76]}>
          <capsuleGeometry args={[0.09, 0.03, 8, 10]} />
          <primitive object={trimMat} attach="material" />
        </mesh>

        {/* Neck - short, wide, Wii-style */}
        <mesh position={[0, NECK_Y, 0.008]} castShadow scale={[1, 0.92, 0.95]}>
          <capsuleGeometry args={[NECK_RADIUS, NECK_LENGTH, 8, 12]} />
          <primitive object={skinMat} attach="material" />
        </mesh>

        <group ref={headRef} position={[0, BASE_HEAD_Y, 0.012]}>
          <mesh castShadow scale={[1.08, 1.14, 1.02]}>
            <sphereGeometry args={[0.158, 20, 20]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <mesh position={[0, 0.068, -0.016]} scale={[1.04, 1.04, 1.02]}>
            <sphereGeometry args={[0.154, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.57]} />
            <primitive object={hairMat} attach="material" />
          </mesh>
          <mesh position={[-0.162, 0.008, 0.012]} castShadow scale={[0.4, 0.68, 0.36]}>
            <sphereGeometry args={[0.034, 10, 10]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <mesh position={[0.162, 0.008, 0.012]} castShadow scale={[0.4, 0.68, 0.36]}>
            <sphereGeometry args={[0.034, 10, 10]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <mesh position={[-0.056, 0.032, 0.152]} rotation={[0, 0, -0.12]}>
            <boxGeometry args={[0.054, 0.01, 0.006]} />
            <meshBasicMaterial color={BROW_COLOR} />
          </mesh>
          <mesh position={[0.056, 0.032, 0.152]} rotation={[0, 0, 0.12]}>
            <boxGeometry args={[0.054, 0.01, 0.006]} />
            <meshBasicMaterial color={BROW_COLOR} />
          </mesh>
          <mesh position={[-0.054, 0.004, 0.154]} scale={[1.2, 1.15, 0.34]}>
            <sphereGeometry args={[0.021, 14, 14]} />
            <meshBasicMaterial color="#fafafa" />
          </mesh>
          <mesh position={[0.054, 0.004, 0.154]} scale={[1.2, 1.15, 0.34]}>
            <sphereGeometry args={[0.021, 14, 14]} />
            <meshBasicMaterial color="#fafafa" />
          </mesh>
          <mesh position={[-0.054, 0.004, 0.162]} scale={[0.74, 1.12, 0.22]}>
            <sphereGeometry args={[0.022, 14, 14]} />
            <meshBasicMaterial color={EYE_COLOR} />
          </mesh>
          <mesh position={[0.054, 0.004, 0.162]} scale={[0.74, 1.12, 0.22]}>
            <sphereGeometry args={[0.022, 14, 14]} />
            <meshBasicMaterial color={EYE_COLOR} />
          </mesh>
          <mesh position={[-0.05, 0.012, 0.166]} scale={[0.3, 0.3, 0.1]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.058, 0.012, 0.166]} scale={[0.3, 0.3, 0.1]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Nose - uses skin toon */}
          <mesh position={[0, -0.01, 0.162]} scale={[0.48, 0.58, 0.48]}>
            <sphereGeometry args={[0.016, 12, 12]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <mesh position={[0, -0.048, 0.154]} rotation={[0.08, 0, 0]}>
            <capsuleGeometry args={[0.005, 0.04, 4, 8]} />
            <meshBasicMaterial color={MOUTH_COLOR} />
          </mesh>
        </group>

        {renderArm('left', leftArmRef, leftForeArmRef, leftHandRef)}
        {renderArm('right', rightArmRef, rightForeArmRef, rightHandRef)}
        {renderLeg('left', leftLegRef, leftShinRef, leftFootRef)}
        {renderLeg('right', rightLegRef, rightShinRef, rightFootRef)}

        {torsoAccessory}
      </group>

      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.46, 24]} />
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
