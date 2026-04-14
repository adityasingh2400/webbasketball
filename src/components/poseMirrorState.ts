import * as THREE from 'three';
import {
  BASKETBALL_RADIUS,
  ELBOW_OFFSET_Y,
  FOREARM_TO_HAND_Y,
  HAND_PIVOT_Z,
  SHOULDER_X,
  SHOULDER_Y,
} from '../r3f/playerRig';
import type {
  ArmAngles,
  BallPose,
  PhaseAngles,
  ShotPhase,
} from '../data/shotPhases';

export type { ArmAngles, BallPose, PhaseAngles, ShotPhase } from '../data/shotPhases';

export interface SavePhaseResult {
  phases: ShotPhase[];
  selectedIdx: number;
  angles: PhaseAngles;
  ball: BallPose;
}

export type RigArmSide = 'left' | 'right';

const HAND_CONTACT_OFFSET = 0.072;

const ARM_FIELD_LIMITS: Record<keyof ArmAngles, { min: number; max: number; changeWeight: number }> = {
  shoulderX: { min: -3.14, max: 3.14, changeWeight: 3.2 },
  shoulderY: { min: -1.5, max: 1.5, changeWeight: 2.8 },
  shoulderZ: { min: -3.14, max: 3.14, changeWeight: 2.8 },
  elbowX: { min: -3.14, max: 3.14, changeWeight: 2.1 },
  elbowY: { min: -1.5, max: 1.5, changeWeight: 1.8 },
  elbowZ: { min: -3.14, max: 3.14, changeWeight: 1.8 },
  wristX: { min: -2.0, max: 2.0, changeWeight: 0.9 },
  wristY: { min: -1.0, max: 1.0, changeWeight: 0.8 },
  wristZ: { min: -1.5, max: 1.5, changeWeight: 0.8 },
};

const ARM_FIELD_ORDER: (keyof ArmAngles)[] = [
  'shoulderX',
  'shoulderY',
  'elbowX',
  'elbowY',
  'wristX',
  'wristY',
  'shoulderZ',
  'elbowZ',
  'wristZ',
];

const SHOULDER_POSITIONS: Record<RigArmSide, THREE.Vector3> = {
  left: new THREE.Vector3(-SHOULDER_X, SHOULDER_Y, 0.01),
  right: new THREE.Vector3(SHOULDER_X, SHOULDER_Y, 0.01),
};

export function cloneArmAngles(angles: ArmAngles): ArmAngles {
  return { ...angles };
}

export function cloneBallPose(ball: BallPose): BallPose {
  return { ...ball };
}

export function clonePhaseAngles(angles: PhaseAngles): PhaseAngles {
  return {
    right: cloneArmAngles(angles.right),
    left: cloneArmAngles(angles.left),
  };
}

export function cloneShotPhase(phase: ShotPhase): ShotPhase {
  return {
    ...phase,
    angles: clonePhaseAngles(phase.angles),
    ball: cloneBallPose(phase.ball),
  };
}

export function lerpBallPose(a: BallPose, b: BallPose, t: number): BallPose {
  const l = (v1: number, v2: number) => v1 + (v2 - v1) * t;
  return {
    x: l(a.x, b.x),
    y: l(a.y, b.y),
    z: l(a.z, b.z),
  };
}

export function savePhaseProgression(
  phases: ShotPhase[],
  selectedIdx: number,
  angles: PhaseAngles,
  ball: BallPose,
  seedNextPhaseOnSave: boolean,
): SavePhaseResult {
  if (phases.length === 0) {
    return {
      phases: [],
      selectedIdx: 0,
      angles: clonePhaseAngles(angles),
      ball: cloneBallPose(ball),
    };
  }

  const clampedIdx = Math.min(Math.max(selectedIdx, 0), phases.length - 1);
  const savedAngles = clonePhaseAngles(angles);
  const savedBall = cloneBallPose(ball);
  const nextPhases = phases.map(cloneShotPhase);

  nextPhases[clampedIdx] = {
    ...nextPhases[clampedIdx],
    angles: clonePhaseAngles(savedAngles),
    ball: cloneBallPose(savedBall),
  };

  if (!seedNextPhaseOnSave || clampedIdx >= nextPhases.length - 1) {
    return {
      phases: nextPhases,
      selectedIdx: clampedIdx,
      angles: clonePhaseAngles(savedAngles),
      ball: cloneBallPose(savedBall),
    };
  }

  const nextIdx = clampedIdx + 1;
  nextPhases[nextIdx] = {
    ...nextPhases[nextIdx],
    angles: clonePhaseAngles(savedAngles),
    ball: cloneBallPose(savedBall),
  };

  return {
    phases: nextPhases,
    selectedIdx: nextIdx,
    angles: clonePhaseAngles(savedAngles),
    ball: cloneBallPose(savedBall),
  };
}

