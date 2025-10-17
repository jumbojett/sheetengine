/**
 * @fileoverview Scene management, canvas initialization, and yard loading
 * Handles scene setup, center positioning, and dynamic yard loading/unloading
 */

import { state, internal } from './core.js';
import * as geometry from './geometry.js';
import * as transforms from './transforms.js';
import * as shadows from './shadows.js';
import * as calc from './calc.js';
import * as drawing from './drawing.js';
import * as objhelpers from './objhelpers.js';
import { BaseSheet } from './BaseSheet.js';
import { Sheet } from './Sheet.js';

export let scene = {};

// Module-level variables
let startsheets = [];
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
  drawing.config.allowContourDrawing = false;

  state.sheets.length = 0;
  state.basesheets.length = 0;
  state.polygons.length = 0;
  state.objects.length = 0;
  startsheets = [];
  loadedyards = {};

  state.canvas = canvasElement;
  state.context = state.canvas.getContext('2d');
  state.canvasCenter = { u: state.canvas.width / 2, v: state.canvas.height / 2 };

  shadows.config.baseshadowCanvas = drawing.createCanvas(state.canvas.width, state.canvas.height);

  if (backgroundSize) {
    shadows.config.baseshadowCanvas.width = backgroundSize.w;
    shadows.config.baseshadowCanvas.height = backgroundSize.h;
    state.backgroundcanvas = drawing.createCanvas(backgroundSize.w, backgroundSize.h);
    state.backgroundcontext = state.backgroundcanvas.getContext('2d');
    state.backgroundtranslate = { u: 0, v: 0 };

    state.temppartcanvas = drawing.createCanvas(state.tempCanvasSize.w, state.tempCanvasSize.h);
    state.temppartcontext = state.temppartcanvas.getContext('2d');
    state.temppartshadowcanvas = drawing.createCanvas(state.tempCanvasSize.w, state.tempCanvasSize.h);
    state.temppartshadowcontext = state.temppartshadowcanvas.getContext('2d');
  }
  shadows.config.baseshadowContext = shadows.config.baseshadowCanvas.getContext('2d');
  shadows.config.baseShadowCenter = { u: shadows.config.baseshadowCanvas.width / 2, v: shadows.config.baseshadowCanvas.height / 2 };
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
          const createdObj = objhelpers.defineObject(objdata.name);
          if (!createdObj)
            continue;
          createdObj.id = 'x' + yard.x + 'y' + yard.y + 'i' + j;
          yardObjects.push(createdObj);
          newobjects.push(createdObj);
          createdObj.setPosition(geometry.addPoint(objdata.centerp, offset));
          createdObj.oldcenterp = geometry.clonePoint(createdObj.centerp);
          createdObj.setOrientation(objdata.rot);
          newsheets = newsheets.concat(createdObj.sheets);
        }
      }

      const newyard = { sheets: sheets, basesheet: basesheet, x: yard.x, y: yard.y, objects: yardObjects };
      const key = 'x' + yard.x + 'y' + yard.y;
      loadedyards[key] = newyard;
    }
  }

  startsheets = newsheets;
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
      geometry.addPoint(data.centerp, offset),
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
  if (!shadows.config.drawShadows)
    return;

  const sheetsToMove = sheets ? sheets : state.sheets;
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
  calc.calculateAllSheets();

  const centerpuv = transforms.transformPoint(centerp);
  scene.center = { x: centerp.x, y: centerp.y, u: centerpuv.u, v: centerpuv.v };

  moveBaseShadows(scene.center);
}

/**
 * Move scene center by a vector
 */
function moveCenter(vectorxyz, vectoruv) {
  if (!vectoruv) {
    if (!vectorxyz.z)
      vectoruv = transforms.transformPoint({ x: vectorxyz.x, y: vectorxyz.y, z: 0 });
    else
      vectoruv = transforms.transformPointz(vectorxyz);
  }
  if (!vectorxyz)
    vectorxyz = transforms.inverseTransformPointSimple(vectoruv);

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
      vectoruv = transforms.transformPoint({ x: vectorxyz.x, y: vectorxyz.y, z: 0 });
    else
      vectoruv = transforms.transformPointz(vectorxyz);
  }
  if (!vectorxyz)
    vectorxyz = transforms.inverseTransformPointSimple(vectoruv);

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
      objhelpers.defineAppObjects(yardsAndObjects.appobjects);
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
  const oldcenteruv = transforms.transformPoint(oldcenter);
  const newcenteruv = transforms.transformPoint(newcenter);
  const transu = newcenteruv.u - oldcenteruv.u;
  const transv = newcenteruv.v - oldcenteruv.v;
  state.backgroundcontext.translate(-transu, -transv);
  shadows.config.baseshadowContext.translate(-transu, -transv);
  state.backgroundtranslate.u += transu;
  state.backgroundtranslate.v += transv;

  state.backgroundcontext.clearRect(state.backgroundtranslate.u, state.backgroundtranslate.v, state.backgroundcanvas.width, state.backgroundcanvas.height);
  shadows.config.baseshadowContext.clearRect(state.backgroundtranslate.u, state.backgroundtranslate.v, state.backgroundcanvas.width, state.backgroundcanvas.height);
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

// Add all public functions to the scene object
scene.init = init;
scene.initScene = initScene;
scene.moveCenter = moveCenter;
scene.setCenter = setCenter;
scene.addYards = addYards;
scene.getYards = getYards;
scene.getNewYards = getNewYards;
scene.removeYard = removeYard;

// Export named functions
export {
  init,
  initScene,
  moveCenter,
  setCenter,
  addYards,
  getYards,
  getNewYards,
  removeYard,
  translateBackground
};
