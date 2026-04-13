import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRuntime } from '../engine/GameRuntime';

/** Fraction of drawing buffer for the inset (top-right). */
const PIP_W_FRAC = 0.26;
const PIP_H_FRAC = 0.24;
const PIP_PAD_PX = 14;

interface FrontViewPipProps {
  runtime: GameRuntime;
  enabled?: boolean;
}

/**
 * Second render pass after the main (postprocessed) frame: same scene from a camera
 * in front of the player (hoop side) so you can see face / form while playing.
 */
export function FrontViewPip({ runtime, enabled = true }: FrontViewPipProps) {
  const cam = useMemo(() => new THREE.PerspectiveCamera(40, 1, 0.1, 140), []);
  const lookAt = useRef(new THREE.Vector3());

  useFrame(({ gl, scene, size }) => {
    if (!enabled) return;

    const dw = size.width;
    const dh = size.height;
    if (dw < 8 || dh < 8) return;

    const pw = Math.max(64, Math.floor(dw * PIP_W_FRAC));
    const ph = Math.max(64, Math.floor(dh * PIP_H_FRAC));
    const pad = Math.max(8, Math.floor(PIP_PAD_PX * gl.getPixelRatio()));
    const vx = dw - pw - pad;
    const vy = dh - ph - pad;

    const snapshot = runtime.getRenderState();
    const [px, py, pz] = snapshot.playerPosition;

    cam.aspect = pw / ph;
    cam.updateProjectionMatrix();

    const dist = 4.0;
    const camY = py + 1.36;
    cam.position.set(px * 0.22, camY, pz - dist);
    lookAt.current.set(px, py + 1.08, pz);
    cam.lookAt(lookAt.current);

    const prevAutoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setViewport(vx, vy, pw, ph);
    gl.setScissor(vx, vy, pw, ph);
    gl.setScissorTest(true);
    gl.clearDepth();
    gl.render(scene, cam);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, dw, dh);
    gl.autoClear = prevAutoClear;
  }, 1000);

  return null;
}
