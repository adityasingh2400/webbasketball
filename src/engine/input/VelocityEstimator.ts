const DEFAULT_WINDOW_SIZE = 5;

interface Sample {
  x: number;
  y: number;
  t: number;
}

/**
 * Sliding-window velocity estimator. Averages position change over
 * the last N samples to reduce single-frame jitter while keeping
 * latency under ~150ms at 30fps.
 */
export class VelocityEstimator {
  private buffer: Sample[] = [];
  private readonly windowSize: number;

  constructor(windowSize = DEFAULT_WINDOW_SIZE) {
    this.windowSize = windowSize;
  }

  push(x: number, y: number, timestampMs: number): void {
    this.buffer.push({ x, y, t: timestampMs });
    if (this.buffer.length > this.windowSize) this.buffer.shift();
  }

  get(): { x: number; y: number } {
    if (this.buffer.length < 2) return { x: 0, y: 0 };
    const first = this.buffer[0];
    const last = this.buffer[this.buffer.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt < 0.001) return { x: 0, y: 0 };
    return {
      x: (last.x - first.x) / dt,
      y: (last.y - first.y) / dt,
    };
  }

  reset(): void {
    this.buffer.length = 0;
  }
}
