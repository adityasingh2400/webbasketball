import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlayerProps {
  position: [number, number, number];
  visible?: boolean;
  animationState?: 'idle' | 'dribbling' | 'gathering' | 'shooting';
}

const SKIN_COLOR = '#f5c6a0';
const JERSEY_COLOR = '#2563eb';
const SHORTS_COLOR = '#1e40af';
const SHOE_COLOR = '#1a1a2e';
const HAIR_COLOR = '#3b2f20';

export function Player({ position, visible = true, animationState = 'idle' }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const animPhase = useRef(0);

  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  }), []);

  useFrame((_, delta) => {
    if (!groupRef.current || !visible) return;
    animPhase.current += delta;
    const t = animPhase.current;

    groupRef.current.position.set(...position);

    const body = bodyRef.current;
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const head = headRef.current;
    if (!body || !lArm || !rArm || !lLeg || !rLeg || !head) return;

    body.position.y = 0;
    body.rotation.x = 0;
    lArm.rotation.x = 0;
    rArm.rotation.x = 0;
    lLeg.rotation.x = 0;
    rLeg.rotation.x = 0;
    head.position.y = 1.55;

    switch (animationState) {
      case 'dribbling': {
        const bounce = Math.abs(Math.sin(t * 6)) * 0.04;
        body.position.y = -0.05 + bounce;
        head.position.y = 1.55 - 0.05 + bounce;
        rArm.rotation.x = Math.sin(t * 12) * 0.4 - 0.3;
        lArm.rotation.x = Math.sin(t * 3) * 0.1;
        lLeg.rotation.x = Math.sin(t * 6) * 0.05;
        rLeg.rotation.x = -Math.sin(t * 6) * 0.05;
        break;
      }
      case 'gathering': {
        body.position.y = -0.08;
        body.rotation.x = -0.12;
        head.position.y = 1.55 - 0.08;
        rArm.rotation.x = -1.2 - Math.sin(t * 2) * 0.1;
        lArm.rotation.x = -0.8 - Math.sin(t * 2) * 0.1;
        lLeg.rotation.x = 0.15;
        rLeg.rotation.x = 0.15;
        break;
      }
      case 'shooting': {
        const shootProgress = Math.min(1, (t % 2) * 3);
        body.position.y = 0.05 + shootProgress * 0.1;
        body.rotation.x = 0.05;
        head.position.y = 1.55 + 0.05 + shootProgress * 0.1;
        rArm.rotation.x = -2.5 + shootProgress * 0.3;
        lArm.rotation.x = -0.4;
        lLeg.rotation.x = -0.1;
        rLeg.rotation.x = -0.1;
        break;
      }
      default: {
        const breathe = Math.sin(t * 1.5) * 0.01;
        body.position.y = breathe;
        head.position.y = 1.55 + breathe;
        lArm.rotation.x = Math.sin(t * 1.5) * 0.03;
        rArm.rotation.x = -Math.sin(t * 1.5) * 0.03;
      }
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        {/* Torso */}
        <mesh position={[0, 1.05, 0]} castShadow>
          <boxGeometry args={[0.4, 0.5, 0.22]} />
          <meshStandardMaterial color={JERSEY_COLOR} roughness={0.7} />
        </mesh>

        {/* Shorts */}
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[0.38, 0.2, 0.21]} />
          <meshStandardMaterial color={SHORTS_COLOR} roughness={0.8} />
        </mesh>

        {/* Head */}
        <mesh ref={headRef} position={[0, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
        </mesh>

        {/* Hair */}
        <mesh position={[0, 1.65, -0.02]}>
          <sphereGeometry args={[0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color={HAIR_COLOR} roughness={0.9} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.04, 1.56, 0.12]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.04, 1.56, 0.12]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.28, 1.2, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <capsuleGeometry args={[0.05, 0.25, 4, 8]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.38, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
          </mesh>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.28, 1.2, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <capsuleGeometry args={[0.05, 0.25, 4, 8]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.38, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
          </mesh>
        </group>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.1, 0.6, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.42, 0.03]}>
            <boxGeometry args={[0.1, 0.08, 0.16]} />
            <meshStandardMaterial color={SHOE_COLOR} roughness={0.5} />
          </mesh>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.1, 0.6, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.42, 0.03]}>
            <boxGeometry args={[0.1, 0.08, 0.16]} />
            <meshStandardMaterial color={SHOE_COLOR} roughness={0.5} />
          </mesh>
        </group>

        {/* Jersey number */}
        <mesh position={[0, 1.08, 0.115]}>
          <planeGeometry args={[0.12, 0.12]} />
          <meshBasicMaterial color="white" transparent opacity={0.9} />
        </mesh>
      </group>

      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} material={shadowMat}>
        <circleGeometry args={[0.4, 24]} />
      </mesh>
    </group>
  );
}
