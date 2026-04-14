export type BallHandlingState =
  | 'IDLE'
  | 'HELD_RIGHT'
  | 'HELD_LEFT'
  | 'DRIBBLE_RIGHT_DOWN'
  | 'DRIBBLE_RIGHT_UP'
  | 'DRIBBLE_LEFT_DOWN'
  | 'DRIBBLE_LEFT_UP'
  | 'CROSSOVER_R2L'
  | 'CROSSOVER_L2R'
  | 'GATHER_LOW'
  | 'GATHER_HIGH'
  | 'SHOOTING'
  | 'FOLLOW_THROUGH'
  | 'BOUNCE'
  | 'DEAD';

export interface BallStateConfig {
  duration: number | null;
  ballOffset: { x: number; y: number; z: number };
  ballBounce: { amplitude: number; frequency: number } | null;
  ballSpin: number;
  playerAnim: 'idle' | 'dribbling' | 'gathering' | 'shooting';
  canMove: boolean;
  autoNext: BallHandlingState | null;
}

export interface TransitionCondition {
  to: BallHandlingState;
  when: (input: BallInput) => boolean;
  priority: number;
}

export interface BallInput {
  velocityX: number;
  velocityY: number;
  dribblePressed: boolean;
  handSide: 'left' | 'right';
  released: boolean;
  timeSinceStateEnter: number;
}

const CROSSOVER_VELOCITY_THRESHOLD = 0.5;
const GATHER_VELOCITY_THRESHOLD = -0.6;
const DRIBBLE_VELOCITY_THRESHOLD = 0.3;
const DRIBBLE_PHASE_DURATION = 0.45;

const STATE_CONFIGS: Record<BallHandlingState, BallStateConfig> = {
  IDLE: {
    duration: null,
    ballOffset: { x: 0, y: 0.12, z: 0 },
    ballBounce: null,
    ballSpin: 0,
    playerAnim: 'idle',
    canMove: true,
    autoNext: null,
  },

  HELD_RIGHT: {
    duration: null,
    ballOffset: { x: -0.25, y: 0.8, z: 0.1 },
    ballBounce: null,
    ballSpin: 0,
    playerAnim: 'idle',
    canMove: true,
    autoNext: null,
  },
  HELD_LEFT: {
    duration: null,
    ballOffset: { x: 0.25, y: 0.8, z: 0.1 },
    ballBounce: null,
    ballSpin: 0,
    playerAnim: 'idle',
    canMove: true,
    autoNext: null,
  },

  DRIBBLE_RIGHT_DOWN: {
    duration: DRIBBLE_PHASE_DURATION,
    ballOffset: { x: -0.3, y: 0.3, z: 0.15 },
    ballBounce: { amplitude: 0.3, frequency: 2.8 },
    ballSpin: 3,
    playerAnim: 'dribbling',
    canMove: true,
    autoNext: 'DRIBBLE_RIGHT_UP',
  },
  DRIBBLE_RIGHT_UP: {
    duration: DRIBBLE_PHASE_DURATION,
    ballOffset: { x: -0.3, y: 0.65, z: 0.15 },
    ballBounce: null,
    ballSpin: 2,
    playerAnim: 'dribbling',
    canMove: true,
    autoNext: null,
  },
  DRIBBLE_LEFT_DOWN: {
    duration: DRIBBLE_PHASE_DURATION,
    ballOffset: { x: 0.3, y: 0.3, z: 0.15 },
    ballBounce: { amplitude: 0.3, frequency: 2.8 },
    ballSpin: -3,
    playerAnim: 'dribbling',
    canMove: true,
    autoNext: 'DRIBBLE_LEFT_UP',
  },
  DRIBBLE_LEFT_UP: {
    duration: DRIBBLE_PHASE_DURATION,
    ballOffset: { x: 0.3, y: 0.65, z: 0.15 },
    ballBounce: null,
    ballSpin: -2,
    playerAnim: 'dribbling',
    canMove: true,
    autoNext: null,
  },

  CROSSOVER_R2L: {
    duration: 0.25,
    ballOffset: { x: 0, y: 0.25, z: 0.2 },
    ballBounce: { amplitude: 0.15, frequency: 2 },
    ballSpin: -8,
    playerAnim: 'dribbling',
    canMove: true,
    autoNext: 'DRIBBLE_LEFT_DOWN',
  },
  CROSSOVER_L2R: {
    duration: 0.25,
    ballOffset: { x: 0, y: 0.25, z: 0.2 },
    ballBounce: { amplitude: 0.15, frequency: 2 },
    ballSpin: 8,
    playerAnim: 'dribbling',
    canMove: true,
    autoNext: 'DRIBBLE_RIGHT_DOWN',
  },

  GATHER_LOW: {
    duration: 0.17,
    ballOffset: { x: 0.15, y: 0.5, z: 0.1 },
    ballBounce: null,
    ballSpin: 0,
    playerAnim: 'gathering',
    canMove: false,
    autoNext: 'GATHER_HIGH',
  },
  GATHER_HIGH: {
    duration: null,
    ballOffset: { x: 0.1, y: 1.4, z: 0.05 },
    ballBounce: null,
    ballSpin: 0,
    playerAnim: 'gathering',
    canMove: false,
    autoNext: null,
  },

  SHOOTING: {
    duration: 0.13,
    ballOffset: { x: 0.05, y: 1.6, z: -0.1 },
    ballBounce: null,
    ballSpin: -3,
    playerAnim: 'shooting',
    canMove: false,
    autoNext: 'FOLLOW_THROUGH',
  },
  FOLLOW_THROUGH: {
    duration: 0.4,
    ballOffset: { x: 0, y: 1.7, z: -0.2 },
    ballBounce: null,
    ballSpin: 0,
    playerAnim: 'shooting',
    canMove: false,
    autoNext: 'IDLE',
  },
  BOUNCE: {
    duration: 0.15,
    ballOffset: { x: 0, y: 0, z: 0 },
    ballBounce: { amplitude: 0.5, frequency: 4 },
    ballSpin: 3,
    playerAnim: 'idle',
    canMove: true,
    autoNext: 'DEAD',
  },
  DEAD: {
    duration: 0.15,
    ballOffset: { x: 0, y: 0.12, z: 0 },
    ballBounce: null,
    ballSpin: 0,
    playerAnim: 'idle',
    canMove: true,
    autoNext: 'IDLE',
  },
};

