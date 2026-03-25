export class GameLoop {
  private accumulator = 0;
  private lastFrameTime = 0;
  private isRunning = false;
  private isPaused = false;
  private frameCount = 0;
  private droppedFrames = 0;
  private rafId: number | null = null;

  private frameTimes: number[] = [];
  private frameTimeIndex = 0;
  private readonly frameTimeSamples = 60;

  private readonly onUpdate: (deltaTime: number) => void;
  private readonly onRender: (alpha: number) => void;

  readonly fixedTimeStep = 1 / 60;
  readonly maxAccumulator = 0.25;
  readonly maxSubSteps = 5;

  constructor(
    onUpdate: (deltaTime: number) => void,
    onRender: (alpha: number) => void,
  ) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.frameTimes = new Array<number>(this.frameTimeSamples).fill(0);
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.accumulator = 0;
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.lastFrameTime = performance.now();
    this.frameTimes.fill(0);
    this.frameTimeIndex = 0;

    this.rafId = requestAnimationFrame(this.loop);
  }

  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.accumulator = 0;
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.isPaused = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (currentTime: number = performance.now()): void => {
    if (!this.isRunning) return;

    if (this.isPaused) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const deltaMs = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    this.frameTimes[this.frameTimeIndex] = deltaMs;
    this.frameTimeIndex = (this.frameTimeIndex + 1) % this.frameTimeSamples;

    // Convert to seconds, clamp to prevent spiral of death
    const deltaSeconds = Math.min(deltaMs / 1000, this.maxAccumulator);
    this.accumulator += deltaSeconds;

    let steps = 0;
    while (this.accumulator >= this.fixedTimeStep && steps < this.maxSubSteps) {
      this.onUpdate(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      steps++;
    }

    if (this.accumulator >= this.fixedTimeStep) {
      this.droppedFrames++;
      this.accumulator = 0;
    }

    // Interpolation alpha: fraction of a timestep remaining in the accumulator
    const alpha = this.accumulator / this.fixedTimeStep;
    this.onRender(alpha);

    this.frameCount++;
    this.rafId = requestAnimationFrame(this.loop);
  };

  getStats(): { fps: number; frameTime: number; droppedFrames: number } {
    const validSamples = Math.min(this.frameCount, this.frameTimeSamples);
    if (validSamples === 0) {
      return { fps: 0, frameTime: 0, droppedFrames: this.droppedFrames };
    }

    let sum = 0;
    for (let i = 0; i < validSamples; i++) {
      sum += this.frameTimes[i];
    }
    const avgFrameTime = sum / validSamples;

    return {
      fps: avgFrameTime > 0 ? 1000 / avgFrameTime : 0,
      frameTime: avgFrameTime,
      droppedFrames: this.droppedFrames,
    };
  }
}
