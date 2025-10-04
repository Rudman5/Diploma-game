import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders';
import { createScene } from './createScene';

export class App {
  engine: BABYLON.Engine;
  scene!: BABYLON.Scene;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.engine = new BABYLON.Engine(canvas, true);
    window.addEventListener('resize', () => this.engine.resize());
  }

  async run() {
    this.scene = await createScene(this.engine, this.canvas);

    this.scene.debugLayer.show({ overlay: true });

    this.engine.runRenderLoop(() => this.scene.render());
  }
}
