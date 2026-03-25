import type {
  GameState,
  GameContext,
  ShotOutcome,
  Vector2,
  NormalizedPosition,
} from '../types';

// ============================================
// Internal Types
// ============================================

type StateHandler = {
  enter?: (context: GameContext) => void;
  exit?: (context: GameContext) => void;
  update?: (context: GameContext, deltaTime: number) => void;
};

type StateListener = (state: GameState, context: GameContext) => void;

const VALID_TRANSITIONS: Record<GameState, readonly GameState[]> = {
  IDLE: ['HOLDING'],
  HOLDING: ['DRIBBLING', 'GATHERING', 'IDLE'],
  DRIBBLING: ['HOLDING', 'IDLE'],
  GATHERING: ['SHOOTING', 'HOLDING', 'IDLE'],
  SHOOTING: ['IN_FLIGHT', 'IDLE'],
  IN_FLIGHT: ['RESOLVING', 'IDLE'],
  RESOLVING: ['SCORED', 'MISSED'],
  SCORED: ['COOLDOWN'],
  MISSED: ['COOLDOWN'],
  COOLDOWN: ['IDLE'],
} as const;

const SPAWN_ZONE = {
  minX: 0.2,
  maxX: 0.8,
  minY: 0.2,
  maxY: 0.7,
} as const;

const COOLDOWN_DURATION = 1.0;

// ============================================
// GameStateMachine
// ============================================

export class GameStateMachine {
  private context: GameContext;
  private stateHandlers: Map<GameState, StateHandler> = new Map();
  private listeners: StateListener[] = [];
  private cooldownTimer = 0;

  constructor() {
    this.context = this.createInitialContext();
    this.setupStateHandlers();
  }

  getState(): GameState {
    return this.context.state;
  }

  getContext(): Readonly<GameContext> {
    return this.context;
  }

  transition(to: GameState, payload?: Record<string, unknown>): boolean {
    const from = this.context.state;
    const allowed = VALID_TRANSITIONS[from];

    if (!allowed.includes(to)) {
      return false;
    }

    const exitHandler = this.stateHandlers.get(from);
    exitHandler?.exit?.(this.context);

    if (payload) {
      Object.assign(this.context, payload);
    }

    this.context.state = to;

    const enterHandler = this.stateHandlers.get(to);
    enterHandler?.enter?.(this.context);

    for (const listener of this.listeners) {
      listener(to, this.context);
    }

    return true;
  }

  update(deltaTime: number): void {
    const handler = this.stateHandlers.get(this.context.state);
    handler?.update?.(this.context, deltaTime);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  reset(): void {
    const oldState = this.context.state;
    const exitHandler = this.stateHandlers.get(oldState);
    exitHandler?.exit?.(this.context);

    this.context = this.createInitialContext();
    this.cooldownTimer = 0;

    const enterHandler = this.stateHandlers.get(this.context.state);
    enterHandler?.enter?.(this.context);

    for (const listener of this.listeners) {
      listener(this.context.state, this.context);
    }
  }

  onHandDetected(position: NormalizedPosition): void {
    if (this.context.state !== 'IDLE') return;

    const inSpawnZone =
      position.x >= SPAWN_ZONE.minX &&
      position.x <= SPAWN_ZONE.maxX &&
      position.y >= SPAWN_ZONE.minY &&
      position.y <= SPAWN_ZONE.maxY;

    if (!inSpawnZone) return;

    this.transition('HOLDING', {
      ballPosition: { x: position.x, y: position.y },
      ballVelocity: { x: 0, y: 0 },
    });
  }

  onHandLost(): void {
    const interruptible: GameState[] = [
      'HOLDING',
      'DRIBBLING',
      'GATHERING',
    ];

    if (interruptible.includes(this.context.state)) {
      this.transition('IDLE');
    }
  }

  onDribbleStart(): void {
    if (this.context.state !== 'HOLDING') return;
    this.transition('DRIBBLING');
  }

  onDribbleEnd(): void {
    if (this.context.state !== 'DRIBBLING') return;
    this.transition('HOLDING');
  }

  onGatherStart(): void {
    if (this.context.state !== 'HOLDING') return;
    this.transition('GATHERING');
  }

  onShotReleased(power: number, angle: number, velocity: Vector2): void {
    if (this.context.state !== 'GATHERING') return;

    const shotTransitioned = this.transition('SHOOTING', {
      ballVelocity: { x: velocity.x, y: velocity.y },
    });

    if (!shotTransitioned) return;

    this.context.shotsAttempted++;

    const angleRad = angle * (Math.PI / 180);
    this.transition('IN_FLIGHT', {
      ballVelocity: {
        x: Math.cos(angleRad) * power,
        y: -Math.sin(angleRad) * power,
      },
    });
  }

  onBallLanded(position: NormalizedPosition): void {
    if (this.context.state !== 'IN_FLIGHT') return;

    this.transition('RESOLVING', {
      ballPosition: { x: position.x, y: position.y },
    });
  }

  onShotResolved(outcome: ShotOutcome, made: boolean): void {
    if (this.context.state !== 'RESOLVING') return;

    this.context.lastShotOutcome = outcome;

    if (made) {
      this.context.score++;
      this.context.shotsMade++;
      this.context.streak++;

      if (this.context.streak > this.context.bestStreak) {
        this.context.bestStreak = this.context.streak;
      }

      this.transition('SCORED');
    } else {
      this.context.streak = 0;
      this.transition('MISSED');
    }
  }

  private createInitialContext(): GameContext {
    return {
      state: 'IDLE',
      ballPosition: { x: 0.5, y: 0.5 },
      ballVelocity: { x: 0, y: 0 },
      score: 0,
      streak: 0,
      bestStreak: 0,
      shotsAttempted: 0,
      shotsMade: 0,
      timeRemaining: null,
      dominantHand: 'Right',
      lastShotOutcome: null,
    };
  }

  private setupStateHandlers(): void {
    this.stateHandlers.set('IDLE', {
      enter: (ctx) => {
        ctx.ballPosition = { x: 0.5, y: 0.5 };
        ctx.ballVelocity = { x: 0, y: 0 };
        ctx.lastShotOutcome = null;
      },
    });

    this.stateHandlers.set('HOLDING', {
      enter: (ctx) => {
        ctx.ballVelocity = { x: 0, y: 0 };
      },
    });

    this.stateHandlers.set('DRIBBLING', {});

    this.stateHandlers.set('GATHERING', {
      enter: (ctx) => {
        ctx.ballVelocity = { x: 0, y: 0 };
      },
    });

    this.stateHandlers.set('SHOOTING', {});

    this.stateHandlers.set('IN_FLIGHT', {});

    this.stateHandlers.set('RESOLVING', {});

    this.stateHandlers.set('SCORED', {
      enter: () => {
        // Deferred to prevent re-entrant transition during enter callback
        queueMicrotask(() => {
          if (this.context.state === 'SCORED') {
            this.transition('COOLDOWN');
          }
        });
      },
    });

    this.stateHandlers.set('MISSED', {
      enter: () => {
        // Deferred to prevent re-entrant transition during enter callback
        queueMicrotask(() => {
          if (this.context.state === 'MISSED') {
            this.transition('COOLDOWN');
          }
        });
      },
    });

    this.stateHandlers.set('COOLDOWN', {
      enter: () => {
        this.cooldownTimer = 0;
      },
      update: (_ctx, deltaTime) => {
        this.cooldownTimer += deltaTime;
        if (this.cooldownTimer >= COOLDOWN_DURATION) {
          this.cooldownTimer = 0;
          this.transition('IDLE');
        }
      },
    });
  }
}
