/* eslint-disable @typescript-eslint/no-unused-vars */
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
  return {
    base: '/Diploma-game/',
    resolve: {
      alias: {
        babylonjs: mode === 'development' ? 'babylonjs/babylon.max' : 'babylonjs',
      },
    },
    plugins: [
      {
        name: 'fix-recast',
        transform(code, id) {
          if (id.includes('recast-detour.js')) {
            return code.replace(`this["Recast"]`, 'window["Recast"]');
          }
        },
      },
    ],
  };
});
