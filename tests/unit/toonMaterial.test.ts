import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class MockCanvasTexture {
    minFilter = actual.NearestFilter;
    magFilter = actual.NearestFilter;
    colorSpace = actual.SRGBColorSpace;
    image: HTMLCanvasElement;
    dispose = vi.fn();
    constructor(canvas: HTMLCanvasElement) {
      this.image = canvas;
    }
  }

  class MockMeshToonMaterial {
    color: THREE.Color;
    map: THREE.Texture | null = null;
    gradientMap: THREE.Texture | null = null;
    side = actual.FrontSide;
    transparent = false;
    opacity = 1;
    flatShading = false;
    emissive: THREE.Color | undefined;
    emissiveIntensity: number | undefined;
    onBeforeCompile: ((shader: unknown) => void) | null = null;
    dispose = vi.fn();
    customProgramCacheKey: (() => string) | null = null;
    constructor(opts: Record<string, unknown> = {}) {
      this.color = new actual.Color(opts.color as string ?? '#ffffff');
      this.map = opts.map as THREE.Texture ?? null;
      this.gradientMap = opts.gradientMap as THREE.Texture ?? null;
      this.side = opts.side as THREE.Side ?? actual.FrontSide;
      this.transparent = opts.transparent as boolean ?? false;
      this.opacity = opts.opacity as number ?? 1;
      this.flatShading = opts.flatShading as boolean ?? false;
      this.emissive = opts.emissive ? new actual.Color(opts.emissive as string) : undefined;
      this.emissiveIntensity = opts.emissiveIntensity as number;
    }
  }

  return {
    ...actual,
    CanvasTexture: MockCanvasTexture,
    MeshToonMaterial: MockMeshToonMaterial,
  };
});

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillStyle: '',
    fillRect: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('toonMaterial', () => {
  it('createToonRimMaterial returns a MeshToonMaterial', async () => {
    const { createToonRimMaterial } = await import('../../src/r3f/toonMaterial');
    const { skinGradient, disposeAllGradients } = await import('../../src/r3f/toonGradients');
    const mat = createToonRimMaterial({ gradientMap: skinGradient() });
    expect(mat).toBeDefined();
    expect(mat.gradientMap).toBe(skinGradient());
    mat.dispose();
    disposeAllGradients();
  });

  it('onBeforeCompile injects rim uniforms into shader', async () => {
    const { createToonRimMaterial } = await import('../../src/r3f/toonMaterial');
    const { genericGradient, disposeAllGradients } = await import('../../src/r3f/toonGradients');
    const mat = createToonRimMaterial({
      gradientMap: genericGradient(),
      rimIntensity: 0.5,
      rimPower: 3.0,
    });

    expect(mat.onBeforeCompile).toBeTypeOf('function');

    const mockShader = {
      uniforms: {} as Record<string, { value: unknown }>,
      fragmentShader: `
        void main() {
          vec3 outgoingLight = vec3(1.0);
          #include <output_fragment>
        }
      `,
    };

    mat.onBeforeCompile!(mockShader as unknown as THREE.WebGLProgramParametersWithUniforms);

    expect(mockShader.uniforms.u_rimColor).toBeDefined();
    expect(mockShader.uniforms.u_rimPower).toBeDefined();
    expect((mockShader.uniforms.u_rimPower.value as number)).toBe(3.0);
    expect(mockShader.uniforms.u_rimIntensity).toBeDefined();
    expect((mockShader.uniforms.u_rimIntensity.value as number)).toBe(0.5);
    expect(mockShader.fragmentShader).toContain('u_rimColor');
    expect(mockShader.fragmentShader).toContain('dot(_viewDir, _norm)');

    mat.dispose();
    disposeAllGradients();
  });

  it('preset factories produce valid materials', async () => {
    const { SKIN_TOON, JERSEY_TOON, PANTS_TOON, HAIR_TOON, SHOE_TOON, METAL_TOON, BALL_TOON } =
      await import('../../src/r3f/toonMaterial');
    const { disposeAllGradients } = await import('../../src/r3f/toonGradients');

    const materials = [
      SKIN_TOON(),
      JERSEY_TOON(),
      PANTS_TOON(),
      HAIR_TOON(),
      SHOE_TOON(),
      METAL_TOON(),
      BALL_TOON(),
    ];

    for (const mat of materials) {
      expect(mat).toBeDefined();
      expect(mat.gradientMap).toBeDefined();
    }

    materials.forEach(m => m.dispose());
    disposeAllGradients();
  });

  it('rimIntensity 0 skips onBeforeCompile', async () => {
    const { createToonRimMaterial } = await import('../../src/r3f/toonMaterial');
    const { genericGradient, disposeAllGradients } = await import('../../src/r3f/toonGradients');
    const mat = createToonRimMaterial({
      gradientMap: genericGradient(),
      rimIntensity: 0,
    });
    expect(mat.onBeforeCompile).toBeNull();
    mat.dispose();
    disposeAllGradients();
  });
});
