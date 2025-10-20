/**
 * @fileoverview SheetObject class - main object class with multiple sheets
 * Handles object positioning, rotation, intersection management, and rendering
 */

import { state } from './core.js';
import * as geometry from './geometry.js';
import * as transforms from './transforms.js';
import * as shadows from './shadows.js';
import * as calc from './calc.js';
import * as sheetutil from './sheetutil.js';
import * as objhelpers from './objhelpers.js';
import { calculateSheetSections } from './intersections.js';
import * as drawing from './drawing.js';

/**
 * SheetObject class - represents a 3D object composed of multiple sheets
 * @constructor
 * @param {Object} centerp - Center position {x, y, z}
 * @param {Object} rot - Rotation angles {alphaD, betaD, gammaD}
 * @param {Array} sheets - Array of Sheet objects
 * @param {Object} canvasSize - Canvas size {w, h, relu, relv}
 * @param {boolean} intersectionsenabled - Whether intersections are enabled
 */
export function SheetObject(centerp, rot, sheets, canvasSize, intersectionsenabled) {
  for (const s of sheets) {
    s.objectsheet = true;
    s.object = this;

    s.startcenterp = { x: s.centerp.x, y: s.centerp.y, z: s.centerp.z };
    s.rotcenterp = { x: s.centerp.x, y: s.centerp.y, z: s.centerp.z };
    s.centerp.x += centerp.x;
    s.centerp.y += centerp.y;
    s.centerp.z += centerp.z;

    s.intersectionParams = [];

    calc.calculateSheetData(s);
  }

  this.intersectionsenabled = intersectionsenabled ? true : false;

  if (!state.objectsintersect && !this.intersectionsenabled) {
    for (let i = 0; i < sheets.length; i++) {
      calculateSheetSections(sheets[i], true, sheets);
    }
    for (let i = 0; i < sheets.length; i++) {
      sheetutil.initializeStartPolygons(sheets[i], centerp);
    }
  }

  this.centerp = centerp;
  this.rot = objhelpers.fillRot(rot);
  this.rotvectorstart = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 }];
  this.rotvector = sheetutil.calcRotVector(this.rot, this.rotvectorstart);
  this.sheets = sheets;
  this.hidden = false;
  this.intersectionsredefine = false;
  this.intersectionsrecalc = false;

  this.canvasSize = canvasSize;

  // adjust temppartcanvas size if necessary
  if (state.temppartcanvas && (canvasSize.w > state.tempCanvasSize.w || canvasSize.h > state.tempCanvasSize.h)) {
    const w = Math.max(canvasSize.w, state.tempCanvasSize.w);
    const h = Math.max(canvasSize.h, state.tempCanvasSize.h);
    state.tempCanvasSize = { w, h };
    state.temppartcanvas.width = w;
    state.temppartcanvas.height = h;
    state.temppartshadowcanvas.width = w;
    state.temppartshadowcanvas.height = h;
  }

  this.oldcenterp = geometry.clonePoint(this.centerp);

  this.centerpuv = transforms.transformPoint(this.centerp);
  this.centerpuvrel = transforms.transformPointuvz(this.centerp, transforms.transformPointz, state.canvasCenter);
  this.oldcenterpuv = transforms.transformPoint(this.oldcenterp);

  this.setOrientation(this.rot);
  state.objects.push(this);
}

/**
 * Set dimming for object sheets
 */
