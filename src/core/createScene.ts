import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { createRTSCamera, moveCameraTo } from './createCamera';
import { Astronaut } from '../modelCreation/astronaut';
import {
  createGui,
  hideLeaveButton,
  setupAstronautThumbnails,
  updateBuildingButtons,
  updateGlobalResourceDisplay,
  updateResourceInfo,
} from './createGui';
import { PlacementController } from '../modelCreation/placementController';
import { createNavMesh } from './createNavMesh';
import { Rover } from '../modelCreation/rover';
import { RockManager } from './rockManager';

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

  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    '',
    './buildModels/',
    'apolloLunarModule.glb'
  );
  const apolloModule = result.meshes[0];
  apolloModule.rotation.z = Math.PI / 4;
  const apolloLat = 0.67408;
  const apolloLon = 23.47297;
  const terrainMinLat = 0;
  const terrainMaxLat = 30;
  const terrainMinLon = 0;
  const terrainMaxLon = 45;

  const u = (apolloLon - terrainMinLon) / (terrainMaxLon - terrainMinLon);
  const v = (apolloLat - terrainMinLat) / (terrainMaxLat - terrainMinLat);

  const height = ground.getHeightAtCoordinates(u, v);

  const apolloModuleCenterX = (u - 0.5) * groundWidth;
  const apolloModuleCenterZ = (v - 0.5) * groundLength;

  const astronautData = [
    {
      id: 'neil-armstrong',
      x: apolloModuleCenterX + 7,
      z: apolloModuleCenterZ + 5,
      name: 'Neil Armstrong',
    },
    {
      id: 'buzz-aldrin',
      x: apolloModuleCenterX + 5,
      z: apolloModuleCenterZ + 4,
      name: 'Buzz Aldrin',
    },
    {
      id: 'michael-collins',
      x: apolloModuleCenterX + 5,
      z: apolloModuleCenterZ + 8,
      name: 'Michael Collins',
    },
  ];

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

  const sound = await BABYLON.CreateSoundAsync('roverEngine', './sounds/carina-bot-aug-3.wav', {
    loop: true,
    autoplay: false,
    volume: 0.1,
  });
  sound.play();

  for (const data of astronautData) {
    const astro = new Astronaut(scene, ground, data.id, data.name);
    await astro.load();
    astro.mesh.position.set(data.x, 0, data.z);
    astro.mesh.position.y = ground.getHeightAtCoordinates(data.x, data.z) ?? 0;
    astro.addCrowdAgent();
    astro.playAnimation('Idle');
    astro.startResourceConsumption();
  }
  await createNavMesh(scene, [ground]);

  const crowd: BABYLON.ICrowd | undefined = scene.crowd;
  const navPlugin: BABYLON.RecastJSPlugin | undefined = scene.navigationPlugin;

  apolloModule.position.x = apolloModuleCenterX;
  apolloModule.position.z = apolloModuleCenterZ;
  apolloModule.position.y = height;
  if (crowd && navPlugin) {
    const center = apolloModule.position.clone();
    const size = apolloModule.getHierarchyBoundingVectors(true);
    const buildingWidth = Math.max(size.max.x - size.min.x, size.max.z - size.min.z);
    const agentRadius = buildingWidth / 2;

    const agentParams: BABYLON.IAgentParameters = {
      radius: agentRadius,
      height: size.max.y - size.min.y,
      maxSpeed: 0,
      maxAcceleration: 0,
      collisionQueryRange: agentRadius,
      pathOptimizationRange: 5,
      separationWeight: 3,
    };

    crowd.addAgent(center, agentParams, apolloModule);
    const dt = scene.getEngine().getDeltaTime() / 1000;
    crowd.update(dt);
  }
  moveCameraTo(camera, apolloModule.position);

  setupAstronautThumbnails(scene, camera);

  const rover = new Rover(scene, ground);
  await rover.load();
  rover.mesh.position.set(apolloModuleCenterX + 15, 0, apolloModuleCenterZ + 15);
  rover.mesh.position.y =
    ground.getHeightAtCoordinates(rover.mesh.position.x, rover.mesh.position.z) ?? 0;
  rover.addCrowdAgent();

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

    if (event.button === 0) {
      if (clickedAstronaut) {
        Astronaut.allAstronauts.forEach((a) => a.deselect());
        rover.deselect();
        clickedAstronaut.select();
        updateResourceInfo(clickedAstronaut);
      } else if (rover.containsMesh(pick.pickedMesh as BABYLON.AbstractMesh)) {
        Astronaut.allAstronauts.forEach((a) => a.deselect());
        rover.select();
        updateResourceInfo(rover);
      } else {
        Astronaut.allAstronauts.forEach((a) => a.deselect());
        rover.deselect();
        hideLeaveButton();
        updateBuildingButtons(scene);
        updateGlobalResourceDisplay(scene);
      }
    }

    if (event.button === 2) {
      if (selectedAstronaut && pick.pickedPoint) {
        const clickedRover = rover.containsMesh(pick.pickedMesh as BABYLON.AbstractMesh);
        const clickedRock = rockManager.findRockFromMesh(pick.pickedMesh as BABYLON.AbstractMesh);
        if (clickedRover) {
          selectedAstronaut.walkToRover(rover);
        } else if (clickedRock) {
          selectedAstronaut.walkToRock(clickedRock);
        } else {
          selectedAstronaut.walkTo(pick.pickedPoint, 2);
        }
        selectedAstronaut.deselect();
      } else if (selectedRover && pick.pickedPoint && rover.occupiedBy.length > 0) {
        rover.driveTo(pick.pickedPoint, 12);
        rover.deselect();
      }
    }

    placementController.handlePointerPick(pick, event);
  });

  const placementController = new PlacementController(scene);
  createGui(placementController, ground, scene);

  const rockManager = new RockManager(scene, ground);
  (scene as any).rockManager = rockManager;

  rockManager.scatterRocksAcrossMap(1000);

  return scene;
}
