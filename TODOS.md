# TODOS

## Court Movement Design
**Priority:** High
**What:** Design a proper court movement system for webcam play. Current hip-X-to-court-X mapping doesn't scale (3 feet of real movement → 15 units of court). Explore: auto-movement with body-lean steering (Wii Sports approach), lean-to-velocity, or zone-based navigation.
**Why:** You can't play basketball if you can't move. The body-drive animation architecture works regardless of how court position is determined, but the game needs a real movement system before it's playable.
**Context:** Wii Sports Resort basketball does NOT give free court movement. It auto-positions players and you control actions (shoot, pass, block). This is a game design problem that needs playtesting.
**Depends on:** Nothing. Can be done before, during, or after the animation work.
**Added:** 2026-04-14 via /plan-eng-review

## Wrist Flick Detection (Multi-Camera)
**Priority:** Medium
**What:** Implement true wrist articulation detection for shot release. A front-facing camera can't reliably see wrist flexion (Z-axis motion). Options: MediaPipe Hand Landmarker (21 hand landmarks, needs close-up hand visibility) or side-angle phone camera via multi-device input.
**Why:** More natural shot release feel. The "flick" is how real basketball players release. Current two-gate detector (hand rise + velocity reversal) works but feels indirect.
**Context:** Multi-device architecture (phone as side camera) would see the Z-axis motion clearly. BodyInputFrame already supports multiple input sources.
**Depends on:** Multi-device input architecture (BodyInputFrame supports it, no phone adapter exists yet).
**Added:** 2026-04-14 via /plan-eng-review
