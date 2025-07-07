import * as BABYLON from 'babylonjs';

export class AppOne {
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.engine = new BABYLON.Engine(canvas, true);
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
    this.scene = createScene(this.engine, this.canvas);
  }

  debug(debugOn: boolean = true) {
    if (debugOn) {
      this.scene.debugLayer.show({ overlay: true });
    } else {
      this.scene.debugLayer.hide();
    }
  }

  run() {
    this.debug(true);

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }
}

const createScene = function (engine: BABYLON.Engine, canvas: HTMLCanvasElement) {
  const scene = new BABYLON.Scene(engine);

  // camera
  const camera = new BABYLON.ArcRotateCamera(
    'Camera',
    0,
    0,
    10,
    new BABYLON.Vector3(0, 0, 0),
    scene
  );
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  // Light
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.5;

  // Ground with height map and texture
  const groundMaterial = new BABYLON.StandardMaterial('groundMaterial', scene);
  groundMaterial.diffuseTexture = new BABYLON.Texture(
    '/src/assets/heightmap_downscaled.png',
    scene
  );
  const scale = 100;

  const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
    'gdhm',
    './src/assets/heightmap_downscaled.png',
    {
      width: 500940 / scale,
      height: 333960 / scale,
      subdivisions: 2048,
      minHeight: -4899 / scale,
      maxHeight: 3466 / scale,
    },
    scene
  );
  ground.material = groundMaterial;

  return scene;
};
