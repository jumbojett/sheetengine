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
    this.maxdiag = Math.ceil(Math.sqrt(this.width * this.width + this.height * this.height) / 2);

    // Calculate corners
    sheetutil.calcUdifVdif(this);
    this.corners = sheetutil.calculateCornersFromCenter(this.centerp, this.udif, this.vdif);
    
    // Calculate A1 (base matrix inverse)
    this.A1 = geometry.getBaseMatrixInverse(this.p1, this.p2, this.normalp);

    // Calculate sheet data if transforms are available
    if (state.canvasCenter) {
      calc.calculateSheetData(this);
    }
    
    // Calculate shade for the sheet
    shadows.calculateSheetShade(this);

    state.basesheets.push(this);
  }

  destroy() {
    const bidx = state.basesheets.indexOf(this);
    if (bidx != -1)
      state.basesheets.splice(bidx, 1);
  }
}
