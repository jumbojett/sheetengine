# SheetEngine Test Suite

A comprehensive test suite for SheetEngine, an isometric HTML5 JavaScript Display Engine. Tests are written with Vitest and can be run from the command line.

## Installation

Tests require no additional setup beyond what's already installed. The testing framework (Vitest), browser environment (jsdom), and canvas support are all included as dev dependencies.

## Running Tests

### Run tests once
```bash
npm test
```

### Watch mode (re-run on file changes)
```bash
npm run test:watch
```

### UI Mode (interactive test interface)
```bash
npm run test:ui
```

## Test Coverage

The test suite covers all major SheetEngine functionality:

### 1. **Scene Initialization**
   - Canvas setup and initialization
   - Canvas center positioning
   - View source configuration

### 2. **BaseSheet Creation**
   - Creating base sheets with correct properties
   - Setting base sheet colors
   - Global sheets array management

### 3. **Sheet Creation**
   - Creating sheets with orientations and positions
   - Drawing on sheet canvas contexts
   - Sheet drawing operations
   - Global sheets array management

### 4. **SheetObject Creation**
   - Creating composite objects with multiple sheets
   - Object centering
   - Object registration in global array

### 5. **Geometry Calculations**
   - Point rotation around X, Y, Z axes
   - Point addition and subtraction
   - Vector cross products
   - Point distance calculations

### 6. **Transforms**
   - 2D point transformation to u-v coordinates
   - 3D point transformation with z-depth
   - Inverse transformation (camera to world coordinates)

### 7. **Calculation Functions**
   - Calculating all sheets in scene
   - Calculating only changed sheets

### 8. **SheetObject Movement and Rotation**
   - Moving objects in 3D space
   - Rotating objects around axes
   - Setting absolute object orientation
   - Hiding and showing objects

### 9. **DensityMap**
   - Creating density maps for collision detection
   - Adding sheets to density maps
   - Point queries in density maps

### 10. **Scene Drawing**
   - Drawing complete scenes
   - Redrawing scenes after changes
   - Canvas rendering operations

### 11. **Integration Tests**
   - Complete scene creation with multiple objects
   - Complex object interactions
   - Full animation cycles

## Test Structure

Tests are organized by functional area with related tests grouped in `describe` blocks:

```javascript
describe('SheetEngine Core', () => {
  describe('Feature Area', () => {
    it('should do something specific', () => {
      // test implementation
    });
  });
});
```

## Using Tests for Debugging

### Run a specific test file
```bash
npx vitest tests/sheetengine.test.js
```

### Run tests matching a pattern
```bash
npx vitest -t "movement and rotation"
```

### Watch mode with filtering
```bash
npx vitest -t "rotation" --watch
```

## Test Examples

### Basic Functionality Test
```javascript
it('should move object', () => {
  const obj = new sheetengine.SheetObject(...);
  const originalCenterp = { ...obj.centerp };
  obj.move({ x: 10, y: 20, z: 0 });

  expect(obj.centerp).not.toEqual(originalCenterp);
});
```

### Geometry Calculation Test
```javascript
it('should calculate point rotation around Z axis', () => {
  const point = { x: 1, y: 0, z: 0 };
  const rotated = geometry.rotateAroundAxis(
    point, 
    { x: 0, y: 0, z: 1 }, 
    Math.PI / 2
  );

  expect(rotated.x).toBeCloseTo(0, 5);
  expect(rotated.y).toBeCloseTo(1, 5);
  expect(rotated.z).toBeCloseTo(0, 5);
});
```

### Integration Test
```javascript
it('should create and render a complete scene', () => {
  // Create base ground
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      const basesheet = new sheetengine.BaseSheet(
        { x: x * 100, y: y * 100, z: 0 },
        { alphaD: 90, betaD: 0, gammaD: 0 },
        { w: 100, h: 100 }
      );
      basesheet.color = '#5D7E36';
    }
  }

  // Create objects and animate
  sheetengine.calc.calculateAllSheets();
  sheetengine.drawing.drawScene(true);
  
  // Verify rendering
  expect(sheetengine.sheets.length).toBeGreaterThan(0);
});
```

## Setup and Teardown

Tests use automatic setup and teardown:

- **beforeEach**: Creates a fresh canvas and initializes scene for each test
- **afterEach**: Clears sheets, basesheets, and objects to prevent test pollution

## Custom Assertions

The test suite includes a custom point comparison assertion:

```javascript
// Compares points with default tolerance of 0.01
expect(point).toBeCloseToPoint(expectedPoint);

// With custom tolerance
expect(point).toBeCloseToPoint(expectedPoint, 0.001);
```

## Troubleshooting

### Tests hanging or timing out
- Ensure canvas and jsdom are properly initialized
- Check for infinite loops in drawing code
- Verify geometry calculations complete quickly

### False positives in floating point tests
- Use `toBeCloseTo()` instead of exact `toBe()` for numbers
- Adjust tolerance parameter based on precision needed

### Canvas-related failures
- Ensure `canvas` npm package is installed
- Check jsdom environment configuration in `vitest.config.js`
- Verify HTMLCanvasElement.getContext() is working

## Continuous Integration

For CI/CD pipelines:

```bash
# Run tests with exit code based on results
npm test

# Generate coverage report
npm run test:coverage
```

## Adding New Tests

When adding new features to SheetEngine:

1. Create tests in `tests/sheetengine.test.js` or a new test file
2. Follow the existing describe/it structure
3. Include both unit tests and integration tests
4. Run tests frequently during development with watch mode
5. Ensure all tests pass before committing

## Performance

- Typical test run: ~1.5 seconds
- Each test: < 50ms average
- 33 tests covering all major functionality
- Full scene rendering tested to ensure no performance regressions

## References

- [Vitest Documentation](https://vitest.dev/)
- [Expect API](https://vitest.dev/api/expect.html)
- [Test Patterns](https://vitest.dev/guide/)
