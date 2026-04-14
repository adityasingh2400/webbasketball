import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';
import { METAL_TOON, RIM_RED_TOON, ENV_TOON } from './toonMaterial';

interface HoopProps {
  runtime: GameRuntime;
  position?: [number, number, number];
}

const RIM_RADIUS = 0.23;
const RIM_TUBE = 0.02;
const NET_SEGMENTS = 16;
const NET_RINGS = 8;
const NET_LEVELS = NET_RINGS + 1;
const NET_LENGTH = 0.5;
const NET_VERTICAL_SPRING = 72;
const NET_VERTICAL_DAMPING = 13;
const NET_RADIAL_SPRING = 44;
const NET_RADIAL_DAMPING = 10;
const NET_TWIST_SPRING = 26;
const NET_TWIST_DAMPING = 7;
const NET_NEIGHBOR_COUPLING = 24;
const NET_MAX_STEP = 1 / 60;
const NET_SETTLE_OFFSET_EPSILON = 0.0012;
const NET_SETTLE_VELOCITY_EPSILON = 0.018;
const BACKBOARD_WIDTH = 1.83;
const BACKBOARD_HEIGHT = 1.07;
const BACKBOARD_GLASS_THICKNESS = 0.028;
const BACKBOARD_FRAME_DEPTH = 0.07;
const BACKBOARD_TRIM_WIDTH = 0.055;
const BACKBOARD_CENTER_Y_OFFSET = 0.225;
const BACKBOARD_FRONT_Z_OFFSET = -0.05;
const TARGET_BOX_WIDTH = 0.61;
const TARGET_BOX_HEIGHT = 0.457;
const TARGET_BOX_BOTTOM_OFFSET = 0.46;
const BACKBOARD_PADDING_HEIGHT = 0.09;
const BACKBOARD_PADDING_WIDTH = 0.1;
const BACKBOARD_PADDING_DEPTH = 0.075;

