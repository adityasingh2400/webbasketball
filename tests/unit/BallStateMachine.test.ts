import { describe, it, expect, beforeEach } from 'vitest';
import { BallStateMachine, type BallInput } from '../../src/engine/BallStateMachine';

function makeInput(overrides: Partial<BallInput> = {}): BallInput {
  return {
    velocityX: 0,
    velocityY: 0,
    handSide: 'right',
    released: false,
    timeSinceStateEnter: 0,
    ...overrides,
  };
}

describe('BallStateMachine', () => {
  let sm: BallStateMachine;

  beforeEach(() => {
    sm = new BallStateMachine();
  });

  describe('initial state', () => {
    it('starts in IDLE', () => {
      expect(sm.getState()).toBe('IDLE');
    });

    it('reports not dribbling, not held, not shooting', () => {
      expect(sm.isDribbling()).toBe(false);
      expect(sm.isHeld()).toBe(false);
      expect(sm.isShooting()).toBe(false);
      expect(sm.isGathering()).toBe(false);
    });
  });

  describe('IDLE → HELD transitions', () => {
    it('transitions to HELD_RIGHT when right hand detected', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      expect(sm.getState()).toBe('HELD_RIGHT');
      expect(sm.isHeld()).toBe(true);
    });

    it('transitions to HELD_LEFT when left hand detected', () => {
      sm.update(0.016, makeInput({ handSide: 'left' }));
      expect(sm.getState()).toBe('HELD_LEFT');
    });

    it('does NOT transition to HELD when released is true', () => {
      sm.update(0.016, makeInput({ handSide: 'right', released: true }));
      expect(sm.getState()).toBe('IDLE');
    });
  });

  describe('HELD → DRIBBLE transitions', () => {
    it('transitions to DRIBBLE_RIGHT_DOWN on downward velocity', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      expect(sm.getState()).toBe('HELD_RIGHT');

      sm.update(0.016, makeInput({ velocityY: 0.5 }));
      expect(sm.getState()).toBe('DRIBBLE_RIGHT_DOWN');
      expect(sm.isDribbling()).toBe(true);
    });

    it('transitions to DRIBBLE_LEFT_DOWN from HELD_LEFT', () => {
      sm.update(0.016, makeInput({ handSide: 'left' }));
      sm.update(0.016, makeInput({ velocityY: 0.5 }));
      expect(sm.getState()).toBe('DRIBBLE_LEFT_DOWN');
    });
  });

  describe('dribble auto-cycling', () => {
    it('auto-transitions DRIBBLE_RIGHT_DOWN → DRIBBLE_RIGHT_UP after duration', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: 0.5 }));
      expect(sm.getState()).toBe('DRIBBLE_RIGHT_DOWN');

      for (let i = 0; i < 29; i++) {
        sm.update(0.016, makeInput());
      }
      expect(sm.getState()).toBe('DRIBBLE_RIGHT_UP');
    });

    it('cycles DOWN → UP → DOWN continuously', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: 0.5 }));

      for (let i = 0; i < 29; i++) sm.update(0.016, makeInput());
      expect(sm.getState()).toBe('DRIBBLE_RIGHT_UP');

      for (let i = 0; i < 29; i++) sm.update(0.016, makeInput());
      expect(sm.getState()).toBe('DRIBBLE_RIGHT_DOWN');
    });
  });

  describe('crossover transitions', () => {
    it('HELD_RIGHT → CROSSOVER_R2L on strong leftward velocity', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityX: -0.8 }));
      expect(sm.getState()).toBe('CROSSOVER_R2L');
      expect(sm.isCrossover()).toBe(true);
    });

    it('CROSSOVER_R2L auto-transitions to DRIBBLE_LEFT_DOWN', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityX: -0.8 }));
      expect(sm.getState()).toBe('CROSSOVER_R2L');

      for (let i = 0; i < 20; i++) sm.update(0.016, makeInput());
      expect(sm.getState()).toBe('DRIBBLE_LEFT_DOWN');
    });

    it('DRIBBLE_RIGHT_DOWN → CROSSOVER_R2L on lateral velocity', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: 0.5 }));
      expect(sm.getState()).toBe('DRIBBLE_RIGHT_DOWN');

      sm.update(0.016, makeInput({ velocityX: -0.8 }));
      expect(sm.getState()).toBe('CROSSOVER_R2L');
    });
  });

  describe('gather and shoot transitions', () => {
    it('HELD_RIGHT → GATHER_LOW on upward velocity', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: -0.8 }));
      expect(sm.getState()).toBe('GATHER_LOW');
      expect(sm.isGathering()).toBe(true);
    });

    it('GATHER_LOW auto-transitions to GATHER_HIGH', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: -0.8 }));

      for (let i = 0; i < 25; i++) sm.update(0.016, makeInput());
      expect(sm.getState()).toBe('GATHER_HIGH');
    });

    it('GATHER_HIGH → SHOOTING on release', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: -0.8 }));
      for (let i = 0; i < 25; i++) sm.update(0.016, makeInput());
      expect(sm.getState()).toBe('GATHER_HIGH');

      sm.update(0.016, makeInput({ released: true }));
      expect(sm.getState()).toBe('SHOOTING');
      expect(sm.isShooting()).toBe(true);
    });

    it('GATHER_HIGH only shoots once release is true', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: -0.8 }));
      for (let i = 0; i < 25; i++) sm.update(0.016, makeInput());

      sm.update(0.016, makeInput());
      expect(sm.getState()).toBe('GATHER_HIGH');

      sm.update(0.016, makeInput({ released: true }));
      expect(sm.getState()).toBe('SHOOTING');
    });

    it('SHOOTING → FOLLOW_THROUGH auto-transition', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: -0.8 }));
      for (let i = 0; i < 25; i++) sm.update(0.016, makeInput());
      sm.update(0.016, makeInput({ released: true }));
      expect(sm.getState()).toBe('SHOOTING');

      for (let i = 0; i < 12; i++) sm.update(0.016, makeInput());
      expect(sm.getState()).toBe('FOLLOW_THROUGH');
    });

    it('FOLLOW_THROUGH → IDLE auto-transition', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: -0.8 }));
      for (let i = 0; i < 25; i++) sm.update(0.016, makeInput());
      sm.update(0.016, makeInput({ released: true }));
      for (let i = 0; i < 12; i++) sm.update(0.016, makeInput());
      expect(sm.getState()).toBe('FOLLOW_THROUGH');

      const transitions: string[] = [];
      const unsub = sm.onTransition((_from, to) => { transitions.push(to); });
      for (let i = 0; i < 30; i++) sm.update(0.016, makeInput());
      unsub();
      expect(transitions).toContain('IDLE');
    });
  });

  describe('trick moves', () => {
    it('DRIBBLE_RIGHT_DOWN → BEHIND_BACK on extreme velocity combo', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      sm.update(0.016, makeInput({ velocityY: 0.5 }));
      expect(sm.getState()).toBe('DRIBBLE_RIGHT_DOWN');

      sm.update(0.016, makeInput({ velocityX: 1.5, velocityY: -0.3 }));
      expect(sm.getState()).toBe('BEHIND_BACK');
      expect(sm.isTrick()).toBe(true);
    });
  });

  describe('forceTransition', () => {
    it('forces any transition regardless of rules', () => {
      sm.forceTransition('DEAD');
      expect(sm.getState()).toBe('DEAD');
    });

    it('DEAD auto-transitions to IDLE', () => {
      sm.forceTransition('DEAD');
      for (let i = 0; i < 70; i++) sm.update(0.016, makeInput({ released: true }));
      expect(sm.getState()).toBe('IDLE');
    });
  });

  describe('transition listener', () => {
    it('fires listener on state change', () => {
      const transitions: Array<{ from: string; to: string }> = [];
      sm.onTransition((from, to) => transitions.push({ from, to }));

      sm.update(0.016, makeInput({ handSide: 'right' }));

      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({ from: 'IDLE', to: 'HELD_RIGHT' });
    });

    it('unsubscribe works', () => {
      const transitions: string[] = [];
      const unsub = sm.onTransition((_from, to) => transitions.push(to));

      sm.update(0.016, makeInput({ handSide: 'right' }));
      expect(transitions).toHaveLength(1);

      unsub();
      sm.update(0.016, makeInput({ velocityY: 0.5 }));
      expect(transitions).toHaveLength(1);
    });
  });

  describe('blend factor', () => {
    it('returns blend < 1 immediately after transition', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      const snapshot = sm.getSnapshot();
      expect(snapshot.blendFactor).toBeLessThan(1);
      expect(snapshot.previousConfig).not.toBeNull();
    });

    it('returns blend = 1 after BLEND_DURATION', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      for (let i = 0; i < 10; i++) sm.update(0.016, makeInput());
      const snapshot = sm.getSnapshot();
      expect(snapshot.blendFactor).toBe(1);
    });
  });

  describe('reset', () => {
    it('returns to IDLE', () => {
      sm.update(0.016, makeInput({ handSide: 'right' }));
      expect(sm.getState()).toBe('HELD_RIGHT');

      sm.reset();
      expect(sm.getState()).toBe('IDLE');
    });
  });
});
