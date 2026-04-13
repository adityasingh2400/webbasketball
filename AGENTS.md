# WEBBALL KNOWLEDGE BASE

**Generated:** 2026-03-25

## OVERVIEW

Webcam-controlled basketball game. React UI + BallStateMachine + ShotArc physics + R3F (React Three Fiber) 3D rendering + MediaPipe hand tracking.

## STRUCTURE

```
webball/
├── src/
│   ├── engine/               # Game engine subsystems
│   │   ├── BallStateMachine.ts   # 18-state ball handling FSM
│   │   ├── ShotArc.ts            # 3D projectile physics with collision
│   │   └── input/
│   │       ├── HandTracker.ts        # MediaPipe hand landmarker
│   │       ├── ReleaseDetector.ts    # Legacy velocity-based release
│   │       ├── OneEuroFilter.ts      # Jitter-reducing landmark filter
│   │       └── TwoGateReleaseDetector.ts  # Position + velocity gate shot detection
│   ├── r3f/                  # React Three Fiber 3D components
│   │   ├── GameCanvas.tsx        # Top-level R3F Canvas
│   │   ├── Court.tsx             # Half-court floor + markings
│   │   ├── Hoop.tsx              # Single hoop with backboard + net
│   │   ├── Player.tsx            # Articulated player character
│   │   ├── Ball.tsx              # Basketball with canvas texture
│   │   ├── Lighting.tsx          # 3-point + hemisphere lighting
│   │   └── ThirdPersonCamera.tsx # Smooth-follow camera
│   ├── components/
│   │   ├── GameScreen3D.tsx      # Main game screen (orchestrator)
│   │   ├── MainMenu.tsx          # Landing screen with mode select
│   │   └── MainMenu.css          # Menu styles
│   ├── hooks/
│   │   ├── useHandTracking3D.ts  # Hand tracking with OneEuroFilter
│   │   └── useWebcam.ts          # Webcam access
│   ├── types/index.ts            # Shared type definitions
│   └── App.tsx                   # Root component, screen routing
├── tests/unit/               # Vitest tests
└── public/                   # Static assets
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add game feature | `src/components/GameScreen3D.tsx` | Game loop orchestrator |
| Modify ball handling | `src/engine/BallStateMachine.ts` | 18 states, priority transitions |
| Change shot physics | `src/engine/ShotArc.ts` | Trajectory + rim/backboard collision |
| Change rendering | `src/r3f/` | R3F components |
| Add hand gesture | `src/engine/input/TwoGateReleaseDetector.ts` | Position + velocity gates |
| Reduce jitter | `src/engine/input/OneEuroFilter.ts` | Adaptive low-pass filter |
| Modify UI | `src/components/` | GameScreen3D.tsx, MainMenu.tsx |
| Add types | `src/types/index.ts` | All shared types here |

## ARCHITECTURE

**React-driven**: No singleton engine. R3F provides frame loop, React owns state.

```
App.tsx → GameScreen3D.tsx (drives game loop via requestAnimationFrame)
 ├── useHandTracking3D hook
 │   ├── HandTracker (MediaPipe)
 │   ├── OneEuroFilter (jitter reduction)
 │   └── TwoGateReleaseDetector (raise + flick detection)
 ├── BallStateMachine ref (18 states, priority-based transitions)
 ├── ShotArc ref (3D projectile, rim/backboard/floor collision)
 ├── useWebcam hook
 └── GameCanvas (R3F <Canvas>)
     ├── Court (half-court)
     ├── Hoop (single, with net)
     ├── Player (articulated character)
     ├── Ball (textured sphere)
     ├── Lighting (3-point + hemisphere)
     └── ThirdPersonCamera (smooth follow)
```

**Coordinate System**: 3D world space. Court is 15x14 units. Hoop at (0, 3.05, -13).

**Ball State Flow**: IDLE → HELD → DRIBBLE_DOWN/UP → (CROSSOVER|BEHIND_BACK|BETWEEN_LEGS) → GATHER_LOW → GATHER_HIGH → SHOOTING → FOLLOW_THROUGH → (BOUNCE|DEAD) → IDLE

## CONVENTIONS

- **Components**: PascalCase R3F components (`Player`, `Court`, `Ball`)
- **Hooks**: `useXxx` pattern
- **Engine classes**: PascalCase (`BallStateMachine`, `ShotArc`)
- **Constants**: UPPER_SNAKE_CASE at module top
- **Types**: Centralized in `types/index.ts`, use `import type`
- **Tests**: `tests/unit/{ClassName}.test.ts`

## ANTI-PATTERNS

- NO singleton engine classes — React hooks + state + useFrame
- NO `@ts-ignore` or type bypasses — strict mode enforced
- NO console.log in production
- NO PixiJS or 2D rendering — removed entirely, 3D only

## COMMANDS

```bash
npm run dev       # Dev server (Vite)
npm run build     # Type-check + build
npm run lint      # ESLint
npx vitest        # Run tests
```

## GOTCHAS

1. **mirrorVideo**: Webcam is mirrored. Hand X coordinate flipped: `1 - hand.wrist.x`
2. **Two-gate shot detection**: Requires BOTH hand above shoulder AND velocity reversal (raise then flick)
3. **BallStateMachine transitions**: Priority-based — higher priority conditions checked first
4. **OneEuroFilter params**: `minCutoff=1.0, beta=0.007` are starting values, tune empirically
5. **ShotArc accuracy**: Shot meter sweet spot gives +0.2 accuracy bonus to launch angle
6. **Half court only**: Single hoop at z=-13, player starts at z=8
