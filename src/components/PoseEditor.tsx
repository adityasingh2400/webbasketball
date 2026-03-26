import { useRef, useMemo, useState, useCallback, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useFBX, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_PATH = '/models/Dribble.fbx';
const TARGET_HEIGHT = 1.8;

const BONE_NAMES = [
  'hips', 'spine', 'spine1', 'spine2', 'neck', 'head',
  'leftShoulder', 'leftArm', 'leftForeArm', 'leftHand',
  'rightShoulder', 'rightArm', 'rightForeArm', 'rightHand',
  'leftUpLeg', 'leftLeg', 'leftFoot',
  'rightUpLeg', 'rightLeg', 'rightFoot',
];

const MIXAMO_MAP: Record<string, string> = {
  hips: 'mixamorig:hips',
  spine: 'mixamorig:spine',
  spine1: 'mixamorig:spine1',
  spine2: 'mixamorig:spine2',
  neck: 'mixamorig:neck',
  head: 'mixamorig:head',
  leftShoulder: 'mixamorig:leftshoulder',
  leftArm: 'mixamorig:leftarm',
  leftForeArm: 'mixamorig:leftforearm',
  leftHand: 'mixamorig:lefthand',
  rightShoulder: 'mixamorig:rightshoulder',
  rightArm: 'mixamorig:rightarm',
  rightForeArm: 'mixamorig:rightforearm',
  rightHand: 'mixamorig:righthand',
  leftUpLeg: 'mixamorig:leftupleg',
  leftLeg: 'mixamorig:leftleg',
  leftFoot: 'mixamorig:leftfoot',
  rightUpLeg: 'mixamorig:rightupleg',
  rightLeg: 'mixamorig:rightleg',
  rightFoot: 'mixamorig:rightfoot',
};

type BoneOffsets = Record<string, { x: number; y: number; z: number }>;

function createDefaultOffsets(): BoneOffsets {
  const offsets: BoneOffsets = {};
  for (const name of BONE_NAMES) {
    offsets[name] = { x: 0, y: 0, z: 0 };
  }
  return offsets;
}

interface CharacterProps {
  offsets: BoneOffsets;
  hipsY: number;
}

function Character({ offsets, hipsY }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const offsetsRef = useRef(offsets);
  const hipsYRef = useRef(hipsY);
  offsetsRef.current = offsets;
  hipsYRef.current = hipsY;

  const fbx = useFBX(MODEL_PATH);

  const setupDone = useRef(false);
  if (!setupDone.current) {
    fbx.scale.setScalar(1);
    fbx.position.set(0, 0, 0);

    fbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of materials) {
            if ((mat as THREE.MeshStandardMaterial).map) {
              (mat as THREE.MeshStandardMaterial).map!.colorSpace = THREE.SRGBColorSpace;
            }
          }
        }
      }
    });

    const box = new THREE.Box3().setFromObject(fbx);
    const size = box.getSize(new THREE.Vector3());
    const s = size.y > 0 ? TARGET_HEIGHT / size.y : 0.01;
    fbx.scale.setScalar(s);

    const scaledBox = new THREE.Box3().setFromObject(fbx);
    if (scaledBox.min.y < 0) fbx.position.y -= scaledBox.min.y;

    setupDone.current = true;
  }

  const skinnedMeshes = useMemo(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    fbx.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        meshes.push(child as THREE.SkinnedMesh);
      }
    });
    return meshes;
  }, [fbx]);

  const bones = useMemo(() => {
    const found: Record<string, THREE.Bone> = {};

    for (const sm of skinnedMeshes) {
      for (const bone of sm.skeleton.bones) {
        const n = bone.name.toLowerCase();
        for (const [key, mixName] of Object.entries(MIXAMO_MAP)) {
          if (n === mixName || n === key.toLowerCase()) {
            found[key] = bone;
          }
        }
      }
    }

    if (Object.keys(found).length === 0) {
      fbx.traverse((child) => {
        if ((child as THREE.Bone).isBone) {
          const bone = child as THREE.Bone;
          const n = bone.name.toLowerCase();
          for (const [key, mixName] of Object.entries(MIXAMO_MAP)) {
            if (n === mixName || n === key.toLowerCase()) {
              found[key] = bone;
            }
          }
        }
      });
    }

    return found;
  }, [fbx, skinnedMeshes]);

  const bindPoses = useMemo(() => {
    const poses: Record<string, { pos: THREE.Vector3; quat: THREE.Quaternion }> = {};
    for (const [key, bone] of Object.entries(bones)) {
      poses[key] = { pos: bone.position.clone(), quat: bone.quaternion.clone() };
    }
    return poses;
  }, [bones]);

  const hipsBaseY = useMemo(() => bindPoses.hips?.pos.y ?? 0, [bindPoses]);

  const _euler = useMemo(() => new THREE.Euler(), []);
  const _quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const currentOffsets = offsetsRef.current;
    const currentHipsY = hipsYRef.current;

    for (const [key, bone] of Object.entries(bones)) {
      const bind = bindPoses[key];
      if (bind) {
        bone.position.copy(bind.pos);
        bone.quaternion.copy(bind.quat);
      }
    }

    for (const [key, bone] of Object.entries(bones)) {
      const off = currentOffsets[key];
      if (!off) continue;
      if (off.x === 0 && off.y === 0 && off.z === 0) continue;
      _euler.set(off.x, off.y, off.z);
      _quat.setFromEuler(_euler);
      bone.quaternion.multiply(_quat);
    }

    if (bones.hips && currentHipsY !== 0) {
      const scale = fbx.scale.x;
      bones.hips.position.y = hipsBaseY + currentHipsY / scale;
    }

    for (const sm of skinnedMeshes) {
      sm.skeleton.update();
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={fbx} />
    </group>
  );
}

