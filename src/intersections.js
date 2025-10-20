/**
 * Sheet intersection detection and polygon calculation
 */

import * as geometry from './geometry.js';
import * as transforms from './transforms.js';
import { state } from './core.js';
import * as shadows from './shadows.js';

export let config = {
  intersections: true
};

let polygonMidpointsForOverlapCheck = [
  { dist: 50, numpoints: 4 },
  { dist: 20, numpoints: 3 },
  { dist: 10, numpoints: 2 },
  { dist: 0, numpoints: 1 }
];

function getIntersection(n, p, c1, c2) {
  const p2 = c1;
  const n2 = { x: c2.x - c1.x, y: c2.y - c1.y, z: c2.z - c1.z };

  const p2p = { x: p.x - p2.x, y: p.y - p2.y, z: p.z - p2.z };
  const cp1 = geometry.crossProduct(p2p, n);
  const cp2 = geometry.crossProduct(n2, n);
  let t = geometry.vectorMagnitude(cp1) / geometry.vectorMagnitude(cp2);

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
    poly[0][poly[0].length] = geometry.clonePoint(allcorners[index]);
    if (index == secondintersect) break;
    index--;
    if (index < 0) index = allcorners.length - 1;
  }
  index = firstintersect;
  for (; ;) {
    poly[1][poly[1].length] = geometry.clonePoint(allcorners[index]);
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

  const n = geometry.crossProduct(a.normalp, b.normalp);

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

  return { n, p: geometry.roundVector2digits(p, 10000) };
}

export function doSheetsIntersect(s1, s2) {
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

  for (const othersheet of sheetset) {
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

  for (const poly of polygons) {
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

export function calculateSheetSections(sheet, full, sheetset) {
  const currentsheet = sheet;

  if (full) {
    currentsheet.polygons = [];
    currentsheet.polygons[0] = { points: currentsheet.corners };

    currentsheet.intersectors = [];
    if (config.intersections)
      calculatePolygonsForSheet(currentsheet, sheetset);

    currentsheet.polygons = filterPolygons(currentsheet.polygons);
  }

  for (const poly of currentsheet.polygons) {
    const umin = 10000;
    const umax = -10000;
    const vmin = 10000;
    const vmax = -10000;
    const zmin = 10000;
    const zmax = -10000;
    poly.pointscanvasuv = [];
    poly.data = { umin, umax, vmin, vmax, zmin, zmax, pointsuv: [] };
    poly.shData = { umin, umax, vmin, vmax, zmin, zmax, pointsuv: [] };

    const avg = { u: 0, v: 0 };

    poly.points.forEach((polypointspi, pi) => {
      poly.pointscanvasuv[pi] = getPointForCanvasUV(currentsheet, polypointspi);

      poly.data.pointsuv[pi] = transforms.transformPointuvz(polypointspi, transforms.transformPointz, state.canvasCenter);

      avg.u += poly.data.pointsuv[pi].u;
      avg.v += poly.data.pointsuv[pi].v;

      const c1xyz = geometry.getCoordsInBase(shadows.config.shadowBaseMatrixInverse, polypointspi);
      poly.shData.pointsuv[pi] = { u: c1xyz.x, v: c1xyz.y, z: c1xyz.z };

      updateuvzMaxMin(poly.data, pi);
      updateuvzMaxMin(poly.shData, pi);
    });

    avg.u /= poly.points.length;
    avg.v /= poly.points.length;
    poly.data.avguv = { u: avg.u, v: avg.v };

    poly.midpoints = [];
    poly.data.midpointsuv = [];
    poly.shData.midpointsuv = [];
    for (let pi = 0; pi < poly.points.length; pi++) {
      const pj = pi == poly.points.length - 1 ? 0 : pi + 1;
      const dist = geometry.roughPointDist(poly.points[pi], poly.points[pj]);
      const midpoints = getMidpointNum(dist) + 1;
      for (let k = 1; k < midpoints; k++) {
        const ratio1 = k;
        const ratio2 = midpoints - ratio1;
        poly.midpoints[poly.midpoints.length] = geometry.avgPoints(poly.points[pi], poly.points[pj], ratio1, ratio2, midpoints);
      }
      const p1 = poly.data.pointsuv[pi];
      const p2 = poly.data.pointsuv[pj];
      for (let k = 1; k < midpoints; k++) {
        const ratio1 = k;
        const ratio2 = midpoints - ratio1;
        poly.data.midpointsuv[poly.data.midpointsuv.length] = geometry.avgPointsuv(p1, p2, ratio1, ratio2, midpoints);
      }

      const p1sh = poly.shData.pointsuv[pi];
      const p2sh = poly.shData.pointsuv[pj];
      for (let k = 1; k < midpoints; k++) {
        const ratio1 = k;
        const ratio2 = midpoints - ratio1;
        poly.shData.midpointsuv[poly.shData.midpointsuv.length] = geometry.avgPointsuv(p1sh, p2sh, ratio1, ratio2, midpoints);
      }
    }

    poly.sheetindex = currentsheet.index;
    poly.index = state.polygons.length;
    poly.constraints = [];
    poly.shadowconstraints = [];
    state.polygons.push(poly);
  }
}
