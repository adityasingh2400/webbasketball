import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  useEffect(() => () => { texture.dispose(); }, [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -5]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial map={texture} roughness={0.92} metalness={0.0} />
    </mesh>
  );
}

function Sun() {
  return (
    <group position={[25, 30, -20]}>
      <mesh>
        <sphereGeometry args={[2.5, 16, 16]} />
        <meshBasicMaterial color="#fff8e0" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[5, 16, 16]} />
        <meshBasicMaterial color="#fff4c0" transparent opacity={0.12} toneMapped={false} />
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
  useEffect(() => () => { seatTextures.forEach(t => t.dispose()); }, [seatTextures]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: rows }).map((_, i) => (
        <group key={i} position={[0, i * rowHeight, -i * rowDepth]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[seatWidth, 0.08, rowDepth * 0.6]} />
            <meshStandardMaterial
              map={seatTextures[i % seatTextures.length]}
              roughness={0.75}
              metalness={0.02}
            />
          </mesh>
          <mesh position={[0, -rowHeight / 2 + 0.04, 0]}>
            <boxGeometry args={[seatWidth, rowHeight - 0.08, 0.06]} />
            <meshStandardMaterial
              color={`hsl(230, 5%, ${38 + i * 3}%)`}
              metalness={0.5}
              roughness={0.35 + i * 0.05}
            />
          </mesh>
        </group>
      ))}
      {[-seatWidth / 2, seatWidth / 2].map((x, idx) => (
        <mesh key={idx} position={[x, rows * rowHeight / 2 - 0.2, -rows * rowDepth / 2]}>
          <boxGeometry args={[0.08, rows * rowHeight + 0.5, rows * rowDepth + 0.5]} />
          <meshStandardMaterial color="#555566" metalness={0.5} roughness={0.35} />
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
        <meshStandardMaterial color={shirtColor} roughness={0.85} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.48 * headScale, 0]}>
        <sphereGeometry args={[0.07 * headScale, 8, 8]} />
        <meshStandardMaterial color={skinTone} roughness={0.7} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.12, 0.18, 0]} rotation={[0, 0, 0.3 + (s % 5) * 0.1]}>
        <capsuleGeometry args={[0.025, 0.12, 3, 4]} />
        <meshStandardMaterial color={skinTone} roughness={0.7} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.12, 0.18, 0]} rotation={[0, 0, -0.3 - (s % 4) * 0.1]}>
        <capsuleGeometry args={[0.025, 0.12, 3, 4]} />
        <meshStandardMaterial color={skinTone} roughness={0.7} />
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
    const result: { pos: [number, number, number]; seed: number }[] = [];
    for (let row = 0; row < rows; row++) {
      for (let seat = 0; seat < seatsPerRow; seat++) {
        if (Math.random() < 0.12) continue;
        result.push({
          pos: [(seat - seatsPerRow / 2) * seatSpacing + (Math.random() - 0.5) * 0.1, row * 0.5, -row * rowSpacing],
          seed: row * seatsPerRow + seat + Math.random() * 0.01,
        });
      }
    }
    return result;
  }, [rows, seatsPerRow, rowSpacing, seatSpacing]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const rowIdx = Math.floor(i / seatsPerRow);
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
  const swayOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  const swaySpeed = useMemo(() => 0.3 + Math.random() * 0.3, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z = Math.sin(t * swaySpeed + swayOffset) * 0.015;
    groupRef.current.rotation.x = Math.cos(t * swaySpeed * 0.7 + swayOffset) * 0.01;
  });

  const trunkH = 2.5 + scale * 1.5;
  const leafColors = useMemo(() => [
    `hsl(${110 + Math.random() * 30}, ${55 + Math.random() * 20}%, ${25 + Math.random() * 15}%)`,
    `hsl(${115 + Math.random() * 25}, ${50 + Math.random() * 25}%, ${30 + Math.random() * 15}%)`,
    `hsl(${105 + Math.random() * 35}, ${45 + Math.random() * 20}%, ${22 + Math.random() * 12}%)`,
    `hsl(${120 + Math.random() * 20}, ${40 + Math.random() * 20}%, ${35 + Math.random() * 10}%)`,
  ], []);

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.18, trunkH, 8]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.95} />
      </mesh>
      {[0.3, 0.6, 0.9].map((t, i) => (
        <mesh key={i} position={[0, trunkH * t, 0]}>
          <torusGeometry args={[0.1 + (1 - t) * 0.06, 0.015, 4, 12]} />
          <meshStandardMaterial color="#4a2e14" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, trunkH + 0.6, 0]} castShadow>
        <dodecahedronGeometry args={[1.4, 1]} />
        <meshStandardMaterial color={leafColors[0]} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.2, trunkH + 1.5, -0.1]} castShadow>
        <dodecahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial color={leafColors[1]} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-0.6, trunkH + 0.3, 0.3]} castShadow>
        <dodecahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color={leafColors[2]} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.5, trunkH + 0.2, -0.4]} castShadow>
        <dodecahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color={leafColors[3]} roughness={0.9} flatShading />
      </mesh>
      {/* Lower canopy fill for density */}
      <mesh position={[-0.3, trunkH + 0.0, 0.5]} castShadow>
        <dodecahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color={leafColors[0]} roughness={0.92} flatShading />
      </mesh>
    </group>
  );
}

