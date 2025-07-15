import * as BABYLON from '@babylonjs/core';
import { loadCharacter } from './assetManager';

export async function createScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement) {
  const scene = new BABYLON.Scene(engine);

  const camera = new BABYLON.ArcRotateCamera('camera', 0, 0, 10, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvas, true);

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.groundColor = new BABYLON.Color3(0, 0, 0);
  light.diffuse = new BABYLON.Color3(0.9, 0.9, 0.9);
  light.specular = new BABYLON.Color3(0, 0, 0);
  light.intensity = 0.7;

  // Ground setup
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
  );
  ground.material = groundMaterial;

  await loadCharacter(scene);

  return scene;
}
