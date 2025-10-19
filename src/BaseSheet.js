/**
 * BaseSheet class - static base rectangles for the scene
 */

import { state } from './core.js';
import * as geometry from './geometry.js';
import * as calc from './calc.js';
import * as shadows from './shadows.js';
import * as drawing from './drawing.js';

export class BaseSheet {
  constructor(centerp, rot, size) {
    const rotclone = fillRot(rot);

    this.width = size.w;
    this.height = size.h;
    this.centerp = geometry.clonePoint(centerp);
    this.rot = { alphaD: rotclone.alphaD, betaD: rotclone.betaD, gammaD: rotclone.gammaD };

    this.objectsheet = false;
    this.dirty = true;
    this.allowshadows = true;
    this.castshadows = false;
    
    // Initialize shadow canvases
    this.shadowcanvas = drawing.createCanvas(this.width, this.height);
    this.shadowcontext = this.shadowcanvas.getContext('2d');
    this.shadowtempcanvas = drawing.createCanvas(this.width, this.height);
    this.shadowtempcontext = this.shadowtempcanvas.getContext('2d');
    
    // Initialize sheet parameters inline
    this.p0orig = { x: -this.width / 2, y: 0, z: this.height / 2 };
    this.p1orig = { x: 1, y: 0, z: 0 };
    this.p2orig = { x: 0, y: 0, z: -1 };
    this.normalporig = { x: 0, y: 1, z: 0 };

    const alpha = this.rot.alphaD * Math.PI / 180;
    const beta = this.rot.betaD * Math.PI / 180;
    const gamma = this.rot.gammaD * Math.PI / 180;

    this.p0 = this.p0start = geometry.rotatePoint(this.p0orig, alpha, beta, gamma);
    this.p1 = this.p1start = geometry.rotatePoint(this.p1orig, alpha, beta, gamma);
    this.p2 = this.p2start = geometry.rotatePoint(this.p2orig, alpha, beta, gamma);
    this.normalp = this.normalpstart = geometry.rotatePoint(this.normalporig, alpha, beta, gamma);

    this.maxdiag = Math.ceil(Math.sqrt(this.width * this.width + this.height * this.height) / 2);

    // Calculate corners
    const scalew = this.width / 2;
    const scaleh = this.height / 2;
    this.udif = { x: this.p1.x * scalew, y: this.p1.y * scalew, z: this.p1.z * scalew };
    this.vdif = { x: this.p2.x * scaleh, y: this.p2.y * scaleh, z: this.p2.z * scaleh };
    
    const cp = this.centerp;
    const ud = this.udif;
    const vd = this.vdif;
    this.corners = [];
    this.corners[0] = { x: -ud.x - vd.x + cp.x, y: -ud.y - vd.y + cp.y, z: -ud.z - vd.z + cp.z };
    this.corners[1] = { x: +ud.x - vd.x + cp.x, y: +ud.y - vd.y + cp.y, z: +ud.z - vd.z + cp.z };
    this.corners[2] = { x: +ud.x + vd.x + cp.x, y: +ud.y + vd.y + cp.y, z: +ud.z + vd.z + cp.z };
    this.corners[3] = { x: -ud.x + vd.x + cp.x, y: -ud.y + vd.y + cp.y, z: -ud.z + vd.z + cp.z };
    
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

function fillRot(rot) {
  if (!rot) return { alphaD: 0, betaD: 0, gammaD: 0 };
  return {
    alphaD: rot.alphaD || 0,
    betaD: rot.betaD || 0,
    gammaD: rot.gammaD || 0
  };
}
