# Webball Code Review Rules

## Architecture

This is a React Three Fiber 3D basketball game. The architecture is React-driven:
- `GameScreen3D.tsx` drives the game loop via `requestAnimationFrame`
- `BallStateMachine` (19 states) handles all ball handling logic
- `ShotArc` handles 3D projectile physics with collision detection
- `useHandTracking3D` wraps MediaPipe hand tracking with OneEuroFilter
- R3F components in `src/r3f/` render the 3D scene

There is NO singleton engine class. React owns state, R3F provides the render loop.

## Critical Rules

### No Memory Leaks
- Three.js resources (geometries, materials, textures) MUST be disposed on unmount
- Canvas textures created in useMemo MUST be cleaned up
- Event listeners MUST be removed in cleanup functions
- requestAnimationFrame handles MUST be cancelled on unmount

### No Frame-Rate Dependent Code
- All physics and animations must use `deltaTime` (seconds), not per-frame multipliers
- `position.x *= 0.9` is frame-rate dependent — use `Math.exp(-decay * deltaTime)` instead
- The OneEuroFilter handles time-based smoothing correctly — do not add frame-based smoothing on top

### React Three Fiber Best Practices
- Pre-allocate Vector3/Quaternion instances as useRef, not inside useFrame
- Use `<Suspense>` around components that load async resources
- Prefer declarative JSX props over imperative `ref.current.position.set()` when possible
- Do not create `new THREE.*` objects in JSX return statements (they recreate every render)

### Hand Tracking
- All 21 landmarks must pass through OneEuroFilter before any game logic
- Shot detection requires BOTH position gate (above shoulder) AND velocity gate (flick)
- Webcam coordinate X is mirrored: use `1 - hand.wrist.x`
- HandTracker errors must be caught and retried (max 3 attempts)

### State Management
- Score/streak are single source of truth in React useState
- BallStateMachine is the ONLY source of truth for ball handling state
- No duplicate state tracking between components
- useEffect dependency arrays must be correct — use refs for frequently-changing values that shouldn't trigger re-subscription

### TypeScript
- Strict mode is enforced — no `any`, no `@ts-ignore`
- Use `import type` for type-only imports
- All function parameters must be typed