function clampArmField(field: keyof ArmAngles, value: number): number {
  const limits = ARM_FIELD_LIMITS[field];
  return THREE.MathUtils.clamp(value, limits.min, limits.max);
}

function shoulderPositionFor(side: RigArmSide): THREE.Vector3 {
  return SHOULDER_POSITIONS[side].clone();
}

function ballVector(ball: BallPose): THREE.Vector3 {
  return new THREE.Vector3(ball.x, ball.y, ball.z);
}

function resolveBallTarget(side: RigArmSide, ball: BallPose) {
  const shoulder = shoulderPositionFor(side);
  const center = ballVector(ball);
  const surfaceNormal = shoulder.clone().sub(center);

  if (surfaceNormal.lengthSq() < 1e-6) {
    surfaceNormal.set(side === 'left' ? -1 : 1, 0, 0);
  }

  surfaceNormal.normalize();

  return {
    center,
    shoulder,
    desiredForward: surfaceNormal.clone().multiplyScalar(-1),
    contactPoint: center.clone().add(surfaceNormal.clone().multiplyScalar(BASKETBALL_RADIUS)),
    handOriginTarget: center.clone().add(surfaceNormal.multiplyScalar(BASKETBALL_RADIUS + HAND_CONTACT_OFFSET)),
  };
}

function evaluateArmPose(side: RigArmSide, arm: ArmAngles) {
  const shoulder = shoulderPositionFor(side);
  const shoulderQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(arm.shoulderX, arm.shoulderY, arm.shoulderZ, 'XYZ'),
  );
  const elbowQuat = shoulderQuat.clone().multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(arm.elbowX, arm.elbowY, arm.elbowZ, 'XYZ')),
  );
  const handQuat = elbowQuat.clone().multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(arm.wristX, arm.wristY, arm.wristZ, 'XYZ')),
  );

  const elbow = shoulder.clone().add(new THREE.Vector3(0, ELBOW_OFFSET_Y, 0).applyQuaternion(shoulderQuat));
  const handOrigin = elbow.clone().add(
    new THREE.Vector3(0, FOREARM_TO_HAND_Y, HAND_PIVOT_Z).applyQuaternion(elbowQuat),
  );
  const handForward = new THREE.Vector3(0, 0, 1).applyQuaternion(handQuat).normalize();
  const handContact = handOrigin.clone().add(handForward.clone().multiplyScalar(HAND_CONTACT_OFFSET));

  return {
    shoulder,
    handOrigin,
    handForward,
    handContact,
  };
}

function snapCost(side: RigArmSide, initialArm: ArmAngles, candidate: ArmAngles, ball: BallPose): number {
  const target = resolveBallTarget(side, ball);
  const evaluation = evaluateArmPose(side, candidate);
  const contactError = evaluation.handContact.distanceToSquared(target.contactPoint);
  const originError = evaluation.handOrigin.distanceToSquared(target.handOriginTarget);
  const orientationError = 1 - THREE.MathUtils.clamp(evaluation.handForward.dot(target.desiredForward), -1, 1);

  let changePenalty = 0;
  for (const field of ARM_FIELD_ORDER) {
    const delta = candidate[field] - initialArm[field];
    changePenalty += delta * delta * ARM_FIELD_LIMITS[field].changeWeight;
  }

  return contactError * 280 + originError * 150 + orientationError * 24 + changePenalty * 1.35;
}

export function measureBallSnapGap(side: RigArmSide, arm: ArmAngles, ball: BallPose): number {
  const target = resolveBallTarget(side, ball);
  const evaluation = evaluateArmPose(side, arm);
  return evaluation.handContact.distanceTo(target.contactPoint);
}

export function snapArmToBall(side: RigArmSide, arm: ArmAngles, ball: BallPose): ArmAngles {
  let best = cloneArmAngles(arm);
  let bestCost = snapCost(side, arm, best, ball);
  const stepSizes = [0.45, 0.24, 0.12, 0.06, 0.03, 0.015];

  for (const step of stepSizes) {
    let improved = true;

    while (improved) {
      improved = false;

      for (const field of ARM_FIELD_ORDER) {
        for (const delta of [-step, step]) {
          const nextValue = clampArmField(field, best[field] + delta);
          if (nextValue === best[field]) continue;

          const candidate = {
            ...best,
            [field]: nextValue,
          };
          const candidateCost = snapCost(side, arm, candidate, ball);

          if (candidateCost + 1e-6 < bestCost) {
            best = candidate;
            bestCost = candidateCost;
            improved = true;
          }
        }
      }
    }
  }

  return best;
}
