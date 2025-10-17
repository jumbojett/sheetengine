# SheetEngine

**Version 2.0.0** - Modern JavaScript Isometric HTML5 Display Engine

An isometric 3D graphics engine for HTML5 Canvas, completely refactored with modern ES6 modules.

## What's New in 2.0

This is a complete refactoring of the original SheetEngine library:

- **Modern ES6 Modules** - Clean, modular architecture split into 14 focused modules
- **Simple JavaScript** - No TypeScript, just clean, readable ES6+ code
- **Tree-Shakeable** - Import only what you need
- **Better Developer Experience** - Clear module boundaries and dependencies
- **Backward Compatible** - Same API as version 1.x

## Installation

```bash
npm install
```

## Building

```bash
# Build for production
npm run build

# Build and watch for changes
npm run dev
```

This creates two builds:
- `dist/sheetengine.js` - UMD build (works everywhere)
- `dist/sheetengine.esm.js` - ES Module build (for modern bundlers)

## Usage

### Browser (UMD)

```html
<script src="dist/sheetengine.js"></script>
<script>
  const canvas = document.getElementById('mycanvas');
  sheetengine.scene.init(canvas, {w: 900, h: 500});

  // Create a base sheet
  const basesheet = new sheetengine.BaseSheet(
    {x:0, y:0, z:0},
    {alphaD:90, betaD:0, gammaD:0},
    {w:200, h:200}
  );
  basesheet.color = '#5D7E36';

  // Calculate and draw
  sheetengine.calc.calculateAllSheets();
  sheetengine.drawing.drawScene(true);
</script>
```

### ES Modules

```javascript
import sheetengine, { BaseSheet, Sheet, SheetObject } from './dist/sheetengine.esm.js';

// Or import individual modules
import * as geometry from './src/geometry.js';
import * as transforms from './src/transforms.js';
```

### Node.js

```javascript
const sheetengine = require('./dist/sheetengine.js');
```

## Project Structure

```
sheetengine/
├── src/
│   ├── core.js              # Global state management
│   ├── geometry.js          # 3D math utilities
│   ├── transforms.js        # Coordinate transformations
│   ├── shadows.js           # Shadow calculation
│   ├── drawing.js           # Canvas rendering
│   ├── intersections.js     # Sheet intersection detection
│   ├── z-ordering.js        # Depth sorting
│   ├── calc.js              # Main calculation engine
│   ├── scene.js             # Scene management
│   ├── objhelpers.js        # Object helper utilities
│   ├── BaseSheet.js         # BaseSheet class
│   ├── Sheet.js             # Sheet class
│   ├── SheetObject.js       # SheetObject class
│   ├── DensityMap.js        # Collision detection
│   └── index.js             # Main entry point
├── dist/                    # Built files
├── examples/                # Example HTML files
└── package.json
```

## API Overview

### Core Classes

- **BaseSheet** - Static background rectangles
- **Sheet** - Drawable 3D sheets with canvases
- **SheetObject** - Complex objects with multiple sheets
- **DensityMap** - Collision detection grid

### Main Modules

- **scene** - Canvas initialization, scene management
- **calc** - Sheet calculations and transformations
- **drawing** - Rendering functions
- **geometry** - Vector math, rotations, transformations
- **shadows** - Shadow and lighting effects

## Examples

Check out the `examples/` directory for working demos:

- Creating a scene
- Custom textures
- Moving and rotating objects
- Animations
- Collision detection
- Shadows and lighting
- And more...

To view examples:

```bash
npm run serve
# Open http://localhost:8080/examples/
```

## Development

The codebase is organized into clean ES6 modules:

1. **Core modules** - geometry, transforms (no dependencies)
2. **Rendering modules** - shadows, drawing, intersections
3. **Engine modules** - calc, scene, z-ordering
4. **Class modules** - BaseSheet, Sheet, SheetObject, DensityMap

Each module has clear responsibilities and minimal dependencies.

## Original Documentation

For detailed API documentation and tutorials, see:
https://normanzb.github.io/sheetengine/

## License

MIT License - Copyright (C) 2012 Levente Dobson