function PalmTree({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const lean = useMemo(() => (Math.random() - 0.5) * 0.12, []);
  const height = useMemo(() => 4 + Math.random() * 2, []);
  const swayOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z = lean + Math.sin(t * 0.4 + swayOffset) * 0.02;
  });

  const frondColors = useMemo(() =>
    Array.from({ length: 8 }, () => `hsl(${100 + Math.random() * 40}, ${50 + Math.random() * 25}%, ${28 + Math.random() * 15}%)`),
  []);

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 5 }).map((_, i) => {
        const segH = height / 5;
        const y = i * segH + segH / 2;
        const radius = 0.12 - i * 0.015;
        return (
          <mesh key={i} position={[lean * (i / 5) * height * 0.3, y, 0]} castShadow>
            <cylinderGeometry args={[radius - 0.01, radius, segH + 0.05, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#7a5a28' : '#8b6830'} roughness={0.95} />
          </mesh>
        );
      })}
      {frondColors.map((color, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const droop = 0.5 + Math.random() * 0.4;
        return (
          <group key={i} position={[lean * height * 0.3, height, 0]} rotation={[droop, angle, 0]}>
            <mesh position={[0, 0, 0.8]} rotation={[0.2, 0, 0]}>
              <planeGeometry args={[0.25, 1.8]} />
              <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.08, 0, 0.5]} rotation={[0.1, 0.2, 0]}>
              <planeGeometry args={[0.15, 1.2]} />
              <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {[0, 1.2, 2.5].map((a, i) => (
        <mesh key={i} position={[lean * height * 0.3 + Math.cos(a) * 0.1, height - 0.15, Math.sin(a) * 0.1]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#6b4c1e" roughness={0.9} />
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

  return (
    <group position={[-18, 0, -5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, -0.01, 0]}>
        <planeGeometry args={[14, 32]} />
        <meshStandardMaterial color="#e8d5a3" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6, -0.012, 0]}>
        <planeGeometry args={[6, 32]} />
        <meshStandardMaterial color="#c4a87a" roughness={0.6} metalness={0.08} />
      </mesh>
      <mesh ref={waveRef} rotation={[-Math.PI / 2, 0, 0]} position={[-14, -0.02, 0]}>
        <planeGeometry args={[24, 44]} />
        <meshPhysicalMaterial
          color="#2a7ab5"
          transmission={0.4}
          roughness={0.08}
          ior={1.33}
          thickness={0.5}
          metalness={0.1}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-9, -0.005, 0]}>
        <planeGeometry args={[1.5, 32]} />
        <meshStandardMaterial color="#d0eaf4" roughness={0.3} transparent opacity={0.45} />
      </mesh>

      {[[-1, 0.05, 3], [-3, 0.04, -6], [-2, 0.06, -12], [1, 0.03, 8], [-4, 0.05, 1]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[Math.random(), Math.random(), 0]} castShadow>
          <dodecahedronGeometry args={[0.1 + Math.random() * 0.12, 0]} />
          <meshStandardMaterial color={`hsl(30, ${10 + i * 5}%, ${50 + i * 5}%)`} roughness={0.95} />
        </mesh>
      ))}

      <mesh position={[0, 0.04, -3]} rotation={[0.1, 0.8, 0.05]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 1.2, 6]} />
        <meshStandardMaterial color="#8a7050" roughness={0.95} />
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

  return (
    <group>
      {posts.map((pos, i) => (
        <mesh key={i} position={[pos[0], 0.6, pos[2]]}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
          <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.3} />
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
        <mesh key={`rail-${i}`} position={[x, y, z]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function BackgroundTrees() {
  const trees = useMemo(() => {
    const result: { pos: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 22 + Math.random() * 25;
      result.push({
        pos: [Math.cos(angle) * dist, 0, Math.sin(angle) * dist - 5],
        scale: 0.7 + Math.random() * 0.8,
      });
    }
    return result;
  }, []);

  return (
    <group>
      {trees.map((tree, i) => (
        <TreeCanopy key={i} position={tree.pos} scale={tree.scale} />
      ))}
    </group>
  );
}

export function Environment() {
  return (
    <group>
      <Ground />
      <Sun />
      <Beach />
      <Fence />

      <BleacherSection position={[13, 0, -7]} rotation={-Math.PI / 2} />
      <BleacherSection position={[0, 0, -20]} rotation={0} />

      <Crowd basePosition={[13, 0.15, -7]} rows={4} seatsPerRow={10} rowSpacing={0.8} seatSpacing={0.5} facing={-Math.PI / 2} />
      <Crowd basePosition={[0, 0.15, -20]} rows={4} seatsPerRow={14} rowSpacing={0.8} seatSpacing={0.5} facing={0} />

      <BackgroundTrees />
    </group>
  );
}
