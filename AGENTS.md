# WEBBALL KNOWLEDGE BASE

**Generated:** 2026-03-25

## OVERVIEW

Webcam-controlled basketball game. React UI + custom game engine + PixiJS rendering + MediaPipe hand tracking.

## STRUCTURE

```
webball/
├── src/
│   ├── engine/          # Game engine (see engine/AGENTS.md)
│   ├── components/      # React components (GameScreen, MainMenu)
│   ├── hooks/           # useGameEngine, useWebcam
│   ├── types/           # Centralized type definitions (306 lines)
│   └── App.tsx          # Root component, screen state management
├── tests/unit/          # Vitest tests for physics/input
└── public/              # Models (MediaPipe), sounds (Howler)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add game feature | `src/engine/GameEngine.ts` | Singleton, orchestrates subsystems |
| Modify physics | `src/engine/physics/` | BallPhysics (trajectory), ShotResolver (collision) |
| Change rendering | `src/engine/rendering/PixiRenderer.ts` | 967 lines, layered scene |
| Add hand gesture | `src/engine/input/ReleaseDetector.ts` | Velocity + finger extension |
| Modify UI | `src/components/` | GameScreen.tsx, MainMenu.tsx |
| Add types | `src/types/index.ts` | All shared types here |
| Add sounds | `src/engine/audio/AudioManager.ts` | Howler.js + synth fallback |

## ARCHITECTURE

**Hybrid Pattern**: React UI wraps singleton game engine

```
App.tsx → GameScreen.tsx → useGameEngine hook
                              ↓
                        GameEngine (singleton)
                        ├── GameLoop (60 FPS fixed timestep)
                        ├── GameStateMachine (10 states)
                        ├── HandTracker (MediaPipe)
                        ├── BallPhysics + ShotResolver
                        ├── PixiRenderer (4 layers)
                        └── AudioManager
```

**Coordinate System**: Normalized 0-1 space. (0,0)=top-left, (1,1)=bottom-right.

**State Flow**: IDLE → HOLDING → GATHERING → SHOOTING → IN_FLIGHT → RESOLVING → SCORED/MISSED → COOLDOWN

## CONVENTIONS

- **Classes**: PascalCase (`GameEngine`, `BallPhysics`)
- **Hooks**: `useXxx` pattern
- **Constants**: UPPER_SNAKE_CASE at module top
- **Types**: Centralized in `types/index.ts`, use `import type`
- **Tests**: `tests/unit/{ClassName}.test.ts`

## ANTI-PATTERNS

- NO `@ts-ignore` or type bypasses — strict mode enforced
- NO console.log in production — use EventBus for state changes
- NO direct DOM manipulation — PixiRenderer handles all rendering
- NO React state for game logic — GameStateMachine is source of truth

## COMMANDS

```bash
npm run dev      # Dev server (Vite)
npm run build    # Type-check + build
npm run lint     # ESLint
npx vitest       # Run tests
```

## GOTCHAS

1. **Singleton lifecycle**: GameEngine persists across GameScreen remounts. Call `destroy()` on cleanup.
2. **Two-phase init**: `engine.init()` then `engine.initRenderer()` — renderer needs container + video element.
3. **mirrorVideo**: Webcam is mirrored. Hand X coordinate flipped: `1 - hand.wrist.x`
4. **Particle budget**: Adaptive 50-500 particles based on frame time. Don't hardcode particle counts.
5. **Shot detection**: Requires BOTH velocity reversal AND finger extension > 0.08
