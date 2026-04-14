export interface ArmAngles {
  shoulderX: number;
  shoulderY: number;
  shoulderZ: number;
  elbowX: number;
  elbowY: number;
  elbowZ: number;
  wristX: number;
  wristY: number;
  wristZ: number;
}

export interface BallPose {
  x: number;
  y: number;
  z: number;
}

export interface PhaseAngles {
  right: ArmAngles;
  left: ArmAngles;
}

export interface ShotPhase {
  name: string;
  duration: number;
  angles: PhaseAngles;
  ball: BallPose;
}

export const SHOT_PHASE_DEPTH_RANGE = {
  min: -0.35,
  max: 0.45,
} as const;

/**
 * Extra forward/backward ball tuning applied on top of the saved phase data.
 * Positive values push the ball farther toward the hoop during the shot motion.
 */
export const SHOT_PHASE_BALL_DEPTH_OFFSET = 0;

export const SHOT_GATHER_END_PROGRESS = 0.7;
export const SHOT_RELEASE_END_PROGRESS = 0.813;

export const SHOT_PHASES: ShotPhase[] = [
  {
    name: 'Idle',
    duration: 0.12,
    ball: {
      x: -0.045,
      y: 0.75,
      z: 0.24,
    },
    angles: {
      right: {
        shoulderX: -0.08,
        shoulderY: 0.05,
        shoulderZ: 0.18,
        elbowX: -0.73,
        elbowY: 0,
        elbowZ: 0.06,
        wristX: -0.1,
        wristY: 0.02,
        wristZ: 0.05,
      },
      left: {
        shoulderX: -0.18,
        shoulderY: -0.05,
        shoulderZ: -0.12,
        elbowX: -0.66,
        elbowY: -0.11,
        elbowZ: -0.42,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
  },
  {
    name: 'Ball at hip',
    duration: 0.1,
    angles: {
      right: {
        shoulderX: -0.31,
        shoulderY: 0.43999999999999995,
        shoulderZ: 0.08,
        elbowX: -1.03,
        elbowY: -1.2750000000000001,
        elbowZ: 0.36,
        wristX: 1.2799999999999998,
        wristY: -1,
        wristZ: 0.05,
      },
      left: {
        shoulderX: -0.6,
        shoulderY: -0.05,
        shoulderZ: -0.12,
        elbowX: -0.85,
        elbowY: -0.11,
        elbowZ: -0.74,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
    ball: {
      x: -0.07,
      y: 0.945,
      z: 0.28,
    },
  },
  {
    name: 'Ball between chest & hip',
    duration: 0.08,
    angles: {
      right: {
        shoulderX: -0.4,
        shoulderY: 0.43999999999999995,
        shoulderZ: 0.08,
        elbowX: -1.7,
        elbowY: -1.2750000000000001,
        elbowZ: 0.36,
        wristX: 1.2799999999999998,
        wristY: -1,
        wristZ: 0.05,
      },
      left: {
        shoulderX: -1.01,
        shoulderY: -0.05,
        shoulderZ: -0.12,
        elbowX: -1.3,
        elbowY: -0.11,
        elbowZ: -0.74,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
    ball: {
      x: -0.015,
      y: 1.19,
      z: 0.28,
    },
  },
  {
    name: 'Ball at chest',
    duration: 0.08,
    angles: {
      right: {
        shoulderX: -0.82,
        shoulderY: 0.43999999999999995,
        shoulderZ: 0.08,
        elbowX: -1.97,
        elbowY: -1.2750000000000001,
        elbowZ: 0.36,
        wristX: 1.2799999999999998,
        wristY: -1,
        wristZ: 0.05,
      },
      left: {
        shoulderX: -1.18,
        shoulderY: -0.05,
        shoulderZ: -0.12,
        elbowX: -1.73,
        elbowY: -0.11,
        elbowZ: -0.74,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
    ball: {
      x: -0.025,
      y: 1.38,
      z: 0.28,
    },
  },
  {
    name: 'Ball at chin',
    duration: 0.08,
    angles: {
      right: {
        shoulderX: -1.16,
        shoulderY: 0.43999999999999995,
        shoulderZ: 0.08,
        elbowX: -1.7,
        elbowY: -1.2750000000000001,
        elbowZ: 0.36,
        wristX: 1.2799999999999998,
        wristY: -1,
        wristZ: 0.05,
      },
      left: {
        shoulderX: -1.47,
        shoulderY: -0.05,
        shoulderZ: -0.12,
        elbowX: -1.65,
        elbowY: -0.11,
        elbowZ: -0.74,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
    ball: {
      x: 0.01,
      y: 1.47,
      z: 0.28,
    },
  },
  {
    name: 'Ball at set point',
    duration: 0.1,
    angles: {
      right: {
        shoulderX: -1.8,
        shoulderY: 0.43999999999999995,
        shoulderZ: 0.08,
        elbowX: -1.22,
        elbowY: -1.2750000000000001,
        elbowZ: 0.36,
        wristX: 1.2799999999999998,
        wristY: -1,
        wristZ: 0.05,
      },
      left: {
        shoulderX: -2.04,
        shoulderY: -0.05,
        shoulderZ: -0.12,
        elbowX: -1.65,
        elbowY: -0.11,
        elbowZ: -0.74,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
    ball: {
      x: -0.02,
      y: 1.645,
      z: 0.28,
    },
  },
  {
    name: 'Extension point 1',
    duration: 0.05,
    angles: {
      right: {
        shoulderX: -2.58,
        shoulderY: -0.08,
        shoulderZ: 0.02,
        elbowX: -0.53,
        elbowY: -1.2750000000000001,
        elbowZ: 0.35,
        wristX: 1.2799999999999998,
        wristY: -1,
        wristZ: -0.1,
      },
      left: {
        shoulderX: -2.38,
        shoulderY: 0.62,
        shoulderZ: -0.48,
        elbowX: -0.32,
        elbowY: -0.11,
        elbowZ: -0.74,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
    ball: {
      x: -0.185,
      y: 1.87,
      z: 0.175,
    },
  },
  {
    name: 'Extension point 2',
    duration: 0.04,
    angles: {
      right: {
        shoulderX: -2.36,
        shoulderY: -0.33,
        shoulderZ: 0.06,
        elbowX: 0.02,
        elbowY: -1.2750000000000001,
        elbowZ: 0.35,
        wristX: 1.2799999999999998,
        wristY: -1,
        wristZ: -0.1,
      },
      left: {
        shoulderX: -1.98,
        shoulderY: 0.62,
        shoulderZ: -0.48,
        elbowX: -0.32,
        elbowY: -0.11,
        elbowZ: -0.74,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
    ball: {
      x: -0.13,
      y: 1.87,
      z: 0.28,
    },
  },
  {
    name: 'Wrist flick (follow through)',
    duration: 0.15,
    angles: {
      right: {
        shoulderX: -2.6,
        shoulderY: -0.33,
        shoulderZ: 0.06,
        elbowX: 0.51,
        elbowY: -1.2750000000000001,
        elbowZ: 0.35,
        wristX: 1.2799999999999998,
        wristY: -1,
        wristZ: -0.1,
      },
      left: {
        shoulderX: -2.02,
        shoulderY: 0.62,
        shoulderZ: -0.48,
        elbowX: -0.32,
        elbowY: -0.11,
        elbowZ: -0.74,
        wristX: -0.1,
        wristY: -0.02,
        wristZ: -0.05,
      },
    },
    ball: {
      x: -0.1,
      y: 1.87,
      z: 0.28,
    },
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

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

export function lerpArmAngles(a: ArmAngles, b: ArmAngles, t: number): ArmAngles {
  return {
    shoulderX: lerp(a.shoulderX, b.shoulderX, t),
    shoulderY: lerp(a.shoulderY, b.shoulderY, t),
    shoulderZ: lerp(a.shoulderZ, b.shoulderZ, t),
    elbowX: lerp(a.elbowX, b.elbowX, t),
    elbowY: lerp(a.elbowY, b.elbowY, t),
    elbowZ: lerp(a.elbowZ, b.elbowZ, t),
    wristX: lerp(a.wristX, b.wristX, t),
    wristY: lerp(a.wristY, b.wristY, t),
    wristZ: lerp(a.wristZ, b.wristZ, t),
  };
}

export function lerpPhaseAngles(a: PhaseAngles, b: PhaseAngles, t: number): PhaseAngles {
  return {
    right: lerpArmAngles(a.right, b.right, t),
    left: lerpArmAngles(a.left, b.left, t),
  };
}

export function lerpBallPose(a: BallPose, b: BallPose, t: number): BallPose {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function sampleShotPhase(progress: number, depthOffset = SHOT_PHASE_BALL_DEPTH_OFFSET): ShotPhase {
  if (SHOT_PHASES.length === 0) {
    throw new Error('Expected at least one shot phase.');
  }

  const totalDuration = SHOT_PHASES.reduce((sum, phase) => sum + phase.duration, 0);
  const clampedProgress = clamp(progress, 0, 1);
  const sampleTime = clampedProgress * totalDuration;

  let elapsed = 0;
  for (let index = 0; index < SHOT_PHASES.length; index++) {
    const current = SHOT_PHASES[index];
    const next = SHOT_PHASES[Math.min(index + 1, SHOT_PHASES.length - 1)];
    const phaseEnd = elapsed + current.duration;

    if (sampleTime <= phaseEnd || index === SHOT_PHASES.length - 1) {
      const localT = current.duration > 0 ? clamp((sampleTime - elapsed) / current.duration, 0, 1) : 0;
      const ball = lerpBallPose(current.ball, next.ball, localT);
      ball.z += depthOffset;

      return {
        name: current.name,
        duration: current.duration,
        angles: lerpPhaseAngles(current.angles, next.angles, localT),
        ball,
      };
    }

    elapsed = phaseEnd;
  }

  const last = cloneShotPhase(SHOT_PHASES[SHOT_PHASES.length - 1]);
  last.ball.z += depthOffset;
  return last;
}