function BoneSlider({ label, value, onChange, min = -3.14, max = 3.14 }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 22 }}>
      <span style={{ width: 20, fontSize: 11, color: '#aaa', textAlign: 'right' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: 120, accentColor: label === 'X' ? '#ff6666' : label === 'Y' ? '#66ff66' : '#6666ff' }}
      />
      <span style={{ width: 40, fontSize: 11, color: '#ccc', fontFamily: 'monospace' }}>{value.toFixed(2)}</span>
    </div>
  );
}

const PRESETS: Record<string, { offsets: BoneOffsets; hipsY: number }> = {};

export default function PoseEditor({ onBack }: { onBack: () => void }) {
  const [offsets, setOffsets] = useState<BoneOffsets>(createDefaultOffsets);
  const [hipsY, setHipsY] = useState(0);
  const [expandedBone, setExpandedBone] = useState<string | null>('rightArm');
  const [poseName, setPoseName] = useState('idle');
  const [savedPoses, setSavedPoses] = useState<Record<string, { offsets: BoneOffsets; hipsY: number }>>(PRESETS);
  const [copied, setCopied] = useState(false);

  const updateBone = useCallback((boneName: string, axis: 'x' | 'y' | 'z', value: number) => {
    setOffsets(prev => ({
      ...prev,
      [boneName]: { ...prev[boneName], [axis]: value },
    }));
  }, []);

  const resetAll = useCallback(() => {
    setOffsets(createDefaultOffsets());
    setHipsY(0);
  }, []);

  const savePose = useCallback(() => {
    setSavedPoses(prev => ({
      ...prev,
      [poseName]: { offsets: JSON.parse(JSON.stringify(offsets)), hipsY },
    }));
  }, [poseName, offsets, hipsY]);

  const loadPose = useCallback((name: string) => {
    const pose = savedPoses[name];
    if (pose) {
      setOffsets(JSON.parse(JSON.stringify(pose.offsets)));
      setHipsY(pose.hipsY);
      setPoseName(name);
    }
  }, [savedPoses]);

  const exportCode = useCallback(() => {
    const lines: string[] = [];
    lines.push(`// Pose: ${poseName}`);
    lines.push(`// hipsY offset: ${hipsY.toFixed(3)}`);
    for (const name of BONE_NAMES) {
      const o = offsets[name];
      if (Math.abs(o.x) > 0.005 || Math.abs(o.y) > 0.005 || Math.abs(o.z) > 0.005) {
        lines.push(`applyOffset(${name}, '${name}', ${o.x.toFixed(3)}, ${o.y.toFixed(3)}, ${o.z.toFixed(3)});`);
      }
    }
    const code = lines.join('\n');
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setCopied(false);
      },
    );
  }, [offsets, hipsY, poseName]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onBack]);

  const BONE_GROUPS = [
    { label: 'Core', bones: ['hips', 'spine', 'spine1', 'spine2', 'neck', 'head'] },
    { label: 'Left Arm', bones: ['leftShoulder', 'leftArm', 'leftForeArm', 'leftHand'] },
    { label: 'Right Arm', bones: ['rightShoulder', 'rightArm', 'rightForeArm', 'rightHand'] },
    { label: 'Left Leg', bones: ['leftUpLeg', 'leftLeg', 'leftFoot'] },
    { label: 'Right Leg', bones: ['rightUpLeg', 'rightLeg', 'rightFoot'] },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#1a1a2e' }}>
      {/* 3D Viewport */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          shadows
          camera={{ fov: 45, near: 0.1, far: 50, position: [0, 1.2, 3.5] }}
          style={{ background: '#1a1a2e' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow />
          <directionalLight position={[-2, 3, -1]} intensity={0.4} />

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[6, 6]} />
            <meshStandardMaterial color="#2a2a3e" />
          </mesh>

          <gridHelper args={[6, 12, '#444466', '#333355']} position={[0, 0.001, 0]} />

          <Suspense fallback={null}>
            <Character offsets={offsets} hipsY={hipsY} />
          </Suspense>
          <OrbitControls target={[0, 0.9, 0]} />
        </Canvas>

        <div style={{
          position: 'absolute', top: 12, left: 12, color: 'white',
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, opacity: 0.5,
        }}>
          Drag to orbit | Scroll to zoom | ESC to go back
        </div>
      </div>

      {/* Slider Panel */}
      <div style={{
        width: 320, background: '#12121e', color: 'white', overflowY: 'auto',
        fontFamily: "'DM Sans', Arial, sans-serif", fontSize: 13,
        borderLeft: '1px solid #333',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onBack} style={{
            background: 'none', border: '1px solid #555', color: '#ccc', borderRadius: 6,
            padding: '4px 10px', cursor: 'pointer', fontSize: 12,
          }}>
            ← Back
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Pose Editor</span>
        </div>

        {/* Save / Load */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #333' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              value={poseName}
              onChange={(e) => setPoseName(e.target.value)}
              style={{
                flex: 1, background: '#1a1a2e', border: '1px solid #444', borderRadius: 4,
                color: 'white', padding: '4px 8px', fontSize: 12,
              }}
            />
            <button onClick={savePose} style={{
              background: '#2563eb', border: 'none', color: 'white', borderRadius: 4,
              padding: '4px 10px', cursor: 'pointer', fontSize: 12,
            }}>
              Save
            </button>
          </div>
          {Object.keys(savedPoses).length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.keys(savedPoses).map(name => (
                <button key={name} onClick={() => loadPose(name)} style={{
                  background: poseName === name ? '#2563eb' : '#333',
                  border: 'none', color: 'white', borderRadius: 4,
                  padding: '3px 8px', cursor: 'pointer', fontSize: 11,
                }}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #333', display: 'flex', gap: 6 }}>
          <button onClick={resetAll} style={{
            background: '#444', border: 'none', color: 'white', borderRadius: 4,
            padding: '5px 12px', cursor: 'pointer', fontSize: 12,
          }}>
            Reset All
          </button>
          <button onClick={exportCode} style={{
            background: copied ? '#22c55e' : '#ff6b35', border: 'none', color: 'white',
            borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12,
            transition: 'background 0.2s',
          }}>
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>

        {/* Hips Y */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #333' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#ff6b35' }}>Hips Height</div>
          <BoneSlider label="Y" value={hipsY} onChange={setHipsY} min={-0.5} max={0.5} />
        </div>

        {/* Bone Groups */}
        {BONE_GROUPS.map(group => (
          <div key={group.label} style={{ borderBottom: '1px solid #333' }}>
            <div style={{
              padding: '8px 16px', fontWeight: 600, fontSize: 12, color: '#888',
              textTransform: 'uppercase', letterSpacing: 1,
            }}>
              {group.label}
            </div>
            {group.bones.map(boneName => {
              const isExpanded = expandedBone === boneName;
              const o = offsets[boneName];
              const hasValue = Math.abs(o.x) > 0.01 || Math.abs(o.y) > 0.01 || Math.abs(o.z) > 0.01;
              return (
                <div key={boneName}>
                  <div
                    onClick={() => setExpandedBone(isExpanded ? null : boneName)}
                    style={{
                      padding: '5px 16px', cursor: 'pointer', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                      background: isExpanded ? '#1a1a3e' : 'transparent',
                    }}
                  >
                    <span style={{ color: hasValue ? '#ff6b35' : '#ccc', fontSize: 13 }}>
                      {isExpanded ? '▾' : '▸'} {boneName}
                    </span>
                    {hasValue && (
                      <span style={{ fontSize: 10, color: '#666' }}>
                        {o.x.toFixed(1)}, {o.y.toFixed(1)}, {o.z.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '4px 16px 8px 24px' }}>
                      <BoneSlider label="X" value={o.x} onChange={(v) => updateBone(boneName, 'x', v)} />
                      <BoneSlider label="Y" value={o.y} onChange={(v) => updateBone(boneName, 'y', v)} />
                      <BoneSlider label="Z" value={o.z} onChange={(v) => updateBone(boneName, 'z', v)} />
                      <button
                        onClick={() => {
                          updateBone(boneName, 'x', 0);
                          updateBone(boneName, 'y', 0);
                          updateBone(boneName, 'z', 0);
                        }}
                        style={{
                          background: '#333', border: 'none', color: '#aaa', borderRadius: 3,
                          padding: '2px 8px', cursor: 'pointer', fontSize: 10, marginTop: 4,
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
