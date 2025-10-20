/**
 * @fileoverview Object helper utilities for defining and managing objects
 * Provides utilities for object creation, rotation handling, and object data serialization
 */

import { state } from './core.js';
import * as geometry from './geometry.js';
import * as drawing from './drawing.js';
import * as sheetutil from './sheetutil.js';
import { calculateSheetSections } from './intersections.js';
import { Sheet } from './Sheet.js';
import { SheetObject } from './SheetObject.js';

export let objhelpers = {};

/**
 * Draw object to scene canvas
 */
function drawObjectToScene(obj, centerpuv) {
  const u = Math.floor(centerpuv.u - obj.canvasSize.relu);
  const v = Math.floor(centerpuv.v - obj.canvasSize.relv);
  const w = obj.canvasSize.w;
  const h = obj.canvasSize.h;
  drawing.drawScenePart({
    viewPort: { u, v, w, h }
  });
  const canvas = state.backgroundcanvas ? state.backgroundcanvas : state.canvas;
  const context = state.backgroundcanvas ? state.backgroundcontext : state.context;
  const canvasU = u + canvas.width / 2;
  const canvasV = v + canvas.height / 2;
  const canvasW = w - 1;
  const canvasH = h - 1;
  if (state.drawObjectContour && state.temppartcontext) {
    state.temppartcontext.strokeStyle = '#FFF';
    state.temppartcontext.strokeRect(0, 0, canvasW, canvasH);
  }
  if (state.temppartcanvas) {
    context.drawImage(state.temppartcanvas, 0, 0, canvasW, canvasH, canvasU, canvasV, canvasW, canvasH);
  }
}

/**
 * Define application objects from server data
 */
function defineAppObjects(appobjects) {
  state.appobjects = {};

  for (const obj of appobjects) {
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
function fillRot(rot) {
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

  // Helper to create sheet data object
  const createSheetData = (sheet) => ({
    centerp: sheet.centerp,
    rot: { alphaD: sheet.rot.alphaD, betaD: sheet.rot.betaD, gammaD: sheet.rot.gammaD },
    width: sheet.width,
    height: sheet.height,
    canvas: sheet.canvas.toDataURL()
  });

  if (typeof (group) !== 'undefined' && group !== null) {
    for (const s of state.sheets) {
      if (s.group !== group)
        continue;
      sheets.push(createSheetData(s));
    }
  } else {
    sheets.push(createSheetData(currentSheet));
  }

  let maxdist = 0;

  for (const sheet of sheets) {
    const w2 = sheet.width / 2;
    const h2 = sheet.height / 2;
    const dist = Math.sqrt(w2 * w2 + h2 * h2) + geometry.pointDist(sheet.centerp, { x: 0, y: 0, z: 0 });
    if (dist > maxdist)
      maxdist = dist;
  }

  const w = Math.round(maxdist * 2);
  const h = w;
  const relu = Math.round(maxdist);
  const relv = Math.round(maxdist);

  const canvasSize = { w, h, relu, relv };

  return { name: 'my object', thumbnail: '', hidden: false, intersectionsenabled: true, canvasSize, sheets };
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
objhelpers.fillRot = fillRot;
objhelpers.defineAppObjects = defineAppObjects;
objhelpers.defineObject = defineObject;
objhelpers.getThumbnailString = getThumbnailString;
objhelpers.getCurrentSheetsObject = getCurrentSheetsObject;
objhelpers.getCurrentSheetsObjectStr = getCurrentSheetsObjectStr;

// Export named functions
export {
  defineObject,
  defineAppObjects,
  drawObjectToScene,
  fillRot,
  fromRadian,
  fromDegree,
  getCurrentSheetsObject,
  getCurrentSheetsObjectStr
};
