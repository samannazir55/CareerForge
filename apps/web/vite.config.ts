import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // The templates package is compiled as CommonJS (to fix the docx/Node.js
    // import issue on the server side). Rollup can't statically determine named
    // exports from CJS modules, so we declare them explicitly here.
    commonjsOptions: {
      namedExports: {
        '@careerforge/templates': [
          'getTemplate',
          'getAllTemplateMetadata',
          'isPremiumTemplate',
          'modernTemplate',
          'classicTemplate',
        ],
      },
    },
  },
});
