/**
 * SheetEngine v2.0.0
 * Isometric HTML5 JavaScript Display Engine
 * https://github.com/normanzb/sheetengine
 *
 * Licensed under the MIT license.
 * Copyright (C) 2012 Levente Dobson
 */

import { state, internal } from './core.js';
import * as geometry from './geometry.js';
import * as transforms from './transforms.js';
import * as shadows from './shadows.js';
import * as drawing from './drawing.js';
import * as intersections from './intersections.js';
import * as zOrdering from './z-ordering.js';
import * as calc from './calc.js';
import { redefineIntersections } from './calc.js';
import { scene as sceneObject, init as sceneInit, initScene, moveCenter, setCenter, addYards, getYards, getNewYards, removeYard, translateBackground } from './scene.js';
import * as objhelpers from './objhelpers.js';
import { BaseSheet } from './BaseSheet.js';
import { Sheet } from './Sheet.js';
import { SheetObject } from './SheetObject.js';
import { DensityMap } from './DensityMap.js';

// Initialize shadow base matrix
shadows.config.shadowBaseMatrixInverse = geometry.getBaseMatrixInverse(
  shadows.config.lightSourcep1,
  shadows.config.lightSourcep2,
  shadows.config.lightSource
);

// Create the main sheetengine namespace object
let sheetengine = {
  // Modules
  geometry,
  transforms,
  shadows: shadows.config,
  drawing: {
    ...drawing.config,
    drawScene: drawing.drawScene,
    redraw: drawing.redraw,
    drawSheets: drawing.drawSheets,
    createCanvas: drawing.createCanvas,
    redrawSheetCanvases: drawing.redrawSheetCanvases,
    drawRect: drawing.drawRect,
    getPointuv: drawing.getPointuv
  },
  calc: {
    calculateChangedSheets: calc.calculateChangedSheets,
    calculateAllSheets: calc.calculateAllSheets,
    deleteSheets: calc.deleteSheets,
    defineSheetParams: calc.defineSheetParams
  },
  scene: sceneObject,
  objhelpers: {
    defineObject: objhelpers.defineObject,
    defineAppObjects: objhelpers.defineAppObjects,
    drawObjectToScene: objhelpers.drawObjectToScene,
    fromRadian: objhelpers.fromRadian,
    fromDegree: objhelpers.fromDegree,
    getCurrentSheetsObject: objhelpers.getCurrentSheetsObject,
    getCurrentSheetsObjectStr: objhelpers.getCurrentSheetsObjectStr,
    redefineIntersections: redefineIntersections
  },

  // Classes
  BaseSheet,
  Sheet,
  SheetObject,
  DensityMap
};

// Add state properties as getters/setters to maintain reference
const stateProps = ['sheets', 'basesheets', 'polygons', 'objects', 'currentSheet', 'hoverSheet', 
  'canvas', 'context', 'canvasCenter', 'viewSource', 'tempCanvasSize', 'backgroundColor', 
  'drawObjectContour', 'boundingBoxMaxsheetDistance', 'objectsintersect', 'debug',
  'sheetsbeingdeleted', 'orderedPolygons', 'backgroundcanvas', 'backgroundcontext', 
  'backgroundtranslate', 'temppartcanvas', 'temppartcontext', 'temppartshadowcanvas', 
  'temppartshadowcontext', 'imgCount', 'appobjects'];

stateProps.forEach(prop => {
  Object.defineProperty(sheetengine, prop, {
    get() { return state[prop]; },
    set(value) { state[prop] = value; },
    enumerable: true,
    configurable: true
  });
});

// Export for ES6 modules
export default sheetengine;

// Export individual components for tree-shaking  
export {
  state,
  internal,
  geometry,
  transforms,
  shadows,
  drawing,
  intersections,
  zOrdering,
  calc,
  objhelpers,
  // Note: scene is exported via default only to avoid freezing
  BaseSheet,
  Sheet,
  SheetObject,
  DensityMap
};
