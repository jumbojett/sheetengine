/**
 * DensityMap class - collision detection and spatial queries
 */

import * as geometry from './geometry.js';
import * as sheetutil from './sheetutil.js';

export class DensityMap {
  constructor(granularity) {
    this.map = {};
    this.granularity = granularity;
  }

  get(p) {
    const map = this.map;
    const coords = sheetutil.calculateGridCoordinates(p, this.granularity);
    if (map[sheetutil.calculateGridKey(coords.x, coords.y, coords.z)])
      return map[sheetutil.calculateGridKey(coords.x, coords.y, coords.z)];
    return 0;
  }

  put(p) {
    const map = this.map;
    const coords = sheetutil.calculateGridCoordinates(p, this.granularity, true);
    const { x, y, z } = coords;

    this.add(sheetutil.calculateGridKey(x, y, z));
    this.add(sheetutil.calculateGridKey(x + 1, y, z));
    this.add(sheetutil.calculateGridKey(x, y + 1, z));
    this.add(sheetutil.calculateGridKey(x - 1, y, z));
    this.add(sheetutil.calculateGridKey(x, y - 1, z));
  }

  remove(p) {
    const map = this.map;
    const coords = sheetutil.calculateGridCoordinates(p, this.granularity, true);
    const { x, y, z } = coords;

    this.sub(sheetutil.calculateGridKey(x, y, z));
    this.sub(sheetutil.calculateGridKey(x + 1, y, z));
    this.sub(sheetutil.calculateGridKey(x, y + 1, z));
    this.sub(sheetutil.calculateGridKey(x - 1, y, z));
    this.sub(sheetutil.calculateGridKey(x, y - 1, z));
  }

  add(id) {
    const map = this.map;
    if (!map[id])
      map[id] = 1;
    else
      map[id] = map[id] + 1;
  }

  sub(id) {
    const map = this.map;
    if (!map[id] || map[id] == 0)
      return;
    else
      map[id] = map[id] - 1;
  }

  addSheet(sheet) {
    this.processSheet(sheet, this.put);
  }

  removeSheet(sheet) {
    this.processSheet(sheet, this.remove);
  }

  processSheet(sheet, processFunction) {
    const gran = this.granularity;
    const s = sheet;
    if (s.skipDensityMap) return;
    const granx = Math.round(s.width / gran);
    const grany = Math.round(s.height / gran);
    const xmod = {
      x: (s.corners[1].x - s.corners[0].x) / granx,
      y: (s.corners[1].y - s.corners[0].y) / granx,
      z: (s.corners[1].z - s.corners[0].z) / granx
    };
    const ymod = {
      x: (s.corners[3].x - s.corners[0].x) / grany,
      y: (s.corners[3].y - s.corners[0].y) / grany,
      z: (s.corners[3].z - s.corners[0].z) / grany
    };

    const w = s.canvas.width;
    const h = s.canvas.height;
    const imgData = s.context.getImageData(0, 0, w, h).data;
    let actp = geometry.clonePoint(geometry.addPoint(s.corners[0], { x: (xmod.x + ymod.x) / 2, y: (xmod.y + ymod.y) / 2, z: (xmod.z + ymod.z) / 2 }));
    for (let y = 0; y < grany; y++) {
      let actpx = geometry.clonePoint(actp);
      for (let x = 0; x < granx; x++) {
        const sx = Math.round(x * gran + gran / 2);
        const sy = Math.round(y * gran + gran / 2);
        const pixi = (sx + w * sy) * 4;
        const alpha = imgData[pixi + 3];
        if (alpha != 0) {
          processFunction.call(this, actpx);
        }
        actpx = geometry.addPoint(actpx, xmod);
      }
      actp = geometry.addPoint(actp, ymod);
    }
  }

  addSheets(sheets) {
    for (let i = 0; i < sheets.length; i++) {
      this.addSheet(sheets[i]);
    }
  }

  removeSheets(sheets) {
    for (let i = 0; i < sheets.length; i++) {
      this.removeSheet(sheets[i]);
    }
  }

  getTargetHeight(targetp, objectHeight) {
    const startz = targetp.z + objectHeight;
    for (let z = startz; z > 0; z--) {
      const obstacle = this.get({ x: targetp.x, y: targetp.y, z });
      if (obstacle) return z;
    }
    return 0;
  }

  getTargetPoint(targetPos, vector, objHeight, tolerance) {
    let allowMove = true;
    let stopFall = false;
    let targetp = {
      x: targetPos.x + vector.x,
      y: targetPos.y + vector.y,
      z: targetPos.z + vector.z
    };
    let h = this.getTargetHeight({ x: targetp.x, y: targetp.y, z: targetp.z }, objHeight);
    if (h >= targetp.z) {
      if (h - targetp.z < tolerance) {
        stopFall = true;
        targetp.z = h;
      } else {
        vector.x = 0;
        vector.y = 0;
        targetp = {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z + vector.z
        };
        h = this.getTargetHeight({ x: targetp.x, y: targetp.y, z: targetp.z }, objHeight);
        if (h >= targetp.z) {
          stopFall = true;
          if (h - targetp.z < tolerance) {
            targetp.z = h;
          } else {
            allowMove = false;
            targetp.z = h;
          }
        }
      }
    }
    return { allowMove, targetp, movex: vector.x, movey: vector.y, stopFall };
  }
}
