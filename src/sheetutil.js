/**
 * @fileoverview Shared utility functions for sheet calculations
 * Consolidates repeated patterns to reduce code duplication
 */

import * as geometry from './geometry.js';
import * as transforms from './transforms.js';

// Constant for bounds checking
export const inboundsCheckZeroThresh = 0.001;

/**
 * Check if a point is within polygon bounds
 * @param {Array} corners - Corner points of polygon
 * @param {number} myx - Point x coordinate
 * @param {number} myy - Point y coordinate
 * @returns {Object} Bounds check result with inbounds, areas, allzero properties
 */
export function checkInboundsPolygon(corners, myx, myy) {
  const areas = [];
  let allpositive = true;
  let allnegative = true;
  let allzero = true;
  for (let i = 0; i < corners.length; i++) {
    const j = i === corners.length - 1 ? 0 : i + 1;
    areas[areas.length] = myx * corners[j].v - corners[j].u * myy - myx * corners[i].v + corners[i].u * myy + corners[j].u * corners[i].v - corners[i].u * corners[j].v;
    if ((areas[areas.length - 1]) > inboundsCheckZeroThresh) {
      allnegative = false;
      allzero = false;
    }
    if ((areas[areas.length - 1]) < -inboundsCheckZeroThresh) {
      allpositive = false;
      allzero = false;
    }
  }
  return { inbounds: (allnegative || allpositive) && !allzero, areas: areas, allzero: allzero };
}

/**
 * Fill rotation object with default values
 * @param {Object} rot - Rotation object with alphaD, betaD, gammaD
 * @returns {Object} Filled rotation object
 */
export function fillRot(rot) {
  if (!rot) return { alphaD: 0, betaD: 0, gammaD: 0 };
  return {
    alphaD: rot.alphaD || 0,
    betaD: rot.betaD || 0,
    gammaD: rot.gammaD || 0
  };
}

/**
 * Initialize common sheet properties from rotation object
 * @param {Object} sheet - Sheet object to initialize
 * @param {Object} rot - Rotation object
 */
export function initializeSheetProperties(sheet, rot) {
  const rotclone = fillRot(rot);
  sheet.rot = { alphaD: rotclone.alphaD, betaD: rotclone.betaD, gammaD: rotclone.gammaD };
  
  // Initialize sheet parameters
  sheet.p0orig = { x: -sheet.width / 2, y: 0, z: sheet.height / 2 };
  sheet.p1orig = { x: 1, y: 0, z: 0 };
  sheet.p2orig = { x: 0, y: 0, z: -1 };
  sheet.normalporig = { x: 0, y: 1, z: 0 };
}

/**
 * Finalize sheet initialization - calculate corners, A1 matrix, and sheet data
 * @param {Object} sheet - Sheet object to finalize
 * @param {Object} deps - Dependencies object {calc, geometry, shadows, state}
 * @param {boolean} isObjectSheet - Whether this is an object sheet
 */
export function finalizeSheetInitialization(sheet, deps, isObjectSheet = false) {
  sheet.maxdiag = Math.ceil(Math.sqrt(sheet.width * sheet.width + sheet.height * sheet.height) / 2);

  // Calculate corners
  calcUdifVdif(sheet);
  sheet.corners = calculateCornersFromCenter(sheet.centerp, sheet.udif, sheet.vdif);
  
  // Calculate A1 (base matrix inverse)
  sheet.A1 = deps.geometry.getBaseMatrixInverse(sheet.p1, sheet.p2, sheet.normalp);

  // Calculate sheet data if transforms are available
  if (deps.state.canvasCenter) {
    deps.calc.calculateSheetData(sheet);
  }
  
  // Calculate shade for the sheet
  deps.shadows.calculateSheetShade(sheet);
}

/**
 * Initialize common sheet properties from rotation object

/**
 * Calculate t-parameter for line-plane intersection
 * @param {Object} normalp - Normal point/plane
 * @param {Object} centerp - Center point on plane
 * @param {Object} p - Point to project
 * @param {Object} l - Direction vector
 * @returns {number} T-parameter for intersection
 */
export function getTForSheetLineCrossing(normalp, centerp, p, l) {
  return (
    (normalp.x * centerp.x + normalp.y * centerp.y + normalp.z * centerp.z -
      normalp.x * p.x - normalp.y * p.y - normalp.z * p.z) /
    (normalp.x * l.x + normalp.y * l.y + normalp.z * l.z)
  );
}

