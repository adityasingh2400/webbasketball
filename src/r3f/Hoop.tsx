import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface HoopProps {
  position?: [number, number, number];
  triggerNetAnimation?: boolean;
}

const RIM_RADIUS = 0.23;
const RIM_TUBE = 0.015;
const BACKBOARD_WIDTH = 1.83;
const BACKBOARD_HEIGHT = 1.07;
const NET_SEGMENTS = 10;
const NET_RINGS = 5;
const NET_LENGTH = 0.45;

function Net({ rimCenter, triggerSwish }: { rimCenter: [number, number, number]; triggerSwish: boolean }) {
  const netRef = useRef<THREE.LineSegments>(null);
  const animProgress = useRef(0);
  const animating = useRef(false);
  const prevTrigger = useRef(false);
  const basePositions = useRef<Float32Array | null>(null);

  const { geometry, material } = useMemo(() => {
    const positions: number[] = [];
    const [cx, cy, cz] = rimCenter;

    for (let seg = 0; seg < NET_SEGMENTS; seg++) {
      const angle = (seg / NET_SEGMENTS) * Math.PI * 2;
      const nextAngle = ((seg + 1) / NET_SEGMENTS) * Math.PI * 2;

      for (let ring = 0; ring < NET_RINGS; ring++) {
        const t0 = ring / NET_RINGS;
        const t1 = (ring + 1) / NET_RINGS;
        const shrink0 = 1 - t0 * 0.4;
        const shrink1 = 1 - t1 * 0.4;

        const x0 = cx + Math.cos(angle) * RIM_RADIUS * shrink0;
        const y0 = cy - t0 * NET_LENGTH;
        const z0 = cz + Math.sin(angle) * RIM_RADIUS * shrink0;

        const x1 = cx + Math.cos(angle) * RIM_RADIUS * shrink1;
        const y1 = cy - t1 * NET_LENGTH;
        const z1 = cz + Math.sin(angle) * RIM_RADIUS * shrink1;

        positions.push(x0, y0, z0, x1, y1, z1);

        const mx = cx + Math.cos(nextAngle) * RIM_RADIUS * shrink1;
        const mz = cz + Math.sin(nextAngle) * RIM_RADIUS * shrink1;
        positions.push(x1, y1, z1, mx, y1, mz);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    });

    return { geometry: geom, material: mat };
  }, [rimCenter]);

  if (!basePositions.current && geometry.getAttribute('position')) {
    basePositions.current = Float32Array.from(geometry.getAttribute('position').array);
  }

  useFrame((_, delta) => {
    if (triggerSwish && !prevTrigger.current) {
      animating.current = true;
      animProgress.current = 0;
    }
    prevTrigger.current = triggerSwish;

    if (!animating.current || !netRef.current) return;
    animProgress.current += delta * 3;

    const posAttr = netRef.current.geometry.getAttribute('position');
    const base = basePositions.current;
    if (posAttr && base) {
      const wave = Math.sin(animProgress.current * Math.PI) * 0.05;
      for (let i = 0; i < posAttr.count; i++) {
        const baseY = base[i * 3 + 1];
        posAttr.setY(i, baseY + wave * Math.sin(i * 0.5));
      }
      posAttr.needsUpdate = true;
    }

    if (animProgress.current >= 1) {
      animating.current = false;
      animProgress.current = 0;
    }
  });

  return (
    <primitive
      ref={netRef}
      object={new THREE.LineSegments(geometry, material)}
    />
  );
}

export function Hoop({ position = [0, 3.05, -13], triggerNetAnimation = false }: HoopProps) {
  const [px, py, pz] = position;

  const poleHeight = py;
  const backboardY = py + 0.15;
  const rimY = py;
  const rimZ = pz + 0.25;

  return (
    <group>
      {/* Support pole */}
      <mesh position={[px, poleHeight / 2, pz - 0.3]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, poleHeight, 12]} />
        <meshStandardMaterial color="#888888" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Backboard */}
      <mesh position={[px, backboardY, pz - 0.05]} castShadow>
        <boxGeometry args={[BACKBOARD_WIDTH, BACKBOARD_HEIGHT, 0.04]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.6}
          roughness={0.1}
          metalness={0.05}
        />
      </mesh>

      {/* Backboard border */}
      <mesh position={[px, backboardY, pz - 0.06]}>
        <boxGeometry args={[BACKBOARD_WIDTH + 0.04, BACKBOARD_HEIGHT + 0.04, 0.02]} />
        <meshStandardMaterial color="#333333" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Backboard target square */}
      <mesh position={[px, backboardY + 0.1, pz - 0.02]}>
        <boxGeometry args={[0.6, 0.45, 0.005]} />
        <meshBasicMaterial color="#ff3333" transparent opacity={0.3} />
      </mesh>

      {/* Rim */}
      <mesh position={[px, rimY, rimZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[RIM_RADIUS, RIM_TUBE, 12, 32]} />
        <meshStandardMaterial color="#ff4500" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Rim bracket */}
      <mesh position={[px, rimY - 0.01, pz + 0.12]}>
        <boxGeometry args={[0.08, 0.02, 0.26]} />
        <meshStandardMaterial color="#666666" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Net */}
      <Net rimCenter={[px, rimY - RIM_TUBE, rimZ]} triggerSwish={triggerNetAnimation} />
    </group>
  );
}