function isDribblingRight(state: BallHandlingState): boolean {
  return state === 'DRIBBLE_RIGHT_DOWN' || state === 'DRIBBLE_RIGHT_UP';
}

function isDribblingLeft(state: BallHandlingState): boolean {
  return state === 'DRIBBLE_LEFT_DOWN' || state === 'DRIBBLE_LEFT_UP';
}

function isDribbling(state: BallHandlingState): boolean {
  return isDribblingRight(state) || isDribblingLeft(state);
}

function isHeld(state: BallHandlingState): boolean {
  return state === 'HELD_RIGHT' || state === 'HELD_LEFT';
}

function isCrossover(state: BallHandlingState): boolean {
  return state === 'CROSSOVER_R2L' || state === 'CROSSOVER_L2R';
}

function isGathering(state: BallHandlingState): boolean {
  return state === 'GATHER_LOW' || state === 'GATHER_HIGH';
}

const TRANSITIONS: Record<string, TransitionCondition[]> = {
  IDLE: [
    { to: 'HELD_RIGHT', when: (i) => i.handSide === 'right' && !i.released, priority: 1 },
    { to: 'HELD_LEFT', when: (i) => i.handSide === 'left' && !i.released, priority: 1 },
  ],

  HELD_RIGHT: [
    { to: 'GATHER_LOW', when: (i) => i.velocityY < GATHER_VELOCITY_THRESHOLD, priority: 10 },
    { to: 'DRIBBLE_RIGHT_DOWN', when: (i) => i.velocityY > DRIBBLE_VELOCITY_THRESHOLD, priority: 5 },
    { to: 'CROSSOVER_R2L', when: (i) => i.velocityX < -CROSSOVER_VELOCITY_THRESHOLD, priority: 7 },
  ],
  HELD_LEFT: [
    { to: 'GATHER_LOW', when: (i) => i.velocityY < GATHER_VELOCITY_THRESHOLD, priority: 10 },
    { to: 'DRIBBLE_LEFT_DOWN', when: (i) => i.velocityY > DRIBBLE_VELOCITY_THRESHOLD, priority: 5 },
    { to: 'CROSSOVER_L2R', when: (i) => i.velocityX > CROSSOVER_VELOCITY_THRESHOLD, priority: 7 },
  ],

  DRIBBLE_RIGHT_DOWN: [
    { to: 'CROSSOVER_R2L', when: (i) => i.velocityX < -CROSSOVER_VELOCITY_THRESHOLD, priority: 10 },
    { to: 'GATHER_LOW', when: (i) => i.velocityY < GATHER_VELOCITY_THRESHOLD, priority: 9 },
  ],
  DRIBBLE_RIGHT_UP: [
    { to: 'CROSSOVER_R2L', when: (i) => i.velocityX < -CROSSOVER_VELOCITY_THRESHOLD, priority: 10 },
    { to: 'GATHER_LOW', when: (i) => i.velocityY < GATHER_VELOCITY_THRESHOLD, priority: 9 },
    { to: 'DRIBBLE_RIGHT_DOWN', when: (i) => i.dribblePressed && i.timeSinceStateEnter >= DRIBBLE_PHASE_DURATION, priority: 5 },
    { to: 'HELD_RIGHT', when: (i) => !i.dribblePressed && i.timeSinceStateEnter >= DRIBBLE_PHASE_DURATION, priority: 4 },
  ],
  DRIBBLE_LEFT_DOWN: [
    { to: 'CROSSOVER_L2R', when: (i) => i.velocityX > CROSSOVER_VELOCITY_THRESHOLD, priority: 10 },
    { to: 'GATHER_LOW', when: (i) => i.velocityY < GATHER_VELOCITY_THRESHOLD, priority: 9 },
  ],
  DRIBBLE_LEFT_UP: [
    { to: 'CROSSOVER_L2R', when: (i) => i.velocityX > CROSSOVER_VELOCITY_THRESHOLD, priority: 10 },
    { to: 'GATHER_LOW', when: (i) => i.velocityY < GATHER_VELOCITY_THRESHOLD, priority: 9 },
    { to: 'DRIBBLE_LEFT_DOWN', when: (i) => i.dribblePressed && i.timeSinceStateEnter >= DRIBBLE_PHASE_DURATION, priority: 5 },
    { to: 'HELD_LEFT', when: (i) => !i.dribblePressed && i.timeSinceStateEnter >= DRIBBLE_PHASE_DURATION, priority: 4 },
  ],

  CROSSOVER_R2L: [],
  CROSSOVER_L2R: [],

  GATHER_LOW: [],
  GATHER_HIGH: [
    { to: 'SHOOTING', when: (i) => i.released, priority: 10 },
  ],

  SHOOTING: [],
  FOLLOW_THROUGH: [],
  BOUNCE: [],
  DEAD: [],
};

