import { describe, it, expect, beforeEach } from 'vitest';
import { ReleaseDetector } from '../../src/engine/input/ReleaseDetector';
import type { HandData, HandLandmark } from '../../src/types';

function createMockLandmarks(overrides: Partial<Record<number, Partial<HandLandmark>>> = {}): HandLandmark[] {
  const defaultLandmark: HandLandmark = { index: 0, x: 0.5, y: 0.5, z: 0 };
  
  return Array.from({ length: 21 }, (_, i) => ({
    ...defaultLandmark,
    index: i,
    ...overrides[i],
  }));
}

function createMockHand(
  wristY: number,
  fingerExtended: boolean,
  overrides: Partial<HandData> = {},
): HandData {
  const indexPipY = 0.5;
  const middlePipY = 0.5;
  const tipOffset = fingerExtended ? -0.15 : 0.05;

  const landmarks = createMockLandmarks({
    0: { y: wristY },
    6: { y: indexPipY },
    8: { y: indexPipY + tipOffset },
    10: { y: middlePipY },
    12: { y: middlePipY + tipOffset },
  });

  return {
    landmarks,
    handedness: 'Right',
    confidence: 0.9,
    wrist: { x: 0.5, y: wristY },
    indexTip: { x: 0.5, y: indexPipY + tipOffset },
    fingerExtension: fingerExtended ? 0.15 : 0,
    ...overrides,
  };
}

describe('ReleaseDetector', () => {
  let detector: ReleaseDetector;

  beforeEach(() => {
    detector = new ReleaseDetector(10);
  });

  describe('initial state', () => {
    it('does not detect release on first frame', () => {
      const hand = createMockHand(0.5, true);
      const result = detector.update(hand, 0);
      expect(result.released).toBe(false);
    });
  });

  describe('velocity tracking', () => {
    it('tracks rising motion (negative y velocity)', () => {
      const hand1 = createMockHand(0.6, false);
      const hand2 = createMockHand(0.5, false);
      const hand3 = createMockHand(0.4, false);

      detector.update(hand1, 0);
      detector.update(hand2, 16);
      const result = detector.update(hand3, 32);

      expect(result.released).toBe(false);
    });

    it('detects velocity reversal (rising then falling)', () => {
      const risingHand1 = createMockHand(0.6, true);
      const risingHand2 = createMockHand(0.5, true);
      const risingHand3 = createMockHand(0.4, true);
      const fallingHand = createMockHand(0.45, true);

      detector.update(risingHand1, 0);
      detector.update(risingHand2, 16);
      detector.update(risingHand3, 32);
      const result = detector.update(fallingHand, 48);

      expect(result.released).toBe(true);
    });
  });

  describe('finger extension detection', () => {
    it('requires fingers extended for release', () => {
      const risingHand1 = createMockHand(0.6, false);
      const risingHand2 = createMockHand(0.5, false);
      const risingHand3 = createMockHand(0.4, false);
      const fallingHand = createMockHand(0.45, false);

      detector.update(risingHand1, 0);
      detector.update(risingHand2, 16);
      detector.update(risingHand3, 32);
      const result = detector.update(fallingHand, 48);

      expect(result.released).toBe(false);
    });

    it('detects release when fingers are extended', () => {
      const risingHand1 = createMockHand(0.6, true);
      const risingHand2 = createMockHand(0.5, true);
      const risingHand3 = createMockHand(0.4, true);
      const fallingHand = createMockHand(0.45, true);

      detector.update(risingHand1, 0);
      detector.update(risingHand2, 16);
      detector.update(risingHand3, 32);
      const result = detector.update(fallingHand, 48);

      expect(result.released).toBe(true);
      expect(result.power).toBeGreaterThan(0);
      expect(result.angle).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('release properties', () => {
    it('calculates power from velocity magnitude', () => {
      const hand1 = createMockHand(0.8, true);
      const hand2 = createMockHand(0.6, true);
      const hand3 = createMockHand(0.4, true);
      const hand4 = createMockHand(0.42, true);

      detector.update(hand1, 0);
      detector.update(hand2, 16);
      detector.update(hand3, 32);
      const result = detector.update(hand4, 48);

      expect(result.released).toBe(true);
      expect(result.power).toBeGreaterThan(0);
      expect(result.power).toBeLessThanOrEqual(1);
    });

    it('returns null velocity when not released', () => {
      const hand = createMockHand(0.5, false);
      const result = detector.update(hand, 0);

      expect(result.velocity).toBeNull();
    });

    it('returns velocity object when released', () => {
      const hand1 = createMockHand(0.6, true);
      const hand2 = createMockHand(0.5, true);
      const hand3 = createMockHand(0.4, true);
      const hand4 = createMockHand(0.42, true);

      detector.update(hand1, 0);
      detector.update(hand2, 16);
      detector.update(hand3, 32);
      const result = detector.update(hand4, 48);

      expect(result.velocity).not.toBeNull();
      expect(result.velocity).toHaveProperty('x');
      expect(result.velocity).toHaveProperty('y');
    });
  });

  describe('reset', () => {
    it('clears velocity buffer', () => {
      const hand1 = createMockHand(0.6, true);
      const hand2 = createMockHand(0.5, true);
      
      detector.update(hand1, 0);
      detector.update(hand2, 16);
      detector.reset();

      const hand3 = createMockHand(0.4, true);
      const result = detector.update(hand3, 32);

      expect(result.released).toBe(false);
    });

    it('resets rising state', () => {
      const risingHand = createMockHand(0.4, true);
      detector.update(createMockHand(0.6, true), 0);
      detector.update(createMockHand(0.5, true), 16);
      detector.update(risingHand, 32);
      
      detector.reset();

      const fallingHand = createMockHand(0.5, true);
      const result = detector.update(fallingHand, 48);

      expect(result.released).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles missing landmarks gracefully', () => {
      const handWithMissingLandmarks: HandData = {
        landmarks: [],
        handedness: 'Right',
        confidence: 0.9,
        wrist: { x: 0.5, y: 0.5 },
        indexTip: { x: 0.5, y: 0.4 },
        fingerExtension: 0.1,
      };

      expect(() => {
        detector.update(handWithMissingLandmarks, 0);
      }).not.toThrow();
    });

    it('handles rapid updates without errors', () => {
      for (let i = 0; i < 100; i++) {
        const y = 0.5 + Math.sin(i / 10) * 0.2;
        const hand = createMockHand(y, true);
        expect(() => detector.update(hand, i)).not.toThrow();
      }
    });
  });
});
