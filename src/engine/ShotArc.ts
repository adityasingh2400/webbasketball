const GRAVITY = 9.8;
const HOOP_POSITION = { x: 0, y: 3.05, z: -13 };
const RIM_RADIUS = 0.23;

export interface ShotArcState {
  position: [number, number, number];
  velocity: [number, number, number];
  rotation: number;
  time: number;
  landed: boolean;
  madeBasket: boolean;
}

export function calculateShotVelocity(
  start: [number, number, number],
  power: number,
): [number, number, number] {
  const dx = HOOP_POSITION.x - start[0];
  const dy = HOOP_POSITION.y - start[1] + 1.5;
  const dz = HOOP_POSITION.z - start[2];
  const dist = Math.sqrt(dx * dx + dz * dz);

  const speed = 5 + power * 8;
  const launchAngle = Math.atan2(dy + dist * 0.3, dist);

  const cosAngle = Math.cos(launchAngle);
  const sinAngle = Math.sin(launchAngle);

  const horizontalSpeed = speed * cosAngle;
  const dirAngle = Math.atan2(dz, dx);

  return [
    horizontalSpeed * Math.cos(dirAngle),
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
    };
  }

  launch(start: [number, number, number], power: number): void {
    const velocity = calculateShotVelocity(start, power);
    this.state = {
      position: [...start],
      velocity,
      rotation: 0,
      time: 0,
      landed: false,
      madeBasket: false,
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

    const dx = this.state.position[0] - HOOP_POSITION.x;
    const dy = this.state.position[1] - HOOP_POSITION.y;
    const dz = this.state.position[2] - HOOP_POSITION.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    if (horizontalDist < RIM_RADIUS && Math.abs(dy) < 0.15 && this.state.velocity[1] < 0) {
      this.state.madeBasket = true;
      this.state.landed = true;
      this.active = false;
    }

    if (this.state.position[1] < 0) {
      this.state.position[1] = 0;
      this.state.landed = true;
      this.active = false;
    }

    if (this.state.time > 5) {
      this.state.landed = true;
      this.active = false;
    }

    return this.state;
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
