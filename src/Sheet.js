/**
 * Sheet class - drawable 3D sheets in the scene
 */

import { state, internal } from './core.js';
import * as geometry from './geometry.js';
import * as shadows from './shadows.js';
import * as drawing from './drawing.js';
import * as calc from './calc.js';
import * as sheetutil from './sheetutil.js';

export class Sheet {
  constructor(centerp, rot, size) {
    this.width = size.w;
    this.height = size.h;
    this.centerp = geometry.clonePoint(centerp);

    this.objectsheet = false;
    this.skipDensityMap = false;
    this.dimSheets = false;
    this.dimmingDisabled = false;
    this.hidden = false;
    this.dirty = false;
    this.canvasdirty = true;

    this.dimmed = 0;
    this.dimmedprev = 0;

    this.castshadows = true;
    this.allowshadows = true;

    this.canvas = drawing.createCanvas(this.width, this.height);
    this.context = this.canvas.getContext('2d');
    this.shadowcanvas = drawing.createCanvas(this.width, this.height);
    this.shadowcontext = this.shadowcanvas.getContext('2d');
    this.shadowtempcanvas = drawing.createCanvas(this.width, this.height);
    this.shadowtempcontext = this.shadowtempcanvas.getContext('2d');
    this.baseshadowcanvas = drawing.createCanvas(this.width, this.height);
    this.baseshadowcontext = this.baseshadowcanvas.getContext('2d');
    this.compositecanvas = drawing.createCanvas(this.width, this.height);
    this.compositecontext = this.compositecanvas.getContext('2d');

    // Initialize common sheet properties and parameters
    sheetutil.initializeSheetProperties(this, rot);

    if (!this.objectsheet) {
      sheetutil.initializeSheetOrientation(this);
    }

    // Finalize sheet initialization
    sheetutil.finalizeSheetInitialization(this, { calc, geometry, shadows, state }, this.objectsheet);

    this.index = state.sheets.length;
    state.sheets.push(this);
    internal.staticsheets = null;
  }

  canvasChanged() {
    this.canvasdirty = true;
    if (this.objectsheet) {
      this.object.canvasdirty = true;
      this.object.intersectionsrecalc = true;
    }
    this.dirty = true;
  }

  destroy() {
    this.hidden = true;
    this.dirty = true;
    this.deleting = true;
    state.sheetsbeingdeleted = true;
  }

  refreshCanvas() {
    if (!this.canvasdirty) return;

    this.compositecontext.clearRect(0, 0, this.width, this.height);
    drawing.redrawSheetCanvases(this);
    this.canvasdirty = false;
  }

  setShadows(castshadows, allowshadows) {
    this.castshadows = castshadows;
    if (this.allowshadows != allowshadows) {
      this.allowshadows = allowshadows;
      shadows.calculateSheetShade(this);
    }
    this.dirty = true;
  }

  setDimming(dimSheets, dimmingDisabled) {
    this.dimSheets = dimSheets;
    this.dimmingDisabled = dimmingDisabled;
    this.dirty = true;
  }
}
