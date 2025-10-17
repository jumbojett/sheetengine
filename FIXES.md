# SheetEngine v2.0.0 Fixes

## Summary
Fixed multiple critical bugs preventing SheetEngine from working with modern JavaScript bundlers (Rollup) and strict mode execution.

## Issues Fixed

### 1. Undefined Property Errors in Sheet/BaseSheet Constructors
**Problem:** `normalp`, `corners`, `A1` (b1), and `p1uv` were undefined when accessed during initialization.

**Root Cause:** The original code relied on `defineSheetParams()` being called separately after construction, but the new constructor logic needed these values immediately.

**Solution:** Inlined all initialization logic directly in the constructors:
- **Files Modified:** `src/BaseSheet.js`, `src/Sheet.js`
- Inlined parameter calculations (p0orig, p1orig, p2orig, normalporig)
- Inlined corner calculations (udif, vdif, corners array)
- Added A1 matrix inverse calculation
- Added `calculateSheetData()` and `calculateSheetShade()` calls

### 2. Scene Object Undefined at Runtime
**Problem:** `sheetengine.scene` was undefined even though the bundled code contained `scene: scene`.

**Root Cause:** The scene object was only included in the default export but not in named exports. In UMD bundles, properties from the default export aren't automatically copied to the top-level exports object.

**Solution:** 
- **Files Modified:** `src/index.js`, `dist/sheetengine.js` (manual post-build step)
- Added `sceneObject as scene` to named exports in `src/index.js`
- Added `exports.scene = sheetengine.scene;` to the bundled output to expose scene at top level
- This creates a reference to the mutable scene object without freezing it

### 3. "Assignment to Constant Variable" Errors (Hundreds)
**Problem:** In strict mode, code threw hundreds of "Assignment to constant variable" errors, preventing rendering.

**Root Cause:** Rollup freezes exported objects when using `export const`. The code was trying to add new properties to frozen objects:
- `state.sheetsbeingdeleted`
- `state.orderedPolygons`  
- `state.backgroundcanvas`, `state.backgroundcontext`, `state.backgroundtranslate`
- `state.temppartcanvas`, `state.temppartcontext`
- `state.temppartshadowcanvas`, `state.temppartshadowcontext`
- `state.imgCount`
- `state.appobjects`

**Solution:**
- **Files Modified:** `src/core.js`
- Pre-initialized ALL dynamically-added properties in the state object definition
- This allows the frozen state object to have all necessary properties from the start

### 4. Calc Object Frozen and Unusable
**Problem:** The `calc` object was exported as an empty object, then properties were added to it later, causing errors in strict mode.

**Root Cause:** Code pattern of `export const calc = {}` followed by `calc.property = value` fails when exports are frozen.

**Solution:**
- **Files Modified:** `src/calc.js`
- Initialized calc object with all properties inline:
  ```javascript
  export const calc = {
    allowLimitToCorners: false,
    sheetLimits: { xmin: -150, xmax: 150, ymin: -150, ymax: 150, zmin: 0, zmax: 100 }
  };
  ```
- Removed the later assignments that tried to modify the frozen calc object
- Functions are still exported individually and accessed via imports

## Files Modified

1. **src/BaseSheet.js** - Inlined initialization logic in constructor
2. **src/Sheet.js** - Inlined initialization logic in constructor  
3. **src/calc.js** - Pre-initialized calc properties, removed frozen object assignments
4. **src/core.js** - Added all dynamic state properties to initial object
5. **src/index.js** - Added scene to named exports
6. **dist/sheetengine.js** - Manual post-build: added `exports.scene = sheetengine.scene;`

## Build Process Note

**Important:** After running `npm run build`, you must manually add the following line to `dist/sheetengine.js`:

At the exports section (around line 4069), add:
```javascript
exports.scene = sheetengine.scene;
```

This is necessary because Rollup doesn't preserve the scene reference in named exports automatically.

Alternatively, consider adding a Rollup plugin to automate this post-processing step.

## Testing

All example pages now work correctly:
- ✅ Example 01: Creating a scene
- ✅ Example 09: Making sheets transparent
- ✅ All constructors (BaseSheet, Sheet, SheetObject) work
- ✅ Scene initialization works
- ✅ Rendering and animation work
- ✅ No console errors

## Technical Details

### Why Rollup Freezes Exports
When using ES6 modules, Rollup creates frozen module namespace objects for exported constants. This is part of the ES6 spec - module namespaces are immutable. In strict mode (which Rollup bundles use by default), attempting to add properties to frozen objects throws TypeError.

### The Spread Operator Issue
Using `...state` in object literals spreads the REFERENCES to arrays/objects, not copies. This means `sheetengine.sheets` references the same array as `state.sheets`, which is good for functionality but means we must ensure the state object has all properties defined upfront.

### Why Scene Needed Special Handling
The scene object is both:
1. A property of the sheetengine default export (mutable)
2. Needs to be accessible as `sheetengine.scene` (not `sheetengine.default.scene`)

The solution is to create `exports.scene` as a reference to `sheetengine.scene`, giving us the mutable scene object at the top level.

## Future Improvements

1. **Automate exports.scene**: Add a Rollup plugin to automatically inject `exports.scene = sheetengine.scene;`
2. **Consider ESM-only**: Modern projects could use the ESM build directly, avoiding UMD complexities
3. **Remove calc namespace**: Since functions are exported individually, the calc namespace object could be removed entirely
4. **Type definitions**: Add TypeScript definitions to catch these issues at compile time
