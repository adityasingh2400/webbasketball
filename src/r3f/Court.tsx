import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

const COURT_WIDTH = 15;
const COURT_HALF_LENGTH = 14;
const LINE_Y = 0.015;
const PAINT_Y = 0.008;
const HOOP_Z = -13;

const LINE_COLOR = '#ffffff';
const PAINT_COLOR = '#a04020';

function createHardwoodTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c08050';
  ctx.fillRect(0, 0, w, h);

  const plankCount = 10;
  const plankW = w / plankCount;
  const tones = ['#c48850', '#b87840', '#d09858', '#be8048', '#ca9050',
                 '#b47038', '#cc8c4c', '#c08448', '#d49c5c', '#ba7c44'];

  for (let i = 0; i < plankCount; i++) {
    const x = i * plankW;
    ctx.fillStyle = tones[i % tones.length];
    ctx.fillRect(x, 0, plankW, h);

    ctx.strokeStyle = 'rgba(60, 30, 10, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();

    for (let g = 0; g < 20; g++) {
      ctx.strokeStyle = `rgba(80, 40, 10, ${0.03 + Math.random() * 0.04})`;
      ctx.lineWidth = 0.5 + Math.random();
      const gx = x + Math.random() * plankW;
      const gy = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (Math.random() - 0.5) * 4, gy + 30 + Math.random() * 80);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function CourtFloor() {
  const texture = useMemo(() => createHardwoodTexture(), []);

  useEffect(() => {
    return () => { texture.dispose(); };
  }, [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -COURT_HALF_LENGTH / 2]} receiveShadow>
      <planeGeometry args={[COURT_WIDTH + 2, COURT_HALF_LENGTH + 4]} />
      <meshStandardMaterial map={texture} roughness={0.7} metalness={0.02} />
    </mesh>
  );
}

function Boundary() {
  const hw = COURT_WIDTH / 2;
  const points = useMemo(() => [
    new THREE.Vector3(-hw, LINE_Y, 0),
    new THREE.Vector3(-hw, LINE_Y, -COURT_HALF_LENGTH),
    new THREE.Vector3(hw, LINE_Y, -COURT_HALF_LENGTH),
    new THREE.Vector3(hw, LINE_Y, 0),
    new THREE.Vector3(-hw, LINE_Y, 0),
  ], [hw]);

  return <Line points={points} color={LINE_COLOR} lineWidth={2} />;
}

function HalfCourtLine() {
  const hw = COURT_WIDTH / 2;
  return (
    <Line
      points={[new THREE.Vector3(-hw, LINE_Y, 0), new THREE.Vector3(hw, LINE_Y, 0)]}
      color={LINE_COLOR}
      lineWidth={2}
    />
  );
}

function CenterCircle() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 48;
    const radius = 1.8;
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + (i / segments) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, LINE_Y, Math.sin(angle) * radius));
    }
    return pts;
  }, []);

  return <Line points={points} color={LINE_COLOR} lineWidth={2} />;
}

function Paint() {
  const paintW = 4.88;
  const paintD = 5.79;
  const hw = paintW / 2;
  const paintStartZ = HOOP_Z + 1.22;
  const paintEndZ = paintStartZ + paintD;

  const outline = useMemo(() => [
    new THREE.Vector3(-hw, LINE_Y, paintStartZ),
    new THREE.Vector3(-hw, LINE_Y, paintEndZ),
    new THREE.Vector3(hw, LINE_Y, paintEndZ),
    new THREE.Vector3(hw, LINE_Y, paintStartZ),
  ], [hw, paintEndZ, paintStartZ]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PAINT_Y, paintStartZ + paintD / 2]}>
        <planeGeometry args={[paintW, paintD]} />
        <meshStandardMaterial color={PAINT_COLOR} roughness={0.8} transparent opacity={0.25} />
      </mesh>
      <Line points={outline} color={LINE_COLOR} lineWidth={2} />
    </group>
  );
}

function FreeThrowCircle() {
  const paintStartZ = HOOP_Z + 1.22;
  const ftZ = paintStartZ + 5.79;

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 48;
    const radius = 1.8;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, LINE_Y, ftZ + Math.sin(angle) * radius));
    }
    return pts;
  }, [ftZ]);

  return <Line points={points} color={LINE_COLOR} lineWidth={1.5} />;
}

function ThreePointArc() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const radius = 8.5;
    const segments = 80;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      const x = -Math.cos(angle) * radius;
      const z = HOOP_Z + Math.sin(angle) * radius;
      pts.push(new THREE.Vector3(x, LINE_Y, z));
    }

    return pts;
  }, []);

  return <Line points={points} color={LINE_COLOR} lineWidth={2} />;
}

export function Court() {
  return (
    <group>
      <CourtFloor />
      <Boundary />
      <HalfCourtLine />
      <CenterCircle />
      <Paint />
      <FreeThrowCircle />
      <ThreePointArc />
    </group>
  );
}
