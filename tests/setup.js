import { expect, beforeEach, afterEach } from 'vitest';

// Setup DOM canvas mocking
beforeEach(() => {
  // Create a mock canvas element if needed
  if (!document.getElementById('test-canvas')) {
    const canvas = document.createElement('canvas');
    canvas.id = 'test-canvas';
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
  }
});

afterEach(() => {
  // Clean up
  const canvas = document.getElementById('test-canvas');
  if (canvas) {
    canvas.remove();
  }
});

// Add custom matchers if needed
expect.extend({
  toBeCloseToPoint(received, expected, tolerance = 0.01) {
    const pass = 
      Math.abs(received.x - expected.x) < tolerance &&
      Math.abs(received.y - expected.y) < tolerance &&
      (!received.z || !expected.z || Math.abs(received.z - expected.z) < tolerance);
    
    return {
      pass,
      message: () => `Expected ${JSON.stringify(received)} to be close to ${JSON.stringify(expected)} with tolerance ${tolerance}`
    };
  }
});
