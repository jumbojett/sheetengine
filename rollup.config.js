import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/sheetengine.js',
      format: 'umd',
      name: 'sheetengine',
      sourcemap: true,
      exports: 'named'
    },
    {
      file: 'dist/sheetengine.esm.js',
      format: 'es',
      sourcemap: true
    }
  ],
  plugins: [resolve()],
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
