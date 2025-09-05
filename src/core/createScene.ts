import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { createRTSCamera } from './createCamera';

import { Astronaut } from './astronaut';

export async function createScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement) {
  const scene = new BABYLON.Scene(engine);

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
      subdivisions: 2048,
      minHeight: -4899 / scale,
      maxHeight: 3466 / scale,
    },
    scene
  ) as BABYLON.GroundMesh;

  ground.material = groundMaterial;
  ground.isPickable = true;
  ground.metadata = { isGround: true };
  const camera = createRTSCamera(canvas, engine, scene, groundWidth, groundLength);
  camera.attachControl(canvas, true);

  const astronauts: Astronaut[] = [];

  for (let i = 0; i < 5; i++) {
    const astro = new Astronaut(scene);
    await astro.load();
    astro.mesh.position.set(i * 2, 0, 0);
    astro.playAnimation('Idle');
    astronauts.push(astro);
  }

  // Pointer handler for selection and movement
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

  for (let i = 0; i < 50; i++) {
    const rock = BABYLON.MeshBuilder.CreateBox('rock_' + i, { size: 1 }, scene);
    rock.position.set(Math.random() * 50, 0, Math.random() * 50);
    rock.metadata = { diggable: true };
  }

  const building = BABYLON.MeshBuilder.CreateBox('building', { size: 3 }, scene);
  building.position.set(10, 0, 10);
  building.metadata = { building: true };

  return scene;
}
