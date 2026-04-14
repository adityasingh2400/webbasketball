import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { QualityLevel } from './Lighting';
import { GRASS_TOON, METAL_TOON, ENV_TOON } from './toonMaterial';
import { grassGradient, fabricBlueGradient, fabricDarkGradient, genericGradient, metalGradient, skinGradient } from './toonGradients';

function hashFloat(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function randomRange(seed: number, min: number, max: number): number {
  return min + hashFloat(seed) * (max - min);
}

function seededRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createGrassTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4a8c3f';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = Math.random();
    if (shade < 0.3) {
      ctx.fillStyle = `rgba(58, 106, 47, ${0.3 + Math.random() * 0.4})`;
    } else if (shade < 0.6) {
      ctx.fillStyle = `rgba(82, 150, 65, ${0.2 + Math.random() * 0.3})`;
    } else {
      ctx.fillStyle = `rgba(40, 80, 30, ${0.15 + Math.random() * 0.25})`;
    }
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }

  for (let i = 0; i < 12; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 20 + Math.random() * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(35, 65, 25, 0.4)');
    grad.addColorStop(1, 'rgba(35, 65, 25, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(60, 120, 40, ${0.08 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - 2 - Math.random() * 4);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  return tex;
}

function Ground() {
  const texture = useMemo(() => createGrassTexture(), []);
  const material = useMemo(() => GRASS_TOON(texture), [texture]);
  useEffect(() => () => { texture.dispose(); material.dispose(); }, [texture, material]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -5]} receiveShadow material={material}>
      <planeGeometry args={[120, 120]} />
    </mesh>
  );
}

function Sun() {
  return (
    <group position={[12, 8, -50]}>
      <mesh>
        <sphereGeometry args={[4, 16, 16]} />
        <meshBasicMaterial color="#ff8040" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[7, 16, 16]} />
        <meshBasicMaterial color="#ff6030" transparent opacity={0.15} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[12, 16, 16]} />
        <meshBasicMaterial color="#ff4060" transparent opacity={0.06} toneMapped={false} />
      </mesh>
      <pointLight color="#fff0d0" intensity={0.5} distance={80} />
    </group>
  );
}

