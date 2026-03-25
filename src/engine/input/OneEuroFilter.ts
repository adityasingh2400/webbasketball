/**
 * One Euro Filter — low-pass filter with adaptive cutoff.
 * Reduces jitter while preserving fast intentional movements.
 * See: https://cristal.univ-lille.fr/~casiez/1euro/
 */

function smoothingFactor(te: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * te;
  return r / (r + 1);
}

function exponentialSmoothing(a: number, x: number, xPrev: number): number {
  return a * x + (1 - a) * xPrev;
}

interface FilterState {
  xPrev: number;
  dxPrev: number;
  tPrev: number;
  initialized: boolean;
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private state: FilterState;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.state = { xPrev: 0, dxPrev: 0, tPrev: 0, initialized: false };
  }

  filter(x: number, t: number): number {
    if (!this.state.initialized) {
      this.state.xPrev = x;
      this.state.dxPrev = 0;
      this.state.tPrev = t;
      this.state.initialized = true;
      return x;
    }

    const te = t - this.state.tPrev;
    if (te <= 0) return this.state.xPrev;

    const aD = smoothingFactor(te, this.dCutoff);
    const dx = (x - this.state.xPrev) / te;
    const dxHat = exponentialSmoothing(aD, dx, this.state.dxPrev);

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = smoothingFactor(te, cutoff);
    const xHat = exponentialSmoothing(a, x, this.state.xPrev);

    this.state.xPrev = xHat;
    this.state.dxPrev = dxHat;
    this.state.tPrev = t;

    return xHat;
  }

  reset(): void {
    this.state.initialized = false;
  }
}

export class LandmarkFilter {
  private filters: OneEuroFilter[];

  constructor(numLandmarks = 21, minCutoff = 1.0, beta = 0.007) {
    this.filters = [];
    for (let i = 0; i < numLandmarks * 3; i++) {
      this.filters.push(new OneEuroFilter(minCutoff, beta));
    }
  }

  filterLandmarks(
    landmarks: Array<{ x: number; y: number; z: number }>,
    timestamp: number,
  ): Array<{ x: number; y: number; z: number }> {
    const t = timestamp / 1000;
    return landmarks.map((lm, i) => ({
      x: this.filters[i * 3].filter(lm.x, t),
      y: this.filters[i * 3 + 1].filter(lm.y, t),
      z: this.filters[i * 3 + 2].filter(lm.z, t),
    }));
  }

  reset(): void {
    for (const f of this.filters) f.reset();
  }
}
