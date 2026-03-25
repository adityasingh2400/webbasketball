import type { Vector2, NormalizedPosition } from '../types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVector2(a: Vector2, b: Vector2, t: number): Vector2 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

export function distance(a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function magnitude(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v: Vector2): Vector2 {
  const mag = magnitude(v);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

export function dot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

export function reflect(v: Vector2, normal: Vector2): Vector2 {
  const d = dot(v, normal);
  return {
    x: v.x - 2 * d * normal.x,
    y: v.y - 2 * d * normal.y,
  };
}

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function multiply(v: Vector2, scalar: number): Vector2 {
  return { x: v.x * scalar, y: v.y * scalar };
}

export function normalizedToScreen(
  pos: NormalizedPosition,
  width: number,
  height: number
): Vector2 {
  return {
    x: pos.x * width,
    y: pos.y * height,
  };
}

export function screenToNormalized(
  pos: Vector2,
  width: number,
  height: number
): NormalizedPosition {
  return {
    x: pos.x / width,
    y: pos.y / height,
  };
}

export function angleBetween(a: Vector2, b: Vector2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function circleCollision(
  c1: Vector2,
  r1: number,
  c2: Vector2,
  r2: number
): boolean {
  return distance(c1, c2) < r1 + r2;
}

export function pointInRect(
  point: Vector2,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  return (
    point.x >= rectX &&
    point.x <= rectX + rectWidth &&
    point.y >= rectY &&
    point.y <= rectY + rectHeight
  );
}
