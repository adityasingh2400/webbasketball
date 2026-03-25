# WebBall: React Three Fiber Transformation Plan

## Current State
- **Stack**: React + PixiJS 2D + MediaPipe hand tracking
- **Input**: Webcam-based hand tracking (primary control)
- **View**: Fixed 2D perspective
- **Problem**: Cannot achieve "third-person arcade basketball" with 2D rendering

## Target State
- **Stack**: React + React Three Fiber (R3F) + MediaPipe hand tracking
- **Input**: Webcam hand tracking (primary), keyboard/gamepad (secondary)
- **View**: 3D third-person camera following player
- **Feel**: Wii Sports Resort-inspired arcade basketball

## Architecture Decision

### Keep (Preserve)
- `src/engine/input/HandTracker.ts` - MediaPipe integration
- `src/engine/input/ReleaseDetector.ts` - Gesture detection
- `src/engine/GameStateMachine.ts` - Game state logic
- `src/engine/GameLoop.ts` - Fixed timestep loop
- `src/engine/audio/AudioManager.ts` - Sound system
- `src/engine/physics/BallPhysics.ts` - Trajectory math (adapt for 3D)
- `src/types/index.ts` - Type definitions (extend for 3D)

### Replace
- `src/engine/rendering/PixiRenderer.ts` → R3F scene components
- `src/engine/Player.ts` → R3F player mesh + animations
- Court rendering → R3F court geometry
- HUD components → React overlay or drei Html

### Add
- `@react-three/fiber` - React Three.js renderer
- `@react-three/drei` - Helpers (OrbitControls, Html, useGLTF)
- `@react-three/postprocessing` - Visual effects (optional)
- Third-person camera system
- 3D player model (placeholder capsule → GLTF)
- 3D court environment
- 3D ball with physics

## Transformation Phases

### Phase 1: Dependencies & Scaffolding
1. Install R3F packages: `@react-three/fiber`, `@react-three/drei`
2. Create `src/r3f/` directory structure
3. Create basic R3F Canvas alongside existing PixiJS (parallel development)
4. Verify R3F renders without breaking existing functionality

### Phase 2: Core 3D Scene
1. `src/r3f/Court.tsx` - 3D basketball court geometry
2. `src/r3f/Ball.tsx` - 3D basketball mesh
3. `src/r3f/Hoop.tsx` - 3D hoop with backboard and rim
4. `src/r3f/Player.tsx` - 3D player (capsule placeholder)
5. `src/r3f/Lighting.tsx` - Court lighting setup

### Phase 3: Camera System
1. `src/r3f/ThirdPersonCamera.tsx` - Smooth follow camera
   - Trail behind player at configurable distance
   - Smooth interpolation (lerp/slerp)
   - Look-at target with offset
   - Collision avoidance (raycast from player)
2. Camera presets (debug, cinematic, gameplay)

### Phase 4: Webcam → 3D Mapping
1. Adapt `HandTracker` output to 3D space
   - Hand X (0-1) → Player X position on court
   - Hand Y (0-1) → Shot power / jump height
   - Velocity → Shot direction and power
2. `src/r3f/WebcamController.tsx` - Bridge between hand tracking and 3D player
3. Webcam PiP overlay (keep visible in corner)

### Phase 5: Player Animation States
1. Idle pose
2. Dribble animation (procedural bounce)
3. Gather animation (wind up)
4. Shoot animation (release + follow through)
5. Move animation (based on hand position delta)

### Phase 6: Physics Integration
1. Adapt `BallPhysics` for 3D coordinates (x, y, z)
2. `ShotResolver` → 3D collision detection with rim/backboard
3. Ball trajectory arc in 3D space
4. Bounce physics on court surface

### Phase 7: HUD Overlay
1. `src/r3f/HUD.tsx` - React overlay on R3F canvas
   - Score display
   - Shot meter
   - Streak counter
   - Game state indicators
2. 3D world-space UI (optional: floating score above hoop)

### Phase 8: Polish & Effects
1. Particle effects (swish, brick, fire streak)
2. Screen shake on made shots
3. Court reflections / shadows
4. Post-processing (bloom, vignette)

### Phase 9: Cutover
1. Replace PixiJS GameScreen with R3F GameScreen
2. Remove PixiJS dependencies
3. Update AGENTS.md documentation
4. Final visual verification

## File Structure After Transformation

```
src/
├── r3f/
│   ├── Canvas.tsx          # Main R3F canvas
│   ├── Court.tsx           # 3D court geometry
│   ├── Ball.tsx            # 3D basketball
│   ├── Hoop.tsx            # 3D hoop + backboard
│   ├── Player.tsx          # 3D player avatar
│   ├── ThirdPersonCamera.tsx
│   ├── Lighting.tsx
│   ├── WebcamController.tsx # Hand tracking → 3D
│   ├── HUD.tsx             # Overlay UI
│   └── effects/
│       ├── Particles.tsx
│       └── PostProcessing.tsx
├── engine/                  # Keep most, adapt physics
│   ├── input/              # HandTracker (keep)
│   ├── physics/            # Adapt for 3D
│   ├── audio/              # Keep
│   └── GameStateMachine.ts # Keep
├── components/
│   ├── GameScreen3D.tsx    # New R3F game screen
│   └── ...
└── types/
    └── index.ts            # Extend for 3D types
```

## Dependencies to Add

```json
{
  "@react-three/fiber": "^9.0.0",
  "@react-three/drei": "^10.0.0",
  "three": "^0.175.0",
  "@types/three": "^0.175.0"
}
```

## Success Criteria

1. [ ] Game renders in 3D with visible player on court
2. [ ] Third-person camera follows player smoothly
3. [ ] Webcam hand tracking controls player position
4. [ ] Ball handling (dribble, gather, shoot) visible in 3D
5. [ ] HUD displays score, shot meter, streak
6. [ ] Shots travel in 3D arc to hoop
7. [ ] Made/missed shot detection works in 3D
8. [ ] Audio syncs with 3D events
9. [ ] Performance: 60fps on modern hardware
10. [ ] Visual polish comparable to Wii Sports aesthetic

## Risk Mitigation

1. **Parallel Development**: Build R3F alongside PixiJS, don't delete until verified
2. **Incremental Migration**: Each phase is testable independently
3. **Fallback**: Can revert to PixiJS if R3F proves problematic
4. **Performance**: Profile early, optimize hot paths

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Scaffolding | 1 hour | Critical |
| Phase 2: Core Scene | 3 hours | Critical |
| Phase 3: Camera | 2 hours | Critical |
| Phase 4: Webcam Mapping | 2 hours | Critical |
| Phase 5: Animations | 3 hours | High |
| Phase 6: Physics | 2 hours | High |
| Phase 7: HUD | 2 hours | High |
| Phase 8: Polish | 4 hours | Medium |
| Phase 9: Cutover | 1 hour | Final |

**Total**: ~20 hours of focused work

## Questions for User

1. **Player Model**: Procedural capsule (faster) or custom GLTF model (better looking)?
2. **Court Style**: Realistic wood floor or stylized Wii-like aesthetic?
3. **Multiplayer**: Single player only, or design for future multiplayer?