SheetObject.prototype.setDimming = function(dimSheets, dimmingDisabled) {
  for (const s of this.sheets) {
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
  for (const s of this.sheets) {
    s.setShadows(castshadows, allowshadows);
  }

  this.intersectionsrecalc = true;
  this.canvasdirty = true;
};

/**
 * Set collision detection for object
 */
SheetObject.prototype.setCollision = function(collisionEnabled) {
  for (const s of this.sheets) {
    s.skipDensityMap = !collisionEnabled;
  }
};

/**
 * Destroy object and remove from scene
 */
SheetObject.prototype.destroy = function() {
  this.hide();

  for (const sheet of this.sheets) {
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
  this.oldcenterp = geometry.clonePoint(this.centerp);
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

  for (const s of this.sheets) {
    sheetutil.updateSheetCenterp(s, this.centerp);

    calc.calculateSheetData(s);

    if (s.polygons && !state.objectsintersect && !this.intersectionsenabled) {
      for (const poly of s.polygons) {
        for (const pp of poly.points) {
          pp.x += diffx;
          pp.y += diffy;
          pp.z += diffz;
        }
      }
    }
  }

  this.centerpuv = transforms.transformPoint(this.centerp);
  this.centerpuvrel = transforms.transformPointuvz(this.centerp, transforms.transformPointz, state.canvasCenter);
  this.oldcenterpuv = transforms.transformPoint(this.oldcenterp);

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
    this.rotvector[0] = geometry.rotateAroundAxis(this.rotvectorstart[0], axis, angle);
    this.rotvector[1] = geometry.rotateAroundAxis(this.rotvectorstart[1], axis, angle);
    this.rotvector[2] = geometry.rotateAroundAxis(this.rotvectorstart[2], axis, angle);
  } else {
    this.rotvector[0] = geometry.rotateAroundAxis(this.rotvector[0], axis, angle);
    this.rotvector[1] = geometry.rotateAroundAxis(this.rotvector[1], axis, angle);
    this.rotvector[2] = geometry.rotateAroundAxis(this.rotvector[2], axis, angle);
  }
  this.rot = geometry.inverseRPY(this.rotvector[0], this.rotvector[1], this.rotvector[2]);

  for (const s of this.sheets) {
    sheetutil.rotateSheetPoints(s, axis, angle, base);

    if (s.startpolygons) {
      if (base) {
        // Always rotate startpolygons for base rotation, regardless of intersection settings
        sheetutil.rotateSheetPolygons(s, axis, angle, true);
      }
    } else if (s.polygons && !state.objectsintersect && !this.intersectionsenabled && !base) {
      // For non-base rotation with current polygons, rotate relative to object center
      const polygonArray = s.polygons;

      for (const poly of polygonArray) {
        for (let p = 0; p < poly.points.length; p++) {
          let pp = geometry.subPoint(poly.points[p], this.centerp);
          pp = geometry.rotateAroundAxis(pp, axis, angle);
          poly.points[p] = geometry.addPoint(pp, this.centerp);
        }
      }
    }

    sheetutil.updateSheetCenterp(s, this.centerp);

    calc.calculateSheetData(s);
    shadows.calculateSheetShade(s);

    sheetutil.transformSheetPolygons(s, this.centerp, this.rot, this.intersectionsenabled || state.objectsintersect);
  }

  this.intersectionsrecalc = true;
  this.canvasdirty = true;
};

/**
 * Set object orientation (absolute)
 */
SheetObject.prototype.setOrientation = function(rot) {
  this.rot = objhelpers.fillRot(rot);
  this.rotvector = sheetutil.calcRotVector(this.rot, this.rotvectorstart);

  for (const s of this.sheets) {
    s.p0 = geometry.rotatePoint(s.p0start, this.rot.alpha, this.rot.beta, this.rot.gamma);
    s.p1 = geometry.rotatePoint(s.p1start, this.rot.alpha, this.rot.beta, this.rot.gamma);
    s.p2 = geometry.rotatePoint(s.p2start, this.rot.alpha, this.rot.beta, this.rot.gamma);
    s.normalp = geometry.rotatePoint(s.normalpstart, this.rot.alpha, this.rot.beta, this.rot.gamma);

    s.rotcenterp = geometry.rotatePoint(s.startcenterp, this.rot.alpha, this.rot.beta, this.rot.gamma);

    sheetutil.updateSheetCenterp(s, this.centerp);

    calc.calculateSheetData(s);
    shadows.calculateSheetShade(s);

    sheetutil.transformSheetPolygons(s, this.centerp, this.rot, this.intersectionsenabled || state.objectsintersect);
  }

  this.intersectionsrecalc = true;
  this.canvasdirty = true;
};

/**
 * Set individual sheet position and rotation within object
 */
SheetObject.prototype.setSheetPos = function(sheet, sheetpos, sheetrot) {
  const s = sheet;

  const sheetrot2 = objhelpers.fillRot(sheetrot);

  s.startcenterp = sheetpos;

  s.p0start = geometry.rotatePoint(s.p0orig, sheetrot2.alpha, sheetrot2.beta, sheetrot2.gamma);
  s.p1start = geometry.rotatePoint(s.p1orig, sheetrot2.alpha, sheetrot2.beta, sheetrot2.gamma);
  s.p2start = geometry.rotatePoint(s.p2orig, sheetrot2.alpha, sheetrot2.beta, sheetrot2.gamma);
  s.normalpstart = geometry.rotatePoint(s.normalporig, sheetrot2.alpha, sheetrot2.beta, sheetrot2.gamma);

  if (s.startpolygons && !state.objectsintersect && !this.intersectionsenabled) {
    const diffp = geometry.subPoint(sheetpos, s.startpolygonscenterp);

    for (const startpoly of s.startpolygons) {
      for (let p = 0; p < startpoly.points.length; p++) {
        const relp = startpoly.relpoints[p];
        startpoly.points[p] = geometry.getPointInBase(relp, s.p1start, s.p2start, s.normalpstart);
        startpoly.points[p] = geometry.addPoint(startpoly.points[p], diffp);
      }
    }
  }

  const rot = this.rot;
  s.p0 = geometry.rotatePoint(s.p0start, rot.alpha, rot.beta, rot.gamma);
  s.p1 = geometry.rotatePoint(s.p1start, rot.alpha, rot.beta, rot.gamma);
  s.p2 = geometry.rotatePoint(s.p2start, rot.alpha, rot.beta, rot.gamma);
  s.normalp = geometry.rotatePoint(s.normalpstart, rot.alpha, rot.beta, rot.gamma);
  s.rotcenterp = geometry.rotatePoint(s.startcenterp, rot.alpha, rot.beta, rot.gamma);

  sheetutil.updateSheetCenterp(s, this.centerp);

  calc.calculateSheetData(s);
  shadows.calculateSheetShade(s);

  sheetutil.transformSheetPolygons(s, this.centerp, this.rot, this.intersectionsenabled || state.objectsintersect);

  this.intersectionsrecalc = true;
  this.canvasdirty = true;
};

/**
 * Rotate individual sheet around arbitrary axis
 */
SheetObject.prototype.rotateSheet = function(sheet, rotationCenter, rotationAxis, angle) {
  const s = sheet;

  if (s.startpolygons && !state.objectsintersect && !this.intersectionsenabled) {
    sheetutil.rotateSheetPolygonsArbitrary(s, rotationCenter, rotationAxis, angle, true);
  }

  s.p0start = geometry.rotateAroundAxis(s.p0start, rotationAxis, angle);
  s.p1start = geometry.rotateAroundAxis(s.p1start, rotationAxis, angle);
  s.p2start = geometry.rotateAroundAxis(s.p2start, rotationAxis, angle);
  s.normalpstart = geometry.rotateAroundAxis(s.normalpstart, rotationAxis, angle);
  s.startcenterp = geometry.rotateAroundArbitraryAxis(s.startcenterp, rotationCenter, rotationAxis, angle);

  // rotationCenter and rotationAxis are given relatively to object orientation
  rotationCenter = geometry.rotatePoint(rotationCenter, this.rot.alpha, this.rot.beta, this.rot.gamma);
  rotationAxis = geometry.rotatePoint(rotationAxis, this.rot.alpha, this.rot.beta, this.rot.gamma);

  s.p0 = geometry.rotateAroundAxis(s.p0, rotationAxis, angle);
  s.p1 = geometry.rotateAroundAxis(s.p1, rotationAxis, angle);
  s.p2 = geometry.rotateAroundAxis(s.p2, rotationAxis, angle);
  s.normalp = geometry.rotateAroundAxis(s.normalp, rotationAxis, angle);
  s.rotcenterp = geometry.rotateAroundArbitraryAxis(s.rotcenterp, rotationCenter, rotationAxis, angle);

  sheetutil.updateSheetCenterp(s, this.centerp);

  calc.calculateSheetData(s);
  shadows.calculateSheetShade(s);

  sheetutil.transformSheetPolygons(s, this.centerp, this.rot, this.intersectionsenabled || state.objectsintersect);

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

  for (const s of this.sheets) {
    sheets.push({
      centerp: s.centerp,
      rot: { alphaD: s.rot.alphaD, betaD: s.rot.betaD, gammaD: s.rot.gammaD },
      width: s.width,
      height: s.height,
      canvas: s.canvas.toDataURL()
    });
  }

  const retobj = { name: 'my object', thumbnail: '', hidden: false, intersectionsenabled: this.intersectionsenabled, canvasSize: this.canvasSize, sheets };
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

  const fit = state.temppartcanvas && (du < state.temppartcanvas.width && dv < state.temppartcanvas.height);
  if (fit) {
    // update old + new location using temppartcanvas
    const u = Math.floor(Math.min(centerpuv.u, oldcenterpuv.u) - this.canvasSize.relu);
    const v = Math.floor(Math.min(centerpuv.v, oldcenterpuv.v) - this.canvasSize.relv);
    const w = du;
    const h = dv;
    drawing.drawScenePart({
      viewPort: { u, v, w, h }
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
    objhelpers.drawObjectToScene(this, oldcenterpuv);
    objhelpers.drawObjectToScene(this, centerpuv);
  }

  this.canvasdirty = false;

  if (this.deleting)
    calc.deleteObject(this);
};
