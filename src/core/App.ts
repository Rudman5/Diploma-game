import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders';
import { createScene } from './createScene';
import { createGui } from './createGui';
import { PlacementController } from './placementController';

export class App {
  engine: BABYLON.Engine;
  scene!: BABYLON.Scene;
  placementController!: PlacementController;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.engine = new BABYLON.Engine(canvas, true);
    window.addEventListener('resize', () => this.engine.resize());
  }

  async run() {
    this.scene = await createScene(this.engine, this.canvas);
    this.placementController = new PlacementController(this.scene, this.engine);

    createGui(this.scene, this.placementController);

    this.scene.debugLayer.show({ overlay: true });

    this.engine.runRenderLoop(() => this.scene.render());
  }
}