function createBackboardMarkingsTexture(): THREE.CanvasTexture {
  const width = 1536;
  const height = Math.round(width * (BACKBOARD_HEIGHT / BACKBOARD_WIDTH));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  const borderLineWidth = Math.round(width * (0.0508 / BACKBOARD_WIDTH));
  const targetLineWidth = Math.max(10, Math.round(borderLineWidth * 0.9));
  const targetWidth = Math.round(width * (TARGET_BOX_WIDTH / BACKBOARD_WIDTH));
  const targetHeight = Math.round(height * (TARGET_BOX_HEIGHT / BACKBOARD_HEIGHT));
  const targetBottom = Math.round(height * (TARGET_BOX_BOTTOM_OFFSET / BACKBOARD_HEIGHT));
  const targetX = Math.round((width - targetWidth) / 2);
  const targetY = Math.round(height - targetBottom - targetHeight);

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.22)';
  ctx.shadowBlur = borderLineWidth * 0.65;

  ctx.lineWidth = borderLineWidth;
  ctx.strokeRect(
    borderLineWidth / 2,
    borderLineWidth / 2,
    width - borderLineWidth,
    height - borderLineWidth,
  );

  ctx.lineWidth = targetLineWidth;
  ctx.strokeRect(
    targetX + targetLineWidth / 2,
    targetY + targetLineWidth / 2,
    targetWidth - targetLineWidth,
    targetHeight - targetLineWidth,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createBackboardGlareTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = Math.round(width * (BACKBOARD_HEIGHT / BACKBOARD_WIDTH));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  ctx.clearRect(0, 0, width, height);

  const softWash = ctx.createLinearGradient(0, 0, width, height);
  softWash.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  softWash.addColorStop(0.24, 'rgba(182, 228, 255, 0.12)');
  softWash.addColorStop(0.55, 'rgba(255, 255, 255, 0.03)');
  softWash.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = softWash;
  ctx.fillRect(0, 0, width, height);

  const highlight = ctx.createRadialGradient(width * 0.28, height * 0.22, 0, width * 0.28, height * 0.22, width * 0.42);
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  highlight.addColorStop(0.35, 'rgba(220, 244, 255, 0.12)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width * 0.72, height * 0.5);
  ctx.rotate(-0.34);
  const streak = ctx.createLinearGradient(-width * 0.22, 0, width * 0.22, 0);
  streak.addColorStop(0, 'rgba(255, 255, 255, 0)');
  streak.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)');
  streak.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  streak.addColorStop(0.55, 'rgba(255, 255, 255, 0.06)');
  streak.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = streak;
  ctx.fillRect(-width * 0.24, -height * 0.7, width * 0.48, height * 1.4);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function Net({ runtime, rimCenter }: { runtime: GameRuntime; rimCenter: [number, number, number] }) {
  const netRef = useRef<THREE.LineSegments>(null);
  const previousSwishVersion = useRef(0);
  const basePositions = useRef<Float32Array | null>(null);
  const isPerfectRef = useRef(false);
  const materialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const simulationActive = useRef(false);
  const verticalOffsets = useRef<Float32Array>(new Float32Array(NET_LEVELS));
  const verticalVelocities = useRef<Float32Array>(new Float32Array(NET_LEVELS));
  const radialOffsets = useRef<Float32Array>(new Float32Array(NET_LEVELS));
  const radialVelocities = useRef<Float32Array>(new Float32Array(NET_LEVELS));
  const twistOffsets = useRef<Float32Array>(new Float32Array(NET_LEVELS));
  const twistVelocities = useRef<Float32Array>(new Float32Array(NET_LEVELS));
  const targetGlow = useRef(0);
  const currentGlow = useRef(0);
  const swishPulse = useRef({
    active: false,
    progress: 0,
    intensity: 0,
    speed: 0,
    swirl: 0,
  });

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

  const settleNet = (positions?: Float32Array, base?: Float32Array) => {
    verticalOffsets.current.fill(0);
    verticalVelocities.current.fill(0);
    radialOffsets.current.fill(0);
    radialVelocities.current.fill(0);
    twistOffsets.current.fill(0);
    twistVelocities.current.fill(0);
    swishPulse.current.active = false;
    swishPulse.current.progress = 0;
    swishPulse.current.intensity = 0;
    swishPulse.current.speed = 0;
    swishPulse.current.swirl = 0;
    targetGlow.current = 0;
    currentGlow.current = 0;
    simulationActive.current = false;

    if (positions && base) {
      positions.set(base);
    }
  };

  const triggerSwish = (perfect: boolean, version: number) => {
    isPerfectRef.current = perfect;
    simulationActive.current = true;
    targetGlow.current = perfect ? 1 : 0.42;
    swishPulse.current.active = true;
    swishPulse.current.progress = 0;
    swishPulse.current.intensity = perfect ? 1 : 0.82;
    swishPulse.current.speed = perfect ? 2.15 : 2.45;
    swishPulse.current.swirl = (version % 2 === 0 ? 1 : -1) * (perfect ? 0.18 : 0.12);

    for (let level = 1; level < NET_LEVELS; level += 1) {
      const t = level / NET_RINGS;
      const profile = Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.92);
      const downwardKick = (0.42 + t * 0.82) * profile;
      const radialKick = 0.08 + t * 0.22;
      const twistKick = 0.02 + t * 0.06;
      const intensity = perfect ? 1 : 0.78;

      verticalVelocities.current[level] -= downwardKick * intensity;
      radialVelocities.current[level] += radialKick * intensity;
      twistVelocities.current[level] += swishPulse.current.swirl * twistKick * intensity;
    }
  };

  useFrame((_, delta) => {
    const snapshot = runtime.getRenderState();
    const posAttr = lineSegments.geometry.getAttribute('position');
    const base = basePositions.current;
    const mat = materialRef.current;

    if (!posAttr || !base) return;
    const positions = posAttr.array as Float32Array;

    if (snapshot.netSwishVersion !== previousSwishVersion.current) {
      previousSwishVersion.current = snapshot.netSwishVersion;
      triggerSwish(snapshot.latestSwishPerfect, snapshot.netSwishVersion);
    }

    const frameDt = Math.min(delta, 0.05);

    if (!simulationActive.current && targetGlow.current < 0.001 && currentGlow.current < 0.001) {
      return;
    }

    let remaining = frameDt;
    while (remaining > 0) {
      const step = Math.min(remaining, NET_MAX_STEP);
      remaining -= step;

      targetGlow.current *= Math.exp(-step * 4.2);

      if (swishPulse.current.active) {
        swishPulse.current.progress += step * swishPulse.current.speed;
        swishPulse.current.intensity *= Math.exp(-step * 1.7);
        if (swishPulse.current.progress > 1.32 && swishPulse.current.intensity < 0.025) {
          swishPulse.current.active = false;
        }
      }

      verticalOffsets.current[0] = 0;
      verticalVelocities.current[0] = 0;
      radialOffsets.current[0] = 0;
      radialVelocities.current[0] = 0;
      twistOffsets.current[0] = 0;
      twistVelocities.current[0] = 0;

      for (let level = 1; level < NET_LEVELS; level += 1) {
        const t = level / NET_RINGS;
        const prev = level > 1 ? level - 1 : 0;
        const next = level < NET_RINGS ? level + 1 : level;
        const bottomScale = 1 - t * 0.22;

        const verticalCoupling = (
          verticalOffsets.current[prev] +
          verticalOffsets.current[next] -
          verticalOffsets.current[level] * 2
        ) * NET_NEIGHBOR_COUPLING;
        const radialCoupling = (
          radialOffsets.current[prev] +
          radialOffsets.current[next] -
          radialOffsets.current[level] * 2
        ) * (NET_NEIGHBOR_COUPLING * 0.72);
        const twistCoupling = (
          twistOffsets.current[prev] +
          twistOffsets.current[next] -
          twistOffsets.current[level] * 2
        ) * (NET_NEIGHBOR_COUPLING * 0.38);

        const verticalSpring = THREE.MathUtils.lerp(NET_VERTICAL_SPRING * 1.12, NET_VERTICAL_SPRING * 0.76, t);
        const radialSpring = THREE.MathUtils.lerp(NET_RADIAL_SPRING * 1.08, NET_RADIAL_SPRING * 0.82, t);
        const twistSpring = THREE.MathUtils.lerp(NET_TWIST_SPRING * 1.06, NET_TWIST_SPRING * 0.74, t);

        const verticalAccel =
          -verticalOffsets.current[level] * verticalSpring -
          verticalVelocities.current[level] * NET_VERTICAL_DAMPING +
          verticalCoupling;
        const radialAccel =
          -radialOffsets.current[level] * radialSpring -
          radialVelocities.current[level] * NET_RADIAL_DAMPING +
          radialCoupling;
        const twistAccel =
          -twistOffsets.current[level] * twistSpring -
          twistVelocities.current[level] * NET_TWIST_DAMPING +
          twistCoupling;

        verticalVelocities.current[level] += verticalAccel * step;
        radialVelocities.current[level] += radialAccel * step;
        twistVelocities.current[level] += twistAccel * step;

        verticalOffsets.current[level] += verticalVelocities.current[level] * step;
        radialOffsets.current[level] += radialVelocities.current[level] * step;
        twistOffsets.current[level] += twistVelocities.current[level] * step;

        verticalOffsets.current[level] = THREE.MathUtils.clamp(verticalOffsets.current[level], -0.22 * bottomScale, 0.04);
        radialOffsets.current[level] = THREE.MathUtils.clamp(radialOffsets.current[level], -0.03, 0.12 * bottomScale);
        twistOffsets.current[level] = THREE.MathUtils.clamp(twistOffsets.current[level], -0.16 * bottomScale, 0.16 * bottomScale);
      }
    }

    let maxOffset = 0;
    for (let i = 0; i < posAttr.count; i += 1) {
      const index = i * 3;
      const bx = base[index];
      const by = base[index + 1];
      const bz = base[index + 2];
      const ringDepth = THREE.MathUtils.clamp((rimCenter[1] - by) / NET_LENGTH, 0, 1);
      const ringFloat = ringDepth * NET_RINGS;
      const lower = Math.floor(ringFloat);
      const upper = Math.min(NET_RINGS, lower + 1);
      const blend = ringFloat - lower;

      const verticalOffset = THREE.MathUtils.lerp(verticalOffsets.current[lower], verticalOffsets.current[upper], blend);
      const radialOffset = THREE.MathUtils.lerp(radialOffsets.current[lower], radialOffsets.current[upper], blend);
      const twistOffset = THREE.MathUtils.lerp(twistOffsets.current[lower], twistOffsets.current[upper], blend);

      const rx = bx - rimCenter[0];
      const rz = bz - rimCenter[2];
      const radius = Math.sqrt(rx * rx + rz * rz) || 1;
      const dirX = rx / radius;
      const dirZ = rz / radius;
      const tangentX = -dirZ;
      const tangentZ = dirX;

      let pulseDown = 0;
      let pulseSplay = 0;
      let pulseTwist = 0;
      if (swishPulse.current.active) {
        const pulseDistance = ringDepth - swishPulse.current.progress;
        const pulseEnvelope = Math.exp(-(pulseDistance * pulseDistance) / 0.028) * swishPulse.current.intensity;
        pulseDown = pulseEnvelope * (0.082 + ringDepth * 0.085);
        pulseSplay = pulseEnvelope * (0.026 + ringDepth * 0.05);
        pulseTwist = pulseEnvelope * swishPulse.current.swirl * (0.018 + ringDepth * 0.024);
      }

      const flutter = swishPulse.current.active
        ? Math.sin(Math.atan2(rz, rx) * 2 + swishPulse.current.progress * 7.5) * swishPulse.current.intensity * 0.004 * ringDepth
        : 0;
      const outward = radialOffset + pulseSplay + flutter;
      const tangential = twistOffset * (0.25 + ringDepth * 0.75) + pulseTwist;

      positions[index] = bx + dirX * outward + tangentX * tangential;
      positions[index + 1] = by + verticalOffset - pulseDown - outward * 0.18;
      positions[index + 2] = bz + dirZ * outward + tangentZ * tangential;

      maxOffset = Math.max(
        maxOffset,
        Math.abs(verticalOffset),
        Math.abs(radialOffset),
        Math.abs(twistOffset),
        Math.abs(pulseDown),
        Math.abs(pulseSplay),
      );
    }
    posAttr.needsUpdate = true;

    currentGlow.current = THREE.MathUtils.damp(currentGlow.current, targetGlow.current, 8, frameDt);
    if (mat) {
      const glow = isPerfectRef.current ? currentGlow.current : currentGlow.current * 0.72;
      mat.opacity = 0.78 + glow * 0.1;
      mat.color.setRGB(
        0.93 + glow * 0.04,
        0.93 + glow * 0.07,
        0.93 + glow * 0.04,
      );
    }

    let maxVelocity = 0;
    for (let level = 1; level < NET_LEVELS; level += 1) {
      maxVelocity = Math.max(
        maxVelocity,
        Math.abs(verticalVelocities.current[level]),
        Math.abs(radialVelocities.current[level]),
        Math.abs(twistVelocities.current[level]),
      );
    }

    if (!swishPulse.current.active && maxOffset < NET_SETTLE_OFFSET_EPSILON && maxVelocity < NET_SETTLE_VELOCITY_EPSILON) {
      settleNet(positions, base);
      posAttr.needsUpdate = true;
      if (mat) {
        mat.color.setHex(0xeeeeee);
        mat.opacity = 0.8;
      }
    }
  });

  return <primitive ref={netRef} object={lineSegments} />;
}

