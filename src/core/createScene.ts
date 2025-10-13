import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { createRTSCamera } from './createCamera';
import { Astronaut } from '../modelCreation/astronaut';
import {
  createGui,
  hideLeaveButton,
  setupAstronautThumbnails,
  updateGlobalResourceDisplay,
  updateResourceInfo,
} from './createGui';
import { PlacementController } from '../modelCreation/placementController';
import { createNavMesh } from './createNavMesh';
import { Rover } from '../modelCreation/rover';

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
      subdivisions: 256,
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
  //   0.5,
  //   0.5,
  //   15,
  //   new BABYLON.Vector3(5, 0, 0),
  //   scene
  // );
  camera.attachControl(canvas, true);

  const audioEngine = await BABYLON.CreateAudioEngineAsync({ resumeOnInteraction: true });

  const astronautData = [
    { id: 'neil-armstrong', x: 0, z: 0, name: 'Neil Armstrong' },
    { id: 'buzz-aldrin', x: 2, z: 0, name: 'Buzz Aldrin' },
    { id: 'michael-collins', x: 4, z: 0, name: 'Michael Collins' },
  ];

  for (const data of astronautData) {
    const astro = new Astronaut(scene, ground, data.id, data.name);
    await astro.load();
    astro.mesh.position.set(data.x, 0, data.z);
    astro.mesh.position.y = ground.getHeightAtCoordinates(data.x, data.z) ?? 0;
    astro.addCrowdAgent();
    astro.playAnimation('Idle');
    astro.startResourceConsumption();
  }

  setupAstronautThumbnails(scene, camera);

  const rover = new Rover(scene, ground);
  await rover.load();
  rover.mesh.position.set(15, 0, 0);
  rover.mesh.position.y =
    ground.getHeightAtCoordinates(rover.mesh.position.x, rover.mesh.position.z) ?? 0;

  scene.onBeforeRenderObservable.add(() => {
    if (Astronaut.selectedAstronaut) {
      updateResourceInfo(Astronaut.selectedAstronaut);
    } else if (Rover.selectedRover) {
      updateResourceInfo(Rover.selectedRover);
    } else if (placementController.selectedBuilding) {
      updateResourceInfo(placementController.selectedBuilding);
    } else {
      updateGlobalResourceDisplay(scene);
    }
  });

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;

    const event = pointerInfo.event as PointerEvent;
    const pick = pointerInfo.pickInfo;
    if (!pick?.hit) return;

    const selectedAstronaut = Astronaut.selectedAstronaut;
    const selectedRover = Rover.selectedRover;
    const clickedAstronaut = Astronaut.allAstronauts.find((a) =>
      a.containsMesh(pick.pickedMesh as BABYLON.AbstractMesh)
    );

    let handled = false;

    if (event.button === 0) {
      if (clickedAstronaut) {
        Astronaut.allAstronauts.forEach((a) => a.deselect());
        rover.deselect();
        clickedAstronaut.select();
        updateResourceInfo(clickedAstronaut);
        handled = true;
      } else if (rover.containsMesh(pick.pickedMesh as BABYLON.AbstractMesh)) {
        Astronaut.allAstronauts.forEach((a) => a.deselect());
        rover.select();
        handled = true;
      } else {
        Astronaut.allAstronauts.forEach((a) => a.deselect());
        rover.deselect();
        hideLeaveButton();
      }
    }

    if (event.button === 2 && !handled) {
      if (selectedAstronaut && pick.pickedPoint) {
        const clickedRover = rover.containsMesh(pick.pickedMesh as BABYLON.AbstractMesh);

        if (clickedRover) {
          const roverCenter = rover.mesh.getAbsolutePosition();
          const offsetDir = rover.mesh.getDirection(new BABYLON.Vector3(2.5, 0, 0));
          const entryPos = roverCenter.add(offsetDir.scale(2.5));

          selectedAstronaut.walkTo(entryPos, 2, () => {
            rover.addOccupant(selectedAstronaut);
            selectedAstronaut.enterRover(rover);
          });
          selectedAstronaut.deselect();
          handled = true;
        } else {
          selectedAstronaut.walkTo(pick.pickedPoint, 2);
          selectedAstronaut.deselect();
          handled = true;
        }
      } else if (selectedRover && pick.pickedPoint) {
        rover.driveTo(pick.pickedPoint, 12);
        rover.deselect();
        handled = true;
      }
    }

    placementController.handlePointerPick(pick, event);
    if (placementController.selectedBuilding) handled = true;

    if (!handled && pick.pickedPoint) {
    }
  });

  const placementController = new PlacementController(scene);
  createGui(placementController, ground, scene);
  await createNavMesh(scene, [ground]);

  return scene;
}
