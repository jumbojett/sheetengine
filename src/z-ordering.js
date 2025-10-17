/**
 * Depth sorting and z-ordering for polygon rendering
 */

import { state } from './core.js';
import * as geometry from './geometry.js';
import * as shadows from './shadows.js';

export function calculatePolygonOrder(polygon) {
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

export function addPolygonConstraint(polygon, polygon2) {
  addPolygonConstraintForCam(polygon, polygon2, 0);
  addPolygonConstraintForCam(polygon, polygon2, 1);
}

function addPolygonConstraintForCam(polygon, polygon2, shadow) {
  const polygonData = shadow ? polygon.shData : polygon.data;
  const polygonData2 = shadow ? polygon2.shData : polygon2.data;
  const viewSource = shadow ? shadows.config.lightSource : state.viewSource;

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

export function getOrderedList() {
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
      let zmax = -10000;
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
    const t = geometry.getTForSheetLineCrossing(bsheet.normalp, bsheet.centerp, a.points[i], viewSource);
    if (t < -zOrderDistanceThreshold) {
      const res = checkInboundsPolygon(bData.pointsuv, aData.pointsuv[i].u, aData.pointsuv[i].v);
      if (res.inbounds) return true;
    }
  }

  for (let i = 0; i < aData.midpointsuv.length; i++) {
    const t = geometry.getTForSheetLineCrossing(bsheet.normalp, bsheet.centerp, a.midpoints[i], viewSource);
    if (t < -zOrderDistanceThreshold) {
      const res = checkInboundsPolygon(bData.pointsuv, aData.midpointsuv[i].u, aData.midpointsuv[i].v);
      if (res.inbounds) return true;
    }
  }

  for (let i = 0; i < bData.pointsuv.length; i++) {
    const t = geometry.getTForSheetLineCrossing(asheet.normalp, asheet.centerp, b.points[i], viewSource);
    if (t > zOrderDistanceThreshold) {
      const res = checkInboundsPolygon(aData.pointsuv, bData.pointsuv[i].u, bData.pointsuv[i].v);
      if (res.inbounds) return true;
    }
  }

  for (let i = 0; i < bData.midpointsuv.length; i++) {
    const t = geometry.getTForSheetLineCrossing(asheet.normalp, asheet.centerp, b.midpoints[i], viewSource);
    if (t > zOrderDistanceThreshold) {
      const res = checkInboundsPolygon(aData.pointsuv, bData.midpointsuv[i].u, bData.midpointsuv[i].v);
      if (res.inbounds) return true;
    }
  }

  return false;
}

let inboundsCheckZeroThresh = 0.001;

function checkInboundsPolygon(corners, myx, myy) {
  const areas = [];
  let allpositive = true;
  let allnegative = true;
  let allzero = true;
  for (let i = 0; i < corners.length; i++) {
    const j = i == corners.length - 1 ? 0 : i + 1;
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
  return { inbounds: (allnegative || allpositive) && !allzero, areas, allzero };
}

export function clearDimmedFlags() {
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

export function deleteIndexFromConstraints(deletedSheet, constraints) {
  if (!constraints) return;

  const containedIdx = constraints.indexOf(deletedSheet);
  if (containedIdx != -1)
    constraints.splice(containedIdx, 1);
}

export function updateIndexInConstraints(oldIndex, newIndex, constraints) {
  if (!constraints) return;

  const containedIdx = constraints.indexOf(oldIndex);
  if (containedIdx != -1)
    constraints[containedIdx] = newIndex;
}
