import { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface HoopProps {
  position?: [number, number, number];
}

const RIM_RADIUS = 0.23;
const RIM_TUBE = 0.02;
const BACKBOARD_WIDTH = 1.8;
const BACKBOARD_HEIGHT = 1.05;
const POLE_HEIGHT = 3.05;
const POLE_RADIUS = 0.08;

const COLORS = {
  rim: '#ff4500',
  backboard: '#ffffff',
  backboardBorder: '#1a1a1a',
  pole: '#888888',
  net: '#ffffff',
};

function Net({ position }: { position: [number, number, number] }) {
  const lineSegmentsRef = useRef<THREE.LineSegments>(null);
  
  const netGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 12;
    const rings = 6;
    const topRadius = RIM_RADIUS - 0.02;
    const bottomRadius = RIM_RADIUS * 0.6;
    const netDepth = 0.4;

    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings;
      const radius = topRadius + (bottomRadius - topRadius) * t;
      const y = -t * netDepth;
      
      for (let seg = 0; seg < segments; seg++) {
        const angle = (seg / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          position[0] + Math.cos(angle) * radius,
          position[1] + y,
          position[2] + Math.sin(angle) * radius
        ));
      }
    }

    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    
    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const current = ring * segments + seg;
        const below = (ring + 1) * segments + seg;
        
        const p1 = points[current];
        const p2 = points[below];
        vertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, [position]);

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({ 
      color: COLORS.net, 
      transparent: true, 
      opacity: 0.8 
    });
  }, []);

  return (
    <primitive 
      ref={lineSegmentsRef}
      object={new THREE.LineSegments(netGeometry, material)} 
    />
  );
}

export default function Hoop({ position = [0, POLE_HEIGHT, -13] }: HoopProps) {
  return (
    <group position={position}>
      <mesh position={[0, -POLE_HEIGHT / 2, -0.6]} castShadow>
        <cylinderGeometry args={[POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, 16]} />
        <meshStandardMaterial color={COLORS.pole} metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[BACKBOARD_WIDTH, BACKBOARD_HEIGHT, 0.05]} />
        <meshStandardMaterial color={COLORS.backboard} transparent opacity={0.9} />
      </mesh>

      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[BACKBOARD_WIDTH + 0.02, BACKBOARD_HEIGHT + 0.02, 0.01]} />
        <meshStandardMaterial color={COLORS.backboardBorder} />
      </mesh>

      <mesh position={[0, -0.2, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RIM_RADIUS, RIM_TUBE, 16, 32]} />
        <meshStandardMaterial color={COLORS.rim} metalness={0.8} roughness={0.3} />
      </mesh>

      <Net position={[0, -0.2, 0.15]} />
    </group>
  );
}
