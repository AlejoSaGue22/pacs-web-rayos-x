import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Handles CJS→ESM conversion for Cornerstone sub-dependencies (e.g. dicom-parser)
      viteCommonjs(),
      // Provides Node.js core modules like 'events' for xmlbuilder2
      nodePolyfills(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      // Exclude Cornerstone packages from esbuild pre-bundling to avoid
      // circular-dependency issues that cause "Class extends value undefined"
      exclude: [
        '@cornerstonejs/core',
        '@cornerstonejs/tools',
        '@cornerstonejs/dicom-image-loader',
        '@cornerstonejs/utils',
        '@kitware/vtk.js',
      ],
      // Ensure dicom-parser and xmlbuilder2 (CJS) are pre-bundled so Cornerstone can use them
      include: ['dicom-parser', 'xmlbuilder2'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    worker: {
      format: 'es' as const,
    },
  };
});
