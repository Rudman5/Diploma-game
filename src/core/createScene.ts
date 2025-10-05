import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { createRTSCamera } from './createCamera';
import { Astronaut } from './astronaut';
import { SelectionManager } from './selectionManager';
import { createGui, showLeaveButton } from './createGui';
import { PlacementController } from './placementController';
import { createNavMesh } from './createNavMesh';
import { Rover } from './rover';

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

  const astronauts: Astronaut[] = [];

  for (let i = 0; i < 1; i++) {
    const astro = new Astronaut(scene, ground);

    await astro.load();
    astro.mesh.position.set(i * 2, 0, 0);

    astro.mesh.position.y =
      ground.getHeightAtCoordinates(astro.mesh.position.x, astro.mesh.position.z) ?? 0;
    astronauts.push(astro);
  }
  const rover = new Rover(scene, ground);
  await rover.load();
  rover.mesh.position.set(15, 0, 0);
  rover.mesh.position.y =
    ground.getHeightAtCoordinates(rover.mesh.position.x, rover.mesh.position.z) ?? 0;

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;
    const pick = pointerInfo.pickInfo;
    if (!pick?.hit || !pick.pickedMesh) return;

    const clickedAstronaut = Astronaut.allAstronauts.find((a) =>
      a.containsMesh(pick.pickedMesh as BABYLON.AbstractMesh)
    );
    const clickedRover = rover.containsMesh(pick.pickedMesh as BABYLON.AbstractMesh) ? rover : null;
    const selectedAstronaut = Astronaut.selectedAstronaut;
    const selectedRover = Rover.selectedRover;

    if (clickedAstronaut) {
      if (selectedAstronaut && selectedAstronaut !== clickedAstronaut) selectedAstronaut.deselect();
      clickedAstronaut.select();
      return;
    }

    if (clickedRover) {
      if (selectedAstronaut && !clickedRover.occupiedBy) {
        const roverCenter = clickedRover.mesh.getAbsolutePosition();
        const offsetDir = clickedRover.mesh.getDirection(new BABYLON.Vector3(2.5, 0, 0));
        const entryPos = roverCenter.add(offsetDir.scale(2.5));
        selectedAstronaut.walkTo(entryPos, 2, () => {
          selectedAstronaut.enterRover(clickedRover);
          clickedRover.select();
          showLeaveButton();
        });

        selectedAstronaut.deselect();
        return;
      }

      if (clickedRover.occupiedBy) {
        if (selectedRover && selectedRover !== clickedRover) selectedRover.deselect();
        clickedRover.select();
        showLeaveButton();
        if (selectedAstronaut) selectedAstronaut.deselect();
        return;
      }
    }

    if (pick.pickedPoint) {
      if (selectedRover && selectedRover.occupiedBy) {
        selectedRover.driveTo(pick.pickedPoint, 12);
        selectedRover.deselect();
        return;
      }

      if (selectedAstronaut && !selectedAstronaut.rover) {
        selectedAstronaut.walkTo(pick.pickedPoint, 2);
        selectedAstronaut.deselect();
        return;
      }
    }
  });

  const placementController = new PlacementController(scene);
  createGui(placementController, ground);
  await createNavMesh(scene, [ground]);

  return scene;
}
