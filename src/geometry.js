/**
 * Geometry helper functions for 3D math operations
 */

import * as sheetutil from './sheetutil.js';

export function getBaseMatrixInverse(u, v, w) {
  const det = u.x * (w.z * v.y - v.z * w.y) - u.y * (w.z * v.x - v.z * w.x) + u.z * (w.y * v.x - v.y * w.x);
  const b1 = { x: (w.z * v.y - v.z * w.y) / det, y: (u.z * w.y - w.z * u.y) / det, z: (v.z * u.y - u.z * v.y) / det };
  const b2 = { x: (v.z * w.x - w.z * v.x) / det, y: (w.z * u.x - u.z * w.x) / det, z: (u.z * v.x - v.z * u.x) / det };
  const b3 = { x: (w.y * v.x - v.y * w.x) / det, y: (u.y * w.x - w.y * u.x) / det, z: (v.y * u.x - u.y * v.x) / det };
  return { b1, b2, b3 };
}

export function crossProduct(v1, v2) {
  return {
    x: v1.z * v2.y - v1.y * v2.z,
    y: -(v1.z * v2.x) + v1.x * v2.z,
    z: v1.y * v2.x - v1.x * v2.y
  };
}

export function vectorMagnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function round2digits(a, digits) {
  return Math.round(a * digits) / digits;
}

export function roundVector2digits(v, digits) {
  return {
    x: round2digits(v.x, digits),
    y: round2digits(v.y, digits),
    z: round2digits(v.z, digits)
  };
}

export function getTForSheetLineCrossing(normalp, centerp, p, l) {
  return sheetutil.getTForSheetLineCrossing(normalp, centerp, p, l);
}

export function multiplyMatrices(a1, a2, a3, b1, b2, b3) {
  const c1 = {
    x: a1.x * b1.x + a2.x * b1.y + a3.x * b1.z,
    y: a1.y * b1.x + a2.y * b1.y + a3.y * b1.z,
    z: a1.z * b1.x + a2.z * b1.y + a3.z * b1.z
  };
  const c2 = {
    x: a1.x * b2.x + a2.x * b2.y + a3.x * b2.z,
    y: a1.y * b2.x + a2.y * b2.y + a3.y * b2.z,
    z: a1.z * b2.x + a2.z * b2.y + a3.z * b2.z
  };
  const c3 = {
    x: a1.x * b3.x + a2.x * b3.y + a3.x * b3.z,
    y: a1.y * b3.x + a2.y * b3.y + a3.y * b3.z,
    z: a1.z * b3.x + a2.z * b3.y + a3.z * b3.z
  };
  return { c1, c2, c3 };
}

export function getCoordsInBase(b, p) {
  const x = b.b1.x * p.x + b.b2.x * p.y + b.b3.x * p.z;
  const y = b.b1.y * p.x + b.b2.y * p.y + b.b3.y * p.z;
  const z = b.b1.z * p.x + b.b2.z * p.y + b.b3.z * p.z;
  return { x, y, z };
}

export function getPointInBase(p, p1, p2, normalp) {
  return {
    x: p.x * p1.x + p.y * p2.x + p.z * normalp.x,
    y: p.x * p1.y + p.y * p2.y + p.z * normalp.y,
    z: p.x * p1.z + p.y * p2.z + p.z * normalp.z
  };
}

export function addPoint(p1, p2) {
  return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z };
}

export function subPoint(p1, p2) {
  return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
}

export function avgPoints(p1, p2, ratio1, ratio2, sum) {
  return {
    x: (p1.x * ratio1 + p2.x * ratio2) / sum,
    y: (p1.y * ratio1 + p2.y * ratio2) / sum,
    z: (p1.z * ratio1 + p2.z * ratio2) / sum
  };
}

export function avgPointsuv(p1, p2, ratio1, ratio2, sum) {
  return {
    u: (p1.u * ratio1 + p2.u * ratio2) / sum,
    v: (p1.v * ratio1 + p2.v * ratio2) / sum
  };
}

export function roughPointDist(p1, p2) {
  return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) + Math.abs(p1.z - p2.z);
}

export function pointDist(p1, p2) {
  return vectorMagnitude({ x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z });
}

export function clonePoint(p) {
  return { x: p.x, y: p.y, z: p.z };
}

