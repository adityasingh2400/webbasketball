import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

const COURT_WIDTH = 15;
const COURT_HALF_LENGTH = 14;
const LINE_Y = 0.01;
const PAINT_Y = 0.005;

const FLOOR_COLOR = '#c8956c';
const LINE_COLOR = '#ffffff';
const PAINT_COLOR = '#b85c3a';
const BOUNDARY_COLOR = '#2a2a2a';

function CourtFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -COURT_HALF_LENGTH / 2]} receiveShadow>
      <planeGeometry args={[COURT_WIDTH + 2, COURT_HALF_LENGTH + 4]} />
      <meshStandardMaterial color={FLOOR_COLOR} roughness={0.85} metalness={0.02} />
    </mesh>
  );
}

function Boundary() {
  const points = useMemo(() => {
    const hw = COURT_WIDTH / 2;
    return [
      new THREE.Vector3(-hw, LINE_Y, 0),
      new THREE.Vector3(-hw, LINE_Y, -COURT_HALF_LENGTH),
      new THREE.Vector3(hw, LINE_Y, -COURT_HALF_LENGTH),
      new THREE.Vector3(hw, LINE_Y, 0),
      new THREE.Vector3(-hw, LINE_Y, 0),
    ];
  }, []);

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
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        LINE_Y,
        Math.sin(angle) * radius,
      ));
    }
    return pts;
  }, []);

  return <Line points={points} color={LINE_COLOR} lineWidth={2} />;
}

function Paint() {
  const paintWidth = 4.88;
  const paintDepth = 5.79;
  const hw = paintWidth / 2;

  const outline = useMemo(() => [
    new THREE.Vector3(-hw, LINE_Y, 0),
    new THREE.Vector3(-hw, LINE_Y, -paintDepth),
    new THREE.Vector3(hw, LINE_Y, -paintDepth),
    new THREE.Vector3(hw, LINE_Y, 0),
  ], []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PAINT_Y, -paintDepth / 2]}>
        <planeGeometry args={[paintWidth, paintDepth]} />
        <meshStandardMaterial color={PAINT_COLOR} roughness={0.8} transparent opacity={0.3} />
      </mesh>
      <Line points={outline} color={LINE_COLOR} lineWidth={2} />
    </group>
  );
}

function FreeThrowCircle() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 48;
    const radius = 1.8;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        LINE_Y,
        -5.79 + Math.sin(angle) * radius,
      ));
    }
    return pts;
  }, []);

  return <Line points={points} color={LINE_COLOR} lineWidth={1.5} />;
}

function ThreePointArc() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const radius = 6.75;
    const segments = 48;
    const baseline = -COURT_HALF_LENGTH;
    const hoopZ = -13;

    pts.push(new THREE.Vector3(-COURT_WIDTH / 2, LINE_Y, Math.max(baseline, hoopZ + 0.5)));

    const startAngle = Math.acos(Math.min(1, (COURT_WIDTH / 2) / radius));
    const endAngle = Math.PI - startAngle;

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * (endAngle - startAngle);
      const x = Math.cos(angle) * radius;
      const z = hoopZ + Math.sin(angle) * radius;
      if (z <= 0) {
        pts.push(new THREE.Vector3(-x, LINE_Y, z));
      }
    }

    pts.push(new THREE.Vector3(COURT_WIDTH / 2, LINE_Y, Math.max(baseline, hoopZ + 0.5)));

    return pts;
  }, []);

  return <Line points={points} color={LINE_COLOR} lineWidth={2} />;
}

function FloorSurround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -COURT_HALF_LENGTH / 2]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color={BOUNDARY_COLOR} roughness={0.95} />
    </mesh>
  );
}

export function Court() {
  return (
    <group>
      <FloorSurround />
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
