/**
 * Shadow calculation and rendering system
 */

import { state } from './core.js';
import * as geometry from './geometry.js';
import * as transforms from './transforms.js';
import { scene } from './scene.js';

export let config = {
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

export function calculateSheetBaseShadow(sheet) {
  const s = sheet;
  const l = config.lightSource;
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
  s.baseShadoweData = calculateSheetDataSingle(centerpsect, p0sect, p1sect, p2sect, transforms.transformPoint, transforms.transformPointz, config.baseShadowCenter, s.corners);

  // Adjust for scene center when available
  if (scene.center) {
    s.baseShadoweData.translatex -= scene.center.u;
    s.baseShadoweData.translatey -= scene.center.v;
  }
}

function calculateSheetDataSingle(centerp, p0rot, p1rot, p2rot, transformFunction, transformFunctionz, canvasCenter, corners) {
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

  return { p0uv: p0, p1uv: p1, p2uv: p2, translatex, translatey, ta, tb, tc, td, centerpuv, cornersuv: c, umax, umin, vmax, vmin, zmax, zmin };
}

export function checkDirtyShadowConstraint(prev, dirtySheets) {
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

export function initBaseRectShadow(ctx, size, rel, viewport, drawing) {
  if (!config.drawShadows) return;

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

export function drawBaseRectShadow() {
  state.context.save();
  state.context.globalAlpha = config.shadowAlpha;
  if (scene.tilesize) {
    state.context.drawImage(config.baseshadowCanvas, state.canvasCenter.u - scene.tilesize.x, state.canvasCenter.v - 2 * scene.tilesize.y);
  }
  state.context.restore();
}

export function drawSheetShadow(sheet) {
  if (sheet.hidden) return;

  const drawshadows = !sheet.shaded && config.drawShadows && sheet.allowshadows;

  if (drawshadows && sheet.shadowtempcontext) {
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

  if (sheet.compositecontext) {
    sheet.compositecontext.save();
    sheet.compositecontext.drawImage(sheet.canvas, 0, 0);

    if (sheet.shaded) {
      sheet.compositecontext.globalCompositeOperation = 'source-over';
      sheet.compositecontext.globalAlpha = config.shadeAlpha;
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
      sheet.compositecontext.globalAlpha = config.shadowAlpha - sheet.shadealpha;
      sheet.compositecontext.globalCompositeOperation = 'source-atop';
      sheet.compositecontext.drawImage(sheet.shadowtempcanvas, 0, 0);
    }
    sheet.compositecontext.restore();
  }
}

export function calculateSheetsShadows(calculateAll) {
  for (let i = 0; i < state.sheets.length; i++) {
    const sheet = state.sheets[i];
    if (sheet.shadowdirty || sheet.dirty || calculateAll)
      drawSheetShadow(sheet);
  }
}

function calculateShadowData(sheet, shadowcaster) {
  const s = shadowcaster;
  const l = config.lightSource;

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

  const eData = calculateSheetDataSingle(centerpsect, p0sect, p1sect, p2sect, transforms.transformPoint, null, state.canvasCenter, null);

  const A1 = geometry.getBaseMatrixInverse({ x: sheet.data.ta, y: sheet.data.tb, z: 0 }, { x: sheet.data.tc, y: sheet.data.td, z: 0 }, { x: sheet.data.translatex, y: sheet.data.translatey, z: 1 });
  const C = geometry.multiplyMatrices(A1.b1, A1.b2, A1.b3, { x: eData.ta, y: eData.tb, z: 0 }, { x: eData.tc, y: eData.td, z: 0 }, { x: eData.translatex, y: eData.translatey, z: 1 });

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
  const l = config.lightSource;

  const lightPoint = { x: sheet.centerp.x - (l.x * 100), y: sheet.centerp.y - (l.y * 100), z: sheet.centerp.z - (l.z * 100) };
  const viewPoint = { x: sheet.centerp.x - (v.x * 100), y: sheet.centerp.y - (v.y * 100), z: sheet.centerp.z - (v.z * 100) };

  const nrr0 = sheet.normalp.x * (lightPoint.x - sheet.centerp.x) + sheet.normalp.y * (lightPoint.y - sheet.centerp.y) + sheet.normalp.z * (lightPoint.z - sheet.centerp.z);
  const nrr02 = -sheet.normalp.x * (viewPoint.x - sheet.centerp.x) - sheet.normalp.y * (viewPoint.y - sheet.centerp.y) - sheet.normalp.z * (viewPoint.z - sheet.centerp.z);

  const backToLightSource = nrr0 < 0;
  const backToViewSource = nrr02 < 0;
  return (backToLightSource && backToViewSource) || (!backToLightSource && !backToViewSource);
}

export function calculateSheetShade(sheet) {
  if (!sheet.allowshadows) {
    sheet.shaded = false;
    sheet.shadealpha = 0;
    return;
  }

  const l = config.lightSource;
  const n = sheet.normalp;
  const scale = 3;

  const axb = geometry.vectorMagnitude(geometry.crossProduct(l, n));
  const ab = geometry.vectorMagnitude(l) * geometry.vectorMagnitude(n);
  const t = Math.asin(axb / ab) / (Math.PI * scale);

  sheet.shaded = isSheetDark(sheet, state.viewSource);
  sheet.shadealpha = t - 0.05;
}

export function drawBaseRectShadows(context, offset) {
  if (!offset) offset = { u: 0, v: 0 };
  context.save();
  context.globalAlpha = config.shadowAlpha;
  context.drawImage(config.baseshadowCanvas, offset.u, offset.v);
  context.restore();
}

// Initialize shadow base matrix inverse
config.shadowBaseMatrixInverse = geometry.getBaseMatrixInverse(config.lightSourcep1, config.lightSourcep2, config.lightSource);
