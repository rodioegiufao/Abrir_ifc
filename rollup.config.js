import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'index.js',
  output: {
    file: "dist/bundle.js", // Mude o destino do bundle para 'dist/'
    format: 'esm'
  },
  plugins: [resolve()]
};