/**
 * Calculate intersection points for shadow casting
 * @param {Object} centerp - Center point
 * @param {Object} p0 - First point
 * @param {Object} p1 - Second point
 * @param {Object} p2 - Third point
 * @param {Object} l - Light source or vector
 * @returns {Array} Array of t-parameters for line intersection [tc, t0, t1, t2]
 */
export function calculateTParameters(centerp, p0, p1, p2, l) {
  return [
    centerp.z / -l.z,
    p0.z / -l.z,
    p1.z / -l.z,
    p2.z / -l.z
  ];
}

/**
 * Calculate section points from light intersection
 * @param {Object} centerp - Center point
 * @param {Object} p0 - First point
 * @param {Object} p1 - Second point
 * @param {Object} p2 - Third point
 * @param {Array} tparams - T-parameters [tc, t0, t1, t2]
 * @param {Object} l - Light source or vector
 * @returns {Array} Array of section points [centerpsect, p0sect, p1sect, p2sect]
 */
export function calculateSectionPoints(centerp, p0, p1, p2, tparams, l) {
  const [tc, t0, t1, t2] = tparams;
  const centerpsect = { x: centerp.x + l.x * tc, y: centerp.y + l.y * tc, z: centerp.z + l.z * tc };
  return [
    centerpsect,
    { x: p0.x + l.x * t0 - centerpsect.x, y: p0.y + l.y * t0 - centerpsect.y, z: p0.z + l.z * t0 - centerpsect.z },
    { x: p1.x + l.x * t1 - centerpsect.x, y: p1.y + l.y * t1 - centerpsect.y, z: p1.z + l.z * t1 - centerpsect.z },
    { x: p2.x + l.x * t2 - centerpsect.x, y: p2.y + l.y * t2 - centerpsect.y, z: p2.z + l.z * t2 - centerpsect.z }
  ];
}

/**
 * Calculate grid key for density map
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} z - Z coordinate
 * @returns {string} Grid key string
 */
export function calculateGridKey(x, y, z) {
  return 'x' + x + 'y' + y + 'z' + z;
}

/**
 * Calculate 3D points from center and sheet vectors
 * @param {Object} centerp - Center point
 * @param {Object} p0 - P0 vector
 * @param {Object} p1 - P1 vector
 * @param {Object} p2 - P2 vector
 * @returns {Object} Object with p0, p1, p2 calculated points
 */
export function calculateSheetPoints(centerp, p0, p1, p2) {
  return {
    p0: { x: centerp.x + p0.x, y: centerp.y + p0.y, z: centerp.z + p0.z },
    p1: { x: centerp.x + p1.x, y: centerp.y + p1.y, z: centerp.z + p1.z },
    p2: { x: centerp.x + p2.x, y: centerp.y + p2.y, z: centerp.z + p2.z }
  };
}

/**
 * Calculate spatial grid key for density map
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
/**
 * Calculate corner positions from center point and udif/vdif
 * @param {Object} centerp - Center point
 * @param {Object} udif - U difference vector
 * @param {Object} vdif - V difference vector
 * @returns {Array} Array of 4 corner points
 */
export function calculateCornersFromCenter(centerp, udif, vdif) {
  const corners = [];
  corners[0] = { x: -udif.x - vdif.x + centerp.x, y: -udif.y - vdif.y + centerp.y, z: -udif.z - vdif.z + centerp.z };
  corners[1] = { x: +udif.x - vdif.x + centerp.x, y: +udif.y - vdif.y + centerp.y, z: +udif.z - vdif.z + centerp.z };
  corners[2] = { x: +udif.x + vdif.x + centerp.x, y: +udif.y + vdif.y + centerp.y, z: +udif.z + vdif.z + centerp.z };
  corners[3] = { x: -udif.x + vdif.x + centerp.x, y: -udif.y + vdif.y + centerp.y, z: -udif.z + vdif.z + centerp.z };
  return corners;
}

/**
 * Calculate u and v difference vectors for a sheet
 * @param {Object} sheet - Sheet object with width, height, p1, p2
 */
export function calcUdifVdif(sheet) {
  const scalew = sheet.width / 2;
  const scaleh = sheet.height / 2;
  sheet.udif = { x: sheet.p1.x * scalew, y: sheet.p1.y * scalew, z: sheet.p1.z * scalew };
  sheet.vdif = { x: sheet.p2.x * scaleh, y: sheet.p2.y * scaleh, z: sheet.p2.z * scaleh };
}

