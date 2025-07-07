import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
  return {
    base: '/Diploma-game/',
    resolve: {
      alias: {
        babylonjs: mode === 'development' ? 'babylonjs/babylon.max' : 'babylonjs',
      },
    },
  };
});
