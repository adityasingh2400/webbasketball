import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';

interface HoopProps {
  runtime: GameRuntime;
  position?: [number, number, number];
}

const RIM_RADIUS = 0.23;
const RIM_TUBE = 0.02;
const NET_SEGMENTS = 16;
const NET_RINGS = 8;
const NET_LENGTH = 0.5;

function Net({ runtime, rimCenter }: { runtime: GameRuntime; rimCenter: [number, number, number] }) {
  const netRef = useRef<THREE.LineSegments>(null);
  const animProgress = useRef(0);
  const animating = useRef(false);
  const previousSwishVersion = useRef(0);
  const basePositions = useRef<Float32Array | null>(null);
  const isPerfectRef = useRef(false);
  const materialRef = useRef<THREE.LineBasicMaterial | null>(null);

  const lineSegments = useMemo(() => {
    const positions: number[] = [];
    const [cx, cy, cz] = rimCenter;

    for (let seg = 0; seg < NET_SEGMENTS; seg++) {
      const angle = (seg / NET_SEGMENTS) * Math.PI * 2;
      const nextAngle = ((seg + 1) / NET_SEGMENTS) * Math.PI * 2;

      for (let ring = 0; ring < NET_RINGS; ring++) {
        const t0 = ring / NET_RINGS;
        const t1 = (ring + 1) / NET_RINGS;
        const shrink0 = 1 - t0 * 0.45;
        const shrink1 = 1 - t1 * 0.45;

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
    const mat = new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8 });
    return new THREE.LineSegments(geom, mat);
  }, [rimCenter]);

  useEffect(() => {
    materialRef.current = lineSegments.material as THREE.LineBasicMaterial;
    const posAttr = lineSegments.geometry.getAttribute('position');
    if (posAttr) {
      basePositions.current = Float32Array.from(posAttr.array);
    }

    return () => {
      lineSegments.geometry.dispose();
      (lineSegments.material as THREE.Material).dispose();
      materialRef.current = null;
      basePositions.current = null;
    };
  }, [lineSegments]);

  useFrame((_, delta) => {
    const snapshot = runtime.getRenderState();

    if (snapshot.netSwishVersion !== previousSwishVersion.current) {
      previousSwishVersion.current = snapshot.netSwishVersion;
      animating.current = true;
      animProgress.current = 0;
      isPerfectRef.current = snapshot.latestSwishPerfect;
    }

    if (!animating.current) return;
    animProgress.current += delta * (isPerfectRef.current ? 1.8 : 3);

    const posAttr = lineSegments.geometry.getAttribute('position');
    const base = basePositions.current;
    const mat = materialRef.current;

    if (posAttr && base) {
      const t = animProgress.current;
      const decay = Math.exp(-t * 2.5);
      const intensity = isPerfectRef.current ? 0.14 : 0.06;

      for (let i = 0; i < posAttr.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
        const ringDepth = (rimCenter[1] - by) / NET_LENGTH;
        const push = Math.sin(t * Math.PI * 3 - ringDepth * 2) * intensity * decay * (0.5 + ringDepth);
        const splay = Math.sin(t * Math.PI * 4 - ringDepth * 3) * intensity * 0.5 * decay * ringDepth;
        const rx = bx - rimCenter[0], rz = bz - rimCenter[2];
        const rl = Math.sqrt(rx * rx + rz * rz) || 1;
        posAttr.setX(i, bx + (rx / rl) * splay);
        posAttr.setY(i, by - push);
        posAttr.setZ(i, bz + (rz / rl) * splay);
      }
      posAttr.needsUpdate = true;
    }

    if (isPerfectRef.current && mat) {
      const glow = Math.sin(animProgress.current * Math.PI * 4) * 0.3 + 0.7;
      mat.color.setRGB(glow, 1, glow);
    }

    if (animProgress.current >= 1 && mat) {
      animating.current = false;
      mat.color.setHex(0xeeeeee);
      mat.opacity = 0.8;
    }
  });

  return <primitive ref={netRef} object={lineSegments} />;
}

export function Hoop({ runtime, position = [0, 3.05, -13] }: HoopProps) {
  const [px, py, pz] = position;
  const backboardY = py + 0.2;
  const rimY = py;
  const rimZ = pz + 0.3;

  return (
    <group>
      {/* Main support pole */}
      <mesh position={[px, py / 2, pz - 0.35]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, py, 12]} />
        <meshStandardMaterial color="#707070" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Pole base plate */}
      <mesh position={[px, 0.02, pz - 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 12]} />
        <meshStandardMaterial color="#505050" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Backboard frame */}
      <mesh position={[px, backboardY, pz - 0.07]} castShadow>
        <boxGeometry args={[1.85, 1.1, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Backboard glass */}
      <mesh position={[px, backboardY, pz - 0.03]}>
        <boxGeometry args={[1.8, 1.05, 0.02]} />
        <meshPhysicalMaterial
          color="#d0e8f0"
          transparent
          opacity={0.35}
          roughness={0.05}
          metalness={0.02}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      {/* Backboard target square (shooter's square) */}
      <mesh position={[px, backboardY + 0.08, pz - 0.015]}>
        <boxGeometry args={[0.6, 0.45, 0.003]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
      </mesh>
      {/* Target square border */}
      {[
        [0, 0.225, 0.6, 0.02], [0, -0.225, 0.6, 0.02],
        [-0.3, 0, 0.02, 0.45], [0.3, 0, 0.02, 0.45],
      ].map(([ox, oy, w, h], i) => (
        <mesh key={i} position={[px + ox, backboardY + 0.08 + oy, pz - 0.012]}>
          <boxGeometry args={[w, h, 0.003]} />
          <meshBasicMaterial color="#ff2200" transparent opacity={0.8} />
        </mesh>
      ))}

      {/* Rim bracket arm */}
      <mesh position={[px, rimY - 0.01, pz + 0.14]} castShadow>
        <boxGeometry args={[0.06, 0.03, 0.35]} />
        <meshStandardMaterial color="#555555" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Bracket gusset */}
      <mesh position={[px, rimY + 0.01, pz + 0.02]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.04, 0.08, 0.08]} />
        <meshStandardMaterial color="#555555" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Rim — thicker, more metallic */}
      <mesh position={[px, rimY, rimZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[RIM_RADIUS, RIM_TUBE, 16, 36]} />
        <meshStandardMaterial color="#ff3300" metalness={0.8} roughness={0.15} />
      </mesh>

      {/* Rim hooks (where net attaches) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[
            px + Math.cos(angle) * (RIM_RADIUS + 0.01),
            rimY - 0.025,
            rimZ + Math.sin(angle) * (RIM_RADIUS + 0.01),
          ]}>
            <sphereGeometry args={[0.008, 4, 4]} />
            <meshStandardMaterial color="#cc2200" metalness={0.7} roughness={0.3} />
          </mesh>
        );
      })}

      <Net runtime={runtime} rimCenter={[px, rimY - RIM_TUBE, rimZ]} />
    </group>
  );
}
