# SheetEngine Test Suite - Summary

## 📊 Overview

A comprehensive, command-line test suite for SheetEngine built with Vitest. Replaces manual browser testing with automated, repeatable tests covering all major functionality.

## ✅ What's Included

### Test Coverage (33 Tests)
- **Scene Initialization** (3 tests): Canvas setup, center positioning, view source
- **BaseSheet Operations** (3 tests): Creation, coloring, array management
- **Sheet Operations** (3 tests): Creation, drawing, management
- **SheetObject Creation** (2 tests): Multi-sheet objects, registration
- **Geometry** (6 tests): Rotations, point operations, cross products
- **Transforms** (3 tests): World ↔ Camera coordinate conversions
- **Calculations** (2 tests): Sheet calculation modes
- **Movement & Rotation** (5 tests): Object dynamics and orientation
- **DensityMap** (3 tests): Collision detection
- **Drawing** (2 tests): Scene rendering
- **Integration** (1 test): Complete scene with animation

### Infrastructure
- **Vitest 3.2.4**: Fast, modern test framework with ES6 module support
- **jsdom**: Full DOM/canvas environment simulation
- **canvas**: Native HTMLCanvasElement.getContext() support
- **Custom Assertions**: Point comparison with tolerance

### File Structure
```
tests/
  ├── README.md              # Detailed test documentation
  ├── setup.js               # Test environment setup
  └── sheetengine.test.js    # 33 comprehensive tests

vitest.config.js             # Vitest configuration
run-tests.sh                 # Quick start script
package.json                 # Updated with test scripts
```

## 🚀 Quick Start

### Run Tests
```bash
npm test                  # Run all tests once (~1.3 seconds)
npm run test:watch       # Watch mode - re-run on changes
npm run test:ui          # Interactive test explorer in browser
```

### Filter Tests
```bash
npx vitest -t 'rotation'      # Run only rotation tests
npx vitest -t 'movement'      # Run only movement tests
npx vitest -t 'geometry'      # Run only geometry tests
npx vitest -t 'sheet'         # Run only sheet-related tests
```

### Use with Development
```bash
# Terminal 1: Watch mode
npm run test:watch

# Terminal 2: Make changes to src/
npm run dev                    # Optional: watch build

# Tests automatically re-run as you save files
```

## 📈 Test Performance

- **Total Time**: ~1.3 seconds
- **Per Test Average**: <50ms
- **Environment Setup**: ~460ms
- **33 Tests**: All passing ✅

## 🔍 Example Tests

### Basic Movement Test
```javascript
it('should move object', () => {
  const obj = new sheetengine.SheetObject(...);
  const original = { ...obj.centerp };
  
  obj.move({ x: 10, y: 20, z: 0 });
  
  expect(obj.centerp).not.toEqual(original);
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
});
```

### Scene Rendering Test
```javascript
it('should draw scene without errors', () => {
  const basesheet = new sheetengine.BaseSheet(...);
  const sheet = new sheetengine.Sheet(...);
  
  sheetengine.calc.calculateAllSheets();
  sheetengine.drawing.drawScene(true);
  
  expect(sheetengine.sheets.length).toBeGreaterThan(0);
});
```

## 🛠️ Debugging with Tests

### When You Make Changes
1. Use `npm run test:watch` to get immediate feedback
2. Tests will re-run automatically when you save files
3. See failures instantly before manual testing
4. Use `-t` filter to focus on specific features

### Common Test Commands for Debugging
```bash
# Run tests for a specific module
npx vitest -t 'SheetObject'

# Run tests matching a pattern and stay in watch mode
npx vitest -t 'rotation' --watch

# Run with verbose output
npx vitest --reporter=verbose

# Open interactive UI for visual test exploration
npm run test:ui
```

## 📝 Adding New Tests

When adding features to SheetEngine:

1. **Create test** in `tests/sheetengine.test.js`
2. **Follow structure**: `describe` for groups, `it` for individual tests
3. **Use setup/teardown**: Tests auto-reset scene for isolation
4. **Write both unit and integration tests**
5. **Run frequently**: `npm run test:watch` while developing
6. **Commit tests**: Add tests when committing new features

### Template for New Test
```javascript
describe('New Feature', () => {
  let resource;

  beforeEach(() => {
    // Setup
    resource = new sheetengine.Something(...);
  });

  it('should do something', () => {
    resource.operation();
    expect(resource.property).toBe(expectedValue);
  });

  it('should handle edge case', () => {
    expect(() => {
      resource.edgeCase();
    }).not.toThrow();
  });
});
```

## 🎯 Test Categories

### Unit Tests (17 tests)
- Individual function/method behavior
- Geometry calculations
- Point transformations
- Object properties

### Integration Tests (15 tests)
- Multiple components working together
- Scene creation and rendering
- Object movement and rotation sequences
- Complete animation cycles

### Regression Tests (1 test)
- Full scene creation to catch consolidation issues
- Verifies examples work correctly
- Catches side effects from refactoring

## 🔧 Configuration Files

### vitest.config.js
- Uses jsdom for DOM simulation
- Runs setup.js before tests
- Configures 800x600 test canvas

### tests/setup.js
- Creates test canvas element
- Provides custom assertions
- Cleans up between tests

## 💡 Benefits Over Manual Browser Testing

| Aspect | Manual Testing | Automated Tests |
|--------|---|---|
| Time | 5-10 min per change | 1.3 seconds |
| Repeatability | Manual | Automatic |
| Coverage | Cherry-picked | All functionality |
| Regressions | Manual catch | Automatic detection |
| CI/CD Ready | Not suitable | Perfect |
| Documentation | Browser only | Self-documenting |

## 🚨 Troubleshooting

### Canvas errors
→ Ensure `canvas` package is installed: `npm install --save-dev canvas`

### Tests timing out
→ Check for infinite loops in drawing code, verify calculations complete

### Floating point failures
→ Use `toBeCloseTo()` instead of `toBe()` for precision

### Tests don't re-run in watch mode
→ Verify file changes are being detected: `npx vitest --watch`

## 📚 References

- [Vitest Docs](https://vitest.dev/)
- [Expect API](https://vitest.dev/api/expect.html)
- [Testing Best Practices](https://vitest.dev/guide/)
- [SheetEngine Examples](../examples/) - Real-world usage patterns

## 🎉 Result

Instead of manually opening each HTML example in a browser, you can now:

```bash
npm test
```

Get instant feedback on all 33 tests covering scene creation, object manipulation, geometry, transforms, and rendering. Use it for debugging, regression testing, and feature validation.

**All 33 tests passing ✅**