export function Hoop({ runtime, position = [0, 3.05, -13] }: HoopProps) {
  const [px, py, pz] = position;
  const backboardY = py + BACKBOARD_CENTER_Y_OFFSET;
  const rimY = py;
  const rimZ = pz + 0.25;
  const backboardFrontZ = BACKBOARD_FRONT_Z_OFFSET;
  const backboardGlassZ = backboardFrontZ - BACKBOARD_GLASS_THICKNESS / 2;
  const backboardRearZ = backboardFrontZ - BACKBOARD_GLASS_THICKNESS;
  const trimZ = backboardFrontZ - BACKBOARD_FRAME_DEPTH / 2;
  const mountPlateZ = backboardRearZ - 0.085;
  const rimMountPlateZ = backboardFrontZ + 0.014;
  const rimMountPlateWorldZ = pz + rimMountPlateZ;
  const rimArmCenterZ = (rimZ + rimMountPlateWorldZ) / 2;
  const rimArmDepth = rimZ - rimMountPlateWorldZ + 0.03;

  const markingsTexture = useMemo(() => createBackboardMarkingsTexture(), []);
  const glareTexture = useMemo(() => createBackboardGlareTexture(), []);
  const glassEdges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(BACKBOARD_WIDTH, BACKBOARD_HEIGHT, BACKBOARD_GLASS_THICKNESS)),
    [],
  );

  const poleMat = useMemo(() => METAL_TOON('#707070'), []);
  const bracketMat = useMemo(() => METAL_TOON('#5d626a'), []);
  const bracketDarkMat = useMemo(() => METAL_TOON('#464b52'), []);
  const frameMat = useMemo(() => METAL_TOON('#c7ccd3'), []);
  const rimMat = useMemo(() => RIM_RED_TOON(), []);
  const paddingMat = useMemo(() => ENV_TOON('#16191d', { rimIntensity: 0.05 }), []);
  const mountMat = useMemo(() => METAL_TOON('#4b5058'), []);

  useEffect(() => {
    return () => {
      markingsTexture.dispose();
      glareTexture.dispose();
      glassEdges.dispose();
      poleMat.dispose();
      bracketMat.dispose();
      bracketDarkMat.dispose();
      frameMat.dispose();
      rimMat.dispose();
      paddingMat.dispose();
      mountMat.dispose();
    };
  }, [markingsTexture, glareTexture, glassEdges, poleMat, bracketMat, bracketDarkMat, frameMat, rimMat, paddingMat, mountMat]);

  return (
    <group>
      {/* Main support pole */}
      <mesh position={[px, py / 2, pz - 0.35]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, py, 12]} />
        <primitive object={poleMat} attach="material" />
      </mesh>
      {/* Pole base plate */}
      <mesh position={[px, 0.02, pz - 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 12]} />
        <primitive object={poleMat} attach="material" />
      </mesh>

      {/* Arena-style support arms */}
      <mesh position={[px, py + 0.36, pz - 0.24]} rotation={[0.52, 0, 0]} castShadow>
        <boxGeometry args={[0.12, 0.08, 0.62]} />
        <primitive object={bracketMat} attach="material" />
      </mesh>
      <mesh position={[px, backboardY + 0.24, pz - 0.235]} rotation={[-0.34, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.54]} />
        <primitive object={bracketMat} attach="material" />
      </mesh>
      <mesh position={[px, backboardY, pz - 0.18]} castShadow>
        <boxGeometry args={[0.24, 0.36, 0.18]} />
        <primitive object={bracketDarkMat} attach="material" />
      </mesh>

      {/* NBA-style regulation backboard assembly */}
      <group position={[px, backboardY, pz]}>
        {[
          { position: [0, BACKBOARD_HEIGHT / 2 - BACKBOARD_TRIM_WIDTH / 2, trimZ], size: [BACKBOARD_WIDTH + 0.055, BACKBOARD_TRIM_WIDTH, BACKBOARD_FRAME_DEPTH] },
          { position: [0, -BACKBOARD_HEIGHT / 2 + BACKBOARD_TRIM_WIDTH / 2, trimZ], size: [BACKBOARD_WIDTH + 0.055, BACKBOARD_TRIM_WIDTH, BACKBOARD_FRAME_DEPTH] },
          { position: [-BACKBOARD_WIDTH / 2 + BACKBOARD_TRIM_WIDTH / 2, 0, trimZ], size: [BACKBOARD_TRIM_WIDTH, BACKBOARD_HEIGHT, BACKBOARD_FRAME_DEPTH] },
          { position: [BACKBOARD_WIDTH / 2 - BACKBOARD_TRIM_WIDTH / 2, 0, trimZ], size: [BACKBOARD_TRIM_WIDTH, BACKBOARD_HEIGHT, BACKBOARD_FRAME_DEPTH] },
        ].map(({ position: trimPosition, size }, index) => (
          <mesh key={index} position={trimPosition as [number, number, number]} castShadow>
            <boxGeometry args={size as [number, number, number]} />
            <primitive object={frameMat} attach="material" />
          </mesh>
        ))}

        <mesh position={[0, 0, backboardGlassZ]}>
          <boxGeometry args={[BACKBOARD_WIDTH, BACKBOARD_HEIGHT, BACKBOARD_GLASS_THICKNESS]} />
          <meshPhysicalMaterial
            color="#f6feff"
            roughness={0.02}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.02}
            transmission={0.97}
            thickness={0.08}
            attenuationDistance={2.2}
            attenuationColor="#d8fcff"
            ior={1.52}
            reflectivity={0.86}
            specularIntensity={1}
            specularColor="#ffffff"
            envMapIntensity={1.2}
            opacity={1}
            side={THREE.DoubleSide}
          />
        </mesh>

        <lineSegments geometry={glassEdges} position={[0, 0, backboardGlassZ]}>
          <lineBasicMaterial color="#9bd3c6" transparent opacity={0.28} />
        </lineSegments>

        <mesh position={[0, 0, backboardFrontZ + 0.001]} renderOrder={2}>
          <planeGeometry args={[BACKBOARD_WIDTH, BACKBOARD_HEIGHT]} />
          <meshBasicMaterial
            map={markingsTexture}
            transparent
            opacity={0.95}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[0, 0, backboardFrontZ + 0.002]} renderOrder={3}>
          <planeGeometry args={[BACKBOARD_WIDTH, BACKBOARD_HEIGHT]} />
          <meshBasicMaterial
            map={glareTexture}
            color="#dff6ff"
            transparent
            opacity={0.62}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {/* Backboard padding and hardware channels */}
        <mesh
          position={[0, -BACKBOARD_HEIGHT / 2 + BACKBOARD_PADDING_HEIGHT / 2 - 0.008, backboardFrontZ + BACKBOARD_PADDING_DEPTH / 2 - 0.01]}
          castShadow
        >
          <boxGeometry args={[BACKBOARD_WIDTH + 0.03, BACKBOARD_PADDING_HEIGHT, BACKBOARD_PADDING_DEPTH]} />
          <primitive object={paddingMat} attach="material" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[
              side * (BACKBOARD_WIDTH / 2 - BACKBOARD_PADDING_WIDTH / 2 + 0.002),
              -BACKBOARD_HEIGHT / 2 + 0.22,
              backboardFrontZ + BACKBOARD_PADDING_DEPTH / 2 - 0.012,
            ]}
            castShadow
          >
            <boxGeometry args={[BACKBOARD_PADDING_WIDTH, 0.38, BACKBOARD_PADDING_DEPTH * 0.8]} />
            <primitive object={paddingMat} attach="material" />
          </mesh>
        ))}
      </group>

      {/* Direct rim mount so the goal reads as separate from the glass */}
      <mesh position={[px, rimY + 0.12, pz + mountPlateZ]} castShadow>
        <boxGeometry args={[0.34, 0.4, 0.09]} />
        <primitive object={mountMat} attach="material" />
      </mesh>
      <mesh position={[px, rimY + 0.07, pz + rimMountPlateZ]} castShadow>
        <boxGeometry args={[0.28, 0.17, 0.02]} />
        <primitive object={bracketMat} attach="material" />
      </mesh>
      <mesh position={[px, rimY + 0.03, rimArmCenterZ]} castShadow>
        <boxGeometry args={[0.12, 0.055, rimArmDepth]} />
        <primitive object={bracketMat} attach="material" />
      </mesh>
      <mesh position={[px, rimY + 0.08, pz - 0.01]} rotation={[0.7, 0, 0]} castShadow>
        <boxGeometry args={[0.09, 0.09, 0.15]} />
        <primitive object={bracketMat} attach="material" />
      </mesh>

      {/* Rim — thicker, more metallic */}
      <mesh position={[px, rimY, rimZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[RIM_RADIUS, RIM_TUBE, 16, 36]} />
        <primitive object={rimMat} attach="material" />
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
            <primitive object={rimMat} attach="material" />
          </mesh>
        );
      })}

      <Net runtime={runtime} rimCenter={[px, rimY - RIM_TUBE, rimZ]} />
    </group>
  );
}