function createBleacherSeatTexture(baseColor: string): THREE.CanvasTexture {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 200; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.06})`;
    ctx.fillRect(x, y, 1 + Math.random() * 8, 0.5);
  }

  for (let i = 0; i < 30; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
    ctx.fillRect(x, y, 2 + Math.random() * 12, 0.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const BLEACHER_SEAT_COLORS = ['#cc3333', '#b82e2e', '#d43a3a', '#c03030', '#d04040'];

function BleacherSection({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const rows = 5;
  const seatWidth = 12;
  const rowDepth = 0.8;
  const rowHeight = 0.5;

  const seatTextures = useMemo(
    () => BLEACHER_SEAT_COLORS.map(c => createBleacherSeatTexture(c)),
    [],
  );
  const seatMaterials = useMemo(
    () => seatTextures.map(tex => ENV_TOON('#ffffff', { map: tex })),
    [seatTextures],
  );
  const supportMaterial = useMemo(() => METAL_TOON('#555566'), []);
  const sideMaterial = useMemo(() => METAL_TOON('#555566'), []);
  useEffect(() => () => {
    seatTextures.forEach(t => t.dispose());
    seatMaterials.forEach(m => m.dispose());
    supportMaterial.dispose();
    sideMaterial.dispose();
  }, [seatTextures, seatMaterials, supportMaterial, sideMaterial]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: rows }).map((_, i) => (
        <group key={i} position={[0, i * rowHeight, -i * rowDepth]}>
          <mesh castShadow receiveShadow material={seatMaterials[i % seatMaterials.length]}>
            <boxGeometry args={[seatWidth, 0.08, rowDepth * 0.6]} />
          </mesh>
          <mesh position={[0, -rowHeight / 2 + 0.04, 0]} material={supportMaterial}>
            <boxGeometry args={[seatWidth, rowHeight - 0.08, 0.06]} />
          </mesh>
        </group>
      ))}
      {[-seatWidth / 2, seatWidth / 2].map((x, idx) => (
        <mesh key={idx} position={[x, rows * rowHeight / 2 - 0.2, -rows * rowDepth / 2]} material={sideMaterial}>
          <boxGeometry args={[0.08, rows * rowHeight + 0.5, rows * rowDepth + 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

const SHIRT_COLORS = [
  '#e84040', '#4080e8', '#e8d040', '#40c040', '#e880e8', '#ff8c40',
  '#ffffff', '#8040c0', '#ff6b35', '#20b2aa', '#ffd700', '#dc143c',
  '#4169e1', '#32cd32', '#ff69b4', '#8b4513',
];

const SKIN_TONES = ['#f0c090', '#d4a574', '#c68c5e', '#8d5524', '#e8c4a0', '#a56b3a'];

function Spectator({ position, seed }: { position: [number, number, number]; seed: number }) {
  const s = Math.floor(seed * 1000);
  const shirtColor = SHIRT_COLORS[s % SHIRT_COLORS.length];
  const skinTone = SKIN_TONES[(s * 7) % SKIN_TONES.length];
  const bodyScale = 0.85 + ((s * 13) % 30) / 100;
  const headScale = 0.9 + ((s * 17) % 20) / 100;

  return (
    <group position={position} scale={[bodyScale, bodyScale, bodyScale]}>
      {/* Torso */}
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
        <meshToonMaterial color={shirtColor} gradientMap={genericGradient()} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.48 * headScale, 0]}>
        <sphereGeometry args={[0.07 * headScale, 8, 8]} />
        <meshToonMaterial color={skinTone} gradientMap={skinGradient()} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.12, 0.18, 0]} rotation={[0, 0, 0.3 + (s % 5) * 0.1]}>
        <capsuleGeometry args={[0.025, 0.12, 3, 4]} />
        <meshToonMaterial color={skinTone} gradientMap={skinGradient()} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.12, 0.18, 0]} rotation={[0, 0, -0.3 - (s % 4) * 0.1]}>
        <capsuleGeometry args={[0.025, 0.12, 3, 4]} />
        <meshToonMaterial color={skinTone} gradientMap={skinGradient()} />
      </mesh>
    </group>
  );
}

function Crowd({ basePosition, rows, seatsPerRow, rowSpacing, seatSpacing, facing }: {
  basePosition: [number, number, number]; rows: number; seatsPerRow: number;
  rowSpacing: number; seatSpacing: number; facing: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const spectators = useMemo(() => {
    const result: { pos: [number, number, number]; seed: number; row: number }[] = [];
    for (let row = 0; row < rows; row++) {
      for (let seat = 0; seat < seatsPerRow; seat++) {
        const seed = row * 97 + seat * 53 + rows * 11 + seatsPerRow * 7;
        if (hashFloat(seed) < 0.12) continue;
        result.push({
          pos: [
            (seat - seatsPerRow / 2) * seatSpacing + randomRange(seed + 1, -0.05, 0.05),
            row * 0.5,
            -row * rowSpacing,
          ],
          seed: row * seatsPerRow + seat + hashFloat(seed + 2) * 0.01,
          row,
        });
      }
    }
    return result;
  }, [rows, seatsPerRow, rowSpacing, seatSpacing]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const rowIdx = spectators[i]?.row ?? 0;
      child.rotation.z = Math.sin(t * 0.8 + rowIdx * 1.2) * 0.02;
      child.rotation.x = Math.cos(t * 0.5 + rowIdx * 0.8) * 0.01;
    });
  });

  return (
    <group ref={groupRef} position={basePosition} rotation={[0, facing, 0]}>
      {spectators.map((s, i) => <Spectator key={i} position={s.pos} seed={s.seed} />)}
    </group>
  );
}

function TreeCanopy({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const seedBase = position[0] * 17.13 + position[1] * 3.17 + position[2] * 11.29 + scale * 5.37;
  const swayOffset = useMemo(() => hashFloat(seedBase + 1) * Math.PI * 2, [seedBase]);
  const swaySpeed = useMemo(() => randomRange(seedBase + 2, 0.3, 0.6), [seedBase]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z = Math.sin(t * swaySpeed + swayOffset) * 0.015;
    groupRef.current.rotation.x = Math.cos(t * swaySpeed * 0.7 + swayOffset) * 0.01;
  });

  const trunkH = 2.5 + scale * 1.5;
  const leafColors = useMemo(() => [
    `hsl(${randomRange(seedBase + 3, 110, 140)}, ${randomRange(seedBase + 4, 55, 75)}%, ${randomRange(seedBase + 5, 25, 40)}%)`,
    `hsl(${randomRange(seedBase + 6, 115, 140)}, ${randomRange(seedBase + 7, 50, 75)}%, ${randomRange(seedBase + 8, 30, 45)}%)`,
    `hsl(${randomRange(seedBase + 9, 105, 140)}, ${randomRange(seedBase + 10, 45, 65)}%, ${randomRange(seedBase + 11, 22, 34)}%)`,
    `hsl(${randomRange(seedBase + 12, 120, 140)}, ${randomRange(seedBase + 13, 40, 60)}%, ${randomRange(seedBase + 14, 35, 45)}%)`,
  ], [seedBase]);

  const trunkMaterial = useMemo(() => ENV_TOON('#5c3a1e'), []);
  const barkMaterial = useMemo(() => ENV_TOON('#4a2e14'), []);
  const leafMaterials = useMemo(() => leafColors.map(c => ENV_TOON(c, { flatShading: true })), [leafColors]);
  useEffect(() => () => {
    trunkMaterial.dispose();
    barkMaterial.dispose();
    leafMaterials.forEach(m => m.dispose());
  }, [trunkMaterial, barkMaterial, leafMaterials]);

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh position={[0, trunkH / 2, 0]} castShadow material={trunkMaterial}>
        <cylinderGeometry args={[0.08, 0.18, trunkH, 8]} />
      </mesh>
      {[0.3, 0.6, 0.9].map((t, i) => (
        <mesh key={i} position={[0, trunkH * t, 0]} material={barkMaterial}>
          <torusGeometry args={[0.1 + (1 - t) * 0.06, 0.015, 4, 12]} />
        </mesh>
      ))}
      <mesh position={[0, trunkH + 0.6, 0]} castShadow material={leafMaterials[0]}>
        <dodecahedronGeometry args={[1.4, 1]} />
      </mesh>
      <mesh position={[0.2, trunkH + 1.5, -0.1]} castShadow material={leafMaterials[1]}>
        <dodecahedronGeometry args={[0.9, 1]} />
      </mesh>
      <mesh position={[-0.6, trunkH + 0.3, 0.3]} castShadow material={leafMaterials[2]}>
        <dodecahedronGeometry args={[0.8, 1]} />
      </mesh>
      <mesh position={[0.5, trunkH + 0.2, -0.4]} castShadow material={leafMaterials[3]}>
        <dodecahedronGeometry args={[0.7, 1]} />
      </mesh>
      {/* Lower canopy fill for density */}
      <mesh position={[-0.3, trunkH + 0.0, 0.5]} castShadow material={leafMaterials[0]}>
        <dodecahedronGeometry args={[0.55, 1]} />
      </mesh>
    </group>
  );
}

function PalmTree({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const seedBase = position[0] * 19.31 + position[1] * 2.17 + position[2] * 13.67;
  const lean = useMemo(() => randomRange(seedBase + 1, -0.06, 0.06), [seedBase]);
  const height = useMemo(() => randomRange(seedBase + 2, 4, 6), [seedBase]);
  const swayOffset = useMemo(() => hashFloat(seedBase + 3) * Math.PI * 2, [seedBase]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z = lean + Math.sin(t * 0.4 + swayOffset) * 0.02;
  });

  const frondColors = useMemo(() =>
    Array.from({ length: 8 }, (_, index) =>
      `hsl(${randomRange(seedBase + 10 + index, 100, 140)}, ${randomRange(seedBase + 30 + index, 50, 75)}%, ${randomRange(seedBase + 50 + index, 28, 43)}%)`,
    ),
  [seedBase]);

  const frondDroops = useMemo(
    () => frondColors.map((_, index) => randomRange(seedBase + 70 + index, 0.5, 0.9)),
    [frondColors, seedBase],
  );

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 5 }).map((_, i) => {
        const segH = height / 5;
        const y = i * segH + segH / 2;
        const radius = 0.12 - i * 0.015;
        return (
          <mesh key={i} position={[lean * (i / 5) * height * 0.3, y, 0]} castShadow>
            <cylinderGeometry args={[radius - 0.01, radius, segH + 0.05, 8]} />
            <meshToonMaterial color={i % 2 === 0 ? '#7a5a28' : '#8b6830'} gradientMap={genericGradient()} />
          </mesh>
        );
      })}
      {frondColors.map((color, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const droop = frondDroops[i];
        return (
          <group key={i} position={[lean * height * 0.3, height, 0]} rotation={[droop, angle, 0]}>
            <mesh position={[0, 0, 0.8]} rotation={[0.2, 0, 0]}>
              <planeGeometry args={[0.25, 1.8]} />
              <meshToonMaterial color={color} gradientMap={genericGradient()} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.08, 0, 0.5]} rotation={[0.1, 0.2, 0]}>
              <planeGeometry args={[0.15, 1.2]} />
              <meshToonMaterial color={color} gradientMap={genericGradient()} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {[0, 1.2, 2.5].map((a, i) => (
        <mesh key={i} position={[lean * height * 0.3 + Math.cos(a) * 0.1, height - 0.15, Math.sin(a) * 0.1]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshToonMaterial color="#6b4c1e" gradientMap={genericGradient()} />
        </mesh>
      ))}
    </group>
  );
}

function Beach() {
  const waveRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!waveRef.current) return;
    const t = state.clock.elapsedTime;
    waveRef.current.position.x = Math.sin(t * 0.3) * 0.4;
    waveRef.current.position.z = Math.cos(t * 0.2) * 0.2;
  });

  const rocks = useMemo(() => [
    [-1, 0.05, 3], [-3, 0.04, -6], [-2, 0.06, -12], [1, 0.03, 8], [-4, 0.05, 1],
  ].map(([x, y, z], i) => ({
    pos: [x, y, z] as [number, number, number],
    rot: [hashFloat(i + 1) * Math.PI, hashFloat(i + 11) * Math.PI, 0] as [number, number, number],
    size: randomRange(i + 21, 0.1, 0.22),
    color: `hsl(30, ${10 + i * 5}%, ${50 + i * 5}%)`,
  })), []);

  const sandMat = useMemo(() => ENV_TOON('#e8d5a3'), []);
  const wetSandMat = useMemo(() => ENV_TOON('#c4a87a'), []);
  const waterMat = useMemo(() => ENV_TOON('#1a6090', { rimIntensity: 0.3, rimPower: 2.0 }), []);
  const surfMat = useMemo(() => ENV_TOON('#d0eaf4', { transparent: true, opacity: 0.45 }), []);
  const driftwoodMat = useMemo(() => ENV_TOON('#8a7050'), []);
  useEffect(() => () => {
    sandMat.dispose(); wetSandMat.dispose(); waterMat.dispose(); surfMat.dispose(); driftwoodMat.dispose();
  }, [sandMat, wetSandMat, waterMat, surfMat, driftwoodMat]);

  return (
    <group position={[-28, 0, -5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, 0.01, 0]} material={sandMat}>
        <planeGeometry args={[14, 32]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6, 0.005, 0]} material={wetSandMat}>
        <planeGeometry args={[6, 32]} />
      </mesh>
      <mesh ref={waveRef} rotation={[-Math.PI / 2, 0, 0]} position={[-14, -0.01, 0]} material={waterMat}>
        <planeGeometry args={[24, 44]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-9, 0.008, 0]} material={surfMat}>
        <planeGeometry args={[1.5, 32]} />
      </mesh>

      {rocks.map((rock, i) => (
        <mesh key={i} position={rock.pos} rotation={rock.rot} castShadow>
          <dodecahedronGeometry args={[rock.size, 0]} />
          <meshToonMaterial color={rock.color} gradientMap={genericGradient()} />
        </mesh>
      ))}

      <mesh position={[0, 0.04, -3]} rotation={[0.1, 0.8, 0.05]} castShadow material={driftwoodMat}>
        <cylinderGeometry args={[0.03, 0.04, 1.2, 6]} />
      </mesh>

      <PalmTree position={[-3, 0, 8]} />
      <PalmTree position={[-5, 0, 2]} />
      <PalmTree position={[-2, 0, -4]} />
      <PalmTree position={[-6, 0, -8]} />
      <PalmTree position={[-4, 0, -14]} />
      <PalmTree position={[-1, 0, -1]} />
    </group>
  );
}

function useEnvironmentTexture(path: string): THREE.Texture {
  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(path);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }, [path]);

  useEffect(() => () => {
    texture.dispose();
  }, [texture]);

  return texture;
}

function BillboardPlane({
  texture,
  position,
  size,
  rotation = [0, 0, 0],
  opacity = 1,
}: {
  texture: THREE.Texture;
  position: [number, number, number];
  size: [number, number];
  rotation?: [number, number, number];
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} renderOrder={1}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        alphaTest={0.08}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function AnimatedCloudLayer({ quality }: { quality: QualityLevel }) {
  const groupRef = useRef<THREE.Group>(null);
  const cloudCount = quality === 'high' ? 7 : quality === 'medium' ? 5 : 3;
  const clouds = useMemo(() => (
    Array.from({ length: cloudCount }, (_, index) => ({
      position: [
        randomRange(index + 410, -34, 34),
        randomRange(index + 510, 11, 18),
        randomRange(index + 610, -42, 6),
      ] as [number, number, number],
      scale: randomRange(index + 710, 0.9, 1.8),
      speed: randomRange(index + 810, 0.16, 0.28),
      phase: hashFloat(index + 910) * Math.PI * 2,
    }))
  ), [cloudCount]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, index) => {
      const cloud = clouds[index];
      if (!cloud) return;
      child.position.x += cloud.speed * delta;
      child.position.y += Math.sin(t * cloud.speed + cloud.phase) * delta * 0.12;
      if (child.position.x > 40) {
        child.position.x = -40;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {clouds.map((cloud, index) => (
        <group key={index} position={cloud.position} scale={cloud.scale}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[1.1, 10, 10]} />
            <meshToonMaterial color="#f7fbff" gradientMap={genericGradient()} emissive="#f0e8d8" emissiveIntensity={0.08} />
          </mesh>
          <mesh position={[0.9, 0.2, 0.1]}>
            <sphereGeometry args={[0.85, 10, 10]} />
            <meshToonMaterial color="#eef7ff" gradientMap={genericGradient()} emissive="#f0e8d8" emissiveIntensity={0.06} />
          </mesh>
          <mesh position={[-0.9, 0.15, -0.1]}>
            <sphereGeometry args={[0.8, 10, 10]} />
            <meshToonMaterial color="#edf5ff" gradientMap={genericGradient()} emissive="#ede4d4" emissiveIntensity={0.05} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FerrisWheel({ position }: { position: [number, number, number] }) {
  const wheelRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!wheelRef.current) return;
    wheelRef.current.rotation.z = state.clock.elapsedTime * 0.18;
  });

  const legMat = useMemo(() => METAL_TOON('#7f8b98'), []);
  const baseMat = useMemo(() => METAL_TOON('#65707b'), []);
  const rimMat = useMemo(() => METAL_TOON('#f0a33a'), []);
  const hubMat = useMemo(() => METAL_TOON('#5c6672'), []);
  const spokeMat = useMemo(() => METAL_TOON('#93a0ad'), []);
  useEffect(() => () => {
    legMat.dispose(); baseMat.dispose(); rimMat.dispose(); hubMat.dispose(); spokeMat.dispose();
  }, [legMat, baseMat, rimMat, hubMat, spokeMat]);

  return (
    <group position={position}>
      <mesh position={[-1.15, -2.8, 0]} rotation={[0, 0, 0.25]} castShadow material={legMat}>
        <boxGeometry args={[0.18, 5.8, 0.18]} />
      </mesh>
      <mesh position={[1.15, -2.8, 0]} rotation={[0, 0, -0.25]} castShadow material={legMat}>
        <boxGeometry args={[0.18, 5.8, 0.18]} />
      </mesh>
      <mesh position={[0, -5.55, 0]} castShadow material={baseMat}>
        <boxGeometry args={[3.7, 0.35, 0.35]} />
      </mesh>

      <group ref={wheelRef} position={[0, 0, 0]}>
        <mesh castShadow material={rimMat}>
          <torusGeometry args={[3.2, 0.16, 8, 32]} />
        </mesh>
        <mesh castShadow material={hubMat}>
          <torusGeometry args={[0.28, 0.12, 6, 16]} />
        </mesh>
        {Array.from({ length: 10 }).map((_, index) => {
          const angle = (index / 10) * Math.PI * 2;
          const x = Math.cos(angle) * 3.2;
          const y = Math.sin(angle) * 3.2;
          return (
            <group key={index}>
              <mesh position={[x * 0.5, y * 0.5, 0]} rotation={[0, 0, angle]} castShadow material={spokeMat}>
                <boxGeometry args={[3.25, 0.05, 0.05]} />
              </mesh>
              <mesh position={[x, y, 0]} castShadow>
                <boxGeometry args={[0.45, 0.3, 0.45]} />
                <meshToonMaterial color={index % 2 === 0 ? '#ff7053' : '#4fb2e8'} gradientMap={genericGradient()} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function MovingCars() {
  const groupRef = useRef<THREE.Group>(null);
  const carData = useMemo(() => ([
    { x: -34, z: -28.2, speed: 5.5, color: '#ff7053' },
    { x: -10, z: -29.3, speed: 4.3, color: '#53a7ff' },
    { x: 16, z: -27.8, speed: 6.1, color: '#ffd45c' },
    { x: 30, z: -29.0, speed: 4.9, color: '#7ce07b' },
  ]), []);

  const wheelMat = useMemo(() => ENV_TOON('#20242a'), []);
  const windowMat = useMemo(() => ENV_TOON('#edf5ff'), []);
  useEffect(() => () => { wheelMat.dispose(); windowMat.dispose(); }, [wheelMat, windowMat]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, index) => {
      const car = carData[index];
      if (!car) return;
      child.position.x += car.speed * delta;
      if (child.position.x > 40) {
        child.position.x = -40;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {carData.map((car, index) => (
        <group key={index} position={[car.x, 0.11, car.z]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, 0.26, 0.55]} />
            <meshToonMaterial color={car.color} gradientMap={genericGradient()} />
          </mesh>
          <mesh position={[0.12, 0.2, 0]} castShadow material={windowMat}>
            <boxGeometry args={[0.62, 0.22, 0.48]} />
          </mesh>
          {[-0.44, 0.44].map((x, wheelIndex) => (
            <mesh key={wheelIndex} position={[x, -0.11, 0.22]} rotation={[Math.PI / 2, 0, 0]} material={wheelMat}>
              <cylinderGeometry args={[0.11, 0.11, 0.08, 8]} />
            </mesh>
          ))}
          <mesh position={[0.63, 0.03, 0.16]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshBasicMaterial color="#fff6c8" toneMapped={false} />
          </mesh>
          <mesh position={[0.63, 0.03, -0.16]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshBasicMaterial color="#fff6c8" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CityVista({ quality }: { quality: QualityLevel }) {
  const cityTexture = useEnvironmentTexture('/assets/environment/city-skyline.png');
  const pierTexture = useEnvironmentTexture('/assets/environment/pier-panorama.png');
  const beachTexture = useEnvironmentTexture('/assets/environment/beach-scene.png');
  const palmTexture = useEnvironmentTexture('/assets/environment/palm-tree.png');
  const buildingCount = quality === 'high' ? 26 : quality === 'medium' ? 18 : 12;

  const FACADE_COLORS = [
    '#c4a882', '#b8967a', '#d4b896', '#a08870',
    '#8c7a6a', '#c9b8a0', '#b0906e', '#d0c0a8',
    '#907868', '#6e6058', '#a89480', '#c8b090',
    '#786050', '#e0d0b8', '#b4a48c', '#9c8c78',
  ];
  const WINDOW_GLOW_COLORS = [
    'rgba(255, 230, 160, ALPHA)',
    'rgba(255, 210, 130, ALPHA)',
    'rgba(200, 220, 255, ALPHA)',
    'rgba(255, 200, 170, ALPHA)',
    'rgba(180, 210, 255, ALPHA)',
    'rgba(255, 240, 200, ALPHA)',
  ];

  const buildings = useMemo(() => (
    Array.from({ length: buildingCount }, (_, index) => {
      const lane = index % 2;
      const facadeColor = FACADE_COLORS[index % FACADE_COLORS.length];
      return {
        position: [
          -38 + (index / Math.max(1, buildingCount - 1)) * 76 + randomRange(index + 1200, -1.4, 1.4),
          0,
          lane === 0 ? -38.5 + randomRange(index + 1300, -1.2, 0.8) : -44.5 + randomRange(index + 1400, -1.8, 1.2),
        ] as [number, number, number],
        width: randomRange(index + 1500, 1.8, 4.8),
        height: randomRange(index + 1600, 5.5, lane === 0 ? 13 : 18),
        depth: randomRange(index + 1700, 1.8, 3.5),
        facadeColor,
        seed: index,
      };
    })
  ), [buildingCount]);

  const buildingTextures = useMemo(() => buildings.map((b) => {
    const w = 128;
    const h = Math.round(128 * (b.height / b.width));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = b.facadeColor;
    ctx.fillRect(0, 0, w, h);

    const rng = seededRng(b.seed * 137 + 42);
    const darken = `rgba(0,0,0,${0.03 + rng() * 0.04})`;
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = darken;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 4, 1);
    }

    const cols = Math.max(2, Math.floor(b.width * 2.2));
    const rows = Math.max(3, Math.floor(b.height * 1.4));
    const winW = w / (cols * 2.2);
    const winH = h / (rows * 2.4);
    const padX = winW * 0.6;
    const padY = winH * 0.4;

    for (let row = 1; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const wx = padX + col * ((w - padX * 2) / Math.max(1, cols - 1)) - winW / 2;
        const wy = padY + row * ((h - padY * 2) / rows) - winH / 2;

        if (rng() < 0.12) continue;

        const isLit = rng() < 0.45;
        if (isLit) {
          const glowTemplate = WINDOW_GLOW_COLORS[Math.floor(rng() * WINDOW_GLOW_COLORS.length)];
          const brightness = 0.5 + rng() * 0.5;
          ctx.fillStyle = glowTemplate.replace('ALPHA', String(brightness));
          ctx.fillRect(wx, wy, winW, winH);
          const glowR = winW * 1.5;
          const gcx = wx + winW / 2;
          const gcy = wy + winH / 2;
          const glow = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, glowR);
          glow.addColorStop(0, glowTemplate.replace('ALPHA', String(brightness * 0.15)));
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(gcx - glowR, gcy - glowR, glowR * 2, glowR * 2);
        } else {
          const shade = 0.15 + rng() * 0.15;
          ctx.fillStyle = `rgba(20, 30, 50, ${shade})`;
          ctx.fillRect(wx, wy, winW, winH);
        }

        ctx.strokeStyle = `rgba(0,0,0,${0.08 + rng() * 0.06})`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(wx, wy, winW, winH);
      }
    }

    const roofH = h * 0.04;
    ctx.fillStyle = `rgba(0,0,0,${0.08 + rng() * 0.06})`;
    ctx.fillRect(0, 0, w, roofH);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }), [buildings]);

  const buildingMaterials = useMemo(
    () => buildingTextures.map(tex => ENV_TOON('#ffffff', { map: tex, rimIntensity: 0.12, emissive: '#ffeedd', emissiveIntensity: 0.02 })),
    [buildingTextures],
  );
  const roadMat = useMemo(() => ENV_TOON('#565f68'), []);
  const sidewalkMat = useMemo(() => ENV_TOON('#aa9165'), []);
  const lampPoleMat = useMemo(() => METAL_TOON('#5d636b'), []);
  useEffect(() => () => {
    buildingTextures.forEach(t => t.dispose());
    buildingMaterials.forEach(m => m.dispose());
    roadMat.dispose(); sidewalkMat.dispose(); lampPoleMat.dispose();
  }, [buildingTextures, buildingMaterials, roadMat, sidewalkMat, lampPoleMat]);

  const palmCards = useMemo(() => ([
    { position: [-33, 7.5, -26], size: [4.5, 11] as [number, number], opacity: 0.52 },
    { position: [-26, 6.5, -24], size: [4, 9.5] as [number, number], opacity: 0.46 },
    { position: [-22, 8.2, -31], size: [5, 12.5] as [number, number], opacity: 0.4 },
  ] as { position: [number, number, number]; size: [number, number]; opacity: number }[]), []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.012, -28.6]} material={roadMat}>
        <planeGeometry args={[76, 5.4]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-26, 0.014, -26.5]} material={sidewalkMat}>
        <planeGeometry args={[22, 4.8]} />
      </mesh>

      {[-18, -4, 10, 24].map((x, index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, -28.6]}>
          <planeGeometry args={[6, 0.14]} />
          <meshBasicMaterial color="#f6f3de" toneMapped={false} />
        </mesh>
      ))}

      {buildings.map((building, index) => (
        <mesh
          key={index}
          position={[building.position[0], building.height / 2, building.position[2]]}
          castShadow
          receiveShadow
          material={buildingMaterials[index]}
        >
          <boxGeometry args={[building.width, building.height, building.depth]} />
        </mesh>
      ))}

      <BillboardPlane texture={cityTexture} position={[2, 9.8, -48]} size={[94, 18]} opacity={0.84} />
      <BillboardPlane texture={pierTexture} position={[-27, 4.4, -37]} size={[26, 11]} opacity={0.78} />
      <BillboardPlane texture={beachTexture} position={[-15, 4.5, -22]} size={[8.4, 10]} opacity={0.42} />
      {palmCards.map((card, index) => (
        <BillboardPlane
          key={index}
          texture={palmTexture}
          position={card.position}
          size={card.size}
          opacity={card.opacity}
        />
      ))}

      <FerrisWheel position={[-18, 8.2, -34]} />
      <MovingCars />

      {[-34, -18, -2, 14, 30].map((x, index) => (
        <group key={index} position={[x, 0, -25.2]}>
          <mesh position={[0, 3.3, 0]} castShadow material={lampPoleMat}>
            <cylinderGeometry args={[0.08, 0.11, 6.6, 8]} />
          </mesh>
          <mesh position={[0, 6.85, 0]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshToonMaterial
              color="#fff3d1"
              gradientMap={genericGradient()}
              emissive="#ffd36b"
              emissiveIntensity={quality === 'high' ? 0.8 : 0.45}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ParkBench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const seatMat = useMemo(() => ENV_TOON('#8f6235'), []);
  const backMat = useMemo(() => ENV_TOON('#98683a'), []);
  const legMat = useMemo(() => METAL_TOON('#4e545c'), []);
  useEffect(() => () => { seatMat.dispose(); backMat.dispose(); legMat.dispose(); }, [seatMat, backMat, legMat]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow material={seatMat}>
        <boxGeometry args={[1.8, 0.08, 0.18]} />
      </mesh>
      <mesh position={[0, 0.8, -0.18]} castShadow material={backMat}>
        <boxGeometry args={[1.8, 0.08, 0.18]} />
      </mesh>
      {[-0.75, -0.2, 0.2, 0.75].map((x, index) => (
        <mesh key={index} position={[x, 0.42, index < 2 ? -0.12 : 0.12]} castShadow material={legMat}>
          <boxGeometry args={[0.08, 0.78, 0.08]} />
        </mesh>
      ))}
    </group>
  );
}

function GroundDecor({ quality }: { quality: QualityLevel }) {
  const bushCount = quality === 'high' ? 16 : quality === 'medium' ? 11 : 7;
  const rockCount = quality === 'high' ? 14 : quality === 'medium' ? 10 : 6;

  const bushes = useMemo(() => (
    Array.from({ length: bushCount }, (_, index) => ({
      position: [
        index % 2 === 0 ? randomRange(index + 2200, -26, -12) : randomRange(index + 2200, 12, 28),
        0,
        randomRange(index + 2300, -22, 12),
      ] as [number, number, number],
      scale: randomRange(index + 2400, 0.45, 0.95),
      color: `hsl(${randomRange(index + 2500, 105, 135)}, ${randomRange(index + 2600, 48, 70)}%, ${randomRange(index + 2700, 25, 38)}%)`,
    }))
  ), [bushCount]);

  const rocks = useMemo(() => (
    Array.from({ length: rockCount }, (_, index) => ({
      position: [
        randomRange(index + 2800, -32, 32),
        0,
        randomRange(index + 2900, -25, 15),
      ] as [number, number, number],
      scale: randomRange(index + 3000, 0.12, 0.28),
      rotation: [hashFloat(index + 3100) * Math.PI, hashFloat(index + 3200) * Math.PI, 0] as [number, number, number],
    }))
  ), [rockCount]);

  const flowerPatches = useMemo(() => ([
    [-18, 0, 10],
    [16, 0, 8],
    [-24, 0, -10],
    [22, 0, -6],
    [-14, 0, -21],
    [14, 0, -20],
  ] as [number, number, number][]), []);

  const rockMat = useMemo(() => ENV_TOON('#857b70'), []);
  const stemMat = useMemo(() => ENV_TOON('#4f8b38'), []);
  const bollardMat = useMemo(() => METAL_TOON('#4f5963'), []);
  useEffect(() => () => { rockMat.dispose(); stemMat.dispose(); bollardMat.dispose(); }, [rockMat, stemMat, bollardMat]);

  return (
    <group>
      <ParkBench position={[14.5, 0, 6.5]} rotation={Math.PI} />
      <ParkBench position={[-15.5, 0, -3]} rotation={Math.PI / 2} />
      <ParkBench position={[19, 0, -16]} rotation={Math.PI} />

      {[-18, 18].map((x, index) => (
        <group key={index} position={[x, 0, 11]}>
          <mesh position={[0, 0.55, 0]} castShadow material={bollardMat}>
            <cylinderGeometry args={[0.18, 0.22, 1.1, 10]} />
          </mesh>
          <mesh position={[0, 1.18, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#d4ecff" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {bushes.map((bush, index) => (
        <group key={index} position={bush.position} scale={bush.scale}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshToonMaterial color={bush.color} gradientMap={genericGradient()} flatShading />
          </mesh>
          <mesh position={[0.24, 0.22, -0.08]} castShadow>
            <dodecahedronGeometry args={[0.28, 0]} />
            <meshToonMaterial color={bush.color} gradientMap={genericGradient()} flatShading />
          </mesh>
        </group>
      ))}

      {rocks.map((rock, index) => (
        <mesh key={index} position={[rock.position[0], rock.scale * 0.5, rock.position[2]]} rotation={rock.rotation} castShadow material={rockMat}>
          <dodecahedronGeometry args={[rock.scale, 0]} />
        </mesh>
      ))}

      {flowerPatches.map((patch, index) => (
        <group key={index} position={patch}>
          {Array.from({ length: 5 }).map((_, flowerIndex) => {
            const x = randomRange(index * 10 + flowerIndex + 3300, -0.8, 0.8);
            const z = randomRange(index * 10 + flowerIndex + 3400, -0.5, 0.5);
            const height = randomRange(index * 10 + flowerIndex + 3500, 0.16, 0.28);
            const petalColors = ['#ff7f6e', '#ffd45d', '#ffffff', '#b08cff'];
            const color = petalColors[(index + flowerIndex) % petalColors.length];
            return (
              <group key={flowerIndex} position={[x, 0, z]}>
                <mesh position={[0, height / 2, 0]} material={stemMat}>
                  <cylinderGeometry args={[0.012, 0.012, height, 5]} />
                </mesh>
                <mesh position={[0, height + 0.04, 0]}>
                  <sphereGeometry args={[0.05, 6, 6]} />
                  <meshToonMaterial color={color} gradientMap={genericGradient()} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function Fence() {
  const hw = 10;
  const depth = 18;
  const posts = useMemo(() => {
    const p: [number, number, number][] = [];
    for (let x = -hw; x <= hw; x += 2.5) p.push([x, 0, 3]);
    for (let z = 3; z >= -depth; z -= 2.5) { p.push([hw, 0, z]); p.push([-hw, 0, z]); }
    for (let x = -hw; x <= hw; x += 2.5) p.push([x, 0, -depth]);
    return p;
  }, []);

  const fenceMat = useMemo(() => METAL_TOON('#444444'), []);
  useEffect(() => () => { fenceMat.dispose(); }, [fenceMat]);

  return (
    <group>
      {posts.map((pos, i) => (
        <mesh key={i} position={[pos[0], 0.6, pos[2]]} material={fenceMat}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
        </mesh>
      ))}
      {[[0, 1.1, -depth, hw * 2 + 0.1, 0.03, 0.03],
        [0, 1.1, 3, hw * 2 + 0.1, 0.03, 0.03],
        [hw, 1.1, -depth / 2 + 1.5, 0.03, 0.03, depth + 3 + 0.1],
        [-hw, 1.1, -depth / 2 + 1.5, 0.03, 0.03, depth + 3 + 0.1],
        [0, 0.55, -depth, hw * 2 + 0.1, 0.02, 0.02],
        [0, 0.55, 3, hw * 2 + 0.1, 0.02, 0.02],
        [hw, 0.55, -depth / 2 + 1.5, 0.02, 0.02, depth + 3 + 0.1],
        [-hw, 0.55, -depth / 2 + 1.5, 0.02, 0.02, depth + 3 + 0.1],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={`rail-${i}`} position={[x, y, z]} material={fenceMat}>
          <boxGeometry args={[sx, sy, sz]} />
        </mesh>
      ))}
    </group>
  );
}

function BackgroundTrees({ quality }: { quality: QualityLevel }) {
  const trees = useMemo(() => {
    const result: { pos: [number, number, number]; scale: number }[] = [];
    const count = quality === 'high' ? 34 : quality === 'medium' ? 26 : 16;
    for (let i = 0; i < count; i++) {
      const angle = hashFloat(i + 101) * Math.PI * 2;
      const dist = randomRange(i + 201, 22, 47);
      result.push({
        pos: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist - 5],
        scale: randomRange(i + 301, 0.7, 1.5),
      });
    }
    return result;
  }, [quality]);

  return (
    <group>
      {trees.map((tree, i) => (
        <TreeCanopy key={i} position={tree.pos} scale={tree.scale} />
      ))}
    </group>
  );
}

function Birds({ count = 12 }: { count?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const birds = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      x: randomRange(i + 5000, -30, 30),
      y: randomRange(i + 5100, 14, 25),
      z: randomRange(i + 5200, -40, -10),
      speed: randomRange(i + 5300, 1.5, 3.5),
      flapSpeed: randomRange(i + 5400, 6, 10),
      flapPhase: hashFloat(i + 5500) * Math.PI * 2,
      scale: randomRange(i + 5600, 0.08, 0.14),
    })),
  [count]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((bird, i) => {
      const b = birds[i];
      if (!b) return;
      bird.position.x = b.x + t * b.speed;
      if (bird.position.x > 45) bird.position.x -= 90;
      bird.position.y = b.y + Math.sin(t * 0.5 + b.flapPhase) * 0.3;
      const flapAngle = Math.sin(t * b.flapSpeed + b.flapPhase) * 0.6;
      const leftWing = bird.children[0];
      const rightWing = bird.children[1];
      if (leftWing) leftWing.rotation.z = flapAngle;
      if (rightWing) rightWing.rotation.z = -flapAngle;
    });
  });

  return (
    <group ref={groupRef}>
      {birds.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]} scale={b.scale}>
          <mesh position={[-0.5, 0, 0]} rotation={[0.3, 0, 0]}>
            <planeGeometry args={[1.2, 0.15]} />
            <meshBasicMaterial color="#1a1a2e" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.5, 0, 0]} rotation={[0.3, 0, 0]}>
            <planeGeometry args={[1.2, 0.15]} />
            <meshBasicMaterial color="#1a1a2e" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Environment({ quality = 'medium' }: { quality?: QualityLevel }) {
  const showBeach = true;
  const showCrowd = quality === 'high';

  return (
    <group>
      <Ground />
      <AnimatedCloudLayer quality={quality} />
      <CityVista quality={quality} />
      {showBeach ? <Beach /> : null}
      <Fence />
      <GroundDecor quality={quality} />

      <BleacherSection position={[13, 0, -7]} rotation={-Math.PI / 2} />
      <BleacherSection position={[0, 0, -20]} rotation={0} />

      {showCrowd ? (
        <>
          <Crowd basePosition={[13, 0.15, -7]} rows={4} seatsPerRow={10} rowSpacing={0.8} seatSpacing={0.5} facing={-Math.PI / 2} />
          <Crowd basePosition={[0, 0.15, -20]} rows={4} seatsPerRow={14} rowSpacing={0.8} seatSpacing={0.5} facing={0} />
        </>
      ) : null}

      <BackgroundTrees quality={quality} />
    </group>
  );
}
