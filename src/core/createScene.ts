import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { loadAssets } from './assetManager';
import { createCamera } from './createCamera';
import { AstronautController } from './astronautController';

export async function createScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement) {
  const scene = new BABYLON.Scene(engine);

  const camera = createCamera(scene, canvas);
  camera.attachControl(canvas, true);

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.groundColor = new BABYLON.Color3(0, 0, 0);
  light.diffuse = new BABYLON.Color3(0.9, 0.9, 0.9);
  light.specular = new BABYLON.Color3(0, 0, 0);
  light.intensity = 0.7;

  const groundImg = './assets/heightmap_downscaled.png';
  const groundMaterial = new BABYLON.StandardMaterial(groundImg, scene);
  groundMaterial.diffuseTexture = new BABYLON.Texture(groundImg, scene);

  const scale = 100;
  const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
    'ground',
    groundImg,
    {
      width: 500940 / scale,
      height: 333960 / scale,
      subdivisions: 2048,
      minHeight: -4899 / scale,
      maxHeight: 3466 / scale,
    },
    scene
  ) as BABYLON.GroundMesh;

  ground.material = groundMaterial;
  ground.isPickable = true;

  const astronaut = await loadAssets(scene);
  astronaut.playAnimation('Idle');

  new AstronautController(scene, camera, astronaut);

  return scene;
}
