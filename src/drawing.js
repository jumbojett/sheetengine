/**
 * Canvas drawing utilities and rendering functions
 */

import { state } from './core.js';
import * as shadows from './shadows.js';
import * as transforms from './transforms.js';
import * as geometry from './geometry.js';
import { scene } from './scene.js';

export let config = {
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

export function createCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function redraw() {
  state.context.clearRect(0, 0, state.canvas.width, state.canvas.height);
  if (config.drawBaseRect)
    config.drawBaseRect();
  if (shadows.config.drawShadows) {
    shadows.initBaseRectShadow(shadows.config.baseshadowContext, { w: shadows.config.baseshadowCanvas.width, h: shadows.config.baseshadowCanvas.height }, { u: 0, v: 0 }, null, { drawRect });
    shadows.drawBaseRectShadow();
  }
  if (config.drawBeforeSheets)
    config.drawBeforeSheets();
  drawSheets(state.context);
  if (config.drawAfterSheets)
    config.drawAfterSheets();
}

function round2digits(a, digits) {
  return Math.round(a * digits) / digits;
}

export function drawRect(sheetdata, context, drawFunction, canvas, allowContourDrawing, poly) {
  const a = round2digits(sheetdata.p1uv.u, 1000);
  const b = round2digits(sheetdata.p1uv.v, 1000);
  const c = round2digits(sheetdata.p2uv.u, 1000);
  const d = round2digits(sheetdata.p2uv.v, 1000);

  if ((a == 0 && c == 0) || (c == 0 && d == 0) || (a == 0 && b == 0) || (b == 0 && d == 0) || (a + b == 0 && c + d == 0)) {
    if (allowContourDrawing && config.allowContourDrawing)
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
        if (config.useClipCorrection) {
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

function drawBaseShadowTexture(context, canvas) {
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
  context.lineWidth = config.selectrectlinewidth;

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

export function redrawSheetCanvases(sheet) {
  if (sheet.baseshadowcontext) {
    sheet.baseshadowcontext.save();
    sheet.baseshadowcontext.clearRect(0, 0, sheet.width, sheet.height);
    sheet.baseshadowcontext.drawImage(sheet.canvas, 0, 0);
    sheet.baseshadowcontext.globalCompositeOperation = 'source-in';
    sheet.baseshadowcontext.fillStyle = '#000';
    sheet.baseshadowcontext.fillRect(0, 0, sheet.width, sheet.height);
    sheet.baseshadowcontext.restore();
  }

  if (sheet.shadowcontext) {
    sheet.shadowcontext.save();
    sheet.shadowcontext.clearRect(0, 0, sheet.width, sheet.height);
    sheet.shadowcontext.drawImage(sheet.canvas, 0, 0);
    sheet.shadowcontext.globalCompositeOperation = 'source-in';
    sheet.shadowcontext.fillStyle = '#000';
    sheet.shadowcontext.fillRect(0, 0, sheet.width, sheet.height);
    sheet.shadowcontext.restore();
  }
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
      context.strokeStyle = config.hoveredSheetColor;
      break;
    case 2:
      context.strokeStyle = config.selectedSheetColor;
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

export function drawSheets(context, viewport) {
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
      context.globalAlpha = config.dimmedAlpha;
    }
    drawRect(sheet.data, context, drawTexture, sheet.compositecanvas, true, polygon);
    if (sheet.dimmed) {
      context.restore();
    }
    drawSheetSelection(sheet, polygon, sheet.data, context);
  }
}

export function getPointuv(p) {
  const puv = transforms.transformPoint(p);
  if (scene.center) {
    return {
      u: puv.u + state.canvasCenter.u - scene.center.u,
      v: puv.v + state.canvasCenter.v - scene.center.v
    };
  }
  return { u: puv.u + state.canvasCenter.u, v: puv.v + state.canvasCenter.v };
}

function drawScenePart(options) {
  let viewPort = options.viewPort;
  let targetContext = options.targetContext;
  let targetBaseShadowContext = options.targetBaseShadowContext;
  let targetBaseShadowCanvas = options.targetBaseShadowCanvas;

  if (!targetContext) {
    targetContext = state.temppartcontext;
    targetBaseShadowContext = state.temppartshadowcontext;
    targetBaseShadowCanvas = state.temppartshadowcanvas;
  }

  // If temp canvases are not initialized, skip drawing
  if (!targetContext) {
    return;
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

  if (scene.center) {
    const shadowrel = { u: -u + scene.center.u + state.canvasCenter.u - shadows.config.baseShadowCenter.u, v: -v + scene.center.v + state.canvasCenter.v - shadows.config.baseShadowCenter.v };
    shadows.initBaseRectShadow(targetBaseShadowContext, { w: viewPort.w, h: viewPort.h }, shadowrel, { minu, maxu, minv, maxv }, { drawRect });
    targetContext.save();
    targetContext.globalAlpha = shadows.config.shadowAlpha;
    targetContext.drawImage(targetBaseShadowCanvas, u, v);
    targetContext.restore();
  }

  drawSheets(targetContext, { minu, maxu, minv, maxv });

  targetContext.restore();
}

/**
 * Helper to initialize and draw base rects with optional shadow rendering
 */
function drawBaseRectsAndShadows(context, useBackgroundMode = false) {
  context.save();
  context.translate(-state.canvasCenter.u + shadows.config.baseShadowCenter.u, -state.canvasCenter.v + shadows.config.baseShadowCenter.v);
  drawBaseRects(context);
  context.restore();

  if (scene.center) {
    const shadowrel = { u: scene.center.u, v: scene.center.v };
    shadows.initBaseRectShadow(shadows.config.baseshadowContext, { w: shadows.config.baseshadowCanvas.width, h: shadows.config.baseshadowCanvas.height }, shadowrel, null, { drawRect });
    if (useBackgroundMode) {
      shadows.drawBaseRectShadows(context, { u: state.backgroundtranslate.u, v: state.backgroundtranslate.v });
    } else {
      shadows.drawBaseRectShadows(context);
    }
  }

  context.save();
  context.translate(-state.canvasCenter.u + shadows.config.baseShadowCenter.u, -state.canvasCenter.v + shadows.config.baseShadowCenter.v);
  drawSheets(context, null);
  context.restore();
}

export function drawScene(full) {
  if (full) {
    if (state.backgroundcanvas) {
      state.backgroundcontext.clearRect(0, 0, state.backgroundcanvas.width, state.backgroundcanvas.height);
      drawBaseRectsAndShadows(state.backgroundcontext, true);
    } else {
      state.context.clearRect(0, 0, state.canvas.width, state.canvas.height);
      drawBaseRectsAndShadows(state.context, false);
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
        if (state.temppartcanvas) {
          const canvas = state.backgroundcanvas ? state.backgroundcanvas : state.canvas;
          const context = state.backgroundcanvas ? state.backgroundcontext : state.context;
          const offsetu = u + canvas.width / 2;
          const offsetv = v + canvas.height / 2;
          context.drawImage(state.temppartcanvas, 0, 0, w - 1, h - 1, offsetu, offsetv, w - 1, h - 1);
        }
      }
    }

    for (let i = 0; i < state.objects.length; i++) {
      const obj = state.objects[i];
      obj.draw();
    }
  }

  if (state.backgroundcanvas) {
    state.context.clearRect(0, 0, state.canvas.width, state.canvas.height);
    if (scene.center) {
      const offsetu = -scene.center.u - state.backgroundcanvas.width / 2 + state.canvas.width / 2 + state.backgroundtranslate.u;
      const offsetv = -scene.center.v - state.backgroundcanvas.height / 2 + state.canvas.height / 2 + state.backgroundtranslate.v;
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

// Export named functions
export { drawScenePart };
