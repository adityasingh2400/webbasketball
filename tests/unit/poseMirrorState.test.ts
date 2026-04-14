import { describe, expect, it } from 'vitest';
import {
  cloneBallPose,
  clonePhaseAngles,
  measureBallSnapGap,
  savePhaseProgression,
  snapArmToBall,
  type ArmAngles,
  type BallPose,
  type ShotPhase,
} from '../../src/components/poseMirrorState';

function makeArm(seed: number): ArmAngles {
  return {
    shoulderX: seed + 0.1,
    shoulderY: seed + 0.2,
    shoulderZ: seed + 0.3,
    elbowX: seed + 0.4,
    elbowY: seed + 0.5,
    elbowZ: seed + 0.6,
    wristX: seed + 0.7,
    wristY: seed + 0.8,
    wristZ: seed + 0.9,
  };
}

function makeBall(seed: number): BallPose {
  return {
    x: seed + 0.01,
    y: seed + 0.02,
    z: seed + 0.03,
  };
}

function makePhases(): ShotPhase[] {
  return [
    { name: 'Idle', duration: 0.12, angles: { right: makeArm(0), left: makeArm(10) }, ball: makeBall(0) },
    { name: 'Ball at hip', duration: 0.1, angles: { right: makeArm(20), left: makeArm(30) }, ball: makeBall(1) },
    { name: 'Ball at chest', duration: 0.08, angles: { right: makeArm(40), left: makeArm(50) }, ball: makeBall(2) },
  ];
}

describe('savePhaseProgression', () => {
  it('saves the current phase and seeds the next phase when enabled', () => {
    const phases = makePhases();
    const newAngles = { right: makeArm(100), left: makeArm(200) };
    const newBall = makeBall(10);

    const result = savePhaseProgression(phases, 0, newAngles, newBall, true);

    expect(result.selectedIdx).toBe(1);
    expect(result.phases[0].angles).toEqual(newAngles);
    expect(result.phases[1].angles).toEqual(newAngles);
    expect(result.phases[0].ball).toEqual(newBall);
    expect(result.phases[1].ball).toEqual(newBall);
    expect(result.phases[2].angles).toEqual(phases[2].angles);
    expect(result.angles).toEqual(newAngles);
    expect(result.ball).toEqual(newBall);

    expect(result.phases[1].angles).not.toBe(newAngles);
    expect(result.ball).not.toBe(newBall);
    expect(phases[1].angles).toEqual({ right: makeArm(20), left: makeArm(30) });
    expect(phases[1].ball).toEqual(makeBall(1));
  });

  it('saves in place when next-phase seeding is disabled', () => {
    const phases = makePhases();
    const newAngles = { right: makeArm(300), left: makeArm(400) };
    const newBall = makeBall(12);

    const result = savePhaseProgression(phases, 1, newAngles, newBall, false);

    expect(result.selectedIdx).toBe(1);
    expect(result.phases[1].angles).toEqual(newAngles);
    expect(result.phases[1].ball).toEqual(newBall);
    expect(result.phases[2].angles).toEqual(phases[2].angles);
    expect(result.phases[2].ball).toEqual(phases[2].ball);
  });

  it('stays on the last phase even when next-phase seeding is enabled', () => {
    const phases = makePhases();
    const newAngles = clonePhaseAngles({ right: makeArm(500), left: makeArm(600) });
    const newBall = cloneBallPose(makeBall(14));

    const result = savePhaseProgression(phases, phases.length - 1, newAngles, newBall, true);

    expect(result.selectedIdx).toBe(phases.length - 1);
    expect(result.phases[phases.length - 1].angles).toEqual(newAngles);
    expect(result.phases[phases.length - 1].ball).toEqual(newBall);
  });
});

describe('snapArmToBall', () => {
  it('reduces the hand-to-ball gap without mutating the original arm', () => {
    const arm: ArmAngles = {
      shoulderX: -0.2,
      shoulderY: 0.05,
      shoulderZ: 0.06,
      elbowX: -0.7,
      elbowY: 0.02,
      elbowZ: 0.04,
      wristX: -0.18,
      wristY: 0.01,
      wristZ: 0.01,
    };
    const ball: BallPose = { x: -0.1, y: 1.2, z: 0.13 };

    const before = measureBallSnapGap('left', arm, ball);
    const snapped = snapArmToBall('left', arm, ball);
    const after = measureBallSnapGap('left', snapped, ball);

    expect(after).toBeLessThan(before);
    expect(after).toBeLessThan(0.08);
    expect(snapped).not.toBe(arm);
    expect(arm).toEqual({
      shoulderX: -0.2,
      shoulderY: 0.05,
      shoulderZ: 0.06,
      elbowX: -0.7,
      elbowY: 0.02,
      elbowZ: 0.04,
      wristX: -0.18,
      wristY: 0.01,
      wristZ: 0.01,
    });
  });
});
