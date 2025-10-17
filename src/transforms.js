/**
 * Coordinate transformation functions for isometric projection
 */

import { state } from './core.js';

let su = Math.SQRT1_2;
let sv = Math.SQRT1_2 / 2;

export function transformPoint(p) {
  const u = (p.x - p.y) * su;
  const v = (p.x + p.y) * sv - p.z;
  return { u, v };
}

export function transformPointz(p) {
  const u = (p.x - p.y) * su;
  const v = (p.x + p.y) * sv - p.z;
  const z = -(p.x + p.y);
  return { u, v, z };
}

export function transformPointuv(p, transformFunc, canvasCenter) {
  const puv = transformFunc(p);
  return { u: canvasCenter.u + puv.u, v: canvasCenter.v + puv.v };
}

export function transformPointuvz(p, transformFunc, canvasCenter) {
  const puv = transformFunc(p);
  return { u: canvasCenter.u + puv.u, v: canvasCenter.v + puv.v, z: puv.z };
}

export function inverseTransformPoint(p) {
  const su = Math.SQRT1_2;
  const sv = su / 2;

  const x = ((p.u - state.canvasCenter.u) / su + (p.v - state.canvasCenter.v) / sv) / 2;
  const y = (p.v - state.canvasCenter.v) / sv - x;
  return { x: Math.floor(x), y: Math.floor(y), z: null };
}

export function inverseTransformPointSimple(p) {
  const su = Math.SQRT1_2;
  const sv = su / 2;

  const x = (p.u / su + p.v / sv) / 2;
  const y = p.v / sv - x;
  return { x, y, z: null };
}
