(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.sheetengine = {}));
})(this, (function (exports) { 'use strict';

  /**
   * Core state management for SheetEngine
   */

  const state = {
    sheets: [],
    basesheets: [],
    polygons: [],
    objects: [],
    currentSheet: -1,
    hoverSheet: -1,
    canvas: null,
    context: null,
    canvasCenter: { u: 250, v: 260 },
    viewSource: { x: -1, y: -1, z: -Math.SQRT1_2 },
    tempCanvasSize: { w: 115, h: 115 },
    backgroundColor: '#FFF',
    drawObjectContour: false,
    boundingBoxMaxsheetDistance: 150,
    objectsintersect: false,
    debug: false
  };

  const internal = {
    startsheets: [],
    loadedyards: {},
    staticsheets: null
  };

  /**
   * Geometry helper functions for 3D math operations
   */

  function getBaseMatrixInverse(u, v, w) {
    const det = u.x * (w.z * v.y - v.z * w.y) - u.y * (w.z * v.x - v.z * w.x) + u.z * (w.y * v.x - v.y * w.x);
    const b1 = { x: (w.z * v.y - v.z * w.y) / det, y: (u.z * w.y - w.z * u.y) / det, z: (v.z * u.y - u.z * v.y) / det };
    const b2 = { x: (v.z * w.x - w.z * v.x) / det, y: (w.z * u.x - u.z * w.x) / det, z: (u.z * v.x - v.z * u.x) / det };
    const b3 = { x: (w.y * v.x - v.y * w.x) / det, y: (u.y * w.x - w.y * u.x) / det, z: (v.y * u.x - u.y * v.x) / det };
    return { b1, b2, b3 };
  }

  function crossProduct(v1, v2) {
    return {
      x: v1.z * v2.y - v1.y * v2.z,
      y: -(v1.z * v2.x) + v1.x * v2.z,
      z: v1.y * v2.x - v1.x * v2.y
    };
  }

  function vectorMagnitude(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  function round2digits$1(a, digits) {
    return Math.round(a * digits) / digits;
  }

  function roundVector2digits(v, digits) {
    return {
      x: round2digits$1(v.x, digits),
      y: round2digits$1(v.y, digits),
      z: round2digits$1(v.z, digits)
    };
  }

  function getTForSheetLineCrossing$1(normalp, centerp, p, l) {
    return (
      (normalp.x * centerp.x + normalp.y * centerp.y + normalp.z * centerp.z -
        normalp.x * p.x - normalp.y * p.y - normalp.z * p.z) /
      (normalp.x * l.x + normalp.y * l.y + normalp.z * l.z)
    );
  }

  function multiplyMatrices(a1, a2, a3, b1, b2, b3) {
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

  function getCoordsInBase(b, p) {
    const x = b.b1.x * p.x + b.b2.x * p.y + b.b3.x * p.z;
    const y = b.b1.y * p.x + b.b2.y * p.y + b.b3.y * p.z;
    const z = b.b1.z * p.x + b.b2.z * p.y + b.b3.z * p.z;
    return { x, y, z };
  }

  function getPointInBase(p, p1, p2, normalp) {
    return {
      x: p.x * p1.x + p.y * p2.x + p.z * normalp.x,
      y: p.x * p1.y + p.y * p2.y + p.z * normalp.y,
      z: p.x * p1.z + p.y * p2.z + p.z * normalp.z
    };
  }

  function addPoint(p1, p2) {
    return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z };
  }

  function subPoint(p1, p2) {
    return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  }

  function avgPoints(p1, p2, ratio1, ratio2, sum) {
    return {
      x: (p1.x * ratio1 + p2.x * ratio2) / sum,
      y: (p1.y * ratio1 + p2.y * ratio2) / sum,
      z: (p1.z * ratio1 + p2.z * ratio2) / sum
    };
  }

  function avgPointsuv(p1, p2, ratio1, ratio2, sum) {
    return {
      u: (p1.u * ratio1 + p2.u * ratio2) / sum,
      v: (p1.v * ratio1 + p2.v * ratio2) / sum
    };
  }

  function roughPointDist(p1, p2) {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) + Math.abs(p1.z - p2.z);
  }

  function pointDist(p1, p2) {
    return vectorMagnitude({ x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z });
  }

  function clonePoint(p) {
    return { x: p.x, y: p.y, z: p.z };
  }

  function normalPoint(p) {
    const max = Math.max(Math.abs(p.x), Math.max(Math.abs(p.y), Math.abs(p.z)));
    return { x: p.x / max, y: p.y / max, z: p.z / max };
  }

  function rotatePoint(p, phi, theta, omega) {
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

  function inverseRPY(p1, p2, normalp) {
    let alpha = 0;
    let beta = 0;
    let gamma = 0;

    p1.x;
    const ny = p1.y;
    const nx = p1.z;
    const lz = p2.x;
    const ly = p2.y;
    const lx = p2.z;
    normalp.x;
    const my = normalp.y;
    const mx = normalp.z;

    if (ly === 0 && lx === 0) {
      if (lz === 1) {
        beta = -Math.PI / 2;
        alpha = 0;
        gamma = Math.atan2(ny, nx);
      } else {
        beta = Math.PI / 2;
        alpha = 0;
        gamma = Math.atan2(mx, my);
      }
    } else {
      alpha = Math.atan2(ly, lx);
      const sa = Math.sin(alpha);
      const ca = Math.cos(alpha);
      beta = Math.atan2(-lz, sa * ly + ca * lx);
      gamma = Math.atan2(sa * nx - ca * ny, -sa * mx + ca * my);
    }

    alpha = alpha + Math.PI;
    beta = -beta;
    gamma = gamma + Math.PI;

    if (alpha === 2 * Math.PI) alpha = 0;
    if (gamma === 2 * Math.PI) gamma = 0;
    if (beta < 0) beta = 2 * Math.PI + beta;
    if (beta === 2 * Math.PI) beta = 0;

    const alphaD = Math.round((180 / Math.PI) * alpha);
    const betaD = Math.round((180 / Math.PI) * beta);
    const gammaD = Math.round((180 / Math.PI) * gamma);

    return { alpha, beta, gamma, alphaD, betaD, gammaD };
  }

  function rotateAroundAxis(p, t, phi) {
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

  function rotateAroundArbitraryAxis(p, tp, tv, phi) {
    const temp = { x: p.x - tp.x, y: p.y - tp.y, z: p.z - tp.z };
    const rottemp = rotateAroundAxis(temp, tv, phi);
    return { x: rottemp.x + tp.x, y: rottemp.y + tp.y, z: rottemp.z + tp.z };
  }

  function rotateAroundArbitraryAxisp(p, center, newcenter, tp, tv, phi) {
    const temp = { x: p.x + center.x, y: p.y + center.y, z: p.z + center.z };
    const rottemp = rotateAroundArbitraryAxis(temp, tp, tv, phi);
    return { x: rottemp.x - newcenter.x, y: rottemp.y - newcenter.y, z: rottemp.z - newcenter.z };
  }

  var geometry = /*#__PURE__*/Object.freeze({
    __proto__: null,
    addPoint: addPoint,
    avgPoints: avgPoints,
    avgPointsuv: avgPointsuv,
    clonePoint: clonePoint,
    crossProduct: crossProduct,
    getBaseMatrixInverse: getBaseMatrixInverse,
    getCoordsInBase: getCoordsInBase,
    getPointInBase: getPointInBase,
    getTForSheetLineCrossing: getTForSheetLineCrossing$1,
    inverseRPY: inverseRPY,
    multiplyMatrices: multiplyMatrices,
    normalPoint: normalPoint,
    pointDist: pointDist,
    rotateAroundArbitraryAxis: rotateAroundArbitraryAxis,
    rotateAroundArbitraryAxisp: rotateAroundArbitraryAxisp,
    rotateAroundAxis: rotateAroundAxis,
    rotatePoint: rotatePoint,
    roughPointDist: roughPointDist,
    round2digits: round2digits$1,
    roundVector2digits: roundVector2digits,
    subPoint: subPoint,
    vectorMagnitude: vectorMagnitude
  });

  /**
   * Coordinate transformation functions for isometric projection
   */


  const su = Math.SQRT1_2;
  const sv = Math.SQRT1_2 / 2;

  function transformPoint(p) {
    const u = (p.x - p.y) * su;
    const v = (p.x + p.y) * sv - p.z;
    return { u, v };
  }

  function transformPointz(p) {
    const u = (p.x - p.y) * su;
    const v = (p.x + p.y) * sv - p.z;
    const z = -(p.x + p.y);
    return { u, v, z };
  }

  function transformPointuv(p, transformFunc, canvasCenter) {
    const puv = transformFunc(p);
    return { u: canvasCenter.u + puv.u, v: canvasCenter.v + puv.v };
  }

  function transformPointuvz(p, transformFunc, canvasCenter) {
    const puv = transformFunc(p);
    return { u: canvasCenter.u + puv.u, v: canvasCenter.v + puv.v, z: puv.z };
  }

  function inverseTransformPoint(p) {
    const su = Math.SQRT1_2;
    const sv = su / 2;

    const x = ((p.u - state.canvasCenter.u) / su + (p.v - state.canvasCenter.v) / sv) / 2;
    const y = (p.v - state.canvasCenter.v) / sv - x;
    return { x: Math.floor(x), y: Math.floor(y), z: null };
  }

  function inverseTransformPointSimple(p) {
    const su = Math.SQRT1_2;
    const sv = su / 2;

    const x = (p.u / su + p.v / sv) / 2;
    const y = p.v / sv - x;
    return { x, y, z: null };
  }

  var transforms = /*#__PURE__*/Object.freeze({
    __proto__: null,
    inverseTransformPoint: inverseTransformPoint,
    inverseTransformPointSimple: inverseTransformPointSimple,
    transformPoint: transformPoint,
    transformPointuv: transformPointuv,
    transformPointuvz: transformPointuvz,
    transformPointz: transformPointz
  });

  /**
   * Shadow calculation and rendering system
   */


  const config$2 = {
    baseshadowCanvas: null,
    baseshadowContext: null,
    baseShadowCenter: { u: 212, v: 2 * 106 },
    lightSource: { x: 1, y: -3, z: -10 },
    lightSourcep1: { x: 1, y: -3, z: 1 },
    lightSourcep2: { x: -33, y: 11, z: 0 },
    shadowAlpha: 0.3,
    shadeAlpha: 0.3,
    drawShadows: true,
    shadowBaseMatrixInverse: null
  };

  function calculateSheetBaseShadow(sheet) {
    const s = sheet;
    const l = config$2.lightSource;
    const centerp = { x: s.centerp.x, y: s.centerp.y, z: s.centerp.z };
    const p0 = { x: centerp.x + s.p0.x, y: centerp.y + s.p0.y, z: centerp.z + s.p0.z };
    const p1 = { x: centerp.x + s.p1.x, y: centerp.y + s.p1.y, z: centerp.z + s.p1.z };
    const p2 = { x: centerp.x + s.p2.x, y: centerp.y + s.p2.y, z: centerp.z + s.p2.z };

    const tc = centerp.z / -l.z;
    const t0 = p0.z / -l.z;
    const t1 = p1.z / -l.z;
    const t2 = p2.z / -l.z;

    const centerpsect = { x: centerp.x + l.x * tc, y: centerp.y + l.y * tc, z: centerp.z + l.z * tc };
    const p0sect = { x: p0.x + l.x * t0 - centerpsect.x, y: p0.y + l.y * t0 - centerpsect.y, z: p0.z + l.z * t0 - centerpsect.z };
    const p1sect = { x: p1.x + l.x * t1 - centerpsect.x, y: p1.y + l.y * t1 - centerpsect.y, z: p1.z + l.z * t1 - centerpsect.z };
    const p2sect = { x: p2.x + l.x * t2 - centerpsect.x, y: p2.y + l.y * t2 - centerpsect.y, z: p2.z + l.z * t2 - centerpsect.z };

    // Import calculateSheetDataSingle from calc module when available
    s.baseShadoweData = calculateSheetDataSingle$1(centerpsect, p0sect, p1sect, p2sect, transformPoint, transformPointz, config$2.baseShadowCenter, s.corners);

    // Adjust for scene center when available
    if (window.scene) {
      s.baseShadoweData.translatex -= window.scene.center.u;
      s.baseShadoweData.translatey -= window.scene.center.v;
    }
  }

  function calculateSheetDataSingle$1(centerp, p0rot, p1rot, p2rot, transformFunction, transformFunctionz, canvasCenter, corners) {
    const centerpuv = transformFunction(centerp);
    const p0rotScale = { x: p0rot.x, y: p0rot.y, z: p0rot.z };
    const p1rotScale = { x: p1rot.x, y: p1rot.y, z: p1rot.z };
    const p2rotScale = { x: p2rot.x, y: p2rot.y, z: p2rot.z };

    const p0 = transformFunction(p0rotScale);
    const p1 = transformFunction(p1rotScale);
    const p2 = transformFunction(p2rotScale);

    const translatex = canvasCenter.u + p0.u + centerpuv.u;
    const translatey = canvasCenter.v + p0.v + centerpuv.v;
    const ta = p1.u;
    const tb = p1.v;
    const tc = p2.u;
    const td = p2.v;

    if (corners == null)
      return { p0uv: p0, p1uv: p1, p2uv: p2, translatex, translatey, ta, tb, tc, td, centerpuv };

    const c = [];
    c[0] = transformPointuvz(corners[0], transformFunctionz, canvasCenter);
    c[1] = transformPointuvz(corners[1], transformFunctionz, canvasCenter);
    c[2] = transformPointuvz(corners[2], transformFunctionz, canvasCenter);
    c[3] = transformPointuvz(corners[3], transformFunctionz, canvasCenter);

    const umax = Math.max(c[0].u, c[1].u, c[2].u, c[3].u);
    const umin = Math.min(c[0].u, c[1].u, c[2].u, c[3].u);
    const vmax = Math.max(c[0].v, c[1].v, c[2].v, c[3].v);
    const vmin = Math.min(c[0].v, c[1].v, c[2].v, c[3].v);
    const zmax = Math.max(c[0].z, c[1].z, c[2].z, c[3].z);
    const zmin = Math.min(c[0].z, c[1].z, c[2].z, c[3].z);

    return { p0uv: p0, p1uv: p1, p2uv: p2, translatex, translatey, ta, tb, tc, td, centerpuv, cornersuv: c, umax, umin, vmax, vmin, zmax, zmin };
  }

  function checkDirtyShadowConstraint(prev, dirtySheets) {
    for (let i = 0; i < state.sheets.length; i++) {
      const sheet = state.sheets[i];

      if (sheet.dirty) continue;
      if (sheet.hidden) continue;

      if (prev)
        sheet.shadowdirty = false;
      else {
        if (sheet.shadowdirty) continue;
      }

      for (let j = 0; j < sheet.polygons.length; j++) {
        const sheetpoly = sheet.polygons[j];
        const shadowconstraints = prev ? sheetpoly.prevshadowconstraints : sheetpoly.shadowconstraints;
        if (shadowconstraints == null) {
          sheet.shadowdirty = true;
          break;
        }
        for (let k = 0; k < shadowconstraints.length; k++) {
          const sheetconstraint = state.polygons[shadowconstraints[k]].sheetindex;
          if (dirtySheets.indexOf(sheetconstraint) != -1) {
            sheet.shadowdirty = true;
            break;
          }
        }
        if (sheet.shadowdirty) break;
      }
    }
  }

  function initBaseRectShadow(ctx, size, rel, viewport, drawing) {
    if (!config$2.drawShadows) return;

    ctx.clearRect(0, 0, size.w, size.h);

    for (let i = 0; i < state.sheets.length; i++) {
      const s = state.sheets[i];
      if (s.hidden) continue;
      if (!s.castshadows) continue;

      if (viewport) {
        const sheetdata = s.data;
        if (sheetdata.centerpuv.u < viewport.minu || sheetdata.centerpuv.u > viewport.maxu ||
            sheetdata.centerpuv.v < viewport.minv || sheetdata.centerpuv.v > viewport.maxv)
          continue;
      }

      s.baseShadoweData.translatex += rel.u;
      s.baseShadoweData.translatey += rel.v;
      drawing.drawRect(s.baseShadoweData, ctx, drawBaseShadowTexture, s.baseshadowcanvas, false);
      s.baseShadoweData.translatex -= rel.u;
      s.baseShadoweData.translatey -= rel.v;
    }
  }

  function drawBaseShadowTexture(context, canvas) {
    context.drawImage(canvas, 0, 0);
  }

  function drawBaseRectShadow() {
    state.context.save();
    state.context.globalAlpha = config$2.shadowAlpha;
    if (window.scene) {
      state.context.drawImage(config$2.baseshadowCanvas, state.canvasCenter.u - window.scene.tilesize.x, state.canvasCenter.v - 2 * window.scene.tilesize.y);
    }
    state.context.restore();
  }

  function drawSheetShadow(sheet) {
    if (sheet.hidden) return;

    const drawshadows = !sheet.shaded && config$2.drawShadows && sheet.allowshadows;

    if (drawshadows) {
      sheet.shadowtempcontext.clearRect(0, 0, sheet.width, sheet.height);
      sheet.shadowData = [];

      for (let j = 0; j < sheet.polygons.length; j++) {
        const sheetpoly = sheet.polygons[j];
        const shadowconstraints = sheetpoly.shadowconstraints;

        const sheetsconstraints = [];
        for (let k = 0; k < shadowconstraints.length; k++) {
          const shadowcaster = state.polygons[shadowconstraints[k]].sheetindex;

          if (sheetsconstraints.indexOf(shadowcaster) != -1) continue;
          sheetsconstraints.push(shadowcaster);

          const shadowcastersheet = state.sheets[shadowcaster];
          if (shadowcastersheet.hidden) continue;
          if (!shadowcastersheet.castshadows) continue;

          sheet.shadowtempcontext.save();

          sheet.shadowtempcontext.beginPath();
          for (let pi = 0; pi < sheetpoly.points.length; pi++) {
            sheet.shadowtempcontext.lineTo(sheetpoly.pointscanvasuv[pi].u, sheetpoly.pointscanvasuv[pi].v);
          }
          sheet.shadowtempcontext.closePath();
          sheet.shadowtempcontext.clip();

          if (sheet.shadowData[shadowcastersheet.index] == null)
            sheet.shadowData[shadowcastersheet.index] = calculateShadowData(sheet, shadowcastersheet);

          const sheetData = sheet.shadowData[shadowcastersheet.index];
          sheet.shadowtempcontext.transform(sheetData.ta, sheetData.tb, sheetData.tc, sheetData.td, sheetData.translatex, sheetData.translatey);
          sheet.shadowtempcontext.drawImage(shadowcastersheet.shadowcanvas, 0, 0);
          sheet.shadowtempcontext.restore();
        }
      }
    }

    sheet.compositecontext.save();
    sheet.compositecontext.drawImage(sheet.canvas, 0, 0);

    if (sheet.shaded) {
      sheet.compositecontext.globalCompositeOperation = 'source-over';
      sheet.compositecontext.globalAlpha = config$2.shadeAlpha;
      sheet.compositecontext.drawImage(sheet.shadowcanvas, 0, 0);
    } else {
      const shadeThresh = 0;
      if (sheet.shadealpha > shadeThresh) {
        sheet.compositecontext.globalCompositeOperation = 'source-over';
        sheet.compositecontext.globalAlpha = sheet.shadealpha;
        sheet.compositecontext.drawImage(sheet.shadowcanvas, 0, 0);
      } else {
        sheet.compositecontext.globalCompositeOperation = 'source-atop';
        sheet.compositecontext.globalAlpha = (shadeThresh - sheet.shadealpha * 6);
        sheet.compositecontext.fillStyle = '#FFF';
        sheet.compositecontext.fillRect(0, 0, sheet.width, sheet.height);
      }
    }

    if (drawshadows) {
      sheet.compositecontext.globalAlpha = config$2.shadowAlpha - sheet.shadealpha;
      sheet.compositecontext.globalCompositeOperation = 'source-atop';
      sheet.compositecontext.drawImage(sheet.shadowtempcanvas, 0, 0);
    }
    sheet.compositecontext.restore();
  }

  function calculateSheetsShadows(calculateAll) {
    for (let i = 0; i < state.sheets.length; i++) {
      const sheet = state.sheets[i];
      if (sheet.shadowdirty || sheet.dirty || calculateAll)
        drawSheetShadow(sheet);
    }
  }

  function calculateShadowData(sheet, shadowcaster) {
    const s = shadowcaster;
    const l = config$2.lightSource;

    const centerp = { x: s.centerp.x, y: s.centerp.y, z: s.centerp.z };
    const p0 = { x: s.centerp.x + s.p0.x, y: s.centerp.y + s.p0.y, z: s.centerp.z + s.p0.z };
    const p1 = { x: s.centerp.x + s.p1.x, y: s.centerp.y + s.p1.y, z: s.centerp.z + s.p1.z };
    const p2 = { x: s.centerp.x + s.p2.x, y: s.centerp.y + s.p2.y, z: s.centerp.z + s.p2.z };

    const tc = getTForSheetLineCrossing(sheet.normalp, sheet.centerp, centerp, l);
    const t0 = getTForSheetLineCrossing(sheet.normalp, sheet.centerp, p0, l);
    const t1 = getTForSheetLineCrossing(sheet.normalp, sheet.centerp, p1, l);
    const t2 = getTForSheetLineCrossing(sheet.normalp, sheet.centerp, p2, l);

    const centerpsect = { x: centerp.x + l.x * tc, y: centerp.y + l.y * tc, z: centerp.z + l.z * tc };
    const p0sect = { x: p0.x + l.x * t0 - centerpsect.x, y: p0.y + l.y * t0 - centerpsect.y, z: p0.z + l.z * t0 - centerpsect.z };
    const p1sect = { x: p1.x + l.x * t1 - centerpsect.x, y: p1.y + l.y * t1 - centerpsect.y, z: p1.z + l.z * t1 - centerpsect.z };
    const p2sect = { x: p2.x + l.x * t2 - centerpsect.x, y: p2.y + l.y * t2 - centerpsect.y, z: p2.z + l.z * t2 - centerpsect.z };

    const eData = calculateSheetDataSingle$1(centerpsect, p0sect, p1sect, p2sect, transformPoint, null, state.canvasCenter, null);

    const A1 = getBaseMatrixInverse({ x: sheet.data.ta, y: sheet.data.tb, z: 0 }, { x: sheet.data.tc, y: sheet.data.td, z: 0 }, { x: sheet.data.translatex, y: sheet.data.translatey, z: 1 });
    const C = multiplyMatrices(A1.b1, A1.b2, A1.b3, { x: eData.ta, y: eData.tb, z: 0 }, { x: eData.tc, y: eData.td, z: 0 }, { x: eData.translatex, y: eData.translatey, z: 1 });

    const sheetData = { translatex: C.c3.x, translatey: C.c3.y, ta: C.c1.x, tb: C.c1.y, tc: C.c2.x, td: C.c2.y };
    return sheetData;
  }

  function getTForSheetLineCrossing(normalp, centerp, p, l) {
    return (
      (normalp.x * centerp.x + normalp.y * centerp.y + normalp.z * centerp.z -
        normalp.x * p.x - normalp.y * p.y - normalp.z * p.z) /
      (normalp.x * l.x + normalp.y * l.y + normalp.z * l.z)
    );
  }

  function isSheetDark(sheet, viewSource) {
    const v = viewSource;
    const l = config$2.lightSource;

    const lightPoint = { x: sheet.centerp.x - (l.x * 100), y: sheet.centerp.y - (l.y * 100), z: sheet.centerp.z - (l.z * 100) };
    const viewPoint = { x: sheet.centerp.x - (v.x * 100), y: sheet.centerp.y - (v.y * 100), z: sheet.centerp.z - (v.z * 100) };

    const nrr0 = sheet.normalp.x * (lightPoint.x - sheet.centerp.x) + sheet.normalp.y * (lightPoint.y - sheet.centerp.y) + sheet.normalp.z * (lightPoint.z - sheet.centerp.z);
    const nrr02 = -sheet.normalp.x * (viewPoint.x - sheet.centerp.x) - sheet.normalp.y * (viewPoint.y - sheet.centerp.y) - sheet.normalp.z * (viewPoint.z - sheet.centerp.z);

    const backToLightSource = nrr0 < 0;
    const backToViewSource = nrr02 < 0;
    return (backToLightSource && backToViewSource) || (!backToLightSource && !backToViewSource);
  }

  function calculateSheetShade(sheet) {
    if (!sheet.allowshadows) {
      sheet.shaded = false;
      sheet.shadealpha = 0;
      return;
    }

    const l = config$2.lightSource;
    const n = sheet.normalp;
    const scale = 3;

    const axb = vectorMagnitude(crossProduct(l, n));
    const ab = vectorMagnitude(l) * vectorMagnitude(n);
    const t = Math.asin(axb / ab) / (Math.PI * scale);

    sheet.shaded = isSheetDark(sheet, state.viewSource);
    sheet.shadealpha = t - 0.05;
  }

  function drawBaseRectShadows(context, offset) {
    if (!offset) offset = { u: 0, v: 0 };
    context.save();
    context.globalAlpha = config$2.shadowAlpha;
    context.drawImage(config$2.baseshadowCanvas, offset.u, offset.v);
    context.restore();
  }

  // Initialize shadow base matrix inverse
  config$2.shadowBaseMatrixInverse = getBaseMatrixInverse(config$2.lightSourcep1, config$2.lightSourcep2, config$2.lightSource);

  var shadows = /*#__PURE__*/Object.freeze({
    __proto__: null,
    calculateSheetBaseShadow: calculateSheetBaseShadow,
    calculateSheetShade: calculateSheetShade,
    calculateSheetsShadows: calculateSheetsShadows,
    checkDirtyShadowConstraint: checkDirtyShadowConstraint,
    config: config$2,
    drawBaseRectShadow: drawBaseRectShadow,
    drawBaseRectShadows: drawBaseRectShadows,
    drawSheetShadow: drawSheetShadow,
    initBaseRectShadow: initBaseRectShadow
  });

  /**
   * Canvas drawing utilities and rendering functions
   */


  const config$1 = {
    drawBaseRect: null,
    drawBeforeSheets: null,
    drawAfterSheets: null,
    useClipCorrection: false,
    dimmedAlpha: 0.2,
    allowContourDrawing: true,
    hoveredSheetColor: '#F80',
    selectedSheetColor: '#00F',
    selectrectlinewidth: 2
  };

  function createCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function redraw() {
    state.context.clearRect(0, 0, state.canvas.width, state.canvas.height);
    if (config$1.drawBaseRect)
      config$1.drawBaseRect();
    if (config$2.drawShadows) {
      initBaseRectShadow(config$2.baseshadowContext, { w: config$2.baseshadowCanvas.width, h: config$2.baseshadowCanvas.height }, { u: 0, v: 0 });
      drawBaseRectShadow();
    }
    if (config$1.drawBeforeSheets)
      config$1.drawBeforeSheets();
    drawSheets(state.context);
    if (config$1.drawAfterSheets)
      config$1.drawAfterSheets();
  }

  function round2digits(a, digits) {
    return Math.round(a * digits) / digits;
  }

  function drawRect(sheetdata, context, drawFunction, canvas, allowContourDrawing, poly) {
    const a = round2digits(sheetdata.p1uv.u, 1000);
    const b = round2digits(sheetdata.p1uv.v, 1000);
    const c = round2digits(sheetdata.p2uv.u, 1000);
    const d = round2digits(sheetdata.p2uv.v, 1000);

    if ((a == 0 && c == 0) || (c == 0 && d == 0) || (a == 0 && b == 0) || (b == 0 && d == 0) || (a + b == 0 && c + d == 0)) {
      if (allowContourDrawing && config$1.allowContourDrawing)
        drawSelectRect(sheetdata, context, 0);
      return;
    }

    context.save();
    if (poly != null) {
      let allcornersincluded = true;
      for (let i = 0; i < 4; i++) {
        const c = sheetdata.cornersuv[i];
        let cornerincluded = false;
        for (let polyi = 0; polyi < poly.points.length; polyi++) {
          const p = poly.data.pointsuv[polyi];
          if (c.u == p.u && c.v == p.v) {
            cornerincluded = true;
            break;
          }
        }
        if (!cornerincluded) {
          allcornersincluded = false;
          break;
        }
      }
      if (!allcornersincluded) {
        context.beginPath();
        for (let polyi = 0; polyi < poly.points.length; polyi++) {
          const p = poly.data.pointsuv[polyi];
          if (config$1.useClipCorrection) {
            const avg = poly.data.avguv;
            const corru = (p.u - avg.u) * 0.03;
            const corrv = (p.v - avg.v) * 0.03;
            context.lineTo(p.u + corru, p.v + corrv);
          } else {
            context.lineTo(p.u, p.v);
          }
        }
        context.closePath();
        context.clip();
      }
    }
    context.transform(sheetdata.ta, sheetdata.tb, sheetdata.tc, sheetdata.td, sheetdata.translatex, sheetdata.translatey);
    drawFunction(context, canvas);
    context.beginPath();
    context.restore();
  }

  function drawTexture(context, canvas) {
    context.drawImage(canvas, 0, 0);
  }

  function drawSelectRect(sheetdata, context, selected) {
    context.save();

    context.globalAlpha = 1;
    switch (selected) {
      case 0:
        context.strokeStyle = '#000';
        break;
      case 1:
        context.strokeStyle = '#00F';
        context.globalAlpha = 0.5;
        break;
      case 2:
        context.strokeStyle = '#F80';
        context.globalAlpha = 0.5;
        break;
      case 3:
        context.strokeStyle = '#00F';
        break;
    }
    context.lineWidth = config$1.selectrectlinewidth;

    context.beginPath();
    context.moveTo(sheetdata.cornersuv[0].u, sheetdata.cornersuv[0].v);
    context.lineTo(sheetdata.cornersuv[1].u, sheetdata.cornersuv[1].v);
    context.lineTo(sheetdata.cornersuv[2].u, sheetdata.cornersuv[2].v);
    context.lineTo(sheetdata.cornersuv[3].u, sheetdata.cornersuv[3].v);
    context.lineTo(sheetdata.cornersuv[0].u, sheetdata.cornersuv[0].v);
    context.closePath();
    context.stroke();

    context.restore();
  }

  function redrawSheetCanvases(sheet) {
    sheet.baseshadowcontext.save();
    sheet.baseshadowcontext.clearRect(0, 0, sheet.width, sheet.height);
    sheet.baseshadowcontext.drawImage(sheet.canvas, 0, 0);
    sheet.baseshadowcontext.globalCompositeOperation = 'source-in';
    sheet.baseshadowcontext.fillStyle = '#000';
    sheet.baseshadowcontext.fillRect(0, 0, sheet.width, sheet.height);
    sheet.baseshadowcontext.restore();

    sheet.shadowcontext.save();
    sheet.shadowcontext.clearRect(0, 0, sheet.width, sheet.height);
    sheet.shadowcontext.drawImage(sheet.canvas, 0, 0);
    sheet.shadowcontext.globalCompositeOperation = 'source-in';
    sheet.shadowcontext.fillStyle = '#000';
    sheet.shadowcontext.fillRect(0, 0, sheet.width, sheet.height);
    sheet.shadowcontext.restore();
  }

  function drawSheetSelection(sheet, polygon, sheetData, context) {
    const hoverSheet = state.hoverSheet != -1 ? state.sheets[state.hoverSheet] : null;
    const hovered = state.hoverSheet == sheet.index || (hoverSheet != null && sheet.group != null && sheet.group == hoverSheet.group) || (hoverSheet != null && sheet.objectsheet && sheet.object == hoverSheet.object);
    const selected = state.currentSheet == sheet.index;
    const inSelection = sheet.inSelection;
    if (hovered || selected || inSelection) {
      const color = (inSelection || selected) ? 2 : 1;
      drawSelectPoly(sheetData, context, color, sheet, polygon);
    }
  }

  function drawSelectPoly(sheetdata, context, color, sheet, poly) {
    context.save();

    context.globalAlpha = 1;
    switch (color) {
      case 1:
        context.strokeStyle = config$1.hoveredSheetColor;
        break;
      case 2:
        context.strokeStyle = config$1.selectedSheetColor;
        break;
    }
    context.lineWidth = 2;

    context.beginPath();
    for (let j = 0; j < poly.points.length; j++) {
      const next = j == poly.points.length - 1 ? 0 : j + 1;
      context.moveTo(poly.data.pointsuv[j].u, poly.data.pointsuv[j].v);
      const inframe = pointsInFrame(poly.data.pointsuv[j], poly.data.pointsuv[next], sheetdata.cornersuv);

      if (inframe) {
        context.lineTo(poly.data.pointsuv[next].u, poly.data.pointsuv[next].v);
      }
    }

    context.closePath();
    context.stroke();

    context.restore();
  }

  function pointsInFrame(p1, p2, cornersuv) {
    return pointsInFrameLine(p1, p2, cornersuv[0], cornersuv[1]) ||
      pointsInFrameLine(p1, p2, cornersuv[1], cornersuv[2]) ||
      pointsInFrameLine(p1, p2, cornersuv[2], cornersuv[3]) ||
      pointsInFrameLine(p1, p2, cornersuv[3], cornersuv[0]);
  }

  function pointsInFrameLine(p1, p2, c1, c2) {
    const diffu1 = p1.u - c1.u;
    const diffu2 = p2.u - c1.u;
    const diffu3 = c2.u - c1.u;
    const diffv1 = p1.v - c1.v;
    const diffv2 = p2.v - c1.v;
    const diffv3 = c2.v - c1.v;
    const div1 = (diffu1 / diffu3);
    const div2 = (diffv1 / diffv3);
    const div3 = (diffu2 / diffu3);
    const div4 = (diffv2 / diffv3);
    const thresh1 = 0.1;
    const thresh2 = 2;
    const inline = (Math.abs(div1 - div2) < thresh1 && Math.abs(div3 - div4) < thresh1) || (Math.abs(diffu3) < thresh2 && Math.abs(diffu2) < thresh2 & Math.abs(diffu1) < thresh2) || (Math.abs(diffv3) < thresh2 && Math.abs(diffv2) < thresh2 && Math.abs(diffv1) < thresh2);
    return inline;
  }

  function drawSheets(context, viewport) {
    if (state.sheets.length == 0) return;

    for (let i = 0; i < state.orderedPolygons.length; i++) {
      const polygon = state.polygons[state.orderedPolygons[i]];
      const sheet = state.sheets[polygon.sheetindex];
      if (viewport) {
        const sheetdata = sheet.data;
        if (sheetdata.centerpuv.u < viewport.minu || sheetdata.centerpuv.u > viewport.maxu || sheetdata.centerpuv.v < viewport.minv || sheetdata.centerpuv.v > viewport.maxv)
          continue;
      }
      if (sheet.hidden) continue;
      if (sheet.dimmed) {
        context.save();
        context.globalAlpha = config$1.dimmedAlpha;
      }
      drawRect(sheet.data, context, drawTexture, sheet.compositecanvas, true, polygon);
      if (sheet.dimmed) {
        context.restore();
      }
      drawSheetSelection(sheet, polygon, sheet.data, context);
    }
  }

  function getPointuv(p) {
    const puv = transformPoint(p);
    if (window.scene) {
      return {
        u: puv.u + state.canvasCenter.u - window.scene.center.u,
        v: puv.v + state.canvasCenter.v - window.scene.center.v
      };
    }
    return { u: puv.u + state.canvasCenter.u, v: puv.v + state.canvasCenter.v };
  }

  function drawScenePart(options) {
    const viewPort = options.viewPort;
    const targetContext = options.targetContext;
    const targetBaseShadowContext = options.targetBaseShadowContext;
    const targetBaseShadowCanvas = options.targetBaseShadowCanvas;

    if (!targetContext) {
      targetContext = state.temppartcontext;
      targetBaseShadowContext = state.temppartshadowcontext;
      targetBaseShadowCanvas = state.temppartshadowcanvas;
    }

    targetContext.fillStyle = state.backgroundColor;
    targetContext.fillRect(0, 0, viewPort.w, viewPort.h);

    const u = viewPort.u + state.canvasCenter.u;
    const v = viewPort.v + state.canvasCenter.v;

    targetContext.save();
    targetContext.translate(-u, -v);

    drawBaseRects(targetContext);

    const distance = state.boundingBoxMaxsheetDistance;
    const minu = viewPort.u - distance;
    const minv = viewPort.v - distance;
    const maxu = viewPort.u + viewPort.w + distance;
    const maxv = viewPort.v + viewPort.h + distance;

    if (window.scene) {
      const shadowrel = { u: -u + window.scene.center.u + state.canvasCenter.u - config$2.baseShadowCenter.u, v: -v + window.scene.center.v + state.canvasCenter.v - config$2.baseShadowCenter.v };
      initBaseRectShadow(targetBaseShadowContext, { w: viewPort.w, h: viewPort.h }, shadowrel, { minu, maxu, minv, maxv });
      targetContext.save();
      targetContext.globalAlpha = config$2.shadowAlpha;
      targetContext.drawImage(targetBaseShadowCanvas, u, v);
      targetContext.restore();
    }

    drawSheets(targetContext, { minu, maxu, minv, maxv });

    targetContext.restore();
  }

  function drawScene(full) {
    if (full) {
      if (state.backgroundcanvas) {
        state.backgroundcontext.clearRect(0, 0, state.backgroundcanvas.width, state.backgroundcanvas.height);

        state.backgroundcontext.save();
        state.backgroundcontext.translate(-state.canvasCenter.u + config$2.baseShadowCenter.u, -state.canvasCenter.v + config$2.baseShadowCenter.v);
        drawBaseRects(state.backgroundcontext);
        state.backgroundcontext.restore();

        if (window.scene) {
          const shadowrel = { u: window.scene.center.u, v: window.scene.center.v };
          initBaseRectShadow(config$2.baseshadowContext, { w: config$2.baseshadowCanvas.width, h: config$2.baseshadowCanvas.height }, shadowrel, null);
          drawBaseRectShadows(state.backgroundcontext, { u: state.backgroundtranslate.u, v: state.backgroundtranslate.v });
        }

        state.backgroundcontext.save();
        state.backgroundcontext.translate(-state.canvasCenter.u + config$2.baseShadowCenter.u, -state.canvasCenter.v + config$2.baseShadowCenter.v);
        drawSheets(state.backgroundcontext, null);
        state.backgroundcontext.restore();
      } else {
        state.context.clearRect(0, 0, state.canvas.width, state.canvas.height);
        drawBaseRects(state.context);

        if (window.scene) {
          const shadowrel = { u: window.scene.center.u, v: window.scene.center.v };
          initBaseRectShadow(config$2.baseshadowContext, { w: config$2.baseshadowCanvas.width, h: config$2.baseshadowCanvas.height }, shadowrel, null);
          drawBaseRectShadows(state.context);
        }

        drawSheets(state.context, null);
      }
      if (state.drawObjectContour) {
        for (let i = 0; i < state.objects.length; i++) {
          const obj = state.objects[i];
          obj.canvasdirty = true;
          obj.draw();
        }
      }
    } else {
      for (let i = 0; i < state.sheets.length; i++) {
        const s = state.sheets[i];

        const dimmedChanged = s.dimmed != s.dimmedprev;
        s.dimmedprev = s.dimmed;

        if (dimmedChanged) {
          const w = Math.ceil(s.data.umax - s.data.umin);
          const h = Math.ceil(s.data.vmax - s.data.vmin);
          const u = s.data.umin - state.canvasCenter.u;
          const v = s.data.vmin - state.canvasCenter.v;

          drawScenePart({ viewPort: { u, v, w, h } });
          const canvas = state.backgroundcanvas ? state.backgroundcanvas : state.canvas;
          const context = state.backgroundcanvas ? state.backgroundcontext : state.context;
          const offsetu = u + canvas.width / 2;
          const offsetv = v + canvas.height / 2;
          context.drawImage(state.temppartcanvas, 0, 0, w - 1, h - 1, offsetu, offsetv, w - 1, h - 1);
        }
      }

      for (let i = 0; i < state.objects.length; i++) {
        const obj = state.objects[i];
        obj.draw();
      }
    }

    if (state.backgroundcanvas) {
      state.context.clearRect(0, 0, state.canvas.width, state.canvas.height);
      if (window.scene) {
        const offsetu = -window.scene.center.u - state.backgroundcanvas.width / 2 + state.canvas.width / 2 + state.backgroundtranslate.u;
        const offsetv = -window.scene.center.v - state.backgroundcanvas.height / 2 + state.canvas.height / 2 + state.backgroundtranslate.v;
        state.context.drawImage(state.backgroundcanvas, offsetu, offsetv);
      }
    }
  }

  function drawBaseRects(context) {
    for (let i = 0; i < state.basesheets.length; i++) {
      const basesheet = state.basesheets[i];
      drawRect(basesheet.data, context, (ctx, canvas) => {
        ctx.fillStyle = basesheet.color;
        ctx.fillRect(0, 0, basesheet.width, basesheet.height);
      }, null, false);
    }
  }

  var drawing = /*#__PURE__*/Object.freeze({
    __proto__: null,
    config: config$1,
    createCanvas: createCanvas,
    drawRect: drawRect,
    drawScene: drawScene,
    drawScenePart: drawScenePart,
    drawSheets: drawSheets,
    getPointuv: getPointuv,
    redraw: redraw,
    redrawSheetCanvases: redrawSheetCanvases
  });

  /**
   * Sheet intersection detection and polygon calculation
   */


  const config = {
    intersections: true
  };

  const polygonMidpointsForOverlapCheck = [
    { dist: 50, numpoints: 4 },
    { dist: 20, numpoints: 3 },
    { dist: 10, numpoints: 2 },
    { dist: 0, numpoints: 1 }
  ];

  function getIntersection(n, p, c1, c2) {
    const p2 = c1;
    const n2 = { x: c2.x - c1.x, y: c2.y - c1.y, z: c2.z - c1.z };

    const p2p = { x: p.x - p2.x, y: p.y - p2.y, z: p.z - p2.z };
    const cp1 = crossProduct(p2p, n);
    const cp2 = crossProduct(n2, n);
    let t = vectorMagnitude(cp1) / vectorMagnitude(cp2);

    const check = cp2.x * t + cp2.y * t + cp2.z * t - cp1.x - cp1.y - cp1.z;
    if (Math.round(check) != 0)
      t = -t;

    return { p: { x: p2.x + t * n2.x, y: p2.y + t * n2.y, z: p2.z + t * n2.z }, inside: t >= 0 && t <= 1, t };
  }

  function pointsEqual(p1, p2) {
    return Math.round(p1.x) == Math.round(p2.x) && Math.round(p1.y) == Math.round(p2.y) && Math.round(p1.z) == Math.round(p2.z);
  }

  function bisectCornerList(corners, n, p) {
    const allcorners = [];
    let firstintersect = null;
    let secondintersect = null;
    for (let i = 0; i < corners.length; i++) {
      const j = i == corners.length - 1 ? 0 : i + 1;
      let corneradded = false;
      if ((allcorners.length == 0) || (!pointsEqual(allcorners[allcorners.length - 1], corners[i]))) {
        allcorners[allcorners.length] = corners[i];
        corneradded = true;
      }
      const p1 = getIntersection(n, p, corners[i], corners[j]);
      if (p1.inside) {
        const pointalreadyadded = pointsEqual(allcorners[allcorners.length - 1], p1.p);
        if (!pointalreadyadded) {
          if (firstintersect == null)
            firstintersect = allcorners.length;
          else if (secondintersect == null)
            secondintersect = allcorners.length;
          allcorners[allcorners.length] = p1.p;
        }
        if ((pointalreadyadded) && (corneradded)) {
          if (firstintersect == null)
            firstintersect = allcorners.length - 1;
          else if (secondintersect == null)
            secondintersect = allcorners.length - 1;
        }
      }
    }

    if (secondintersect == null)
      return null;

    const poly = [];
    poly[0] = [];
    poly[1] = [];
    let index = firstintersect;
    for (; ;) {
      poly[0][poly[0].length] = clonePoint(allcorners[index]);
      if (index == secondintersect) break;
      index--;
      if (index < 0) index = allcorners.length - 1;
    }
    index = firstintersect;
    for (; ;) {
      poly[1][poly[1].length] = clonePoint(allcorners[index]);
      if (index == secondintersect) break;
      index++;
      if (index > allcorners.length - 1) index = 0;
    }
    return poly;
  }

  function isInsideCornerList(corners, n, p) {
    for (let i = 0; i < corners.length; i++) {
      const j = i == corners.length - 1 ? 0 : i + 1;
      const p1 = getIntersection(n, p, corners[i], corners[j]);
      if (p1.inside) return true;
    }
    return false;
  }

  function getIntersectionLineofPlanes(a, b) {
    const maxdiag = a.maxdiag + b.maxdiag;
    const distance = Math.sqrt(
      ((a.centerp.x - b.centerp.x) * (a.centerp.x - b.centerp.x)) +
      ((a.centerp.y - b.centerp.y) * (a.centerp.y - b.centerp.y)) +
      ((a.centerp.z - b.centerp.z) * (a.centerp.z - b.centerp.z))
    );
    if (distance > maxdiag) return null;

    const n1n2 = a.normalp.x * b.normalp.x + a.normalp.y * b.normalp.y + a.normalp.z * b.normalp.z;
    if (n1n2 == 1) return null;

    const n1n1 = a.normalp.x * a.normalp.x + a.normalp.y * a.normalp.y + a.normalp.z * a.normalp.z;
    const n2n2 = b.normalp.x * b.normalp.x + b.normalp.y * b.normalp.y + b.normalp.z * b.normalp.z;

    const n = crossProduct(a.normalp, b.normalp);

    const d1 = (a.normalp.x * a.centerp.x + a.normalp.y * a.centerp.y + a.normalp.z * a.centerp.z);
    const d2 = (b.normalp.x * b.centerp.x + b.normalp.y * b.centerp.y + b.normalp.z * b.centerp.z);

    const det = n1n1 * n2n2 - n1n2 * n1n2;
    const c1 = (d1 * n2n2 - d2 * n1n2) / det;
    const c2 = (d2 * n1n1 - d1 * n1n2) / det;

    const p = {
      x: c1 * a.normalp.x + c2 * b.normalp.x,
      y: c1 * a.normalp.y + c2 * b.normalp.y,
      z: c1 * a.normalp.z + c2 * b.normalp.z
    };

    return { n, p: roundVector2digits(p, 10000) };
  }

  function doSheetsIntersect(s1, s2) {
    const line = getIntersectionLineofPlanes(s1, s2);

    s1.intersectionParams[s2.index] = { line };
    s2.intersectionParams[s1.index] = { line };

    if (line == null) return false;

    const insideS1 = isInsideCornerList(s1.corners, line.n, line.p);
    const insideS2 = isInsideCornerList(s2.corners, line.n, line.p);

    s1.intersectionParams[s2.index].insideThis = insideS1;
    s1.intersectionParams[s2.index].insideOther = insideS2;
    s2.intersectionParams[s1.index].insideThis = insideS2;
    s2.intersectionParams[s1.index].insideOther = insideS1;

    return insideS1 && insideS2;
  }

  function calculatePolygonsForSheet(sheet, sheetset) {
    if (sheet.hidden) return;

    if (!sheetset) sheetset = state.sheets;

    for (let s = 0; s < sheetset.length; s++) {
      const othersheet = sheetset[s];
      if (othersheet.index == sheet.index) continue;
      if (othersheet.hidden) continue;

      const intersectionParams = sheet.intersectionParams[othersheet.index];

      const line = intersectionParams == null ?
        getIntersectionLineofPlanes(sheet, othersheet) :
        intersectionParams.line;
      if (line == null) continue;

      let startpolygons1 = null;
      let poly1initialized = false;
      let inside = false;
      if (sheet.polygons.length == 1) {
        startpolygons1 = bisectCornerList(sheet.corners, line.n, line.p);
        inside = !(startpolygons1 == null);
        poly1initialized = true;
      } else {
        inside = intersectionParams == null ?
          isInsideCornerList(sheet.corners, line.n, line.p) :
          intersectionParams.insideThis;
      }
      if (!inside) continue;

      inside = intersectionParams == null ?
        isInsideCornerList(othersheet.corners, line.n, line.p) :
        intersectionParams.insideOther;

      if (!inside) continue;

      const newpoly = [];
      for (let i = 0; i < sheet.polygons.length; i++) {
        let polygons = null;
        if (poly1initialized) {
          polygons = startpolygons1;
          poly1initialized = false;
        } else {
          polygons = bisectCornerList(sheet.polygons[i].points, line.n, line.p);
        }
        if (polygons == null)
          newpoly[newpoly.length] = sheet.polygons[i];
        else {
          newpoly[newpoly.length] = { points: polygons[0] };
          newpoly[newpoly.length] = { points: polygons[1] };
        }
      }
      sheet.polygons = newpoly;
      sheet.intersectors.push(othersheet.index);
    }
  }

  function filterPolygons(polygons) {
    const newpoly = [];
    for (let p = 0; p < polygons.length; p++) {
      const poly = polygons[p];
      if (poly.points.length == 2) continue;
      newpoly.push(poly);
    }
    return newpoly;
  }

  function updateuvzMaxMin(data, pi) {
    if (data.pointsuv[pi].u < data.umin) data.umin = data.pointsuv[pi].u;
    if (data.pointsuv[pi].u > data.umax) data.umax = data.pointsuv[pi].u;
    if (data.pointsuv[pi].v < data.vmin) data.vmin = data.pointsuv[pi].v;
    if (data.pointsuv[pi].v > data.vmax) data.vmax = data.pointsuv[pi].v;
    if (data.pointsuv[pi].z < data.zmin) data.zmin = data.pointsuv[pi].z;
    if (data.pointsuv[pi].z > data.zmax) data.zmax = data.pointsuv[pi].z;
  }

  function getMidpointNum(dist) {
    for (let k = 0; k < polygonMidpointsForOverlapCheck.length; k++) {
      if (dist > polygonMidpointsForOverlapCheck[k].dist)
        return polygonMidpointsForOverlapCheck[k].numpoints;
    }
    return polygonMidpointsForOverlapCheck[polygonMidpointsForOverlapCheck.length - 1].numpoints;
  }

  function getPointForCanvasUV(sheet, p) {
    const A1 = sheet.A1;
    const p0 = sheet.corners[0];
    const p0p = { x: p.x - p0.x, y: p.y - p0.y, z: p.z - p0.z };
    return {
      u: p0p.x * A1.b1.x + p0p.y * A1.b2.x + p0p.z * A1.b3.x,
      v: p0p.x * A1.b1.y + p0p.y * A1.b2.y + p0p.z * A1.b3.y
    };
  }

  function calculateSheetSections(sheet, full, sheetset) {
    const currentsheet = sheet;

    if (full) {
      currentsheet.polygons = [];
      currentsheet.polygons[0] = { points: currentsheet.corners };

      currentsheet.intersectors = [];
      if (config.intersections)
        calculatePolygonsForSheet(currentsheet, sheetset);

      currentsheet.polygons = filterPolygons(currentsheet.polygons);
    }

    for (let p = 0; p < currentsheet.polygons.length; p++) {
      const poly = currentsheet.polygons[p];
      const umin = 10000, umax = -1e4, vmin = 10000, vmax = -1e4, zmin = 10000, zmax = -1e4;
      poly.pointscanvasuv = [];
      poly.data = { umin, umax, vmin, vmax, zmin, zmax, pointsuv: [] };
      poly.shData = { umin, umax, vmin, vmax, zmin, zmax, pointsuv: [] };

      const avg = { u: 0, v: 0 };
      for (let pi = 0; pi < poly.points.length; pi++) {
        const polypointspi = poly.points[pi];
        poly.pointscanvasuv[pi] = getPointForCanvasUV(currentsheet, polypointspi);

        poly.data.pointsuv[pi] = transformPointuvz(polypointspi, transformPointz, state.canvasCenter);

        avg.u += poly.data.pointsuv[pi].u;
        avg.v += poly.data.pointsuv[pi].v;

        const c1xyz = getCoordsInBase(config$2.shadowBaseMatrixInverse, polypointspi);
        poly.shData.pointsuv[pi] = { u: c1xyz.x, v: c1xyz.y, z: c1xyz.z };

        updateuvzMaxMin(poly.data, pi);
        updateuvzMaxMin(poly.shData, pi);
      }

      avg.u /= poly.points.length;
      avg.v /= poly.points.length;
      poly.data.avguv = { u: avg.u, v: avg.v };

      poly.midpoints = [];
      poly.data.midpointsuv = [];
      poly.shData.midpointsuv = [];
      for (let pi = 0; pi < poly.points.length; pi++) {
        const pj = pi == poly.points.length - 1 ? 0 : pi + 1;
        const dist = roughPointDist(poly.points[pi], poly.points[pj]);
        const midpoints = getMidpointNum(dist) + 1;
        for (let k = 1; k < midpoints; k++) {
          const ratio1 = k;
          const ratio2 = midpoints - ratio1;
          poly.midpoints[poly.midpoints.length] = avgPoints(poly.points[pi], poly.points[pj], ratio1, ratio2, midpoints);
        }
        const p1 = poly.data.pointsuv[pi];
        const p2 = poly.data.pointsuv[pj];
        for (let k = 1; k < midpoints; k++) {
          const ratio1 = k;
          const ratio2 = midpoints - ratio1;
          poly.data.midpointsuv[poly.data.midpointsuv.length] = avgPointsuv(p1, p2, ratio1, ratio2, midpoints);
        }

        const p1sh = poly.shData.pointsuv[pi];
        const p2sh = poly.shData.pointsuv[pj];
        for (let k = 1; k < midpoints; k++) {
          const ratio1 = k;
          const ratio2 = midpoints - ratio1;
          poly.shData.midpointsuv[poly.shData.midpointsuv.length] = avgPointsuv(p1sh, p2sh, ratio1, ratio2, midpoints);
        }
      }

      poly.sheetindex = currentsheet.index;
      poly.index = state.polygons.length;
      poly.constraints = [];
      poly.shadowconstraints = [];
      state.polygons.push(poly);
    }
  }

  var intersections = /*#__PURE__*/Object.freeze({
    __proto__: null,
    calculateSheetSections: calculateSheetSections,
    config: config,
    doSheetsIntersect: doSheetsIntersect
  });

  /**
   * Depth sorting and z-ordering for polygon rendering
   */


  function calculatePolygonOrder(polygon) {
    calculatePolygonOrderForCam(polygon, 0);
    calculatePolygonOrderForCam(polygon, 1);
  }

  function calculatePolygonOrderForCam(polygon, shadow) {
    if (!shadow) polygon.constraints = [];
    for (let i = 0; i < state.polygons.length; i++) {
      const polygon2 = state.polygons[i];
      if (polygon2.sheetindex == polygon.sheetindex) continue;

      if (state.sheets[polygon2.sheetindex].hidden || state.sheets[polygon.sheetindex].hidden)
        continue;

      addPolygonConstraintForCam(polygon, polygon2, shadow);
    }
  }

  function addPolygonConstraint(polygon, polygon2) {
    addPolygonConstraintForCam(polygon, polygon2, 0);
    addPolygonConstraintForCam(polygon, polygon2, 1);
  }

  function addPolygonConstraintForCam(polygon, polygon2, shadow) {
    const polygonData = shadow ? polygon.shData : polygon.data;
    const polygonData2 = shadow ? polygon2.shData : polygon2.data;
    const viewSource = shadow ? config$2.lightSource : state.viewSource;

    const sheet = state.sheets[polygon.sheetindex];
    const sheet2 = state.sheets[polygon2.sheetindex];

    if (sheet.hidden || sheet2.hidden) return;

    const isfront = isPolygonFront(polygon2, polygon, sheet2, sheet, polygonData2, polygonData, viewSource, shadow);
    if (!isfront) return;

    if (!shadow) {
      polygon.constraints.push(polygon2.index);
      if (sheet2.dimSheets && !sheet.dimmingDisabled) {
        if (sheet2.intersectors.indexOf(sheet.index) == -1)
          sheet.dimmed = 1;
      }
    } else {
      polygon2.shadowconstraints.push(polygon.index);
    }
  }

  function getOrderedList() {
    const ordered = {};
    const unordered = [];
    for (let i = 0; i < state.polygons.length; i++) {
      if (state.sheets[state.polygons[i].sheetindex].hidden) continue;
      unordered.push(i);
    }

    for (; ;) {
      const newunordered = [];
      const candidates = [];
      for (let i = 0; i < unordered.length; i++) {
        const constraints = state.polygons[unordered[i]].constraints;

        let allConstraintsInOrdered = true;
        for (let j = 0; j < constraints.length; j++) {
          const key = 'k' + constraints[j];
          if (typeof (ordered[key]) === 'undefined') {
            allConstraintsInOrdered = false;
            break;
          }
        }

        if (allConstraintsInOrdered)
          candidates.push(unordered[i]);
        else
          newunordered.push(unordered[i]);
      }

      for (let i = 0; i < candidates.length; i++) {
        const key = 'k' + candidates[i];
        ordered[key] = candidates[i];
      }

      const nochange = unordered.length == newunordered.length;
      unordered.length = 0;
      unordered.push(...newunordered);

      if (unordered.length == 0) break;

      if (nochange) {
        let zmax = -1e4;
        let maxidx = 0;
        for (let i = 0; i < unordered.length; i++) {
          if (state.polygons[unordered[i]].data.zmax > zmax) {
            maxidx = i;
            zmax = state.polygons[unordered[i]].data.zmax;
          }
        }
        const key = 'k' + unordered[maxidx];
        ordered[key] = unordered[maxidx];
        unordered.splice(maxidx, 1);
        if (unordered.length == 0) break;
      }
    }

    const newordered = [];
    for (const key in ordered) {
      newordered.push(ordered[key]);
    }
    return newordered;
  }

  function isPolygonFront(a, b, asheet, bsheet, aData, bData, viewSource, shadow) {
    if (aData.umin >= bData.umax || aData.umax <= bData.umin || aData.vmin >= bData.vmax || aData.vmax <= bData.vmin)
      return false;

    if (bData.zmin > aData.zmax) return false;

    let zOrderDistanceThreshold = 0.3;

    if (!shadow && (asheet.objectsheet || bsheet.objectsheet) && (asheet.object != bsheet.object))
      zOrderDistanceThreshold = 5;

    for (let i = 0; i < aData.pointsuv.length; i++) {
      const t = getTForSheetLineCrossing$1(bsheet.normalp, bsheet.centerp, a.points[i], viewSource);
      if (t < -zOrderDistanceThreshold) {
        const res = checkInboundsPolygon$1(bData.pointsuv, aData.pointsuv[i].u, aData.pointsuv[i].v);
        if (res.inbounds) return true;
      }
    }

    for (let i = 0; i < aData.midpointsuv.length; i++) {
      const t = getTForSheetLineCrossing$1(bsheet.normalp, bsheet.centerp, a.midpoints[i], viewSource);
      if (t < -zOrderDistanceThreshold) {
        const res = checkInboundsPolygon$1(bData.pointsuv, aData.midpointsuv[i].u, aData.midpointsuv[i].v);
        if (res.inbounds) return true;
      }
    }

    for (let i = 0; i < bData.pointsuv.length; i++) {
      const t = getTForSheetLineCrossing$1(asheet.normalp, asheet.centerp, b.points[i], viewSource);
      if (t > zOrderDistanceThreshold) {
        const res = checkInboundsPolygon$1(aData.pointsuv, bData.pointsuv[i].u, bData.pointsuv[i].v);
        if (res.inbounds) return true;
      }
    }

    for (let i = 0; i < bData.midpointsuv.length; i++) {
      const t = getTForSheetLineCrossing$1(asheet.normalp, asheet.centerp, b.midpoints[i], viewSource);
      if (t > zOrderDistanceThreshold) {
        const res = checkInboundsPolygon$1(aData.pointsuv, bData.midpointsuv[i].u, bData.midpointsuv[i].v);
        if (res.inbounds) return true;
      }
    }

    return false;
  }

  const inboundsCheckZeroThresh$1 = 0.001;

  function checkInboundsPolygon$1(corners, myx, myy) {
    const areas = [];
    let allpositive = true;
    let allnegative = true;
    let allzero = true;
    for (let i = 0; i < corners.length; i++) {
      const j = i == corners.length - 1 ? 0 : i + 1;
      areas[areas.length] = myx * corners[j].v - corners[j].u * myy - myx * corners[i].v + corners[i].u * myy + corners[j].u * corners[i].v - corners[i].u * corners[j].v;
      if ((areas[areas.length - 1]) > inboundsCheckZeroThresh$1) {
        allnegative = false;
        allzero = false;
      }
      if ((areas[areas.length - 1]) < -inboundsCheckZeroThresh$1) {
        allpositive = false;
        allzero = false;
      }
    }
    return { inbounds: (allnegative || allpositive) && !allzero, areas, allzero };
  }

  function clearDimmedFlags() {
    const dimmers = [];
    for (let i = 0; i < state.sheets.length; i++) {
      const s = state.sheets[i];
      if (s.dimSheets && !s.hidden) {
        for (let j = 0; j < s.polygons.length; j++) {
          dimmers.push(s.polygons[j].index);
        }
      }
    }
    if (dimmers.length > 0) {
      for (let i = 0; i < state.sheets.length; i++) {
        const s = state.sheets[i];
        if (s.dimmed == 0) continue;

        let dirty = false;
        for (let j = 0; j < s.polygons.length; j++) {
          const sheetpoly = s.polygons[j];
          const constraints = sheetpoly.constraints;
          for (let c = 0; c < constraints.length; c++) {
            if (dimmers.indexOf(constraints[c]) != -1) {
              dirty = true;
              break;
            }
          }
        }
        if (!dirty) s.dimmed = 0;
      }
    }
  }

  function deleteIndexFromConstraints(deletedSheet, constraints) {
    if (!constraints) return;

    const containedIdx = constraints.indexOf(deletedSheet);
    if (containedIdx != -1)
      constraints.splice(containedIdx, 1);
  }

  function updateIndexInConstraints(oldIndex, newIndex, constraints) {
    if (!constraints) return;

    const containedIdx = constraints.indexOf(oldIndex);
    if (containedIdx != -1)
      constraints[containedIdx] = newIndex;
  }

  var zOrdering = /*#__PURE__*/Object.freeze({
    __proto__: null,
    addPolygonConstraint: addPolygonConstraint,
    calculatePolygonOrder: calculatePolygonOrder,
    clearDimmedFlags: clearDimmedFlags,
    deleteIndexFromConstraints: deleteIndexFromConstraints,
    getOrderedList: getOrderedList,
    updateIndexInConstraints: updateIndexInConstraints
  });

  /**
   * @fileoverview Main calculation engine for sheet transformations, ordering, and updates
   * Handles dirty sheet tracking, polygon calculations, and z-order constraints
   */


  const calc = {};

  let staticsheets = null;

  calc.allowLimitToCorners = false;
  calc.sheetLimits = { xmin: -150, xmax: 150, ymin: -150, ymax: 150, zmin: 0, zmax: 100 };

  const inboundsCheckZeroThresh = 0.001;

  /**
   * Check if a point is within polygon bounds
   */
  function checkInboundsPolygon(corners, myx, myy) {
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
   * Calculate u and v difference vectors for sheet
   */
  function calcUdifVdif(sheet) {
    const scalew = sheet.width / 2;
    const scaleh = sheet.height / 2;
    sheet.udif = { x: sheet.p1.x * scalew, y: sheet.p1.y * scalew, z: sheet.p1.z * scalew };
    sheet.vdif = { x: sheet.p2.x * scaleh, y: sheet.p2.y * scaleh, z: sheet.p2.z * scaleh };
  }

  /**
   * Calculate sheet transformation data
   */
  function calculateSheetData(sheet) {
    const centerp = sheet.centerp;
    const p0 = sheet.p0;
    const p1 = sheet.p1;
    const p2 = sheet.p2;

    // corners
    calcUdifVdif(sheet);
    sheet.corners = calculateCornersFromCenter(centerp, sheet.udif, sheet.vdif);

    // inverse basematrix
    sheet.A1 = getBaseMatrixInverse(sheet.p1, sheet.p2, sheet.normalp);

    // transformation-specific data
    sheet.data = calculateSheetDataSingle(centerp, p0, p1, p2, transformPoint, transformPointz, state.canvasCenter, sheet.corners);

    // calculate shadows cast on baserect
    if (config$2.drawShadows)
      calculateSheetBaseShadow(sheet);

    // mark sheet as dirty for z-ordering
    sheet.dirty = true;
  }

  /**
   * Calculate single sheet transformation data
   */
  function calculateSheetDataSingle(centerp, p0rot, p1rot, p2rot, transformFunction, transformFunctionz, canvasCenter, corners) {
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
    c[0] = transformPointuvz(corners[0], transformFunctionz, canvasCenter);
    c[1] = transformPointuvz(corners[1], transformFunctionz, canvasCenter);
    c[2] = transformPointuvz(corners[2], transformFunctionz, canvasCenter);
    c[3] = transformPointuvz(corners[3], transformFunctionz, canvasCenter);

    const umax = Math.max(c[0].u, c[1].u, c[2].u, c[3].u);
    const umin = Math.min(c[0].u, c[1].u, c[2].u, c[3].u);
    const vmax = Math.max(c[0].v, c[1].v, c[2].v, c[3].v);
    const vmin = Math.min(c[0].v, c[1].v, c[2].v, c[3].v);
    const zmax = Math.max(c[0].z, c[1].z, c[2].z, c[3].z);
    const zmin = Math.min(c[0].z, c[1].z, c[2].z, c[3].z);
    return { p0uv: p0, p1uv: p1, p2uv: p2, translatex: translatex, translatey: translatey, ta: ta, tb: tb, tc: tc, td: td, centerpuv: centerpuv, cornersuv: c, umax: umax, umin: umin, vmax: vmax, vmin: vmin, zmax: zmax, zmin: zmin };
  }

  /**
   * Calculate corner positions from center point
   */
  function calculateCornersFromCenter(centerp, udif, vdif) {
    const corners = [];
    corners[0] = { x: -udif.x - vdif.x + centerp.x, y: -udif.y - vdif.y + centerp.y, z: -udif.z - vdif.z + centerp.z };
    corners[1] = { x: +udif.x - vdif.x + centerp.x, y: +udif.y - vdif.y + centerp.y, z: +udif.z - vdif.z + centerp.z };
    corners[2] = { x: +udif.x + vdif.x + centerp.x, y: +udif.y + vdif.y + centerp.y, z: +udif.z + vdif.z + centerp.z };
    corners[3] = { x: -udif.x + vdif.x + centerp.x, y: -udif.y + vdif.y + centerp.y, z: -udif.z + vdif.z + centerp.z };
    return corners;
  }

  /**
   * Limit sheet corners to bounds
   */
  function limitToCorners(sheet) {
    calcUdifVdif(sheet);
    sheet.corners = calculateCornersFromCenter(sheet.centerp, sheet.udif, sheet.vdif);

    if (!calc.allowLimitToCorners)
      return;

    sheet.xsnap = sheet.ysnap = sheet.zsnap = sheet.xexactsnap = sheet.yexactsnap = sheet.zexactsnap = sheet.xminsnap = sheet.xmaxsnap = sheet.yminsnap = sheet.ymaxsnap = sheet.zminsnap = sheet.zmaxsnap = false;
    for (let l = 0; l < 4; l++) {
      limitToCorner(sheet, sheet.corners[l], l);
    }
  }

  /**
   * Limit single corner to bounds
   */
  function limitToCorner(sheet, c, index) {
    const udif = sheet.udif;
    const vdif = sheet.vdif;

    if (c.x <= calc.sheetLimits.xmin) {
      if (c.x === calc.sheetLimits.xmin && !sheet.xsnap)
        sheet.xexactsnap = true;
      c.x = calc.sheetLimits.xmin;
      sheet.xsnap = true;
      sheet.xminsnap = true;
    }
    if (c.x >= calc.sheetLimits.xmax) {
      if (c.x === calc.sheetLimits.xmax && !sheet.xsnap)
        sheet.xexactsnap = true;
      c.x = calc.sheetLimits.xmax;
      sheet.xsnap = true;
      sheet.xmaxsnap = true;
    }
    if (c.y <= calc.sheetLimits.ymin) {
      if (c.y === calc.sheetLimits.ymin && !sheet.ysnap)
        sheet.yexactsnap = true;
      c.y = calc.sheetLimits.ymin;
      sheet.ysnap = true;
      sheet.yminsnap = true;
    }
    if (c.y >= calc.sheetLimits.ymax) {
      if (c.y === calc.sheetLimits.ymax && !sheet.ysnap)
        sheet.yexactsnap = true;
      c.y = calc.sheetLimits.ymax;
      sheet.ysnap = true;
      sheet.ymaxsnap = true;
    }
    if (c.z <= calc.sheetLimits.zmin) {
      if (c.z === calc.sheetLimits.zmin && !sheet.zsnap)
        sheet.zexactsnap = true;
      c.z = calc.sheetLimits.zmin;
      sheet.zsnap = true;
      sheet.zminsnap = true;
    }
    if (c.z >= calc.sheetLimits.zmax) {
      if (c.z === calc.sheetLimits.zmax && !sheet.zsnap)
        sheet.zexactsnap = true;
      c.z = calc.sheetLimits.zmax;
      sheet.zsnap = true;
      sheet.zmaxsnap = true;
    }

    // calculate center from corner
    if (index === 0)
      sheet.centerp = { x: c.x + udif.x + vdif.x, y: c.y + udif.y + vdif.y, z: c.z + udif.z + vdif.z };
    if (index === 1)
      sheet.centerp = { x: c.x - udif.x + vdif.x, y: c.y - udif.y + vdif.y, z: c.z - udif.z + vdif.z };
    if (index === 2)
      sheet.centerp = { x: c.x - udif.x - vdif.x, y: c.y - udif.y - vdif.y, z: c.z - udif.z - vdif.z };
    if (index === 3)
      sheet.centerp = { x: c.x + udif.x - vdif.x, y: c.y + udif.y - vdif.y, z: c.z + udif.z - vdif.z };

    // recalculate all corners from center
    sheet.corners = calculateCornersFromCenter(sheet.centerp, udif, vdif);
  }

  /**
   * Define sheet parameters
   */
  function defineSheetParams(sheet) {
    sheet.p0orig = { x: -sheet.width / 2, y: 0, z: sheet.height / 2 };
    sheet.p1orig = { x: 1, y: 0, z: 0 };
    sheet.p2orig = { x: 0, y: 0, z: -1 };
    sheet.normalporig = { x: 0, y: 1, z: 0 };

    if (!sheet.objectsheet) {
      const alpha = sheet.rot.alphaD * Math.PI / 180;
      const beta = sheet.rot.betaD * Math.PI / 180;
      const gamma = sheet.rot.gammaD * Math.PI / 180;

      sheet.p0 = sheet.p0start = rotatePoint(sheet.p0orig, alpha, beta, gamma);
      sheet.p1 = sheet.p1start = rotatePoint(sheet.p1orig, alpha, beta, gamma);
      sheet.p2 = sheet.p2start = rotatePoint(sheet.p2orig, alpha, beta, gamma);
      sheet.normalp = sheet.normalpstart = rotatePoint(sheet.normalporig, alpha, beta, gamma);
    }

    sheet.maxdiag = Math.ceil(Math.sqrt(sheet.width * sheet.width + sheet.height * sheet.height) / 2);
  }

  /**
   * Gather sheets that need recalculation
   */
  function gatherDirtySheets() {
    for (let i = 0; i < state.sheets.length; i++) {
      state.sheets[i].intersectionParams = [];
    }
    for (let i = 0; i < state.sheets.length; i++) {
      const currentsheet = state.sheets[i];

      if (!currentsheet.dirty)
        continue;

      // objectsheets don't make other sheets dirty
      if (!state.objectsintersect && currentsheet.objectsheet && !currentsheet.object.intersectionsenabled)
        continue;

      // - former intersectOR sheets
      if (currentsheet.intersectors != null) {
        for (let j = 0; j < currentsheet.intersectors.length; j++) {
          const idx = currentsheet.intersectors[j];
          state.sheets[idx].madedirty = true;
        }
      }

      for (let j = 0; j < state.sheets.length; j++) {
        if (j === i)
          continue;

        const othersheet = state.sheets[j];
        if (othersheet.hidden)
          continue;

        // if othersheet is already made dirty, we are ready
        if (othersheet.madedirty)
          continue;

        // if either of the two sheets are objectsheet, intersections will be handled separately
        if (!state.objectsintersect && currentsheet.objectsheet && !currentsheet.object.intersectionsenabled)
          continue;
        if (!state.objectsintersect && othersheet.objectsheet && !othersheet.object.intersectionsenabled)
          continue;

        // - new intersecting sheets
        if (doSheetsIntersect(currentsheet, othersheet)) {
          othersheet.madedirty = true;
        }

        // - former intersecTED sheets
        if (othersheet.intersectors != null) {
          if (othersheet.intersectors.indexOf(i) !== -1)
            othersheet.madedirty = true;
        }
      }
    }
    // build dirtySheets array
    const movedSheets = [];
    const dirtySheets = [];
    const dirtySheetsRedefinePolygons = [];
    for (let i = 0; i < state.sheets.length; i++) {
      const sheet = state.sheets[i];

      if (state.objectsintersect) {
        // if object intersection is allowed, simple mechanism: we only care about sheets and not objects
        if (sheet.dirty || sheet.madedirty) {
          dirtySheets.push(i);
          dirtySheetsRedefinePolygons.push(i);
        }
      } else {
        // if objects don't intersect, complex mechanism: all sheets of a dirty object will be included
        const objdirty = sheet.objectsheet && (sheet.object.intersectionsredefine || sheet.object.intersectionsrecalc) && !sheet.object.intersectionsenabled;
        if (sheet.dirty || sheet.madedirty || objdirty) {
          dirtySheets.push(i);

          const objectintersection = sheet.objectsheet && !sheet.object.intersectionsenabled;
          if (!objectintersection)
            dirtySheetsRedefinePolygons.push(i);
        }
      }

      if (sheet.dirty) {
        movedSheets.push(i);
      }
    }
    return { dirtySheets: dirtySheets, movedSheets: movedSheets, dirtySheetsRedefinePolygons: dirtySheetsRedefinePolygons };
  }

  /**
   * Delete polygons for dirty sheets
   */
  function deleteDirtyPolygons(dirtySheets) {
    if (state.polygons == null)
      state.polygons = [];

    // delete references from state.polygons
    const polys = [];
    for (let j = 0; j < state.polygons.length; j++) {
      // check if polygon's sheet is among dirty ones
      const poly = state.polygons[j];
      const containedIdx = dirtySheets.indexOf(poly.sheetindex);
      if (containedIdx !== -1) {
        // delete polygon index from z-order constraints
        for (let i = 0; i < state.polygons.length; i++) {
          const actPoly = state.polygons[i];
          // delete from constraint lists
          deleteIndexFromConstraints(poly.index, actPoly.constraints);
          deleteIndexFromConstraints(poly.index, actPoly.shadowconstraints);
          deleteIndexFromConstraints(poly.index, actPoly.prevshadowconstraints);
        }
      } else {
        polys[polys.length] = state.polygons[j];
      }
    }
    state.polygons = polys;

    // update polygon indexes
    for (let j = 0; j < state.polygons.length; j++) {
      if (state.polygons[j].index !== j) {

        // update z-order constraint indexes
        for (let i = 0; i < state.polygons.length; i++) {
          const actPoly = state.polygons[i];
          updateIndexInConstraints(state.polygons[j].index, j, actPoly.constraints);
          updateIndexInConstraints(state.polygons[j].index, j, actPoly.shadowconstraints);
          updateIndexInConstraints(state.polygons[j].index, j, actPoly.prevshadowconstraints);
        }

        // update index in polygonlist
        state.polygons[j].index = j;
      }
    }
  }

  /**
   * Calculate z-order for dirty polygons
   */
  function calculateDirtyPolygonOrder(firstDirtyPolygon) {
    for (let i = firstDirtyPolygon; i < state.polygons.length; i++) {
      const dirtyPoly = state.polygons[i];
      calculatePolygonOrder(dirtyPoly);

      // calculate all polygons z-order constraints with respect to dirty polygons
      for (let k = 0; k < firstDirtyPolygon; k++) {
        const staticPoly = state.polygons[k];
        const staticSheet = state.sheets[staticPoly.sheetindex];
        if (staticSheet.hidden)
          continue;
        addPolygonConstraint(staticPoly, dirtyPoly);
      }
    }
  }

  /**
   * Set previous shadow constraints
   */
  function setPrevShadowConstraints() {
    for (let i = 0; i < state.polygons.length; i++) {
      state.polygons[i].prevshadowconstraints = [];
      for (let j = 0; j < state.polygons[i].shadowconstraints.length; j++) {
        state.polygons[i].prevshadowconstraints[state.polygons[i].prevshadowconstraints.length] = state.polygons[i].shadowconstraints[j];
      }
    }
  }

  /**
   * Update ordered polygon lists
   */
  function updateOrderedLists() {
    state.orderedPolygons = getOrderedList();
  }

  /**
   * Get static sheets (non-object sheets or object sheets with intersections enabled)
   */
  function getStaticSheets() {
    if (staticsheets != null)
      return staticsheets;

    const sheetset = [];
    for (let i = 0; i < state.sheets.length; i++) {
      const s = state.sheets[i];
      if (!s.objectsheet || s.object.intersectionsenabled)
        sheetset.push(s);
    }
    staticsheets = sheetset;
    return staticsheets;
  }

  /**
   * Calculate changed sheets (incremental update)
   */
  function calculateChangedSheets() {
    const start1 = +new Date();

    // 1. gather sheets whose polygons are to be recalculated
    const dirtySheetsObj = gatherDirtySheets();
    const dirtySheets = dirtySheetsObj.dirtySheets;
    const movedSheets = dirtySheetsObj.movedSheets;
    const dirtySheetsRedefinePolygons = dirtySheetsObj.dirtySheetsRedefinePolygons;

    const end1 = +new Date();
    const start2 = +new Date();

    // redraw canvases where canvas changed
    for (let i = 0; i < state.sheets.length; i++) {
      const s = state.sheets[i];
      if (s.canvasdirty)
        s.refreshCanvas();
    }

    // gather sheets for shadow redrawing
    checkDirtyShadowConstraint(true, movedSheets);

    const end2 = +new Date();
    const start3 = +new Date();

    // 2. delete polygons of dirty sheets
    deleteDirtyPolygons(dirtySheets);
    const firstDirtyPolygon = state.polygons.length;

    const end3 = +new Date();
    const start4 = +new Date();

    // 3. redefine polygons
    if (state.objectsintersect) {
      // redefine polygons of all sheets
      const sheetset = state.sheets;
      for (let idx = 0; idx < dirtySheetsRedefinePolygons.length; idx++) {
        calculateSheetSections(state.sheets[dirtySheetsRedefinePolygons[idx]], true, sheetset);
      }
    } else {
      // redefine polygons of static sheets
      const sheetset = getStaticSheets();
      for (let idx = 0; idx < dirtySheetsRedefinePolygons.length; idx++) {
        calculateSheetSections(state.sheets[dirtySheetsRedefinePolygons[idx]], true, sheetset);
      }

      // recalculate/redefine polygons of object sheets
      for (let idx = 0; idx < state.objects.length; idx++) {
        const obj = state.objects[idx];
        if (obj.intersectionsenabled)
          continue;
        if (obj.intersectionsredefine) {
          redefineIntersections(obj);
        } else if (obj.intersectionsrecalc) {
          for (let i = 0; i < obj.sheets.length; i++) {
            calculateSheetSections(obj.sheets[i], false, obj.sheets);
          }
        }
        obj.intersectionsredefine = false;
        obj.intersectionsrecalc = false;
      }
    }

    const end4 = +new Date();
    const start5 = +new Date();

    // 4. calculate z-order constraints of dirty polygons
    calculateDirtyPolygonOrder(firstDirtyPolygon);

    const end5 = +new Date();
    const start6 = +new Date();

    // 5. clear dimmed flags for sheets that are not dimmed any more
    clearDimmedFlags();

    const end6 = +new Date();
    const start7 = +new Date();

    // gather sheets for shadow redrawing
    checkDirtyShadowConstraint(false, movedSheets);

    const end7 = +new Date();
    const start8 = +new Date();

    // set previous constraints for polygons
    setPrevShadowConstraints();

    const end8 = +new Date();
    const start9 = +new Date();

    // draw shadows on sheet canvases
    calculateSheetsShadows(false);

    const end9 = +new Date();
    const start10 = +new Date();

    updateOrderedLists();

    const end10 = +new Date();

    // clear dirty flags
    for (let i = 0; i < state.sheets.length; i++) {
      state.sheets[i].dirty = false;
      state.sheets[i].madedirty = false;
    }

    // delete all sheets that were marked as deleting
    deleteSheets();

    if (state.debug)
      console.log((end1 - start1) + ' - ' + (end2 - start2) + ' - ' + (end3 - start3) + ' - ' + (end4 - start4) + ' - ' + (end5 - start5) + ' - ' + (end6 - start6) + ' - ' + (end7 - start7) + ' - ' + (end8 - start8) + ' - ' + (end9 - start9) + ' - ' + (end10 - start10));
  }

  /**
   * Calculate all sheets (full recalculation)
   */
  function calculateAllSheets() {
    for (let i = 0; i < state.sheets.length; i++) {
      const s = state.sheets[i];
      s.dimmed = 0;
      s.intersectionParams = [];

      // redraw canvases where canvas changed
      if (s.canvasdirty)
        s.refreshCanvas();
    }
    state.polygons = [];
    // recalculate intersection of static sheets
    staticsheets = null;
    const sheetset = state.objectsintersect ? state.sheets : getStaticSheets();
    for (let idx = 0; idx < sheetset.length; idx++) {
      calculateSheetSections(sheetset[idx], true, sheetset);
    }
    // recalculate intersection of object sheets
    if (!state.objectsintersect) {
      for (let idx = 0; idx < state.objects.length; idx++) {
        const obj = state.objects[idx];
        if (obj.intersectionsenabled)
          continue;
        if (obj.intersectionsredefine) {
          redefineIntersections(obj);
        } else {
          for (let i = 0; i < obj.sheets.length; i++) {
            calculateSheetSections(obj.sheets[i], true, obj.sheets);
          }
        }
        obj.intersectionsredefine = false;
        obj.intersectionsrecalc = false;
      }
    }

    for (let i = 0; i < state.polygons.length; i++) {
      calculatePolygonOrder(state.polygons[i]);
    }
    setPrevShadowConstraints();
    calculateSheetsShadows(true);
    updateOrderedLists();
    // clear dirty flags
    for (let i = 0; i < state.sheets.length; i++) {
      const s = state.sheets[i];
      s.dirty = false;
      s.madedirty = false;
    }

    // delete all sheets that were marked as deleting
    deleteSheets();
  }

  /**
   * Delete sheets marked for deletion
   */
  function deleteSheets() {
    if (!state.sheetsbeingdeleted)
      return;

    // remove deleted sheets' polygons from state.polygons
    const newpolys = [];
    const deletedpolyidxs = [];
    for (let p = 0; p < state.polygons.length; p++) {
      const poly = state.polygons[p];
      const psheet = state.sheets[poly.sheetindex];
      if (!psheet.deleting)
        newpolys.push(poly);
      else
        deletedpolyidxs.push(p);
    }
    state.polygons = newpolys;

    // remove deleted sheets' polygons from orderedPolygons
    const neworderedpolys = [];
    for (let p = 0; p < state.orderedPolygons.length; p++) {
      const polyidx = state.orderedPolygons[p];
      if (deletedpolyidxs.indexOf(polyidx) === -1)
        neworderedpolys.push(polyidx);
    }
    state.orderedPolygons = neworderedpolys;

    // remove deleted sheets' polygons from polygons' constraints
    for (let p = 0; p < state.polygons.length; p++) {
      const poly = state.polygons[p];

      let newconstraints = [];
      for (let si = 0; si < poly.constraints.length; si++) {
        const polyidx = poly.constraints[si];
        if (deletedpolyidxs.indexOf(polyidx) === -1)
          newconstraints.push(polyidx);
      }
      poly.constraints = newconstraints;

      let newshadowconstraints = [];
      for (let si = 0; si < poly.shadowconstraints.length; si++) {
        const polyidx = poly.shadowconstraints[si];
        if (deletedpolyidxs.indexOf(polyidx) === -1)
          newshadowconstraints.push(polyidx);
      }
      poly.shadowconstraints = newshadowconstraints;

      newshadowconstraints = [];
      for (let si = 0; si < poly.prevshadowconstraints.length; si++) {
        const polyidx = poly.prevshadowconstraints[si];
        if (deletedpolyidxs.indexOf(polyidx) === -1)
          newshadowconstraints.push(polyidx);
      }
      poly.prevshadowconstraints = newshadowconstraints;
    }

    // remove deleted sheets from state.sheets
    const newsheets = [];
    const deletedsheetidxs = [];
    for (let s = 0; s < state.sheets.length; s++) {
      const sheet = state.sheets[s];
      if (!sheet.deleting)
        newsheets.push(sheet);
      else
        deletedsheetidxs.push(s);
    }
    state.sheets = newsheets;

    // remove deleted sheet indexes from intersectors
    for (let s = 0; s < state.sheets.length; s++) {
      const sheet = state.sheets[s];
      if (!sheet.intersectors)
        continue;
      const newintersectors = [];
      for (let is = 0; is < sheet.intersectors.length; is++) {
        const isindex = sheet.intersectors[is];
        if (deletedsheetidxs.indexOf(isindex) === -1)
          newintersectors.push(isindex);
      }
      sheet.intersectors = newintersectors;
    }

    // adjust sheet indexes
    for (let i = 0; i < state.sheets.length; i++) {
      const oldindex = state.sheets[i].index;
      state.sheets[i].index = i;
      if (oldindex !== i) {
        // adjust indices in polygon array
        for (let j = 0; j < state.polygons.length; j++) {
          const poly = state.polygons[j];
          if (poly.sheetindex === oldindex)
            poly.sheetindex = i;
        }

        // adjust indices in intersector array
        for (let s = 0; s < state.sheets.length; s++) {
          const sheet = state.sheets[s];
          updateIndexInConstraints(oldindex, i, sheet.intersectors);
        }
      }
    }

    // update polygon indexes
    for (let j = 0; j < state.polygons.length; j++) {
      const oldindex = state.polygons[j].index;
      if (oldindex !== j) {
        // adjust indexes in orderedPolygons
        updateIndexInConstraints(oldindex, j, state.orderedPolygons);

        // update z-order constraint indexes
        for (let i = 0; i < state.polygons.length; i++) {
          const actPoly = state.polygons[i];
          updateIndexInConstraints(oldindex, j, actPoly.constraints);
          updateIndexInConstraints(oldindex, j, actPoly.shadowconstraints);
          updateIndexInConstraints(oldindex, j, actPoly.prevshadowconstraints);
        }

        // update index in polygonlist
        state.polygons[j].index = j;
      }
    }

    state.sheetsbeingdeleted = false;
    staticsheets = null;
  }

  /**
   * Delete object from objects array
   */
  function deleteObject(obj) {
    const idx = state.objects.indexOf(obj);
    if (idx !== -1)
      state.objects.splice(idx, 1);
  }

  /**
   * Redefine intersections for an object
   */
  function redefineIntersections(obj) {
    // redefine polygons
    for (let i = 0; i < obj.sheets.length; i++) {
      calculateSheetSections(obj.sheets[i], true, obj.sheets);
    }

    // calculate initial polygons from the redefined current polygonset
    for (let i = 0; i < obj.sheets.length; i++) {
      const s = obj.sheets[i];
      s.startpolygons = [];
      const A1 = getBaseMatrixInverse(s.p1start, s.p2start, s.normalpstart);
      for (let j = 0; j < s.polygons.length; j++) {
        const poly = s.polygons[j];
        const points = [];
        const relpoints = [];
        for (let p = 0; p < poly.points.length; p++) {
          let sp = subPoint(poly.points[p], obj.centerp);
          sp = rotatePoint(sp, -obj.rot.alpha, -obj.rot.beta, -obj.rot.gamma);
          points.push(sp);
          const relp = getCoordsInBase(A1, sp);
          relpoints.push(relp);
        }
        s.startpolygons.push({ points: points, relpoints: relpoints });
        s.startpolygonscenterp = clonePoint(s.startcenterp);
      }
    }
  }

  // Export calc functions
  calc.checkInboundsPolygon = checkInboundsPolygon;
  calc.calculateSheetData = calculateSheetData;
  calc.limitToCorners = limitToCorners;
  calc.defineSheetParams = defineSheetParams;
  calc.calculateChangedSheets = calculateChangedSheets;
  calc.calculateAllSheets = calculateAllSheets;
  calc.deleteSheets = deleteSheets;

  var calc$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    calc: calc,
    calculateSheetData: calculateSheetData,
    deleteObject: deleteObject,
    redefineIntersections: redefineIntersections
  });

  /**
   * Sheet class - drawable 3D sheets in the scene
   */


  class Sheet {
    constructor(centerp, rot, size) {
      const rotclone = fillRot$2(rot);

      this.width = size.w;
      this.height = size.h;
      this.centerp = clonePoint(centerp);
      this.rot = { alphaD: rotclone.alphaD, betaD: rotclone.betaD, gammaD: rotclone.gammaD };

      this.objectsheet = false;
      this.skipDensityMap = false;
      this.dimSheets = false;
      this.dimmingDisabled = false;
      this.hidden = false;
      this.dirty = false;
      this.canvasdirty = true;

      this.dimmed = 0;
      this.dimmedprev = 0;

      this.castshadows = true;
      this.allowshadows = true;

      this.canvas = createCanvas(this.width, this.height);
      this.context = this.canvas.getContext('2d');
      this.shadowcanvas = createCanvas(this.width, this.height);
      this.shadowcontext = this.shadowcanvas.getContext('2d');
      this.shadowtempcanvas = createCanvas(this.width, this.height);
      this.shadowtempcontext = this.shadowtempcanvas.getContext('2d');
      this.baseshadowcanvas = createCanvas(this.width, this.height);
      this.baseshadowcontext = this.baseshadowcanvas.getContext('2d');
      this.compositecanvas = createCanvas(this.width, this.height);
      this.compositecontext = this.compositecanvas.getContext('2d');

      // These will be set by calc module when integrated
      if (window.calc) {
        window.calc.defineSheetParams(this);
        window.calc.limitToCorners(this);
        window.calc.calculateSheetData(this);
      }
      calculateSheetShade(this);

      this.index = state.sheets.length;
      state.sheets.push(this);
      internal.staticsheets = null;
    }

    canvasChanged() {
      this.canvasdirty = true;
      if (this.objectsheet) {
        this.object.canvasdirty = true;
        this.object.intersectionsrecalc = true;
      }
      this.dirty = true;
    }

    destroy() {
      this.hidden = true;
      this.dirty = true;
      this.deleting = true;
      state.sheetsbeingdeleted = true;
    }

    refreshCanvas() {
      if (!this.canvasdirty) return;

      this.compositecontext.clearRect(0, 0, this.width, this.height);
      redrawSheetCanvases(this);
      this.canvasdirty = false;
    }

    setShadows(castshadows, allowshadows) {
      this.castshadows = castshadows;
      if (this.allowshadows != allowshadows) {
        this.allowshadows = allowshadows;
        calculateSheetShade(this);
      }
      this.dirty = true;
    }

    setDimming(dimSheets, dimmingDisabled) {
      this.dimSheets = dimSheets;
      this.dimmingDisabled = dimmingDisabled;
      this.dirty = true;
    }
  }

  function fillRot$2(rot) {
    if (!rot) return { alphaD: 0, betaD: 0, gammaD: 0 };
    return {
      alphaD: rot.alphaD || 0,
      betaD: rot.betaD || 0,
      gammaD: rot.gammaD || 0
    };
  }

  /**
   * @fileoverview SheetObject class - main object class with multiple sheets
   * Handles object positioning, rotation, intersection management, and rendering
   */


  /**
   * SheetObject class - represents a 3D object composed of multiple sheets
   * @constructor
   * @param {Object} centerp - Center position {x, y, z}
   * @param {Object} rot - Rotation angles {alphaD, betaD, gammaD}
   * @param {Array} sheets - Array of Sheet objects
   * @param {Object} canvasSize - Canvas size {w, h, relu, relv}
   * @param {boolean} intersectionsenabled - Whether intersections are enabled
   */
  function SheetObject(centerp, rot, sheets, canvasSize, intersectionsenabled) {
    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      s.objectsheet = true;
      s.object = this;

      s.startcenterp = { x: s.centerp.x, y: s.centerp.y, z: s.centerp.z };
      s.rotcenterp = { x: s.centerp.x, y: s.centerp.y, z: s.centerp.z };
      s.centerp.x += centerp.x;
      s.centerp.y += centerp.y;
      s.centerp.z += centerp.z;

      s.intersectionParams = [];

      calculateSheetData(s);
    }

    this.intersectionsenabled = intersectionsenabled ? true : false;

    if (!state.objectsintersect && !this.intersectionsenabled) {
      for (let i = 0; i < sheets.length; i++) {
        calculateSheetSections(sheets[i], true, sheets);
      }
      for (let i = 0; i < sheets.length; i++) {
        const s = sheets[i];
        const startpoly = [];
        const A1 = getBaseMatrixInverse(s.p1start, s.p2start, s.normalpstart);
        for (let j = 0; j < s.polygons.length; j++) {
          const poly = s.polygons[j];
          const points = [];
          const relpoints = [];
          for (let p = 0; p < poly.points.length; p++) {
            const pp = subPoint(poly.points[p], centerp);
            points.push(pp);
            const relp = getCoordsInBase(A1, pp);
            relpoints.push(relp);
          }
          startpoly.push({ points: points, relpoints: relpoints });
        }
        s.startpolygons = startpoly;
        s.startpolygonscenterp = clonePoint(s.startcenterp);
      }
    }

    this.centerp = centerp;
    this.rot = fillRot$1(rot);
    this.rotvectorstart = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 }];
    this.rotvector = calcRotVector(this.rot, this.rotvectorstart);
    this.sheets = sheets;
    this.hidden = false;
    this.intersectionsredefine = false;
    this.intersectionsrecalc = false;

    this.canvasSize = canvasSize;

    // adjust temppartcanvas size if necessary
    if (canvasSize.w > state.tempCanvasSize.w || canvasSize.h > state.tempCanvasSize.h) {
      const w = Math.max(canvasSize.w, state.tempCanvasSize.w);
      const h = Math.max(canvasSize.h, state.tempCanvasSize.h);
      state.tempCanvasSize = { w: w, h: h };
      state.temppartcanvas.width = w;
      state.temppartcanvas.height = h;
      state.temppartshadowcanvas.width = w;
      state.temppartshadowcanvas.height = h;
    }

    this.oldcenterp = clonePoint(this.centerp);

    this.centerpuv = transformPoint(this.centerp);
    this.centerpuvrel = transformPointuvz(this.centerp, transformPointz, state.canvasCenter);
    this.oldcenterpuv = transformPoint(this.oldcenterp);

    this.setOrientation(this.rot);
    state.objects.push(this);
  }

  /**
   * Set dimming for object sheets
   */
  SheetObject.prototype.setDimming = function(dimSheets, dimmingDisabled) {
    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];
      s.dimSheets = dimSheets;
      s.dimmingDisabled = dimmingDisabled;
      s.dirty = true;
    }
    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Set shadow properties for object sheets
   */
  SheetObject.prototype.setShadows = function(castshadows, allowshadows) {
    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];
      s.setShadows(castshadows, allowshadows);
    }
    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Set collision detection for object
   */
  SheetObject.prototype.setCollision = function(collisionEnabled) {
    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];
      s.skipDensityMap = !collisionEnabled;
    }
  };

  /**
   * Destroy object and remove from scene
   */
  SheetObject.prototype.destroy = function() {
    this.hide();
    for (let s = 0; s < this.sheets.length; s++) {
      const sheet = this.sheets[s];
      sheet.deleting = true;
    }
    state.sheetsbeingdeleted = true;
    this.deleting = true;
  };

  /**
   * Set object position (absolute)
   */
  SheetObject.prototype.setPosition = function(pos) {
    this.move(pos, true);
  };

  /**
   * Move object by vector or set absolute position
   */
  SheetObject.prototype.move = function(vector, base) {
    this.oldcenterp = clonePoint(this.centerp);
    if (base) {
      this.centerp.x = vector.x;
      this.centerp.y = vector.y;
      this.centerp.z = vector.z;
    } else {
      this.centerp.x += vector.x;
      this.centerp.y += vector.y;
      this.centerp.z += vector.z;
    }

    const diffx = this.centerp.x - this.oldcenterp.x;
    const diffy = this.centerp.y - this.oldcenterp.y;
    const diffz = this.centerp.z - this.oldcenterp.z;

    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];

      s.centerp.x = s.rotcenterp.x + this.centerp.x;
      s.centerp.y = s.rotcenterp.y + this.centerp.y;
      s.centerp.z = s.rotcenterp.z + this.centerp.z;

      calculateSheetData(s);

      if (s.polygons && !state.objectsintersect && !this.intersectionsenabled) {
        for (let j = 0; j < s.polygons.length; j++) {
          const poly = s.polygons[j];
          for (let p = 0; p < poly.points.length; p++) {
            const pp = poly.points[p];
            pp.x += diffx;
            pp.y += diffy;
            pp.z += diffz;
          }
        }
      }
    }

    this.centerpuv = transformPoint(this.centerp);
    this.centerpuvrel = transformPointuvz(this.centerp, transformPointz, state.canvasCenter);
    this.oldcenterpuv = transformPoint(this.oldcenterp);

    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Rotate object around axis (absolute)
   */
  SheetObject.prototype.rotateBase = function(axis, angle) {
    this.rotate(axis, angle, true);
  };

  /**
   * Rotate object around axis
   */
  SheetObject.prototype.rotate = function(axis, angle, base) {
    if (base) {
      this.rotvector[0] = rotateAroundAxis(this.rotvectorstart[0], axis, angle);
      this.rotvector[1] = rotateAroundAxis(this.rotvectorstart[1], axis, angle);
      this.rotvector[2] = rotateAroundAxis(this.rotvectorstart[2], axis, angle);
    } else {
      this.rotvector[0] = rotateAroundAxis(this.rotvector[0], axis, angle);
      this.rotvector[1] = rotateAroundAxis(this.rotvector[1], axis, angle);
      this.rotvector[2] = rotateAroundAxis(this.rotvector[2], axis, angle);
    }
    this.rot = inverseRPY(this.rotvector[0], this.rotvector[1], this.rotvector[2]);

    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];

      if (base) {
        s.p0 = rotateAroundAxis(s.p0start, axis, angle);
        s.p1 = rotateAroundAxis(s.p1start, axis, angle);
        s.p2 = rotateAroundAxis(s.p2start, axis, angle);
        s.normalp = rotateAroundAxis(s.normalpstart, axis, angle);
        s.rotcenterp = rotateAroundAxis(s.startcenterp, axis, angle);

        if (s.startpolygons && !state.objectsintersect && !this.intersectionsenabled) {
          s.polygons = [];
          for (let j = 0; j < s.startpolygons.length; j++) {
            const poly = { points: [] };
            s.polygons.push(poly);
            const startpoly = s.startpolygons[j];
            for (let p = 0; p < startpoly.points.length; p++) {
              const pp = rotateAroundAxis(startpoly.points[p], axis, angle);
              poly.points.push(addPoint(pp, this.centerp));
            }
          }
        }

      } else {
        s.p0 = rotateAroundAxis(s.p0, axis, angle);
        s.p1 = rotateAroundAxis(s.p1, axis, angle);
        s.p2 = rotateAroundAxis(s.p2, axis, angle);
        s.normalp = rotateAroundAxis(s.normalp, axis, angle);
        s.rotcenterp = rotateAroundAxis(s.rotcenterp, axis, angle);

        if (s.polygons && !state.objectsintersect && !this.intersectionsenabled) {
          for (let j = 0; j < s.polygons.length; j++) {
            const poly = s.polygons[j];
            for (let p = 0; p < poly.points.length; p++) {
              let pp = subPoint(poly.points[p], this.centerp);
              pp = rotateAroundAxis(pp, axis, angle);
              poly.points[p] = addPoint(pp, this.centerp);
            }
          }
        }

      }

      s.centerp.x = s.rotcenterp.x + this.centerp.x;
      s.centerp.y = s.rotcenterp.y + this.centerp.y;
      s.centerp.z = s.rotcenterp.z + this.centerp.z;

      calculateSheetData(s);
      calculateSheetShade(s);
    }

    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Set object orientation (absolute)
   */
  SheetObject.prototype.setOrientation = function(rot) {
    this.rot = fillRot$1(rot);
    this.rotvector = calcRotVector(this.rot, this.rotvectorstart);

    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];

      s.p0 = rotatePoint(s.p0start, this.rot.alpha, this.rot.beta, this.rot.gamma);
      s.p1 = rotatePoint(s.p1start, this.rot.alpha, this.rot.beta, this.rot.gamma);
      s.p2 = rotatePoint(s.p2start, this.rot.alpha, this.rot.beta, this.rot.gamma);
      s.normalp = rotatePoint(s.normalpstart, this.rot.alpha, this.rot.beta, this.rot.gamma);

      s.rotcenterp = rotatePoint(s.startcenterp, this.rot.alpha, this.rot.beta, this.rot.gamma);

      s.centerp.x = s.rotcenterp.x + this.centerp.x;
      s.centerp.y = s.rotcenterp.y + this.centerp.y;
      s.centerp.z = s.rotcenterp.z + this.centerp.z;

      calculateSheetData(s);
      calculateSheetShade(s);

      if (s.startpolygons && !state.objectsintersect && !this.intersectionsenabled) {
        s.polygons = [];
        for (let j = 0; j < s.startpolygons.length; j++) {
          const poly = { points: [] };
          s.polygons.push(poly);
          const startpoly = s.startpolygons[j];
          for (let p = 0; p < startpoly.points.length; p++) {
            const pp = rotatePoint(startpoly.points[p], this.rot.alpha, this.rot.beta, this.rot.gamma);
            poly.points.push(addPoint(pp, this.centerp));
          }
        }
      }
    }

    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Set individual sheet position and rotation within object
   */
  SheetObject.prototype.setSheetPos = function(sheet, sheetpos, sheetrot) {
    const s = sheet;

    const sheetrot2 = fillRot$1(sheetrot);

    s.startcenterp = sheetpos;

    s.p0start = rotatePoint(s.p0orig, sheetrot2.alpha, sheetrot2.beta, sheetrot2.gamma);
    s.p1start = rotatePoint(s.p1orig, sheetrot2.alpha, sheetrot2.beta, sheetrot2.gamma);
    s.p2start = rotatePoint(s.p2orig, sheetrot2.alpha, sheetrot2.beta, sheetrot2.gamma);
    s.normalpstart = rotatePoint(s.normalporig, sheetrot2.alpha, sheetrot2.beta, sheetrot2.gamma);

    if (s.startpolygons && !state.objectsintersect && !this.intersectionsenabled) {
      const diffp = subPoint(sheetpos, s.startpolygonscenterp);
      for (let j = 0; j < s.startpolygons.length; j++) {
        const startpoly = s.startpolygons[j];
        for (let p = 0; p < startpoly.points.length; p++) {
          const relp = startpoly.relpoints[p];
          startpoly.points[p] = getPointInBase(relp, s.p1start, s.p2start, s.normalpstart);
          startpoly.points[p] = addPoint(startpoly.points[p], diffp);
        }
      }
    }

    const rot = this.rot;
    s.p0 = rotatePoint(s.p0start, rot.alpha, rot.beta, rot.gamma);
    s.p1 = rotatePoint(s.p1start, rot.alpha, rot.beta, rot.gamma);
    s.p2 = rotatePoint(s.p2start, rot.alpha, rot.beta, rot.gamma);
    s.normalp = rotatePoint(s.normalpstart, rot.alpha, rot.beta, rot.gamma);
    s.rotcenterp = rotatePoint(s.startcenterp, rot.alpha, rot.beta, rot.gamma);

    s.centerp.x = s.rotcenterp.x + this.centerp.x;
    s.centerp.y = s.rotcenterp.y + this.centerp.y;
    s.centerp.z = s.rotcenterp.z + this.centerp.z;

    calculateSheetData(s);
    calculateSheetShade(s);

    if (s.startpolygons && !state.objectsintersect && !this.intersectionsenabled) {
      s.polygons = [];
      for (let j = 0; j < s.startpolygons.length; j++) {
        const poly = { points: [] };
        s.polygons.push(poly);
        const startpoly = s.startpolygons[j];
        for (let p = 0; p < startpoly.points.length; p++) {
          const pp = rotatePoint(startpoly.points[p], this.rot.alpha, this.rot.beta, this.rot.gamma);
          poly.points.push(addPoint(pp, this.centerp));
        }
      }
    }

    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Rotate individual sheet around arbitrary axis
   */
  SheetObject.prototype.rotateSheet = function(sheet, rotationCenter, rotationAxis, angle) {
    const s = sheet;

    if (s.startpolygons && !state.objectsintersect && !this.intersectionsenabled) {
      for (let j = 0; j < s.startpolygons.length; j++) {
        const startpoly = s.startpolygons[j];
        for (let p = 0; p < startpoly.points.length; p++) {
          startpoly.points[p] = rotateAroundArbitraryAxis(startpoly.points[p], rotationCenter, rotationAxis, angle);
        }
      }
    }

    s.p0start = rotateAroundAxis(s.p0start, rotationAxis, angle);
    s.p1start = rotateAroundAxis(s.p1start, rotationAxis, angle);
    s.p2start = rotateAroundAxis(s.p2start, rotationAxis, angle);
    s.normalpstart = rotateAroundAxis(s.normalpstart, rotationAxis, angle);
    s.startcenterp = rotateAroundArbitraryAxis(s.startcenterp, rotationCenter, rotationAxis, angle);

    // rotationCenter and rotationAxis are given relatively to object orientation
    rotationCenter = rotatePoint(rotationCenter, this.rot.alpha, this.rot.beta, this.rot.gamma);
    rotationAxis = rotatePoint(rotationAxis, this.rot.alpha, this.rot.beta, this.rot.gamma);

    s.p0 = rotateAroundAxis(s.p0, rotationAxis, angle);
    s.p1 = rotateAroundAxis(s.p1, rotationAxis, angle);
    s.p2 = rotateAroundAxis(s.p2, rotationAxis, angle);
    s.normalp = rotateAroundAxis(s.normalp, rotationAxis, angle);
    s.rotcenterp = rotateAroundArbitraryAxis(s.rotcenterp, rotationCenter, rotationAxis, angle);

    s.centerp.x = s.rotcenterp.x + this.centerp.x;
    s.centerp.y = s.rotcenterp.y + this.centerp.y;
    s.centerp.z = s.rotcenterp.z + this.centerp.z;

    calculateSheetData(s);
    calculateSheetShade(s);

    if (s.startpolygons && s.polygons && !state.objectsintersect && !this.intersectionsenabled) {
      s.polygons = [];
      for (let j = 0; j < s.startpolygons.length; j++) {
        const poly = { points: [] };
        s.polygons.push(poly);
        const startpoly = s.startpolygons[j];
        for (let p = 0; p < startpoly.points.length; p++) {
          const pp = rotatePoint(startpoly.points[p], this.rot.alpha, this.rot.beta, this.rot.gamma);
          poly.points.push(addPoint(pp, this.centerp));
        }
      }
    }

    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Mark object for intersection redefinition
   */
  SheetObject.prototype.redefineIntersections = function() {
    this.intersectionsredefine = true;
  };

  /**
   * Show object
   */
  SheetObject.prototype.show = function() {
    for (let i = 0; i < this.sheets.length; i++) {
      this.sheets[i].hidden = false;
      this.sheets[i].dirty = true;
    }
    this.hidden = false;
    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Hide object
   */
  SheetObject.prototype.hide = function() {
    for (let i = 0; i < this.sheets.length; i++) {
      this.sheets[i].hidden = true;
      this.sheets[i].dirty = true;
    }
    this.hidden = true;
    this.intersectionsrecalc = true;
    this.canvasdirty = true;
  };

  /**
   * Get object data as JSON string
   */
  SheetObject.prototype.getString = function() {
    const sheets = [];
    for (let i = 0; i < this.sheets.length; i++) {
      const s = this.sheets[i];

      sheets.push({
        centerp: s.centerp,
        rot: { alphaD: s.rot.alphaD, betaD: s.rot.betaD, gammaD: s.rot.gammaD },
        width: s.width,
        height: s.height,
        canvas: s.canvas.toDataURL()
      });
    }
    const retobj = { name: 'my object', thumbnail: '', hidden: false, intersectionsenabled: this.intersectionsenabled, canvasSize: this.canvasSize, sheets: sheets };
    return JSON.stringify(retobj);
  };

  /**
   * Draw object to scene
   */
  SheetObject.prototype.draw = function() {
    if (!this.canvasdirty)
      return;

    const centerpuv = this.centerpuv;
    const oldcenterpuv = this.oldcenterpuv;

    // check if old position is close enough to be refreshed in one step
    const du = Math.ceil(Math.abs(centerpuv.u - oldcenterpuv.u) + this.canvasSize.w);
    const dv = Math.ceil(Math.abs(centerpuv.v - oldcenterpuv.v) + this.canvasSize.h);

    const fit = (du < state.temppartcanvas.width && dv < state.temppartcanvas.height);
    if (fit) {
      // update old + new location using temppartcanvas
      const u = Math.floor(Math.min(centerpuv.u, oldcenterpuv.u) - this.canvasSize.relu);
      const v = Math.floor(Math.min(centerpuv.v, oldcenterpuv.v) - this.canvasSize.relv);
      const w = du;
      const h = dv;
      drawScenePart({
        viewPort: { u: u, v: v, w: w, h: h }
      });
      const canvas = state.backgroundcanvas ? state.backgroundcanvas : state.canvas;
      const context = state.backgroundcanvas ? state.backgroundcontext : state.context;
      const canvasU = u + canvas.width / 2;
      const canvasV = v + canvas.height / 2;
      const canvasW = w - 1;
      const canvasH = h - 1;
      context.drawImage(state.temppartcanvas, 0, 0, canvasW, canvasH, canvasU, canvasV, canvasW, canvasH);

      if (state.drawObjectContour) {
        context.strokeStyle = '#FFF';
        context.strokeRect(centerpuv.u - this.canvasSize.relu + canvas.width / 2, centerpuv.v - this.canvasSize.relv + canvas.height / 2, this.canvasSize.w, this.canvasSize.h);
      }
    } else {
      // update old + new location separately
      drawObjectToScene(this, oldcenterpuv);
      drawObjectToScene(this, centerpuv);
    }

    this.canvasdirty = false;

    if (this.deleting)
      deleteObject(this);
  };

  /**
   * @fileoverview Object helper utilities for defining and managing objects
   * Provides utilities for object creation, rotation handling, and object data serialization
   */


  const objhelpers = {};

  /**
   * Draw object to scene canvas
   */
  function drawObjectToScene(obj, centerpuv) {
    const u = Math.floor(centerpuv.u - obj.canvasSize.relu);
    const v = Math.floor(centerpuv.v - obj.canvasSize.relv);
    const w = obj.canvasSize.w;
    const h = obj.canvasSize.h;
    drawScenePart({
      viewPort: { u: u, v: v, w: w, h: h }
    });
    const canvas = state.backgroundcanvas ? state.backgroundcanvas : state.canvas;
    const context = state.backgroundcanvas ? state.backgroundcontext : state.context;
    const canvasU = u + canvas.width / 2;
    const canvasV = v + canvas.height / 2;
    const canvasW = w - 1;
    const canvasH = h - 1;
    if (state.drawObjectContour) {
      state.temppartcontext.strokeStyle = '#FFF';
      state.temppartcontext.strokeRect(0, 0, canvasW, canvasH);
    }
    context.drawImage(state.temppartcanvas, 0, 0, canvasW, canvasH, canvasU, canvasV, canvasW, canvasH);
  }

  /**
   * Define application objects from server data
   */
  function defineAppObjects(appobjects) {
    state.appobjects = {};
    for (let i = 0; i < appobjects.length; i++) {
      const obj = appobjects[i];
      state.appobjects[obj.name] = obj;
    }
  }

  /**
   * Define object from template by name
   */
  function defineObject(name) {
    const obj = state.appobjects[name];
    if (!obj)
      return null;

    const createdSheets = [];
    for (let i = 0; i < obj.sheets.length; i++) {
      const s = new Sheet(obj.sheets[i].centerp, obj.sheets[i].rot, { w: obj.sheets[i].width, h: obj.sheets[i].height });
      s.canvasdata = obj.sheets[i].canvas;
      createdSheets.push(s);
    }

    const canvasSize = obj.canvasSize;
    const createdObj = new SheetObject({ x: 0, y: 0, z: 0 }, { alphaD: 0, betaD: 0, gammaD: 0 }, createdSheets, canvasSize, obj.intersectionsenabled);
    for (let i = 0; i < createdSheets.length; i++) {
      createdSheets[i].objecttypehidden = obj.hidden;
    }

    createdObj.name = name;
    return createdObj;
  }

  /**
   * Convert radians to degrees
   */
  function fromRadian(a) {
    return a / Math.PI * 180;
  }

  /**
   * Convert degrees to radians
   */
  function fromDegree(a) {
    return a / 180 * Math.PI;
  }

  /**
   * Fill rotation object with both radians and degrees
   */
  function fillRot$1(rot) {
    const newrot = {
      alpha: rot.alpha, beta: rot.beta, gamma: rot.gamma,
      alphaD: rot.alphaD, betaD: rot.betaD, gammaD: rot.gammaD
    };

    // fill radians if degrees are given
    if (typeof (newrot.alpha) === 'undefined')
      newrot.alpha = fromDegree(newrot.alphaD);
    if (typeof (newrot.beta) === 'undefined')
      newrot.beta = fromDegree(newrot.betaD);
    if (typeof (newrot.gamma) === 'undefined')
      newrot.gamma = fromDegree(newrot.gammaD);

    // fill degrees if radians are given
    if (typeof (newrot.alphaD) === 'undefined')
      newrot.alphaD = fromRadian(newrot.alpha);
    if (typeof (newrot.betaD) === 'undefined')
      newrot.betaD = fromRadian(newrot.beta);
    if (typeof (newrot.gammaD) === 'undefined')
      newrot.gammaD = fromRadian(newrot.gamma);

    return newrot;
  }

  /**
   * Calculate rotation vector from rotation angles
   */
  function calcRotVector(rot, rotvectorstart) {
    const rotvector = [];
    rotvector[0] = rotatePoint(rotvectorstart[0], rot.alpha, rot.beta, rot.gamma);
    rotvector[1] = rotatePoint(rotvectorstart[1], rot.alpha, rot.beta, rot.gamma);
    rotvector[2] = rotatePoint(rotvectorstart[2], rot.alpha, rot.beta, rot.gamma);
    return rotvector;
  }

  /**
   * Get thumbnail image string for object
   */
  function getThumbnailString(imgSrcPath, callback) {
    const i = document.createElement('img');
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    i.onload = () => {
      ctx.drawImage(i, 0, 0);
      callback(c.toDataURL());
    };
    i.src = imgSrcPath;
  }

  /**
   * Get current sheets as object data
   */
  function getCurrentSheetsObject() {
    if (state.currentSheet === -1)
      return { name: 'my object', thumbnail: '', hidden: false, canvasSize: { w: 0, h: 0, relu: 0, relv: 0 }, sheets: {} };

    const currentSheet = state.sheets[state.currentSheet];
    const group = currentSheet.group;
    const sheets = [];
    if (typeof (group) !== 'undefined' && group !== null) {
      for (let i = 0; i < state.sheets.length; i++) {
        const s = state.sheets[i];
        if (s.group !== group)
          continue;

        sheets.push({
          centerp: s.centerp,
          rot: { alphaD: s.rot.alphaD, betaD: s.rot.betaD, gammaD: s.rot.gammaD },
          width: s.width,
          height: s.height,
          canvas: s.canvas.toDataURL()
        });
      }
    } else {
      const s = currentSheet;
      sheets.push({
        centerp: s.centerp,
        rot: { alphaD: s.rot.alphaD, betaD: s.rot.betaD, gammaD: s.rot.gammaD },
        width: s.width,
        height: s.height,
        canvas: s.canvas.toDataURL()
      });
    }

    let maxdist = 0;
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const w2 = sheet.width / 2;
      const h2 = sheet.height / 2;
      const dist = Math.sqrt(w2 * w2 + h2 * h2) + pointDist(sheet.centerp, { x: 0, y: 0, z: 0 });
      if (dist > maxdist)
        maxdist = dist;
    }
    const w = Math.round(maxdist * 2);
    const h = w;
    const relu = Math.round(maxdist);
    const relv = Math.round(maxdist);

    const canvasSize = { w: w, h: h, relu: relu, relv: relv };

    return { name: 'my object', thumbnail: '', hidden: false, intersectionsenabled: true, canvasSize: canvasSize, sheets: sheets };
  }

  /**
   * Get current sheets as JSON string
   */
  function getCurrentSheetsObjectStr() {
    const retobj = getCurrentSheetsObject();
    return JSON.stringify(retobj);
  }

  // Export objhelpers functions
  objhelpers.drawObjectToScene = drawObjectToScene;
  objhelpers.fillRot = fillRot$1;
  objhelpers.defineAppObjects = defineAppObjects;
  objhelpers.defineObject = defineObject;
  objhelpers.getThumbnailString = getThumbnailString;
  objhelpers.getCurrentSheetsObject = getCurrentSheetsObject;
  objhelpers.getCurrentSheetsObjectStr = getCurrentSheetsObjectStr;
  objhelpers.calcRotVector = calcRotVector;

  var objhelpers$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    calcRotVector: calcRotVector,
    drawObjectToScene: drawObjectToScene,
    fillRot: fillRot$1,
    objhelpers: objhelpers
  });

  /**
   * BaseSheet class - static base rectangles for the scene
   */


  class BaseSheet {
    constructor(centerp, rot, size) {
      const rotclone = fillRot(rot);

      this.width = size.w;
      this.height = size.h;
      this.centerp = clonePoint(centerp);
      this.rot = { alphaD: rotclone.alphaD, betaD: rotclone.betaD, gammaD: rotclone.gammaD };

      // These will be set by calc module when integrated
      if (window.calc) {
        window.calc.defineSheetParams(this);
        window.calc.limitToCorners(this);
        window.calc.calculateSheetData(this);
      }
      calculateSheetShade(this);

      state.basesheets.push(this);
    }

    destroy() {
      const bidx = state.basesheets.indexOf(this);
      if (bidx != -1)
        state.basesheets.splice(bidx, 1);
    }
  }

  function fillRot(rot) {
    if (!rot) return { alphaD: 0, betaD: 0, gammaD: 0 };
    return {
      alphaD: rot.alphaD || 0,
      betaD: rot.betaD || 0,
      gammaD: rot.gammaD || 0
    };
  }

  /**
   * @fileoverview Scene management, canvas initialization, and yard loading
   * Handles scene setup, center positioning, and dynamic yard loading/unloading
   */


  const scene = {};
  let loadedyards = {};

  scene.yardcenterstart = { yardx: 0, yardy: 0 };
  scene.yardcenter = { yardx: 0, yardy: 0 };
  scene.center = { x: 0, y: 0, u: 0, v: 0 };
  scene.tilewidth = 300;
  scene.tilesize = { x: 212, y: 106 };

  /**
   * Initialize the sheetengine scene with canvas element
   */
  function init(canvasElement, backgroundSize) {
    config$1.allowContourDrawing = false;

    state.sheets = [];
    state.basesheets = [];
    state.polygons = [];
    state.objects = [];
    loadedyards = {};

    state.canvas = canvasElement;
    state.context = state.canvas.getContext('2d');
    state.canvasCenter = { u: state.canvas.width / 2, v: state.canvas.height / 2 };

    config$2.baseshadowCanvas = createCanvas(state.canvas.width, state.canvas.height);

    if (backgroundSize) {
      config$2.baseshadowCanvas.width = backgroundSize.w;
      config$2.baseshadowCanvas.height = backgroundSize.h;
      state.backgroundcanvas = createCanvas(backgroundSize.w, backgroundSize.h);
      state.backgroundcontext = state.backgroundcanvas.getContext('2d');
      state.backgroundtranslate = { u: 0, v: 0 };

      state.temppartcanvas = createCanvas(state.tempCanvasSize.w, state.tempCanvasSize.h);
      state.temppartcontext = state.temppartcanvas.getContext('2d');
      state.temppartshadowcanvas = createCanvas(state.tempCanvasSize.w, state.tempCanvasSize.h);
      state.temppartshadowcontext = state.temppartshadowcanvas.getContext('2d');
    }
    config$2.baseshadowContext = config$2.baseshadowCanvas.getContext('2d');
    config$2.baseShadowCenter = { u: config$2.baseshadowCanvas.width / 2, v: config$2.baseshadowCanvas.height / 2 };
  }

  /**
   * Add yards to the scene
   */
  function addYards(yards, callback) {
    let newsheets = [];
    let newobjects = [];

    if (yards) {
      for (let i = 0; i < yards.length; i++) {
        const yard = yards[i];

        const offset = { x: (yard.x - scene.yardcenterstart.yardx) * scene.tilewidth, y: (yard.y - scene.yardcenterstart.yardy) * scene.tilewidth, z: 0 };

        const basesheet = new BaseSheet(offset, { alphaD: -90, betaD: 0, gammaD: 0 }, { w: scene.tilewidth, h: scene.tilewidth });
        basesheet.color = yard.baserectcolor;

        let sheets;
        if (yard.sheets) {
          sheets = createSheets(yard.sheets, offset);
          newsheets = newsheets.concat(sheets);
        } else {
          sheets = [];
        }

        const objects = yard.objects;
        const yardObjects = [];
        if (objects) {
          for (let j = 0; j < objects.length; j++) {
            const objdata = objects[j];
            undefined(objdata.name);
            continue;
          }
        }

        const newyard = { sheets: sheets, basesheet: basesheet, x: yard.x, y: yard.y, objects: yardObjects };
        const key = 'x' + yard.x + 'y' + yard.y;
        loadedyards[key] = newyard;
      }
    }
    if (newsheets.length === 0) {
      callback([], []);
      return;
    }

    // draw images on canvases
    state.imgCount = 0;
    for (let i = 0; i < newsheets.length; i++) {
      const img = new Image();
      const context = newsheets[i].canvas.getContext('2d');
      img.onload = imageOnload(newsheets[i], context, img, newsheets.length, () => { callback(newsheets, newobjects); });
      img.src = newsheets[i].canvasdata;
      newsheets[i].canvasdata = null;
    }
  }

  /**
   * Create sheets from sheet data
   */
  function createSheets(sheetdata, offset) {
    const sheets = [];
    if (sheetdata == null)
      return sheets;

    for (let i = 0; i < sheetdata.length; i++) {
      const data = sheetdata[i];
      const sheet = new Sheet(
        addPoint(data.centerp, offset),
        data.rot,
        { w: data.width, h: data.height }
      );
      sheet.canvasdata = data.canvas;
      sheets.push(sheet);
    }
    return sheets;
  }

  /**
   * Create image onload handler
   */
  function imageOnload(sheet, context, img, count, callback) {
    return function() {
      context.drawImage(img, 0, 0);
      sheet.canvasChanged();
      state.imgCount++;
      if (state.imgCount === count) {
        callback();
      }
    };
  }

  /**
   * Move base shadows by a vector
   */
  function moveBaseShadows(vector, sheets) {
    if (!config$2.drawShadows)
      return;

    const sheetsToMove = state.sheets;
    for (let i = 0; i < sheetsToMove.length; i++) {
      const s = sheetsToMove[i];
      s.baseShadoweData.translatex -= vector.u;
      s.baseShadoweData.translatey -= vector.v;
    }
  }

  /**
   * Initialize scene with center point
   */
  function initScene(centerp) {
    undefined();

    const centerpuv = transformPoint(centerp);
    scene.center = { x: centerp.x, y: centerp.y, u: centerpuv.u, v: centerpuv.v };

    moveBaseShadows(scene.center);
  }

  /**
   * Move scene center by a vector
   */
  function moveCenter(vectorxyz, vectoruv) {
    if (!vectoruv) {
      if (!vectorxyz.z)
        vectoruv = transformPoint({ x: vectorxyz.x, y: vectorxyz.y, z: 0 });
      else
        vectoruv = transformPointz(vectorxyz);
    }
    if (!vectorxyz)
      vectorxyz = inverseTransformPointSimple(vectoruv);

    scene.center.x += vectorxyz.x;
    scene.center.y += vectorxyz.y;
    scene.center.u += vectoruv.u;
    scene.center.v += vectoruv.v;

    // move static sheets baseshadow
    moveBaseShadows(vectoruv);
  }

  /**
   * Set scene center to absolute position
   */
  function setCenter(vectorxyz, vectoruv) {
    if (!vectoruv) {
      if (!vectorxyz.z)
        vectoruv = transformPoint({ x: vectorxyz.x, y: vectorxyz.y, z: 0 });
      else
        vectoruv = transformPointz(vectorxyz);
    }
    if (!vectorxyz)
      vectorxyz = inverseTransformPointSimple(vectoruv);

    scene.center.x = vectorxyz.x;
    scene.center.y = vectorxyz.y;
    const diff = { u: vectoruv.u - scene.center.u, v: vectoruv.v - scene.center.v };
    scene.center.u = vectoruv.u;
    scene.center.v = vectoruv.v;

    // move static sheets baseshadow
    moveBaseShadows(diff);
  }

  /**
   * Get URL parameters
   */
  function getUrlParams() {
    let e;
    const a = /\+/g;
    const r = /([^&=]+)=?([^&]*)/g;
    const d = (s) => { return decodeURIComponent(s.replace(a, " ")); };
    const q = window.location.search.substring(1);

    const urlParams = {};
    while (e = r.exec(q))
      urlParams[d(e[1])] = d(e[2]);
    return urlParams;
  }

  /**
   * Get yard center from URL parameters
   */
  function getUrlLoadInfo() {
    const urlParams = scene.getUrlParams();
    return { yardcenter: { yardx: parseInt(urlParams.x), yardy: parseInt(urlParams.y) } };
  }

  /**
   * Make AJAX request for URL
   */
  function requestUrl(url, callback) {
    $.ajax({
      url: url,
      cache: false,
      dataType: "json",
      success: callback
    });
  }

  /**
   * Get yards from server
   */
  function getYards(urlBase, center, levelsize, appid, callback) {
    scene.yardcenterstart = { yardx: center.yardx, yardy: center.yardy };
    const url = urlBase + '/yard?x=' + center.yardx + '&y=' + center.yardy + '&levelsize=' + levelsize + '&appid=' + appid + '&appobjects=1';
    requestUrl(url, (yardsAndObjects) => {
      if (yardsAndObjects) {
        if (yardsAndObjects.center) {
          scene.yardcenterstart = { yardx: yardsAndObjects.center.x, yardy: yardsAndObjects.center.y };
          scene.yardcenter = { yardx: yardsAndObjects.center.x, yardy: yardsAndObjects.center.y };
          scene.level = yardsAndObjects.level;
        }
        undefined(yardsAndObjects.appobjects);
        state.objects = [];
        addYards(yardsAndObjects.yards, (newsheets, newobjects) => {
          callback();
        });
      } else {
        callback();
      }
    });
  }

  /**
   * Get new yards from server (incremental loading)
   */
  function getNewYards(urlBase, center, levelsize, appid, callback) {
    // gather yards to be removed and loaded
    const oldcenter = scene.yardcenter;
    scene.yardcenter = { yardx: center.yardx, yardy: center.yardy };
    const newcenter = scene.yardcenter;

    const oldc = { x1: oldcenter.yardx - levelsize, x2: oldcenter.yardx + levelsize, y1: oldcenter.yardy - levelsize, y2: oldcenter.yardy + levelsize };
    const newc = { x1: newcenter.yardx - levelsize, x2: newcenter.yardx + levelsize, y1: newcenter.yardy - levelsize, y2: newcenter.yardy + levelsize };

    // yards to remove
    const yardsToRemove = [];
    for (let x = oldc.x1; x <= oldc.x2; x++) {
      for (let y = oldc.y1; y <= oldc.y2; y++) {
        if (x < newc.x1 || x > newc.x2 ||
          y < newc.y1 || y > newc.y2)
          yardsToRemove.push({ x: x, y: y });
      }
    }

    // yards to add
    const yardsToAdd = [];
    for (let x = newc.x1; x <= newc.x2; x++) {
      for (let y = newc.y1; y <= newc.y2; y++) {
        if (x < oldc.x1 || x > oldc.x2 ||
          y < oldc.y1 || y > oldc.y2)
          yardsToAdd.push({ x: x, y: y });
      }
    }

    let yardsStr = '';
    for (let i = 0; i < yardsToAdd.length; i++) {
      yardsStr += yardsToAdd[i].x + ',' + yardsToAdd[i].y;
      if (i < yardsToAdd.length - 1)
        yardsStr += ';';
    }
    const url = urlBase + '/yard?x=' + scene.yardcenterstart.yardx + '&y=' + scene.yardcenterstart.yardy + '&yards=' + yardsStr + '&appid=' + appid + '&appobjects=0';
    requestUrl(url, (yardsAndObjects) => {
      const oldcenter2 = { x: oldcenter.yardx * scene.tilewidth, y: oldcenter.yardy * scene.tilewidth, z: 0 };
      const newcenter2 = { x: newcenter.yardx * scene.tilewidth, y: newcenter.yardy * scene.tilewidth, z: 0 };
      scene.translateBackground(oldcenter2, newcenter2);

      if (yardsAndObjects) {
        addYards(yardsAndObjects.yards, (newsheets, newobjects) => {
          const removedsheets = { sheets: [] };
          const removedobjects = { objects: [] };
          newYardsAdded(newsheets, removedsheets, removedobjects, yardsToRemove);
          callback(newsheets, newobjects, removedsheets.sheets, removedobjects.objects);
        });
      } else {
        const removedsheets = { sheets: [] };
        const removedobjects = { objects: [] };
        newYardsAdded(null, removedsheets, removedobjects, yardsToRemove);
        callback([], [], removedsheets.sheets, removedobjects.objects);
      }
    });
  }

  /**
   * Remove yard from scene
   */
  function removeYard(yard) {
    // remove yard sheets
    for (let s = 0; s < yard.sheets.length; s++) {
      const sheet = yard.sheets[s];
      sheet.destroy();
    }

    // remove basesheet
    const bidx = state.basesheets.indexOf(yard.basesheet);
    if (bidx !== -1)
      state.basesheets.splice(bidx, 1);

    // remove yard objects
    for (let o = 0; o < yard.objects.length; o++) {
      const obj = yard.objects[o];
      const idx = state.objects.indexOf(obj);
      if (idx !== -1)
        state.objects.splice(idx, 1);

      obj.destroy();
    }

    // remove yard
    delete loadedyards['x' + yard.x + 'y' + yard.y];

    // adjust sheet indexes
    for (let i = 0; i < state.sheets.length; i++) {
      state.sheets[i].index = i;
    }
  }

  /**
   * Handle new yards being added
   */
  function newYardsAdded(newsheets, removedsheets, removedobjects, yardsToRemove) {
    // remove yard
    for (let i = 0; i < yardsToRemove.length; i++) {
      const y = yardsToRemove[i];
      const key = 'x' + y.x + 'y' + y.y;
      const yard = loadedyards[key];
      if (!yard)
        continue;
      removedsheets.sheets = removedsheets.sheets.concat(yard.sheets);
      removedobjects.objects = removedobjects.objects.concat(yard.objects);
      removeYard(yard);
    }
  }

  /**
   * Get yard coordinates from position
   */
  function getYardFromPos(centerp) {
    const yardx = Math.round(centerp.x / scene.tilewidth);
    const yardy = Math.round(centerp.y / scene.tilewidth);
    return { relyardx: yardx, relyardy: yardy, yardx: yardx + scene.yardcenterstart.yardx, yardy: yardy + scene.yardcenterstart.yardy };
  }

  /**
   * Translate background canvas
   */
  function translateBackground(oldcenter, newcenter) {
    if (typeof (oldcenter.z) === 'undefined')
      oldcenter.z = 0;
    if (typeof (newcenter.z) === 'undefined')
      newcenter.z = 0;
    const oldcenteruv = transformPoint(oldcenter);
    const newcenteruv = transformPoint(newcenter);
    const transu = newcenteruv.u - oldcenteruv.u;
    const transv = newcenteruv.v - oldcenteruv.v;
    state.backgroundcontext.translate(-transu, -transv);
    config$2.baseshadowContext.translate(-transu, -transv);
    state.backgroundtranslate.u += transu;
    state.backgroundtranslate.v += transv;

    state.backgroundcontext.clearRect(state.backgroundtranslate.u, state.backgroundtranslate.v, state.backgroundcanvas.width, state.backgroundcanvas.height);
    config$2.baseshadowContext.clearRect(state.backgroundtranslate.u, state.backgroundtranslate.v, state.backgroundcanvas.width, state.backgroundcanvas.height);
  }

  // Export scene functions
  scene.init = init;
  scene.initScene = initScene;
  scene.moveCenter = moveCenter;
  scene.setCenter = setCenter;
  scene.getUrlParams = getUrlParams;
  scene.getUrlLoadInfo = getUrlLoadInfo;
  scene.getYards = getYards;
  scene.getNewYards = getNewYards;
  scene.getYardFromPos = getYardFromPos;
  scene.translateBackground = translateBackground;

  var scene$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    scene: scene
  });

  /**
   * DensityMap class - collision detection and spatial queries
   */


  class DensityMap {
    constructor(granularity) {
      this.map = {};
      this.granularity = granularity;
    }

    get(p) {
      const map = this.map;
      const gran = this.granularity;
      const x = Math.round(p.x / gran);
      const y = Math.round(p.y / gran);
      const z = Math.round(p.z / gran);

      if (map['x' + x + 'y' + y + 'z' + z])
        return map['x' + x + 'y' + y + 'z' + z];

      return 0;
    }

    put(p) {
      this.map;
      const gran = this.granularity;
      const x = Math.round(p.x / gran);
      const y = Math.round(p.y / gran);
      const z = Math.floor(p.z / gran);

      this.add('x' + x + 'y' + y + 'z' + z);
      this.add('x' + (x + 1) + 'y' + (y) + 'z' + (z));
      this.add('x' + (x) + 'y' + (y + 1) + 'z' + (z));
      this.add('x' + (x - 1) + 'y' + (y) + 'z' + (z));
      this.add('x' + (x) + 'y' + (y - 1) + 'z' + (z));
    }

    remove(p) {
      this.map;
      const gran = this.granularity;
      const x = Math.round(p.x / gran);
      const y = Math.round(p.y / gran);
      const z = Math.floor(p.z / gran);

      this.sub('x' + x + 'y' + y + 'z' + z);
      this.sub('x' + (x + 1) + 'y' + (y) + 'z' + (z));
      this.sub('x' + (x) + 'y' + (y + 1) + 'z' + (z));
      this.sub('x' + (x - 1) + 'y' + (y) + 'z' + (z));
      this.sub('x' + (x) + 'y' + (y - 1) + 'z' + (z));
    }

    add(id) {
      const map = this.map;
      if (!map[id])
        map[id] = 1;
      else
        map[id] = map[id] + 1;
    }

    sub(id) {
      const map = this.map;
      if (!map[id] || map[id] == 0)
        return;
      else
        map[id] = map[id] - 1;
    }

    addSheet(sheet) {
      this.processSheet(sheet, this.put);
    }

    removeSheet(sheet) {
      this.processSheet(sheet, this.remove);
    }

    processSheet(sheet, processFunction) {
      const gran = this.granularity;
      const s = sheet;
      if (s.skipDensityMap) return;
      const granx = Math.round(s.width / gran);
      const grany = Math.round(s.height / gran);
      const xmod = {
        x: (s.corners[1].x - s.corners[0].x) / granx,
        y: (s.corners[1].y - s.corners[0].y) / granx,
        z: (s.corners[1].z - s.corners[0].z) / granx
      };
      const ymod = {
        x: (s.corners[3].x - s.corners[0].x) / grany,
        y: (s.corners[3].y - s.corners[0].y) / grany,
        z: (s.corners[3].z - s.corners[0].z) / grany
      };

      const w = s.canvas.width;
      const h = s.canvas.height;
      const imgData = s.context.getImageData(0, 0, w, h).data;
      let actp = clonePoint(addPoint(s.corners[0], { x: (xmod.x + ymod.x) / 2, y: (xmod.y + ymod.y) / 2, z: (xmod.z + ymod.z) / 2 }));
      for (let y = 0; y < grany; y++) {
        let actpx = clonePoint(actp);
        for (let x = 0; x < granx; x++) {
          const sx = Math.round(x * gran + gran / 2);
          const sy = Math.round(y * gran + gran / 2);
          const pixi = (sx + w * sy) * 4;
          const alpha = imgData[pixi + 3];
          if (alpha != 0) {
            processFunction.call(this, actpx);
          }
          actpx = addPoint(actpx, xmod);
        }
        actp = addPoint(actp, ymod);
      }
    }

    addSheets(sheets) {
      for (let i = 0; i < sheets.length; i++) {
        this.addSheet(sheets[i]);
      }
    }

    removeSheets(sheets) {
      for (let i = 0; i < sheets.length; i++) {
        this.removeSheet(sheets[i]);
      }
    }

    getTargetHeight(targetp, objectHeight) {
      const startz = targetp.z + objectHeight;
      for (let z = startz; z > 0; z--) {
        const obstacle = this.get({ x: targetp.x, y: targetp.y, z });
        if (obstacle) return z;
      }
      return 0;
    }

    getTargetPoint(targetPos, vector, objHeight, tolerance) {
      let allowMove = true;
      let stopFall = false;
      let targetp = {
        x: targetPos.x + vector.x,
        y: targetPos.y + vector.y,
        z: targetPos.z + vector.z
      };
      let h = this.getTargetHeight({ x: targetp.x, y: targetp.y, z: targetp.z }, objHeight);
      if (h >= targetp.z) {
        if (h - targetp.z < tolerance) {
          stopFall = true;
          targetp.z = h;
        } else {
          vector.x = 0;
          vector.y = 0;
          targetp = {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z + vector.z
          };
          h = this.getTargetHeight({ x: targetp.x, y: targetp.y, z: targetp.z }, objHeight);
          if (h >= targetp.z) {
            stopFall = true;
            if (h - targetp.z < tolerance) {
              targetp.z = h;
            } else {
              allowMove = false;
              targetp.z = h;
            }
          }
        }
      }
      return { allowMove, targetp, movex: vector.x, movey: vector.y, stopFall };
    }
  }

  /**
   * SheetEngine v2.0.0
   * Isometric HTML5 JavaScript Display Engine
   * https://github.com/normanzb/sheetengine
   *
   * Licensed under the MIT license.
   * Copyright (C) 2012 Levente Dobson
   */


  // Initialize shadow base matrix
  config$2.shadowBaseMatrixInverse = getBaseMatrixInverse(
    config$2.lightSourcep1,
    config$2.lightSourcep2,
    config$2.lightSource
  );

  // Create the main sheetengine namespace object
  const sheetengine = {
    // State
    ...state,

    // Modules
    geometry,
    transforms,
    shadows: config$2,
    drawing: config$1,
    calc: {
      calculateChangedSheets: undefined,
      calculateAllSheets: undefined,
      deleteSheets: undefined,
      defineSheetParams: undefined
    },
    scene: {
      init: undefined,
      initScene: undefined,
      moveCenter: undefined,
      setCenter: undefined,
      addYards: undefined,
      getYards: undefined,
      getNewYards: undefined,
      removeYard: undefined,
      translateBackground: undefined
    },
    objhelpers: {
      defineObject: undefined,
      defineAppObjects: undefined,
      drawObjectToScene: drawObjectToScene,
      fromRadian: undefined,
      fromDegree: undefined,
      getCurrentSheetsObject: undefined,
      getCurrentSheetsObjectStr: undefined,
      redefineIntersections: undefined
    },

    // Classes
    BaseSheet,
    Sheet,
    SheetObject,
    DensityMap
  };

  exports.BaseSheet = BaseSheet;
  exports.DensityMap = DensityMap;
  exports.Sheet = Sheet;
  exports.SheetObject = SheetObject;
  exports.calc = calc$1;
  exports.default = sheetengine;
  exports.drawing = drawing;
  exports.geometry = geometry;
  exports.internal = internal;
  exports.intersections = intersections;
  exports.objhelpers = objhelpers$1;
  exports.scene = scene$1;
  exports.shadows = shadows;
  exports.state = state;
  exports.transforms = transforms;
  exports.zOrdering = zOrdering;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=sheetengine.js.map
