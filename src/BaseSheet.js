/**
 * BaseSheet class - static base rectangles for the scene
 */

import { state } from './core.js';
import * as geometry from './geometry.js';
import * as calc from './calc.js';
import * as shadows from './shadows.js';
import * as drawing from './drawing.js';
import * as sheetutil from './sheetutil.js';

export class BaseSheet {
  constructor(centerp, rot, size) {
    this.width = size.w;
    this.height = size.h;
    this.centerp = geometry.clonePoint(centerp);

    this.objectsheet = false;
    this.dirty = true;
    this.allowshadows = true;
    this.castshadows = false;
    
    // Initialize shadow canvases
    this.shadowcanvas = drawing.createCanvas(this.width, this.height);
    this.shadowcontext = this.shadowcanvas.getContext('2d');
    this.shadowtempcanvas = drawing.createCanvas(this.width, this.height);
    this.shadowtempcontext = this.shadowtempcanvas.getContext('2d');
    
    // Initialize common sheet properties and parameters
    sheetutil.initializeSheetProperties(this, rot);
    sheetutil.initializeSheetOrientation(this);
    
    // Finalize sheet initialization
    sheetutil.finalizeSheetInitialization(this, { calc, geometry, shadows, state }, this.objectsheet);

    state.basesheets.push(this);
  }

  destroy() {
    const bidx = state.basesheets.indexOf(this);
    if (bidx != -1)
      state.basesheets.splice(bidx, 1);
  }
}
