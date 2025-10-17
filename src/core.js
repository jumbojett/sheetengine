/**
 * Core state management for SheetEngine
 */

export const state = {
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
  debug: false,
  // Properties that get added dynamically - must be initialized to allow freezing
  sheetsbeingdeleted: false,
  orderedPolygons: null,
  backgroundcanvas: null,
  backgroundcontext: null,
  backgroundtranslate: null,
  temppartcanvas: null,
  temppartcontext: null,
  temppartshadowcanvas: null,
  temppartshadowcontext: null,
  imgCount: 0,
  appobjects: null
};

export const internal = {
  startsheets: [],
  loadedyards: {},
  staticsheets: null
};
