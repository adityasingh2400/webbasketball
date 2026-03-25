import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

const COURT_WIDTH = 15;
const COURT_LENGTH = 28;
const LINE_WIDTH = 0.08;

const COLORS = {
  floor: '#e8d4b8',
  lines: '#ffffff',
  paint: '#4a90d9',
  threePointArc: '#ffffff',
};

function CourtLines() {
  const lineGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    
    const hw = COURT_WIDTH / 2;
    const hl = COURT_LENGTH / 2;
    
    shape.moveTo(-hw, -hl);
    shape.lineTo(hw, -hl);
    shape.lineTo(hw, hl);
    shape.lineTo(-hw, hl);
    shape.closePath();
    
    const hole = new THREE.Path();
    hole.moveTo(-hw + LINE_WIDTH, -hl + LINE_WIDTH);
    hole.lineTo(hw - LINE_WIDTH, -hl + LINE_WIDTH);
    hole.lineTo(hw - LINE_WIDTH, hl - LINE_WIDTH);
    hole.lineTo(-hw + LINE_WIDTH, hl - LINE_WIDTH);
    hole.closePath();
    shape.holes.push(hole);
    
    return new THREE.ShapeGeometry(shape);
  }, []);

  const centerCirclePoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const radius = 1.8;
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      points.push([
        Math.cos(angle) * radius,
        0.01,
        Math.sin(angle) * radius
      ]);
    }
    return points;
  }, []);

  const halfCourtLinePoints = useMemo(() => {
    const hw = COURT_WIDTH / 2;
    return [
      [-hw, 0.01, 0] as [number, number, number],
      [hw, 0.01, 0] as [number, number, number],
    ];
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <primitive object={lineGeometry} attach="geometry" />
        <meshStandardMaterial color={COLORS.lines} />
      </mesh>
      
      <Line points={centerCirclePoints} color={COLORS.lines} lineWidth={2} />
      <Line points={halfCourtLinePoints} color={COLORS.lines} lineWidth={2} />
    </group>
  );
}

function Paint({ side }: { side: 1 | -1 }) {
  const paintWidth = 4.9;
  const paintLength = 5.8;
  const zOffset = side * (COURT_LENGTH / 2 - paintLength / 2);

  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, 0.003, zOffset]}
    >
      <planeGeometry args={[paintWidth, paintLength]} />
      <meshStandardMaterial color={COLORS.paint} transparent opacity={0.8} />
    </mesh>
  );
}

function ThreePointArc({ side }: { side: 1 | -1 }) {
  const arcPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const radius = 6.75;
    const startAngle = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    const arcLength = Math.PI;
    
    for (let i = 0; i <= 32; i++) {
      const angle = startAngle + (i / 32) * arcLength;
      const zBase = side * (COURT_LENGTH / 2 - 1.575);
      points.push([
        Math.cos(angle) * radius,
        0.01,
        zBase + Math.sin(angle) * radius * side * -1
      ]);
    }
    
    return points;
  }, [side]);

  return <Line points={arcPoints} color={COLORS.threePointArc} lineWidth={2} />;
}

function FreeThrowCircle({ side }: { side: 1 | -1 }) {
  const circlePoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const radius = 1.8;
    const zCenter = side * (COURT_LENGTH / 2 - 5.8);
    
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      points.push([
        Math.cos(angle) * radius,
        0.01,
        zCenter + Math.sin(angle) * radius
      ]);
    }
    
    return points;
  }, [side]);

  return <Line points={circlePoints} color={COLORS.lines} lineWidth={2} />;
}

export default function Court() {
  return (
    <group>
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[COURT_WIDTH + 2, COURT_LENGTH + 2]} />
        <meshStandardMaterial color={COLORS.floor} />
      </mesh>
      
      <CourtLines />
      
      <Paint side={1} />
      <Paint side={-1} />
      
      <ThreePointArc side={1} />
      <ThreePointArc side={-1} />
      
      <FreeThrowCircle side={1} />
      <FreeThrowCircle side={-1} />
    </group>
  );
}
