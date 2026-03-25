const GRAVITY = 9.8;
const HOOP_POSITION = { x: 0, y: 3.05, z: -13 };
const RIM_RADIUS = 0.23;
const RIM_TUBE = 0.015;
const BALL_RADIUS = 0.12;
const BACKBOARD_Z = -13.05;
const BACKBOARD_WIDTH = 1.83;
const BACKBOARD_Y_MIN = 2.5;
const BACKBOARD_Y_MAX = 3.6;
const RIM_RESTITUTION = 0.55;
const BACKBOARD_RESTITUTION = 0.45;
const FLOOR_RESTITUTION = 0.6;

export interface ShotArcState {
  position: [number, number, number];
  velocity: [number, number, number];
  rotation: number;
  time: number;
  landed: boolean;
  madeBasket: boolean;
  hitRim: boolean;
  hitBackboard: boolean;
}

export function calculateShotVelocity(
  start: [number, number, number],
  power: number,
  accuracyBonus: number = 0,
): [number, number, number] {
  const dx = HOOP_POSITION.x - start[0];
  const dy = HOOP_POSITION.y - start[1] + 1.5;
  const dz = HOOP_POSITION.z - start[2];
  const dist = Math.sqrt(dx * dx + dz * dz);

  const speed = 5 + power * 8;

  const aimOffset = (1 - (accuracyBonus + 1) / 2) * 0.15;
  const launchAngle = Math.atan2(dy + dist * 0.3 + aimOffset, dist);

  const cosAngle = Math.cos(launchAngle);
  const sinAngle = Math.sin(launchAngle);

  const horizontalSpeed = speed * cosAngle;
  const dirAngle = Math.atan2(dz, dx);

  const lateralJitter = (1 - Math.max(0, accuracyBonus)) * (Math.random() - 0.5) * 0.6;

  return [
    horizontalSpeed * Math.cos(dirAngle) + lateralJitter,
    speed * sinAngle,
    horizontalSpeed * Math.sin(dirAngle),
  ];
}

export class ShotArc {
  private state: ShotArcState;
  private active = false;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): ShotArcState {
    return {
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      rotation: 0,
      time: 0,
      landed: false,
      madeBasket: false,
      hitRim: false,
      hitBackboard: false,
    };
  }

  launch(start: [number, number, number], power: number, accuracyBonus: number = 0): void {
    const velocity = calculateShotVelocity(start, power, accuracyBonus);
    this.state = {
      position: [...start],
      velocity,
      rotation: 0,
      time: 0,
      landed: false,
      madeBasket: false,
      hitRim: false,
      hitBackboard: false,
    };
    this.active = true;
  }

  update(deltaTime: number): ShotArcState {
    if (!this.active || this.state.landed) {
      return this.state;
    }

    this.state.time += deltaTime;
    this.state.velocity[1] -= GRAVITY * deltaTime;

    this.state.position[0] += this.state.velocity[0] * deltaTime;
    this.state.position[1] += this.state.velocity[1] * deltaTime;
    this.state.position[2] += this.state.velocity[2] * deltaTime;
    this.state.rotation += 8 * deltaTime;

    this.checkBackboardCollision();
    this.checkRimCollision();
    this.checkBasketMade();
    this.checkFloorBounce(deltaTime);

    if (this.state.time > 6) {
      this.state.landed = true;
      this.active = false;
    }

    return this.state;
  }

  private checkBackboardCollision(): void {
    const [bx, by, bz] = this.state.position;
    if (
      bz <= BACKBOARD_Z + BALL_RADIUS &&
      bz >= BACKBOARD_Z - 0.1 &&
      Math.abs(bx - HOOP_POSITION.x) < BACKBOARD_WIDTH / 2 &&
      by >= BACKBOARD_Y_MIN &&
      by <= BACKBOARD_Y_MAX &&
      this.state.velocity[2] < 0
    ) {
      this.state.velocity[2] *= -BACKBOARD_RESTITUTION;
      this.state.position[2] = BACKBOARD_Z + BALL_RADIUS + 0.01;
      this.state.hitBackboard = true;
    }
  }

  private checkRimCollision(): void {
    const dx = this.state.position[0] - HOOP_POSITION.x;
    const dz = this.state.position[2] - (HOOP_POSITION.z + 0.25);
    const dy = this.state.position[1] - HOOP_POSITION.y;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    const rimEdgeInner = RIM_RADIUS - RIM_TUBE - BALL_RADIUS;
    const rimEdgeOuter = RIM_RADIUS + RIM_TUBE + BALL_RADIUS;

    if (
      horizontalDist > rimEdgeInner &&
      horizontalDist < rimEdgeOuter &&
      Math.abs(dy) < BALL_RADIUS + RIM_TUBE &&
      this.state.velocity[1] < 0
    ) {
      const nx = dx / horizontalDist;
      const nz = dz / horizontalDist;
      const dotProduct = this.state.velocity[0] * nx + this.state.velocity[2] * nz;

      if (horizontalDist > RIM_RADIUS) {
        this.state.velocity[0] -= 2 * dotProduct * nx * RIM_RESTITUTION;
        this.state.velocity[2] -= 2 * dotProduct * nz * RIM_RESTITUTION;
        this.state.velocity[1] *= -RIM_RESTITUTION;
      } else {
        this.state.velocity[0] += 2 * dotProduct * nx * RIM_RESTITUTION * 0.3;
        this.state.velocity[2] += 2 * dotProduct * nz * RIM_RESTITUTION * 0.3;
        this.state.velocity[1] *= -RIM_RESTITUTION * 0.5;
      }

      this.state.hitRim = true;
    }
  }

  private checkBasketMade(): void {
    const dx = this.state.position[0] - HOOP_POSITION.x;
    const dy = this.state.position[1] - HOOP_POSITION.y;
    const dz = this.state.position[2] - (HOOP_POSITION.z + 0.25);
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    if (
      horizontalDist < RIM_RADIUS - BALL_RADIUS &&
      Math.abs(dy) < 0.2 &&
      this.state.velocity[1] < 0
    ) {
      this.state.madeBasket = true;
      this.state.landed = true;
      this.active = false;
    }
  }

  private checkFloorBounce(deltaTime: number): void {
    if (this.state.position[1] < BALL_RADIUS) {
      this.state.position[1] = BALL_RADIUS;
      this.state.velocity[1] *= -FLOOR_RESTITUTION;
      const friction = Math.exp(-4 * deltaTime);
      this.state.velocity[0] *= friction;
      this.state.velocity[2] *= friction;

      if (Math.abs(this.state.velocity[1]) < 0.3) {
        this.state.landed = true;
        this.active = false;
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getPosition(): [number, number, number] {
    return [...this.state.position] as [number, number, number];
  }

  reset(): void {
    this.state = this.createInitialState();
    this.active = false;
  }
}
