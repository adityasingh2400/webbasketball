import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    CanvasTexture: class MockCanvasTexture {
      minFilter = actual.LinearMipmapLinearFilter;
      magFilter = actual.LinearFilter;
      colorSpace = '';
      image: HTMLCanvasElement;
      dispose = vi.fn();
      constructor(canvas: HTMLCanvasElement) {
        this.image = canvas;
      }
    },
  };
});

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillStyle: '',
    fillRect: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('toonGradients', () => {
  it('skinGradient returns a texture with NearestFilter', async () => {
    const { skinGradient, disposeAllGradients } = await import('../../src/r3f/toonGradients');
    const tex = skinGradient();
    expect(tex).toBeDefined();
    expect(tex.minFilter).toBe(THREE.NearestFilter);
    expect(tex.magFilter).toBe(THREE.NearestFilter);
    disposeAllGradients();
  });

  it('gradient textures are cached singletons', async () => {
    const { fabricBlueGradient, disposeAllGradients } = await import('../../src/r3f/toonGradients');
    const a = fabricBlueGradient();
    const b = fabricBlueGradient();
    expect(a).toBe(b);
    disposeAllGradients();
  });

  it('disposeAllGradients clears the cache', async () => {
    const { metalGradient, disposeAllGradients } = await import('../../src/r3f/toonGradients');
    const before = metalGradient();
    disposeAllGradients();
    const after = metalGradient();
    expect(before).not.toBe(after);
    disposeAllGradients();
  });

  it('canvas dimensions match tone count', async () => {
    const { hairGradient, metalGradient, disposeAllGradients } = await import('../../src/r3f/toonGradients');
    const hair = hairGradient();
    expect(hair.image.width).toBe(4);
    const metal = metalGradient();
    expect(metal.image.width).toBe(2);
    disposeAllGradients();
  });
});
