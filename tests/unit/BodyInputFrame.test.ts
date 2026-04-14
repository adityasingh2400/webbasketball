import { describe, it, expect } from 'vitest';
import { keyboardToBodyInputFrame, type KeyboardState } from '../../src/engine/input/BodyInputFrame';

const baseState: KeyboardState = {
  moveX: 0,
  moveZ: 0,
  dribblePressed: false,
  shootHeld: false,
  shootReleased: false,
  currentBallSide: 1,
};

describe('keyboardToBodyInputFrame', () => {
  it('produces confidence=1 and source keyboard', () => {
    const frame = keyboardToBodyInputFrame(baseState, 100);
    expect(frame.confidence).toBe(1.0);
    expect(frame.source).toBe('keyboard');
  });

  it('idle state places wrists at default hip height', () => {
    const frame = keyboardToBodyInputFrame(baseState, 100);
    expect(frame.wristR.y).toBeCloseTo(0.9, 1);
    expect(frame.wristL.y).toBeCloseTo(0.9, 1);
  });

  it('shootHeld raises dominant wrist above head', () => {
    const frame = keyboardToBodyInputFrame({ ...baseState, shootHeld: true }, 100);
    expect(frame.wristR.y).toBeCloseTo(1.8, 1);
    expect(frame.wristL.y).toBeCloseTo(0.9, 1);
  });

  it('dribblePressed drops dominant wrist to dribble height', () => {
    const frame = keyboardToBodyInputFrame({ ...baseState, dribblePressed: true }, 100);
    expect(frame.wristR.y).toBeCloseTo(0.3, 1);
  });

  it('left ball side makes left hand dominant', () => {
    const frame = keyboardToBodyInputFrame({ ...baseState, currentBallSide: -1 }, 100);
    expect(frame.dominantHand).toBe('left');
    expect(frame.intent.handSide).toBe('left');
  });

  it('moveX maps to torsoLean', () => {
    const frameLeft = keyboardToBodyInputFrame({ ...baseState, moveX: -1 }, 100);
    expect(frameLeft.torsoLean).toBe(-1);
    const frameRight = keyboardToBodyInputFrame({ ...baseState, moveX: 1 }, 100);
    expect(frameRight.torsoLean).toBe(1);
  });

  it('intent.velocityY is -0.8 when shootHeld', () => {
    const frame = keyboardToBodyInputFrame({ ...baseState, shootHeld: true }, 100);
    expect(frame.intent.velocityY).toBe(-0.8);
  });

  it('intent.velocityY is 0.5 when dribblePressed', () => {
    const frame = keyboardToBodyInputFrame({ ...baseState, dribblePressed: true }, 100);
    expect(frame.intent.velocityY).toBe(0.5);
  });

  it('elbows are midway between shoulders and wrists', () => {
    const frame = keyboardToBodyInputFrame(baseState, 100);
    const expectedElbowRY = (frame.shoulderR.y + frame.wristR.y) / 2;
    expect(frame.elbowR.y).toBeCloseTo(expectedElbowRY, 5);
  });

  it('shoulders are at rig constants', () => {
    const frame = keyboardToBodyInputFrame(baseState, 100);
    expect(frame.shoulderR.x).toBeCloseTo(0.31, 2);
    expect(frame.shoulderL.x).toBeCloseTo(-0.31, 2);
    expect(frame.shoulderR.y).toBeCloseTo(1.18, 2);
  });
});
