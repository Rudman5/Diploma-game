import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { createRTSCamera } from './createCamera';

import { Astronaut } from './astronaut';
import { SelectionManager } from './selectionManager';
import { createGui } from './createGui';
import { PlacementController } from './placementController';

export async function createScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement) {
  const scene = new BABYLON.Scene(engine);

  scene.createDefaultEnvironment({
    createSkybox: false,
    createGround: false,
  });

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.groundColor = new BABYLON.Color3(0, 0, 0);
  light.diffuse = new BABYLON.Color3(0.9, 0.9, 0.9);
  light.specular = new BABYLON.Color3(0, 0, 0);
  light.intensity = 0.7;

  const groundImg = './assets/heightmap_downscaled.png';
  const groundMaterial = new BABYLON.StandardMaterial(groundImg, scene);
  groundMaterial.diffuseTexture = new BABYLON.Texture(groundImg, scene);

  const scale = 100;
  const groundWidth = 500940 / scale;
  const groundLength = 333960 / scale;

  const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
    'ground',
    groundImg,
    {
      width: groundWidth,
      height: groundLength,
      subdivisions: 512,
      minHeight: -4899 / scale,
      maxHeight: 3466 / scale,
    },
    scene
  ) as BABYLON.GroundMesh;
  ground.freezeWorldMatrix();
  ground.material = groundMaterial;
  ground.isPickable = true;
  ground.metadata = { isGround: true };
  const camera = createRTSCamera(canvas, engine, scene, groundWidth, groundLength);
  // Testing purposes
  // const camera = new BABYLON.ArcRotateCamera(
  //   'Camera',
  //   0,
  //   0,sd
  //   10,
  //   new BABYLON.Vector3(0, 0, 0),
  //   scene
  // );

  camera.attachControl(canvas, true);

  const astronauts: Astronaut[] = [];

  for (let i = 0; i < 1; i++) {
    const astro = new Astronaut(scene, ground);

    await astro.load();
    astro.mesh.position.set(i * 2, 0, 0);

    astro.mesh.position.y =
      ground.getHeightAtCoordinates(astro.mesh.position.x, astro.mesh.position.z) ?? 0;
    astro.playAnimation('Idle');
    astronauts.push(astro);
  }

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;

    const pick = pointerInfo.pickInfo;
    if (!pick?.hit || !pick.pickedMesh) return;

    const astronaut = Astronaut.allAstronauts.find(
      (a) => pick.pickedMesh !== null && a.containsMesh(pick.pickedMesh)
    );

    if (astronaut) {
      Astronaut.selectedAstronaut?.deselect();
      astronaut.select();
      return;
    }

    if (Astronaut.selectedAstronaut && pick.pickedPoint) {
      Astronaut.selectedAstronaut.walkTo(pick.pickedPoint, 2, undefined, true);
    }
  });

  canvas.addEventListener('pointerdown', () => {
    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (!pick?.hit || !pick.pickedMesh) return;

    const meta = pick.pickedMesh.metadata;
    if (meta?.selectable) {
      SelectionManager.setSelection(meta.selectable);
    } else if (SelectionManager.getSelected() instanceof Astronaut && pick.pickedPoint) {
      (SelectionManager.getSelected() as Astronaut).walkTo(pick.pickedPoint, 2);
    }
  });
  const placementController = new PlacementController(scene, engine);
  createGui(placementController, ground);

  return scene;
}