const BLEND_DURATION = 0.1;

export interface BallStateMachineSnapshot {
  state: BallHandlingState;
  config: BallStateConfig;
  stateTime: number;
  stateProgress: number;
  previousConfig: BallStateConfig | null;
  blendFactor: number;
}

export class BallStateMachine {
  private currentState: BallHandlingState = 'IDLE';
  private previousState: BallHandlingState | null = null;
  private stateEnterTime = 0;
  private elapsedTime = 0;
  private listeners: Array<(from: BallHandlingState, to: BallHandlingState) => void> = [];

  getState(): BallHandlingState {
    return this.currentState;
  }

  getConfig(): BallStateConfig {
    return STATE_CONFIGS[this.currentState];
  }

  getStateTime(): number {
    return this.elapsedTime - this.stateEnterTime;
  }

  getStateProgress(): number {
    const config = this.getConfig();
    if (!config.duration) return 0;
    return Math.min(1, this.getStateTime() / config.duration);
  }

  getBlendFactor(): number {
    const stateTime = this.getStateTime();
    if (!this.previousState || stateTime >= BLEND_DURATION) return 1;
    return Math.min(1, stateTime / BLEND_DURATION);
  }

  getPreviousConfig(): BallStateConfig | null {
    return this.previousState ? STATE_CONFIGS[this.previousState] : null;
  }

  getSnapshot(): BallStateMachineSnapshot {
    return {
      state: this.currentState,
      config: this.getConfig(),
      stateTime: this.getStateTime(),
      stateProgress: this.getStateProgress(),
      previousConfig: this.getPreviousConfig(),
      blendFactor: this.getBlendFactor(),
    };
  }

  onTransition(listener: (from: BallHandlingState, to: BallHandlingState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  update(deltaTime: number, input: BallInput): void {
    this.elapsedTime += deltaTime;

    const config = this.getConfig();
    const stateTime = this.getStateTime();
    const evaluatedInput: BallInput = {
      ...input,
      timeSinceStateEnter: stateTime,
    };

    if (config.duration && stateTime >= config.duration && config.autoNext) {
      this.transitionTo(config.autoNext);
      return;
    }

    const transitions = TRANSITIONS[this.currentState];
    if (!transitions || transitions.length === 0) return;

    const sorted = [...transitions].sort((a, b) => b.priority - a.priority);
    for (const t of sorted) {
      if (t.when(evaluatedInput)) {
        this.transitionTo(t.to);
        return;
      }
    }
  }

  forceTransition(to: BallHandlingState): void {
    this.transitionTo(to);
  }

  reset(): void {
    this.transitionTo('IDLE');
    this.elapsedTime = 0;
    this.stateEnterTime = 0;
  }

  isDribbling(): boolean { return isDribbling(this.currentState); }
  isHeld(): boolean { return isHeld(this.currentState); }
  isCrossover(): boolean { return isCrossover(this.currentState); }
  isGathering(): boolean { return isGathering(this.currentState); }
  isShooting(): boolean { return this.currentState === 'SHOOTING' || this.currentState === 'FOLLOW_THROUGH'; }

  private transitionTo(to: BallHandlingState): void {
    const from = this.currentState;
    if (from === to) return;

    this.previousState = from;
    this.currentState = to;
    this.stateEnterTime = this.elapsedTime;

    for (const listener of this.listeners) {
      listener(from, to);
    }
  }
}
