/**
 * @fileoverview Main calculation engine for sheet transformations, ordering, and updates
 * Handles dirty sheet tracking, polygon calculations, and z-order constraints
 */

import { state, internal } from './core.js';
import * as geometry from './geometry.js';
import * as transforms from './transforms.js';
import * as shadows from './shadows.js';
import * as sheetutil from './sheetutil.js';
import { doSheetsIntersect, calculateSheetSections } from './intersections.js';
import {
  deleteIndexFromConstraints,
  updateIndexInConstraints,
  calculatePolygonOrder,
  addPolygonConstraint,
  getOrderedList,
  clearDimmedFlags
} from './z-ordering.js';

export let calc = {
  allowLimitToCorners: false,
  sheetLimits: { xmin: -150, xmax: 150, ymin: -150, ymax: 150, zmin: 0, zmax: 100 }
};

let staticsheets = null;

let inboundsCheckZeroThresh = 0.001;

/**
 * Recalculate object intersections with optional mode
 * @param {Object} obj - Object to process
 * @param {Object} state - State object
 * @param {boolean} forceRecalc - Force recalculation mode (true = recalculate all, false = conditional)
 */
function recalculateObjectIntersections(obj, state, forceRecalc = false) {
  if (obj.intersectionsenabled)
    return;
  if (obj.intersectionsredefine) {
    redefineIntersections(obj);
  } else if (forceRecalc || obj.intersectionsrecalc) {
    for (let i = 0; i < obj.sheets.length; i++) {
      calculateSheetSections(obj.sheets[i], forceRecalc, obj.sheets);
    }
  }
  obj.intersectionsredefine = false;
  obj.intersectionsrecalc = false;
}

/**
 * Check if a point is within polygon bounds
 * Re-exported from sheetutil for backward compatibility
 */
export function checkInboundsPolygon(corners, myx, myy) {
  return sheetutil.checkInboundsPolygon(corners, myx, myy);
}

/**
 * Calculate sheet transformation data
 */
export function calculateSheetData(sheet) {
  const centerp = sheet.centerp;
  const p0 = sheet.p0;
  const p1 = sheet.p1;
  const p2 = sheet.p2;

  // corners
  sheetutil.calcUdifVdif(sheet);
  sheet.corners = sheetutil.calculateCornersFromCenter(centerp, sheet.udif, sheet.vdif);

  // inverse basematrix
  sheet.A1 = geometry.getBaseMatrixInverse(sheet.p1, sheet.p2, sheet.normalp);

  // transformation-specific data
  sheet.data = sheetutil.calculateSheetDataSingle(centerp, p0, p1, p2, transforms.transformPoint, transforms.transformPointz, state.canvasCenter, sheet.corners);

  // calculate shadows cast on baserect
  if (shadows.config.drawShadows)
    shadows.calculateSheetBaseShadow(sheet);

  // mark sheet as dirty for z-ordering
  sheet.dirty = true;
}

/**
 * Limit sheet corners to bounds
 */
export function limitToCorners(sheet) {
  sheetutil.calcUdifVdif(sheet);
  sheet.corners = sheetutil.calculateCornersFromCenter(sheet.centerp, sheet.udif, sheet.vdif);

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
export function defineSheetParams(sheet) {
  sheetutil.initializeSheetProperties(sheet, sheet.rot);

  if (!sheet.objectsheet) {
    sheetutil.initializeSheetOrientation(sheet);
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
      for (const idx of currentsheet.intersectors) {
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
        if (othersheet.intersectors.includes(i))
          othersheet.madedirty = true;
      }
    }
  }
  // build dirtySheets array
  const movedSheets = [];
  const dirtySheets = [];
  const dirtySheetsRedefinePolygons = [];

  state.sheets.forEach(({dirty, madedirty, objectsheet, object}, i) => {
    if (state.objectsintersect) {
      // if object intersection is allowed, simple mechanism: we only care about sheets and not objects
      if (dirty || madedirty) {
        dirtySheets.push(i);
        dirtySheetsRedefinePolygons.push(i);
      }
    } else {
      // if objects don't intersect, complex mechanism: all sheets of a dirty object will be included
      const objdirty = objectsheet && (object.intersectionsredefine || object.intersectionsrecalc) && !object.intersectionsenabled;
      if (dirty || madedirty || objdirty) {
        dirtySheets.push(i);

        const objectintersection = objectsheet && !object.intersectionsenabled;
        if (!objectintersection)
          dirtySheetsRedefinePolygons.push(i);
      }
    }

    if (dirty) {
      movedSheets.push(i);
    }
  });

  return { dirtySheets, movedSheets, dirtySheetsRedefinePolygons };
}

/**
 * Delete polygons for dirty sheets
 */
