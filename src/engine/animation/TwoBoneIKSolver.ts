/**
 * Analytical two-bone IK solver for arm chains.
 *
 * Takes a shoulder position, target wrist position, pole target (elbow hint),
 * and arm segment lengths. Returns Euler angles (XYZ order) compatible with
 * the PlayerPose LimbRotation interface used by the rig.
 *
 * Coordinate system: Y-up, X-right (character perspective), Z-forward (toward hoop).
 * Default pose has arms hanging down along -Y.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface IKResult {
  shoulderRot: Vec3;
  forearmRot: Vec3;
}

// ---------------------------------------------------------------------------
// Module-scope scratch variables (zero allocation per frame)
// ---------------------------------------------------------------------------

const _dir: Vec3 = { x: 0, y: 0, z: 0 };
const _poleLocal: Vec3 = { x: 0, y: 0, z: 0 };
const _fwd: Vec3 = { x: 0, y: 0, z: 0 };
const _right: Vec3 = { x: 0, y: 0, z: 0 };
const _up: Vec3 = { x: 0, y: 0, z: 0 };

const _result: IKResult = {
  shoulderRot: { x: 0, y: 0, z: 0 },
  forearmRot: { x: 0, y: 0, z: 0 },
};

// Default arm-down pose values (from createPlayerPose)
const DEFAULT_LEFT: IKResult = {
  shoulderRot: { x: 0.15, y: 0.05, z: 0.18 },
  forearmRot: { x: -0.22, y: 0, z: 0.06 },
};
const DEFAULT_RIGHT: IKResult = {
  shoulderRot: { x: 0.15, y: -0.05, z: -0.18 },
  forearmRot: { x: -0.22, y: 0, z: -0.06 },
};

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

const EPSILON = 1e-6;
const { sqrt, atan2, acos, min, max, PI } = Math;

function clampF(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lengthSq(v: Vec3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

function length(v: Vec3): number {
  return sqrt(lengthSq(v));
}

function normalize(out: Vec3, v: Vec3): number {
  const len = length(v);
  if (len < EPSILON) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return 0;
  }
  const inv = 1 / len;
  out.x = v.x * inv;
  out.y = v.y * inv;
  out.z = v.z * inv;
  return len;
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(out: Vec3, a: Vec3, b: Vec3): void {
  out.x = a.y * b.z - a.z * b.y;
  out.y = a.z * b.x - a.x * b.z;
  out.z = a.x * b.y - a.y * b.x;
}

function sub(out: Vec3, a: Vec3, b: Vec3): void {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
}

/**
 * Safe acos that clamps the input to [-1, 1] to guard against floating-point
 * overshoot producing NaN.
 */
