import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  return {
    base: '/Diploma-game/',
    resolve: {
      alias: {
        babylonjs: mode === 'development' ? 'babylonjs/babylon.max' : 'babylonjs',
      },
    },
    optimizeDeps: {
      include: ['recast-detour'],
    },
    build: {
      commonjsOptions: {
        include: [/recast-detour/, /node_modules/],
      },
    },
    plugins: [
      {
        name: 'fix-recast',
        transform(code, id) {
          if (id.includes('recast-detour')) {
            return code
              .replace(/this\[["']Recast["']\]/g, 'window["Recast"]')
              .replace(/this\.Recast/g, 'window.Recast')
              .replace(/globalThis\[["']Recast["']\]/g, 'window["Recast"]')
              .replace(/globalThis\.Recast/g, 'window.Recast');
          }
          return code;
        },
      },
    ],
  };
});
