import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/sheetengine.js',
      format: 'umd',
      name: 'sheetengine',
      sourcemap: true,
      exports: 'named',
      strict: false,
      footer: `(function() {
  if (typeof window !== 'undefined' && typeof window.sheetengine !== 'undefined' && window.sheetengine.default) {
    // Copy all properties and property descriptors from default export to the global namespace
    Object.getOwnPropertyNames(window.sheetengine.default).forEach(function(key) {
      if (!window.sheetengine.hasOwnProperty(key)) {
        var descriptor = Object.getOwnPropertyDescriptor(window.sheetengine.default, key);
        if (descriptor) {
          Object.defineProperty(window.sheetengine, key, descriptor);
        }
      }
    });
  }
})();`
    },
    {
      file: 'dist/sheetengine.esm.js',
      format: 'es',
      sourcemap: true
    }
  ],
  plugins: [
    resolve()
    // Temporarily disabled terser to debug variable corruption
    // terser({
    //   format: {
    //     comments: false,
    //   },
    //   compress: {
    //     drop_console: false,
    //     sequences: false,
    //     dead_code: false,
    //     conditionals: false,
    //     booleans: false,
    //     unused: false,
    //     if_return: false,
    //     join_vars: false,
    //     collapse_vars: false,
    //     reduce_vars: false,
    //     passes: 1
    //   },
    //   mangle: false
    // })
  ],
  onwarn(warning, warn) {
    // Suppress circular dependency warning for objhelpers <-> SheetObject
    // This is an intentional design pattern where the factory needs the class
    if (warning.code === 'CIRCULAR_DEPENDENCY' &&
        warning.message.includes('objhelpers.js') &&
        warning.message.includes('SheetObject.js')) {
      return;
    }
    warn(warning);
  }
};
