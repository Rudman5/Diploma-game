/* eslint-disable @typescript-eslint/no-unused-vars */
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
  return {
    resolve: {
      alias: {
        babylonjs: mode === 'development' ? 'babylonjs/babylon.max' : 'babylonjs',
      },
    },
  };
});
