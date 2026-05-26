import { describe, it, expect } from 'vitest';
import { WristFlickDetector, type HandLandmarkPoint } from '../../src/engine/input/WristFlickDetector';

function makeLandmarks(wristAngleDeg: number): HandLandmarkPoint[] {
  const landmarks: HandLandmarkPoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  // WRIST at center
  landmarks[0] = { x: 0.5, y: 0.5, z: 0 };
  // MCP knuckles slightly above wrist
  landmarks[5] = { x: 0.45, y: 0.42, z: 0 };  // INDEX_MCP
  landmarks[9] = { x: 0.50, y: 0.40, z: 0 };  // MIDDLE_MCP
  landmarks[13] = { x: 0.55, y: 0.42, z: 0 }; // RING_MCP
  landmarks[17] = { x: 0.58, y: 0.44, z: 0 }; // PINKY_MCP

  const mcpCenterX = (0.45 + 0.50 + 0.55 + 0.58) / 4;
  const mcpCenterY = (0.42 + 0.40 + 0.42 + 0.44) / 4;

  // MIDDLE_TIP positioned to create the desired angle
  const rad = (wristAngleDeg * Math.PI) / 180;
  const dist = 0.15;
  // Angle measured at MCP center between wrist and fingertip
  const baseAngle = Math.atan2(mcpCenterY - 0.5, mcpCenterX - 0.5);
  const tipAngle = baseAngle + (Math.PI - rad);
  landmarks[12] = {
    x: mcpCenterX + Math.cos(tipAngle) * dist,
    y: mcpCenterY + Math.sin(tipAngle) * dist,
    z: 0,
  };

  return landmarks;
}

describe('WristFlickDetector', () => {
  it('does not detect flick when hand landmarks are null', () => {
    const detector = new WristFlickDetector();
    const result = detector.update(null, true, 1000);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('does not detect flick with insufficient landmarks', () => {
    const detector = new WristFlickDetector();
    const result = detector.update([{ x: 0, y: 0, z: 0 }], true, 1000);
    expect(result.detected).toBe(false);
  });

  it('detects a deliberate flick (cupped → fingers-down transition)', () => {
    const detector = new WristFlickDetector({
      requireAboveShoulder: false,
      cooldownMs: 0,
    });

    // Feed cupped frames (small angle)
    for (let i = 0; i < 5; i++) {
      detector.update(makeLandmarks(110), false, 1000 + i * 33);
    }

    // Feed rapid opening frames (large angle, big velocity)
    let detected = false;
    for (let i = 0; i < 5; i++) {
      const result = detector.update(makeLandmarks(110 + i * 25), false, 1200 + i * 33);
      if (result.detected) detected = true;
    }

    expect(detected).toBe(true);
  });

  it('does not trigger during steady state (no angle change)', () => {
    const detector = new WristFlickDetector({ requireAboveShoulder: false });

    for (let i = 0; i < 10; i++) {
      const result = detector.update(makeLandmarks(150), false, 1000 + i * 33);
      expect(result.detected).toBe(false);
    }
  });

  it('respects cooldown period', () => {
    const detector = new WristFlickDetector({
      requireAboveShoulder: false,
      cooldownMs: 500,
    });

    for (let i = 0; i < 5; i++) {
      detector.update(makeLandmarks(110), false, 1000 + i * 33);
    }
    for (let i = 0; i < 5; i++) {
      detector.update(makeLandmarks(110 + i * 25), false, 1200 + i * 33);
    }

    // Try again immediately (within cooldown)
    for (let i = 0; i < 5; i++) {
      detector.update(makeLandmarks(110), false, 1400 + i * 33);
    }
    for (let i = 0; i < 5; i++) {
      const result = detector.update(makeLandmarks(110 + i * 25), false, 1600 + i * 33);
      expect(result.detected).toBe(false);
    }
  });

  it('reset clears internal state', () => {
    const detector = new WristFlickDetector({ requireAboveShoulder: false });

    for (let i = 0; i < 5; i++) {
      detector.update(makeLandmarks(110), false, 1000 + i * 33);
    }

    detector.reset();

    // After reset, the wasCupped flag is cleared
    const result = detector.update(makeLandmarks(180), false, 2000);
    expect(result.detected).toBe(false);
  });

  it('reports wristAngle and angleVelocity even when no flick', () => {
    const detector = new WristFlickDetector({ requireAboveShoulder: false });
    const result = detector.update(makeLandmarks(150), false, 1000);
    expect(result.wristAngle).toBeGreaterThan(0);
    expect(typeof result.angleVelocity).toBe('number');
  });
});