function safeAcos(v: number): number {
  return acos(clampF(v, -1, 1));
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * Solve two-bone IK for an arm chain and return Euler XYZ rotations for the
 * shoulder and forearm (elbow) joints.
 *
 * @param shoulderPos   World-space shoulder pivot
 * @param targetWristPos World-space desired wrist position
 * @param poleTarget    World-space elbow hint (e.g. from MediaPipe elbow landmark)
 * @param upperArmLen   Length of the upper arm segment
 * @param forearmLen    Length of the forearm segment
 * @param isLeftArm     Mirror sign for left/right arm
 * @returns IKResult with Euler angles — returns a reused object, copy if you need to persist
 */
export function solveTwoBoneIK(
  shoulderPos: Vec3,
  targetWristPos: Vec3,
  poleTarget: Vec3,
  upperArmLen: number,
  forearmLen: number,
  isLeftArm: boolean,
): IKResult {
  const defaults = isLeftArm ? DEFAULT_LEFT : DEFAULT_RIGHT;
  const sign = isLeftArm ? 1 : -1;

  // Direction from shoulder to target
  sub(_dir, targetWristPos, shoulderPos);
  let dist = length(_dir);

  // --- Edge case: target at shoulder (near-zero distance) ---
  if (dist < EPSILON) {
    copyResult(_result, defaults);
    return _result;
  }

  const totalReach = upperArmLen + forearmLen;

  // --- Edge case: unreachable — clamp to max reach ---
  if (dist > totalReach - EPSILON) {
    dist = totalReach - EPSILON;
  }

  // Normalised aim direction
  const invDist = 1 / dist;
  _fwd.x = _dir.x * invDist;
  _fwd.y = _dir.y * invDist;
  _fwd.z = _dir.z * invDist;

  // --- Law of cosines: elbow angle ---
  const a = upperArmLen;
  const b = forearmLen;
  const c = dist;
  const cosElbow = (a * a + b * b - c * c) / (2 * a * b);
  const elbowAngle = PI - safeAcos(cosElbow);

  // Angle at shoulder (between upper arm and shoulder-to-target line)
  const cosShoulder = (a * a + c * c - b * b) / (2 * a * c);
  const shoulderOffset = safeAcos(cosShoulder);

  // --- Build a frame from the aim direction + pole target ---
  // Pole vector: project the pole target direction onto the plane perpendicular to _fwd
  sub(_poleLocal, poleTarget, shoulderPos);
  const poleDotFwd = dot(_poleLocal, _fwd);
  _poleLocal.x -= poleDotFwd * _fwd.x;
  _poleLocal.y -= poleDotFwd * _fwd.y;
  _poleLocal.z -= poleDotFwd * _fwd.z;

  const poleLen = normalize(_up, _poleLocal);
  if (poleLen < EPSILON) {
    // Fallback pole: use world +X (outward from body) for the respective arm side
    _up.x = sign;
    _up.y = 0;
    _up.z = 0;
    // Re-orthogonalise
    const d = dot(_up, _fwd);
    _up.x -= d * _fwd.x;
    _up.y -= d * _fwd.y;
    _up.z -= d * _fwd.z;
    normalize(_up, _up);
  }

  cross(_right, _fwd, _up);
  normalize(_right, _right);
  // Ensure _up is truly orthogonal (re-cross)
  cross(_up, _right, _fwd);

  // --- Shoulder Euler angles ---
  // The rig's default arm direction is -Y (hanging down). We need to rotate
  // from -Y to the direction that places the upper arm correctly.
  //
  // The actual upper arm direction lies in the plane spanned by _fwd and _up,
  // tilted by shoulderOffset from _fwd toward _up.
  const cosS = Math.cos(shoulderOffset);
  const sinS = Math.sin(shoulderOffset);
  const armDirX = _fwd.x * cosS + _up.x * sinS;
  const armDirY = _fwd.y * cosS + _up.y * sinS;
  const armDirZ = _fwd.z * cosS + _up.z * sinS;

  // Convert arm direction to Euler XYZ that rotates the default -Y axis to armDir.
  // Default bone axis is (0, -1, 0). We need rotation R such that R * (0,-1,0) = armDir.
  //
  // Pitch (X rotation) controls forward/back tilt in the sagittal plane.
  // Yaw (Y rotation) controls internal/external rotation.
  // Roll (Z rotation) controls abduction/adduction.
  //
  // For XYZ Euler applied to a -Y bone:
  //   After full rotation the bone points along:
  //     x' = -sin(z)*cos(y) - cos(z)*sin(x)*sin(y)  ... etc (complex)
  //
  // We use a pragmatic decomposition:
  //   pitch = rotation around X bringing -Y toward -Z (forward lean)
  //   roll  = rotation around Z bringing -Y toward +/-X (abduction)
  //   Then fine-tune yaw for the pole twist.

  // Shoulder pitch: angle in the YZ plane (sagittal)
  const shoulderPitch = -atan2(-armDirZ, -armDirY);

  // Shoulder roll: angle in the XY plane (frontal).
  // The geometry already encodes side (left target is +X, right is -X from body center),
  // so no manual sign flip is needed.
  const shoulderRoll = atan2(armDirX, -armDirY);

  // Shoulder yaw: twist around the bone axis, driven by pole target.
  // The pole target's projection onto the _right axis determines twist.
  const poleInRight = dot(_poleLocal, _right);
  const poleInUp = dot(_poleLocal, _up);
  const shoulderYaw = atan2(poleInRight, poleInUp + EPSILON) * 0.3 * sign;

  _result.shoulderRot.x = guardNaN(shoulderPitch);
  _result.shoulderRot.y = guardNaN(shoulderYaw);
  _result.shoulderRot.z = guardNaN(shoulderRoll);

  // --- Forearm (elbow) Euler angles ---
  // The elbow is a hinge: flex is around the local X axis.
  // Negative X rotates the forearm toward the upper arm (flexion).
  _result.forearmRot.x = guardNaN(-elbowAngle);
  _result.forearmRot.y = 0;
  _result.forearmRot.z = guardNaN(sign * 0.02);

  return _result;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function copyResult(dst: IKResult, src: IKResult): void {
  dst.shoulderRot.x = src.shoulderRot.x;
  dst.shoulderRot.y = src.shoulderRot.y;
  dst.shoulderRot.z = src.shoulderRot.z;
  dst.forearmRot.x = src.forearmRot.x;
  dst.forearmRot.y = src.forearmRot.y;
  dst.forearmRot.z = src.forearmRot.z;
}

function guardNaN(v: number): number {
  return v !== v ? 0 : v;
}

/**
 * Copy an IKResult into a fresh object (the solver reuses its return value).
 */
export function cloneIKResult(r: IKResult): IKResult {
  return {
    shoulderRot: { x: r.shoulderRot.x, y: r.shoulderRot.y, z: r.shoulderRot.z },
    forearmRot: { x: r.forearmRot.x, y: r.forearmRot.y, z: r.forearmRot.z },
  };
}
