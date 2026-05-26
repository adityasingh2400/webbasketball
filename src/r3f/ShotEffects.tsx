import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';

const TRAIL_MAX = 140;
const EXPLOSION_MAX = 100;
const EXPLOSION_DURATION = 1.8;
const HOOP_POSITION = new THREE.Vector3(0, 3.05, -12.75);

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  maxLife: number;
}

function makeTrailColor(t: number): THREE.Color {
  if (t < 0.5) {
    return new THREE.Color().setRGB(0.4, 1.0, 0.6).lerp(new THREE.Color().setRGB(1.0, 1.0, 0.5), t * 2);
  }
  return new THREE.Color().setRGB(1.0, 1.0, 0.5).lerp(new THREE.Color().setRGB(1.0, 0.6, 0.2), (t - 0.5) * 2);
}

function makeExplosionColor(): THREE.Color {
  const r = Math.random();
  if (r < 0.3) return new THREE.Color(0.3, 1.0, 0.5);
  if (r < 0.55) return new THREE.Color(0.5, 1.0, 0.8);
  if (r < 0.75) return new THREE.Color(1.0, 0.95, 0.4);
  return new THREE.Color(1.0, 1.0, 0.95);
}

function createParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function ShotEffects({ runtime }: { runtime: GameRuntime }) {
  const trailParticles = useRef<Particle[]>([]);
  const explosionParticles = useRef<Particle[]>([]);
  const explosionColors = useRef<THREE.Color[]>([]);

  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  const particleTexture = useMemo(() => createParticleTexture(), []);

  const trailMat = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.35,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
  }, [particleTexture]);

  const explosionGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(EXPLOSION_MAX * 3), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(EXPLOSION_MAX * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  const explosionMat = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.5,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
  }, [particleTexture]);

  const trailRef = useRef<THREE.Points>(null);
  const explosionRef = useRef<THREE.Points>(null);

  const wasInFlight = useRef(false);
  const isGreenShot = useRef(false);
  const spawnTimer = useRef(0);
  const lastBallPos = useRef(new THREE.Vector3(0, -100, 0));

  const explosionActive = useRef(false);
  const explosionTime = useRef(0);
  const lastSwishVersion = useRef(0);

  useFrame((_, delta) => {
    const snap = runtime.getRenderState();
    const dt = Math.min(delta, 0.05);
    const ballPos = new THREE.Vector3(snap.ballPosition[0], snap.ballPosition[1], snap.ballPosition[2]);

    if (snap.shotReleaseQuality === 'perfect' && snap.ballInFlight) {
      isGreenShot.current = true;
    }
    if (!snap.ballInFlight && wasInFlight.current) {
      isGreenShot.current = false;
    }
    wasInFlight.current = snap.ballInFlight;

    // --- TRAIL ---
    if (snap.ballInFlight && isGreenShot.current) {
      spawnTimer.current += dt;
      const interval = 0.008;
      while (spawnTimer.current >= interval && trailParticles.current.length < TRAIL_MAX) {
        spawnTimer.current -= interval;
        const spread = 0.12;
        trailParticles.current.push({
          x: ballPos.x + (Math.random() - 0.5) * spread,
          y: ballPos.y + (Math.random() - 0.5) * spread,
          z: ballPos.z + (Math.random() - 0.5) * spread,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8 + 0.2,
          vz: (Math.random() - 0.5) * 0.8,
          life: 0,
          maxLife: 0.3 + Math.random() * 0.5,
        });
      }
      if (spawnTimer.current >= interval) spawnTimer.current = 0;
    } else {
      spawnTimer.current = 0;
    }

    lastBallPos.current.copy(ballPos);

    for (let i = trailParticles.current.length - 1; i >= 0; i--) {
      const p = trailParticles.current[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 1.2 * dt;
      p.vx *= 0.97;
      p.vz *= 0.97;
      if (p.life >= p.maxLife) {
        trailParticles.current.splice(i, 1);
      }
    }

    {
      const count = trailParticles.current.length;
      const posArr = trailGeom.getAttribute('position').array as Float32Array;
      const colArr = trailGeom.getAttribute('color').array as Float32Array;

      for (let i = 0; i < count; i++) {
        const p = trailParticles.current[i];
        const t = p.life / p.maxLife;
        const alpha = (1 - t) * (1 - t);

        posArr[i * 3] = p.x;
        posArr[i * 3 + 1] = p.y;
        posArr[i * 3 + 2] = p.z;

        const c = makeTrailColor(t);
        colArr[i * 3] = c.r * alpha;
        colArr[i * 3 + 1] = c.g * alpha;
        colArr[i * 3 + 2] = c.b * alpha;
      }

      trailGeom.getAttribute('position').needsUpdate = true;
      trailGeom.getAttribute('color').needsUpdate = true;
      trailGeom.setDrawRange(0, count);
    }

    if (trailRef.current) {
      trailRef.current.visible = trailParticles.current.length > 0;
    }

    // --- EXPLOSION ---
    if (snap.netSwishVersion !== lastSwishVersion.current) {
      if (snap.latestSwishPerfect) {
        explosionActive.current = true;
        explosionTime.current = 0;
        explosionParticles.current = [];
        explosionColors.current = [];

        for (let i = 0; i < EXPLOSION_MAX; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = (Math.random() - 0.25) * Math.PI;
          const speed = 1.5 + Math.random() * 5.0;
          explosionParticles.current.push({
            x: HOOP_POSITION.x + (Math.random() - 0.5) * 0.4,
            y: HOOP_POSITION.y + Math.random() * 0.2,
            z: HOOP_POSITION.z + (Math.random() - 0.5) * 0.4,
            vx: Math.cos(theta) * Math.cos(phi) * speed,
            vy: Math.abs(Math.sin(phi)) * speed * 0.6 + 2.5,
            vz: Math.sin(theta) * Math.cos(phi) * speed,
            life: 0,
            maxLife: 0.4 + Math.random() * 1.2,
          });
          explosionColors.current.push(makeExplosionColor());
        }
      }
      lastSwishVersion.current = snap.netSwishVersion;
    }

    if (explosionActive.current) {
      explosionTime.current += dt;

      for (let i = explosionParticles.current.length - 1; i >= 0; i--) {
        const p = explosionParticles.current[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 7.0 * dt;
        p.vx *= 0.99;
        p.vz *= 0.99;
        if (p.life >= p.maxLife) {
          explosionParticles.current.splice(i, 1);
          explosionColors.current.splice(i, 1);
        }
      }

      if (explosionTime.current > EXPLOSION_DURATION || explosionParticles.current.length === 0) {
        explosionActive.current = false;
        explosionParticles.current = [];
        explosionColors.current = [];
      }
    }

    {
      const count = explosionParticles.current.length;
      const posArr = explosionGeom.getAttribute('position').array as Float32Array;
      const colArr = explosionGeom.getAttribute('color').array as Float32Array;

      for (let i = 0; i < count; i++) {
        const p = explosionParticles.current[i];
        const t = p.life / p.maxLife;
        const alpha = Math.min(1, p.life * 12) * (1 - t * t);
        const c = explosionColors.current[i];

        posArr[i * 3] = p.x;
        posArr[i * 3 + 1] = p.y;
        posArr[i * 3 + 2] = p.z;

        colArr[i * 3] = c.r * alpha;
        colArr[i * 3 + 1] = c.g * alpha;
        colArr[i * 3 + 2] = c.b * alpha;
      }

      explosionGeom.getAttribute('position').needsUpdate = true;
      explosionGeom.getAttribute('color').needsUpdate = true;
      explosionGeom.setDrawRange(0, count);
    }

    if (explosionRef.current) {
      explosionRef.current.visible = explosionActive.current;
    }
  });

  return (
    <>
      <points ref={trailRef} visible={false} frustumCulled={false}>
        <primitive object={trailGeom} attach="geometry" />
        <primitive object={trailMat} attach="material" />
      </points>
      <points ref={explosionRef} visible={false} frustumCulled={false}>
        <primitive object={explosionGeom} attach="geometry" />
        <primitive object={explosionMat} attach="material" />
      </points>
    </>
  );
}