export function normalPoint(p) {
  const max = Math.max(Math.abs(p.x), Math.max(Math.abs(p.y), Math.abs(p.z)));
  return { x: p.x / max, y: p.y / max, z: p.z / max };
}

export function rotatePoint(p, phi, theta, omega) {
  const sphi = Math.sin(phi);
  const cphi = Math.cos(phi);
  const stheta = Math.sin(theta);
  const ctheta = Math.cos(theta);
  const somega = Math.sin(omega);
  const comega = Math.cos(omega);
  const x = p.x * ctheta * comega + p.y * ctheta * somega - p.z * stheta;
  const y = p.x * (-cphi * somega + sphi * stheta * comega) + p.y * (cphi * comega + sphi * stheta * somega) + p.z * sphi * ctheta;
  const z = p.x * (sphi * somega + cphi * stheta * comega) + p.y * (-sphi * comega + cphi * stheta * somega) + p.z * cphi * ctheta;
  return { x, y, z };
}

export function inverseRPY(p1, p2, normalp) {
  let resultAlpha = 0;
  let resultBeta = 0;
  let resultGamma = 0;

  const { y: lightYValue, z: lightXValue, x: lightZValue } = p2;
  const { y: normalYValue, z: normalXValue } = p1;
  const { y: matrixYValue, z: matrixXValue } = normalp;

  if (lightYValue === 0 && lightXValue === 0) {
    if (lightZValue === 1) {
      resultBeta = -Math.PI / 2;
      resultAlpha = 0;
      resultGamma = Math.atan2(normalYValue, normalXValue);
    } else {
      resultBeta = Math.PI / 2;
      resultAlpha = 0;
      resultGamma = Math.atan2(matrixXValue, matrixYValue);
    }
  } else {
    resultAlpha = Math.atan2(lightYValue, lightXValue);
    const sa = Math.sin(resultAlpha);
    const ca = Math.cos(resultAlpha);
    resultBeta = Math.atan2(-lightZValue, sa * lightYValue + ca * lightXValue);
    resultGamma = Math.atan2(sa * normalXValue - ca * normalYValue, -sa * matrixXValue + ca * matrixYValue);
  }

  resultAlpha = resultAlpha + Math.PI;
  resultBeta = -resultBeta;
  resultGamma = resultGamma + Math.PI;

  if (resultAlpha === 2 * Math.PI) resultAlpha = 0;
  if (resultGamma === 2 * Math.PI) resultGamma = 0;
  if (resultBeta < 0) resultBeta = 2 * Math.PI + resultBeta;
  if (resultBeta === 2 * Math.PI) resultBeta = 0;

  const alphaD = Math.round((180 / Math.PI) * resultAlpha);
  const betaD = Math.round((180 / Math.PI) * resultBeta);
  const gammaD = Math.round((180 / Math.PI) * resultGamma);

  return { alpha: resultAlpha, beta: resultBeta, gamma: resultGamma, alphaD, betaD, gammaD };
}

export function rotateAroundAxis(p, t, phi) {
  const cphi = Math.cos(phi);
  const sphi = Math.sin(phi);
  const tp = p.x * t.x + p.y * t.y + p.z * t.z;
  const txp = { x: t.y * p.z - p.y * t.z, y: -t.x * p.z + p.x * t.z, z: t.x * p.y - p.x * t.y };

  return {
    x: p.x * cphi + txp.x * sphi + t.x * tp * (1 - cphi),
    y: p.y * cphi + txp.y * sphi + t.y * tp * (1 - cphi),
    z: p.z * cphi + txp.z * sphi + t.z * tp * (1 - cphi)
  };
}

export function rotateAroundArbitraryAxis(p, tp, tv, phi) {
  const temp = { x: p.x - tp.x, y: p.y - tp.y, z: p.z - tp.z };
  const rottemp = rotateAroundAxis(temp, tv, phi);
  return { x: rottemp.x + tp.x, y: rottemp.y + tp.y, z: rottemp.z + tp.z };
}

export function rotateAroundArbitraryAxisp(p, center, newcenter, tp, tv, phi) {
  const temp = { x: p.x + center.x, y: p.y + center.y, z: p.z + center.z };
  const rottemp = rotateAroundArbitraryAxis(temp, tp, tv, phi);
  return { x: rottemp.x - newcenter.x, y: rottemp.y - newcenter.y, z: rottemp.z - newcenter.z };
}