function deleteDirtyPolygons(dirtySheets) {
  if (state.polygons == null)
    state.polygons = [];

  // delete references from state.polygons
  const polys = [];

  // check if polygon's sheet is among dirty ones
  state.polygons.forEach(({sheetindex, index}, j) => {
    const containedIdx = dirtySheets.indexOf(sheetindex);
    if (containedIdx !== -1) {
      // delete polygon index from z-order constraints
      for (const actPoly of state.polygons) {
        // delete from constraint lists
        deleteIndexFromConstraints(index, actPoly.constraints);
        deleteIndexFromConstraints(index, actPoly.shadowconstraints);
        deleteIndexFromConstraints(index, actPoly.prevshadowconstraints);
      }
    } else {
      polys[polys.length] = state.polygons[j];
    }
  });

  state.polygons = polys;

  // update polygon indexes
  for (let j = 0; j < state.polygons.length; j++) {
    if (state.polygons[j].index !== j) {
      // update z-order constraint indexes
      for (const actPoly of state.polygons) {
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

  for (const s of state.sheets) {
    if (!s.objectsheet || s.object.intersectionsenabled)
      sheetset.push(s);
  }

  staticsheets = sheetset;
  return staticsheets;
}

/**
 * Calculate changed sheets (incremental update)
 */
export function calculateChangedSheets() {
  const start1 = +new Date();

  // 1. gather sheets whose polygons are to be recalculated
  const dirtySheetsObj = gatherDirtySheets();
  const dirtySheets = dirtySheetsObj.dirtySheets;
  const movedSheets = dirtySheetsObj.movedSheets;
  const dirtySheetsRedefinePolygons = dirtySheetsObj.dirtySheetsRedefinePolygons;

  const end1 = +new Date();
  const start2 = +new Date();

  // redraw canvases where canvas changed
  for (const s of state.sheets) {
    if (s.canvasdirty)
      s.refreshCanvas();
  }

  // gather sheets for shadow redrawing
  shadows.checkDirtyShadowConstraint(true, movedSheets);

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
    for (const obj of state.objects) {
      recalculateObjectIntersections(obj, state);
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
  shadows.checkDirtyShadowConstraint(false, movedSheets);

  const end7 = +new Date();
  const start8 = +new Date();

  // set previous constraints for polygons
  setPrevShadowConstraints();

  const end8 = +new Date();
  const start9 = +new Date();

  // draw shadows on sheet canvases
  shadows.calculateSheetsShadows(false);

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
    console.log(`${end1 - start1} - ${end2 - start2} - ${end3 - start3} - ${end4 - start4} - ${end5 - start5} - ${end6 - start6} - ${end7 - start7} - ${end8 - start8} - ${end9 - start9} - ${end10 - start10}`);
}

/**
 * Calculate all sheets (full recalculation)
 */
export function calculateAllSheets() {
  for (const s of state.sheets) {
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
    for (const obj of state.objects) {
      recalculateObjectIntersections(obj, state, true);
    }
  }

  for (let i = 0; i < state.polygons.length; i++) {
    calculatePolygonOrder(state.polygons[i]);
  }
  setPrevShadowConstraints();
  shadows.calculateSheetsShadows(true);
  updateOrderedLists();

  // clear dirty flags
  for (const s of state.sheets) {
    s.dirty = false;
    s.madedirty = false;
  }

  // delete all sheets that were marked as deleting
  deleteSheets();
}

/**
 * Delete sheets marked for deletion
 */
export function deleteSheets() {
  if (!state.sheetsbeingdeleted)
    return;

  // remove deleted sheets' polygons from state.polygons
  const newpolys = [];
  const deletedpolyidxs = [];

  state.polygons.forEach((poly, p) => {
    const psheet = state.sheets[poly.sheetindex];
    if (!psheet.deleting)
      newpolys.push(poly);
    else
      deletedpolyidxs.push(p);
  });

  state.polygons = newpolys;

  // remove deleted sheets' polygons from orderedPolygons
  const neworderedpolys = [];

  for (const polyidx of state.orderedPolygons) {
    if (!deletedpolyidxs.includes(polyidx))
      neworderedpolys.push(polyidx);
  }

  state.orderedPolygons = neworderedpolys;

  // remove deleted sheets' polygons from polygons' constraints
  for (const poly of state.polygons) {
    let newconstraints = [];

    for (const polyidx of poly.constraints) {
      if (!deletedpolyidxs.includes(polyidx))
        newconstraints.push(polyidx);
    }

    poly.constraints = newconstraints;

    let newshadowconstraints = [];

    for (const polyidx of poly.shadowconstraints) {
      if (!deletedpolyidxs.includes(polyidx))
        newshadowconstraints.push(polyidx);
    }

    poly.shadowconstraints = newshadowconstraints;

    newshadowconstraints = [];

    for (const polyidx of poly.prevshadowconstraints) {
      if (!deletedpolyidxs.includes(polyidx))
        newshadowconstraints.push(polyidx);
    }

    poly.prevshadowconstraints = newshadowconstraints;
  }

  // remove deleted sheets from state.sheets
  const newsheets = [];
  const deletedsheetidxs = [];

  state.sheets.forEach((sheet, s) => {
    if (!sheet.deleting)
      newsheets.push(sheet);
    else
      deletedsheetidxs.push(s);
  });

  state.sheets = newsheets;

  // remove deleted sheet indexes from intersectors
  for (const sheet of state.sheets) {
    if (!sheet.intersectors)
      continue;
    const newintersectors = [];

    for (const isindex of sheet.intersectors) {
      if (!deletedsheetidxs.includes(isindex))
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
      for (const poly of state.polygons) {
        if (poly.sheetindex === oldindex)
          poly.sheetindex = i;
      }

      // adjust indices in intersector array
      for (const sheet of state.sheets) {
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
      for (const actPoly of state.polygons) {
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
export function deleteObject(obj) {
  const idx = state.objects.indexOf(obj);
  if (idx !== -1)
    state.objects.splice(idx, 1);
}

/**
 * Redefine intersections for an object
 */
export function redefineIntersections({sheets, centerp, rot}) {
  // redefine polygons
  for (let i = 0; i < sheets.length; i++) {
    calculateSheetSections(sheets[i], true, sheets);
  }

  // calculate initial polygons from the redefined current polygonset
  for (const s of sheets) {
    sheetutil.initializeStartPolygons(s, centerp, { alpha: -rot.alpha, beta: -rot.beta, gamma: -rot.gamma });
  }
}
