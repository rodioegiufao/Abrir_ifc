// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'index.js',
  output: {
    file: "bundle.js",
    format: 'esm',
    inlineDynamicImports: true  // ✅ Esta linha resolve o problema
  },
  plugins: [
    resolve({
      browser: true
    }),
    commonjs()
  ]
};