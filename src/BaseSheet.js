/**
 * BaseSheet class - static base rectangles for the scene
 */

import { state } from './core.js';
import * as geometry from './geometry.js';
import * as shadows from './shadows.js';

export class BaseSheet {
  constructor(centerp, rot, size) {
    const rotclone = fillRot(rot);

    this.width = size.w;
    this.height = size.h;
    this.centerp = geometry.clonePoint(centerp);
    this.rot = { alphaD: rotclone.alphaD, betaD: rotclone.betaD, gammaD: rotclone.gammaD };

    // These will be set by calc module when integrated
    if (window.calc) {
      window.calc.defineSheetParams(this);
      window.calc.limitToCorners(this);
      window.calc.calculateSheetData(this);
    }
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
