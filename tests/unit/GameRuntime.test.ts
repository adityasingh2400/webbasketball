import { describe, expect, it } from 'vitest';
import { GameRuntime, type RuntimeControls } from '../../src/engine/GameRuntime';

function makeControls(overrides: Partial<RuntimeControls> = {}): RuntimeControls {
  return {
    webcamActive: false,
    hand: {
      hasHand: false,
      playerX: 0,
      playerZ: 0,
      velocity: { x: 0, y: 0 },
      handedness: 'Right',
      released: false,
    },
    moveX: 0,
    moveZ: 0,
    dribblePressed: false,
    shootHeld: false,
    shootReleased: false,
    ...overrides,
  };
}

describe('GameRuntime side mapping', () => {
  it('maps HELD_RIGHT to the screen-right side of the player', () => {
    const runtime = new GameRuntime();

    runtime.advance(1 / 60, makeControls());

    const snapshot = runtime.getRenderState();
    expect(snapshot.ballState).toBe('HELD_RIGHT');
    expect(snapshot.ballLocalPosition[0]).toBeLessThan(0);
  });

  it('maps movement to screen-space left/right held states', () => {
    const moveRightRuntime = new GameRuntime();
    moveRightRuntime.advance(1 / 60, makeControls({ moveX: 1 }));
    expect(moveRightRuntime.getRenderState().ballState).toBe('HELD_RIGHT');
    expect(moveRightRuntime.getRenderState().ballLocalPosition[0]).toBeLessThan(0);

    const moveLeftRuntime = new GameRuntime();
    moveLeftRuntime.advance(1 / 60, makeControls({ moveX: -1 }));
    expect(moveLeftRuntime.getRenderState().ballState).toBe('HELD_LEFT');
    expect(moveLeftRuntime.getRenderState().ballLocalPosition[0]).toBeGreaterThan(0);
  });

  it('enters right-side dribble when E is held from HELD_RIGHT', () => {
    const runtime = new GameRuntime();

    runtime.advance(1 / 60, makeControls());
    runtime.advance(1 / 60, makeControls({ dribblePressed: true }));

    const snapshot = runtime.getRenderState();
    expect(snapshot.ballState).toBe('DRIBBLE_RIGHT_DOWN');
    expect(snapshot.ballLocalPosition[0]).toBeLessThan(0);
  });

  it('maps keyboard crossover direction to screen-space movement', () => {
    const runtime = new GameRuntime();

    runtime.advance(1 / 60, makeControls());
    runtime.advance(1 / 60, makeControls({ moveX: -1 }));

    expect(runtime.getRenderState().ballState).toBe('CROSSOVER_R2L');
  });
});
