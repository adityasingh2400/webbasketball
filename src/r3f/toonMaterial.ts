import * as THREE from 'three';
import {
  skinGradient,
  fabricBlueGradient,
  fabricDarkGradient,
  hairGradient,
  shoeGradient,
  courtGradient,
  metalGradient,
  ballGradient,
  grassGradient,
  genericGradient,
} from './toonGradients';

export interface ToonRimConfig {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  gradientMap: THREE.Texture;
  rimColor?: THREE.Color;
  rimPower?: number;
  rimLift?: number;
  rimIntensity?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  flatShading?: boolean;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
}

const RIM_UNIFORMS_FRAGMENT = /* glsl */ `
uniform vec3 u_rimColor;
uniform float u_rimPower;
uniform float u_rimLift;
uniform float u_rimIntensity;
`;

const RIM_LIGHT_GLSL = /* glsl */ `
{
  vec3 _viewDir = normalize(vViewPosition);
  vec3 _norm = normalize(vNormal);
  float _rim = pow(
    clamp(1.0 - dot(_viewDir, _norm) + u_rimLift, 0.0, 1.0),
    u_rimPower
  ) * u_rimIntensity;
  outgoingLight += u_rimColor * _rim;
}
`;

export function createToonRimMaterial(config: ToonRimConfig): THREE.MeshToonMaterial {
  const rimColor = config.rimColor ?? new THREE.Color(1.0, 0.95, 0.88);
  const rimPower = config.rimPower ?? 3.0;
  const rimLift = config.rimLift ?? 0.0;
  const rimIntensity = config.rimIntensity ?? 0.4;

  const opts: Record<string, unknown> = {
    color: config.color ?? '#ffffff',
    map: config.map ?? null,
    gradientMap: config.gradientMap,
  };
  if (config.side != null) opts.side = config.side;
  if (config.transparent != null) opts.transparent = config.transparent;
  if (config.opacity != null) opts.opacity = config.opacity;
  if (config.flatShading != null) opts.flatShading = config.flatShading;
  if (config.emissive != null) opts.emissive = config.emissive;
  if (config.emissiveIntensity != null) opts.emissiveIntensity = config.emissiveIntensity;

  const material = new THREE.MeshToonMaterial(opts as ConstructorParameters<typeof THREE.MeshToonMaterial>[0]);

  if (rimIntensity > 0) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.u_rimColor = { value: rimColor };
      shader.uniforms.u_rimPower = { value: rimPower };
      shader.uniforms.u_rimLift = { value: rimLift };
      shader.uniforms.u_rimIntensity = { value: rimIntensity };

      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        RIM_UNIFORMS_FRAGMENT + '\nvoid main() {',
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        RIM_LIGHT_GLSL + '\n#include <output_fragment>',
      );
    };
    material.customProgramCacheKey = () =>
      `toon-rim-${rimPower}-${rimIntensity}-${rimLift}`;
  }

  return material;
}

export const SKIN_TOON = () => createToonRimMaterial({
  color: '#f5bf94',
  gradientMap: skinGradient(),
  rimPower: 3.0,
  rimIntensity: 0.3,
  rimLift: 0.0,
});

export const HAND_TOON = () => createToonRimMaterial({
  color: '#eda06a',
  gradientMap: skinGradient(),
  rimPower: 3.0,
  rimIntensity: 0.25,
});

export const JERSEY_TOON = (map?: THREE.Texture) => createToonRimMaterial({
  map,
  gradientMap: fabricBlueGradient(),
  rimPower: 2.5,
  rimIntensity: 0.4,
});

export const PANTS_TOON = (map?: THREE.Texture) => createToonRimMaterial({
  map,
  gradientMap: fabricDarkGradient(),
  rimPower: 3.5,
  rimIntensity: 0.2,
});

export const HAIR_TOON = (map?: THREE.Texture) => createToonRimMaterial({
  color: '#2e1e12',
  map,
  gradientMap: hairGradient(),
  rimIntensity: 0,
});

export const SHOE_TOON = (map?: THREE.Texture) => createToonRimMaterial({
  map,
  gradientMap: shoeGradient(),
  rimPower: 2.0,
  rimIntensity: 0.6,
});

export const SOCK_TOON = () => createToonRimMaterial({
  color: '#f0f0f0',
  gradientMap: genericGradient(),
  rimPower: 3.0,
  rimIntensity: 0.15,
});

export const SHOE_SOLE_TOON = () => createToonRimMaterial({
  color: '#111827',
  gradientMap: fabricDarkGradient(),
  rimIntensity: 0.05,
});

export const SHOE_MIDSOLE_TOON = () => createToonRimMaterial({
  color: '#f0f0f0',
  gradientMap: genericGradient(),
  rimIntensity: 0.1,
});

export const TRIM_TOON = () => createToonRimMaterial({
  color: '#f8fafc',
  gradientMap: genericGradient(),
  rimPower: 3.0,
  rimIntensity: 0.2,
});

export const COURT_TOON = (map?: THREE.Texture) => createToonRimMaterial({
  map,
  gradientMap: courtGradient(),
  rimPower: 4.0,
  rimIntensity: 0.1,
});

export const METAL_TOON = (color?: THREE.ColorRepresentation) => createToonRimMaterial({
  color: color ?? '#707070',
  gradientMap: metalGradient(),
  rimColor: new THREE.Color(0.9, 0.92, 1.0),
  rimPower: 2.0,
  rimIntensity: 0.6,
});

export const RIM_RED_TOON = () => createToonRimMaterial({
  color: '#ff3300',
  gradientMap: metalGradient(),
  rimColor: new THREE.Color(1.0, 0.6, 0.4),
  rimPower: 2.0,
  rimIntensity: 0.5,
});

export const BALL_TOON = (map?: THREE.Texture) => createToonRimMaterial({
  color: '#f2d8c8',
  map,
  gradientMap: ballGradient(),
  rimPower: 2.5,
  rimIntensity: 0.4,
});

export const GRASS_TOON = (map?: THREE.Texture) => createToonRimMaterial({
  map,
  gradientMap: grassGradient(),
  rimPower: 4.0,
  rimIntensity: 0.08,
});

export const ENV_TOON = (color: THREE.ColorRepresentation, opts?: Partial<ToonRimConfig>) => createToonRimMaterial({
  color,
  map: opts?.map,
  gradientMap: opts?.gradientMap ?? genericGradient(),
  rimPower: opts?.rimPower ?? 3.5,
  rimIntensity: opts?.rimIntensity ?? 0.15,
  flatShading: opts?.flatShading,
  side: opts?.side,
  transparent: opts?.transparent,
  opacity: opts?.opacity,
  emissive: opts?.emissive,
  emissiveIntensity: opts?.emissiveIntensity,
});