/**
 * Initialize sheet orientation parameters (p0, p1, p2, normalp)
 * @param {Object} sheet - Sheet object with p0orig, p1orig, p2orig, normalporig, rot
 */
export function initializeSheetOrientation(sheet) {
  const alpha = sheet.rot.alphaD * Math.PI / 180;
  const beta = sheet.rot.betaD * Math.PI / 180;
  const gamma = sheet.rot.gammaD * Math.PI / 180;

  sheet.p0 = sheet.p0start = geometry.rotatePoint(sheet.p0orig, alpha, beta, gamma);
  sheet.p1 = sheet.p1start = geometry.rotatePoint(sheet.p1orig, alpha, beta, gamma);
  sheet.p2 = sheet.p2start = geometry.rotatePoint(sheet.p2orig, alpha, beta, gamma);
  sheet.normalp = sheet.normalpstart = geometry.rotatePoint(sheet.normalporig, alpha, beta, gamma);
}

/**
 * Calculate sheet transformation data (used by both normal and shadow calculations)
 * @param {Object} centerp - Center point
 * @param {Object} p0rot - First corner vector
 * @param {Object} p1rot - Second corner vector
 * @param {Object} p2rot - Third corner vector
 * @param {Function} transformFunction - Point transformation function
 * @param {Function} transformFunctionz - Point transformation with z function
 * @param {Object} canvasCenter - Canvas center point
 * @param {Array} corners - Corner points array
 * @returns {Object} Sheet transformation data
 */
export function calculateSheetDataSingle(centerp, p0rot, p1rot, p2rot, transformFunction, transformFunctionz, canvasCenter, corners) {
  // we calculate the new position of the center
  const centerpuv = transformFunction(centerp);

  // from the angles we calculate 3 cornerpoints of the sheet: p0 is top left
  const p0rotScale = { x: p0rot.x, y: p0rot.y, z: p0rot.z };
  const p1rotScale = { x: p1rot.x, y: p1rot.y, z: p1rot.z };
  const p2rotScale = { x: p2rot.x, y: p2rot.y, z: p2rot.z };

  const p0 = transformFunction(p0rotScale);
  const p1 = transformFunction(p1rotScale);
  const p2 = transformFunction(p2rotScale);

  // p1 and p2 are the cornerpoints of the square, so that 0,0 is lower left, p1 is lower right and p2 is upper left point
  // p1 and p2 will define the transformation with respect to 0,0, and the whole thing should be translated to p0

  const translatex = canvasCenter.u + p0.u + centerpuv.u;
  const translatey = canvasCenter.v + p0.v + centerpuv.v;

  const ta = p1.u;
  const tb = p1.v;
  const tc = p2.u;
  const td = p2.v;

  if (corners == null)
    return { p0uv: p0, p1uv: p1, p2uv: p2, translatex: translatex, translatey: translatey, ta: ta, tb: tb, tc: tc, td: td, centerpuv: centerpuv };

  // cornerpoints
  const c = [];
  c[0] = transforms.transformPointuvz(corners[0], transformFunctionz, canvasCenter);
  c[1] = transforms.transformPointuvz(corners[1], transformFunctionz, canvasCenter);
  c[2] = transforms.transformPointuvz(corners[2], transformFunctionz, canvasCenter);
  c[3] = transforms.transformPointuvz(corners[3], transformFunctionz, canvasCenter);

  const umax = Math.max(c[0].u, c[1].u, c[2].u, c[3].u);
  const umin = Math.min(c[0].u, c[1].u, c[2].u, c[3].u);
  const vmax = Math.max(c[0].v, c[1].v, c[2].v, c[3].v);
  const vmin = Math.min(c[0].v, c[1].v, c[2].v, c[3].v);
  const zmax = Math.max(c[0].z, c[1].z, c[2].z, c[3].z);
  const zmin = Math.min(c[0].z, c[1].z, c[2].z, c[3].z);
  return { p0uv: p0, p1uv: p1, p2uv: p2, translatex: translatex, translatey: translatey, ta: ta, tb: tb, tc: tc, td: td, centerpuv: centerpuv, cornersuv: c, umax: umax, umin: umin, vmax: vmax, vmin: vmin, zmax: zmax, zmin: zmin };
}
