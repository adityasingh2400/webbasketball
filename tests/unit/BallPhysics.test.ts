import { describe, it, expect, beforeEach } from 'vitest';
import { BallPhysics } from '../../src/engine/physics/BallPhysics';

describe('BallPhysics', () => {
  let physics: BallPhysics;

  beforeEach(() => {
    physics = new BallPhysics();
  });

  describe('initial state', () => {
    it('starts at center-bottom position', () => {
      const pos = physics.getPosition();
      expect(pos.x).toBe(0.5);
      expect(pos.y).toBe(0.8);
    });

    it('starts with zero velocity', () => {
      const vel = physics.getVelocity();
      expect(vel.x).toBe(0);
      expect(vel.y).toBe(0);
    });

    it('is not in flight initially', () => {
      expect(physics.isInFlight()).toBe(false);
    });
  });

  describe('followHand', () => {
    it('updates position to follow hand', () => {
      physics.followHand({ x: 0.3, y: 0.4 });
      const pos = physics.getPosition();
      expect(pos.x).toBe(0.3);
      expect(pos.y).toBeCloseTo(0.45, 2);
    });

    it('resets velocity when following hand', () => {
      physics.release({ x: 1, y: -1 });
      physics.followHand({ x: 0.5, y: 0.5 });
      const vel = physics.getVelocity();
      expect(vel.x).toBe(0);
      expect(vel.y).toBe(0);
    });

    it('sets inFlight to false', () => {
      physics.release({ x: 1, y: -1 });
      expect(physics.isInFlight()).toBe(true);
      physics.followHand({ x: 0.5, y: 0.5 });
      expect(physics.isInFlight()).toBe(false);
    });
  });

  describe('release', () => {
    it('sets velocity and inFlight', () => {
      physics.release({ x: 0.5, y: -1.0 });
      expect(physics.isInFlight()).toBe(true);
      const vel = physics.getVelocity();
      expect(vel.x).toBe(0.5);
      expect(vel.y).toBe(-1.0);
    });

    it('accepts angular velocity', () => {
      physics.release({ x: 0.5, y: -1.0 }, 2.0);
      const state = physics.getState();
      expect(state.angularVelocity).toBe(2.0);
    });
  });

  describe('update (physics simulation)', () => {
    it('does not update when not in flight', () => {
      const initialPos = { ...physics.getPosition() };
      physics.update(1 / 60);
      const newPos = physics.getPosition();
      expect(newPos.x).toBe(initialPos.x);
      expect(newPos.y).toBe(initialPos.y);
    });

    it('applies gravity when in flight', () => {
      physics.release({ x: 0, y: 0 });
      const initialY = physics.getPosition().y;
      physics.update(1 / 60);
      expect(physics.getVelocity().y).toBeGreaterThan(0);
      expect(physics.getPosition().y).toBeGreaterThan(initialY);
    });

    it('moves ball according to velocity', () => {
      physics.release({ x: 0.5, y: -0.5 });
      const initialPos = { ...physics.getPosition() };
      physics.update(1 / 60);
      expect(physics.getPosition().x).toBeGreaterThan(initialPos.x);
      expect(physics.getPosition().y).toBeLessThan(initialPos.y);
    });

    it('applies drag to slow down ball', () => {
      physics.release({ x: 1, y: 0 });
      const initialVelX = physics.getVelocity().x;
      physics.update(1 / 60);
      expect(physics.getVelocity().x).toBeLessThan(initialVelX);
    });

    it('returns false when ball exits bounds', () => {
      physics.release({ x: 10, y: 0 });
      for (let i = 0; i < 100; i++) {
        physics.update(1 / 60);
      }
      const inBounds = physics.update(1 / 60);
      expect(inBounds).toBe(false);
    });
  });

  describe('bounce', () => {
    it('reflects velocity off horizontal surface', () => {
      physics.release({ x: 0, y: 1 });
      physics.bounce({ x: 0, y: -1 });
      expect(physics.getVelocity().y).toBeLessThan(0);
    });

    it('reflects velocity off vertical surface', () => {
      physics.release({ x: 1, y: 0 });
      physics.bounce({ x: -1, y: 0 });
      expect(physics.getVelocity().x).toBeLessThan(0);
    });

    it('applies bounce coefficient to reduce energy', () => {
      physics.release({ x: 0, y: 1 });
      const initialMagnitude = Math.abs(physics.getVelocity().y);
      physics.bounce({ x: 0, y: -1 });
      const newMagnitude = Math.abs(physics.getVelocity().y);
      expect(newMagnitude).toBeLessThan(initialMagnitude);
    });
  });

  describe('applyImpulse', () => {
    it('adds to existing velocity', () => {
      physics.release({ x: 1, y: 1 });
      physics.applyImpulse({ x: 0.5, y: -0.5 });
      const vel = physics.getVelocity();
      expect(vel.x).toBe(1.5);
      expect(vel.y).toBe(0.5);
    });
  });

  describe('reset', () => {
    it('returns ball to initial state', () => {
      physics.release({ x: 1, y: -1 });
      physics.update(1 / 60);
      physics.reset();
      expect(physics.getPosition().x).toBe(0.5);
      expect(physics.getPosition().y).toBe(0.8);
      expect(physics.isInFlight()).toBe(false);
    });
  });
});
