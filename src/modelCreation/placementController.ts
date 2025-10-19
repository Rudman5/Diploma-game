import * as BABYLON from '@babylonjs/core';
import { Astronaut } from './astronaut';
import { Rover } from './rover';
import {
  hideDestroyButton,
  showDestroyButton,
  updateResourceInfo,
  hideRefillButtons,
} from '../core/createGui';
import { ModelMetadata } from '../types';
import { ResourceManager } from '../core/resourceManager';
import { showAlert } from '../core/alertSystem';

const RESOURCE_COLORS: Record<string, BABYLON.Color3> = {
  water: BABYLON.Color3.FromHexString('#2e90b0'),
  food: BABYLON.Color3.FromHexString('#c9112d'),
  oxygen: BABYLON.Color3.FromHexString('#27de48'),
  energy: BABYLON.Color3.FromHexString('#ffff00'),
};

export class PlacementController {
  private scene: BABYLON.Scene;
  private currentRoot: BABYLON.TransformNode | null = null;
  private rotating = false;
  private placedBBoxes: { min: BABYLON.Vector3; max: BABYLON.Vector3 }[] = [];
  private highlightLayer: BABYLON.HighlightLayer;
  private resourceManager: ResourceManager;

  private pointerObserver?: BABYLON.Observer<BABYLON.PointerInfo>;
  private rotationObserver?: BABYLON.Observer<BABYLON.Scene>;
  private keyboardObserver?: BABYLON.Observer<BABYLON.KeyboardInfo>;
  private obstacles: any[] = [];

  public placedObjects: BABYLON.TransformNode[] = [];
  public selectedBuilding: BABYLON.TransformNode | null = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.highlightLayer = new BABYLON.HighlightLayer('hl', scene);
    this.resourceManager = new ResourceManager(scene);
    (scene as any).resourceManager = this.resourceManager;

    this.keyboardObserver = this.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && kbInfo.event.key === 'Escape') {
        this.cancelPlacement();
        this.deselect();
      }
    });
  }

  public async placeModelOnClick(
    modelPath: string,
    groundMesh: BABYLON.Mesh,
    onPlaced?: () => void,
    metadata?: ModelMetadata
  ): Promise<void> {
    if (this.currentRoot) this.cancelPlacement();
    showAlert('If you click on the selected thumbnail in menu, you can cancel placement', 'info');
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      '',
      './buildModels/',
      modelPath,
      this.scene
    );
    const meshes = result.meshes.filter((m): m is BABYLON.Mesh => m instanceof BABYLON.Mesh);
    if (meshes.length === 0) {
      console.error('No mesh found to place');
      return;
    }

    const root = new BABYLON.TransformNode(metadata!.name, this.scene);
    this.currentRoot = root;
    meshes.forEach((mesh) => {
      mesh.checkCollisions = true;
      mesh.parent = root;
    });

    root.metadata = metadata;

    const yOffset = 0.01;
    const gridSize = 0;
    const rotationSpeed = 0.03;
    const maxSlope = 0.5;

    let canPlace = true;

    this.pointerObserver = this.scene.onPointerObservable.add(async (pi: BABYLON.PointerInfo) => {
      if (!this.currentRoot) return;

      if (pi.type === BABYLON.PointerEventTypes.POINTERDOWN && pi.event.button === 2)
        this.rotating = true;
      if (pi.type === BABYLON.PointerEventTypes.POINTERUP && pi.event.button === 2)
        this.rotating = false;

      if (pi.type === BABYLON.PointerEventTypes.POINTERMOVE && !this.rotating) {
        const pick = this.scene.pick(
          this.scene.pointerX,
          this.scene.pointerY,
          (m) => m === groundMesh
        );
        if (!pick?.hit || !pick.pickedPoint) return;

        let pos = pick.pickedPoint.clone();
        pos.y += yOffset;
        if (gridSize > 0) {
          pos.x = Math.round(pos.x / gridSize) * gridSize;
          pos.z = Math.round(pos.z / gridSize) * gridSize;
        }
        root.position.copyFrom(pos);

        const normal = pick.getNormal(true) ?? BABYLON.Vector3.Up();
        const slope = Math.acos(BABYLON.Vector3.Dot(normal, BABYLON.Vector3.Up()));
        canPlace = slope <= maxSlope;

        const bboxA = root.getHierarchyBoundingVectors(true);
        for (const bboxB of this.placedBBoxes) {
          if (
            bboxA.min.x <= bboxB.max.x &&
            bboxA.max.x >= bboxB.min.x &&
            bboxA.min.y <= bboxB.max.y &&
            bboxA.max.y >= bboxB.min.y &&
            bboxA.min.z <= bboxB.max.z &&
            bboxA.max.z >= bboxB.min.z
          ) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          for (const astronaut of Astronaut.allAstronauts) {
            if (astronaut.mesh && this.isPositionOccupiedByAstronaut(pos, astronaut)) {
              canPlace = false;
              break;
            }
          }
        }

        if (canPlace && Rover.mainRover && Rover.mainRover.mesh) {
          if (this.isPositionOccupiedByRover(pos, Rover.mainRover)) {
            canPlace = false;
          }
        }

        if (canPlace) {
          const rockManager = (this.scene as any).rockManager;
          if (rockManager) {
            const rocks = rockManager.getRocks();
            for (const rock of rocks) {
              if (this.isPositionOccupiedByRock(pos, rock)) {
                canPlace = false;
                break;
              }
            }
          }
        }

        for (const mesh of meshes) {
          this.highlightLayer.removeMesh(mesh as BABYLON.Mesh);
          this.highlightLayer.addMesh(
            mesh as BABYLON.Mesh,
            canPlace ? BABYLON.Color3.Green() : BABYLON.Color3.Red()
          );
        }

        const forward = new BABYLON.Vector3(0, 0, 1);
        const right = BABYLON.Vector3.Cross(forward, normal).normalize();
        const correctedForward = BABYLON.Vector3.Cross(normal, right).normalize();
        root.rotationQuaternion = null;
        root.rotation = BABYLON.Vector3.RotationFromAxis(right, normal, correctedForward);
      }

      if (pi.type === BABYLON.PointerEventTypes.POINTERDOWN && pi.event.button === 0 && canPlace) {
        if (metadata?.rocksNeeded) {
          const resourceManager: ResourceManager = (this.scene as any).resourceManager;
          if (!resourceManager || !resourceManager.consumeRocks(metadata.rocksNeeded)) {
            console.warn(`Not enough rocks! Need ${metadata.rocksNeeded}`);
            return;
          }
        }
        this.placeBuilding(root, meshes, groundMesh, onPlaced);
      }
    });

    this.rotationObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.currentRoot && this.rotating) this.currentRoot.rotation.y += rotationSpeed;
    });
  }

  private isPositionOccupiedByAstronaut(position: BABYLON.Vector3, astronaut: Astronaut): boolean {
    const astronautPos = astronaut.mesh.position;
    const distance = BABYLON.Vector3.Distance(position, astronautPos);
    return distance < 3.0;
  }

  private isPositionOccupiedByRover(position: BABYLON.Vector3, rover: Rover): boolean {
    const roverPos = rover.mesh.position;
    const distance = BABYLON.Vector3.Distance(position, roverPos);
    return distance < 5.0;
  }

  private isPositionOccupiedByRock(position: BABYLON.Vector3, rock: any): boolean {
    const rockPos = rock.mesh.position;
    const distance = BABYLON.Vector3.Distance(position, rockPos);
    return distance < 3.0;
  }

  private placeBuilding(
    root: BABYLON.TransformNode,
    meshes: BABYLON.Mesh[],
    groundMesh: BABYLON.Mesh,
    onPlaced?: () => void
  ) {
    for (const astro of Astronaut.allAstronauts) astro.stopWalk();
    Rover.selectedRover?.stopMove();

    this.placedObjects.push(root);
    const bbox = root.getHierarchyBoundingVectors(true);
    this.placedBBoxes.push({ min: bbox.min.clone(), max: bbox.max.clone() });

    if (root.metadata?.resource) {
      const resourceType = root.metadata.resource;

      const productionRates: Record<string, number> = {
        oxygen: 2.0,
        food: 1.0,
        water: 1.0,
        energy: 30.0,
      };

      const productionRate = productionRates[resourceType] || 1.0;
      const energyConsumption = root.metadata.energyConsumption || 0;

      const width = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z);
      const radius = width * 1.5;

      this.resourceManager.registerBuilding(
        root,
        resourceType,
        productionRate,
        radius,
        energyConsumption
      );

      root.metadata.productionRate = productionRate;
      root.metadata.radius = radius;

      this.createRadiusCircle(root, groundMesh, resourceType, radius);
    }

    const crowd: BABYLON.ICrowd | undefined = (this.scene as any).crowd;
    const navPlugin: any = (this.scene as any).navigationPlugin;

    if (crowd && navPlugin) {
      const center = root.position.clone();
      const size = root.getHierarchyBoundingVectors(true);
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

      const agentIndex = crowd.addAgent(center, agentParams, root);
      if (agentIndex >= 0) this.obstacles.push(agentIndex);
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      crowd.update(dt);
    }

    this.cleanupPlacement();
    this.deselect();
    if (onPlaced) onPlaced();
    showAlert(
      'To refill astronaut and rover, bring them inside the circle around the building, then a button will show in the menu',
      'info'
    );
  }

  private createRadiusCircle(
    building: BABYLON.TransformNode,
    groundMesh: BABYLON.Mesh,
    resourceType: string,
    radius: number
  ) {
    const segments = 64;
    const points: BABYLON.Vector3[] = [];

    const pos = building.getAbsolutePosition();
    for (let i = 0; i <= segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      const x = pos.x + Math.cos(angle) * radius;
      const z = pos.z + Math.sin(angle) * radius;

      const pick = this.scene.pickWithRay(
        new BABYLON.Ray(new BABYLON.Vector3(x, 1000, z), BABYLON.Vector3.Down(), 2000),
        (m) => m === groundMesh
      );
      const y = pick?.hit && pick.pickedPoint ? pick.pickedPoint.y + 0.05 : pos.y + 0.05;
      points.push(new BABYLON.Vector3(x, y, z));
    }

    const circle = BABYLON.MeshBuilder.CreateLines(
      `${resourceType}_radiusCircle_${Date.now()}`,
      { points },
      this.scene
    );

    circle.color = RESOURCE_COLORS[resourceType] ?? BABYLON.Color3.White();
    circle.isPickable = false;
    circle.alwaysSelectAsActiveMesh = false;
    circle.setEnabled(false);
    building.metadata.radiusMesh = circle;
  }

  public cancelPlacement(): void {
    if (!this.currentRoot) return;
    this.cleanupPlacement(true);
  }

  private cleanupPlacement(disposeCurrent = false) {
    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = undefined;
    }
    if (this.rotationObserver) {
      this.scene.onBeforeRenderObservable.remove(this.rotationObserver);
      this.rotationObserver = undefined;
    }

    if (this.currentRoot) {
      for (const mesh of this.currentRoot.getChildMeshes()) {
        this.highlightLayer.removeMesh(mesh as BABYLON.Mesh);
      }

      if (disposeCurrent) {
        this.currentRoot.dispose();
      }
    }

    this.currentRoot = null;
    this.rotating = false;
  }

  public removeObstacle(obstacle: any) {
    const index = this.obstacles.indexOf(obstacle);
    if (index !== -1) {
      this.obstacles[index].dispose?.();
      this.obstacles.splice(index, 1);
    }
  }

  public clearObstacles() {
    this.obstacles.forEach((o) => o.dispose?.());
    this.obstacles = [];
  }

  public dispose() {
    this.cancelPlacement();
    this.clearObstacles();
    if (this.keyboardObserver) this.scene.onKeyboardObservable.remove(this.keyboardObserver);
  }

  private removeBuilding(building: BABYLON.TransformNode) {
    const index = this.placedObjects.indexOf(building);
    if (index !== -1) {
      this.placedObjects.splice(index, 1);
      this.placedBBoxes.splice(index, 1);
    }

    if (building.metadata?.radiusMesh) {
      building.metadata.radiusMesh.dispose();
    }
    this.resourceManager.unregisterBuilding(building);

    if ((this.scene as any).crowd && this.obstacles[index] !== undefined) {
      const crowd: BABYLON.ICrowd = (this.scene as any).crowd;
      const agentIndex = this.obstacles[index];
      crowd.removeAgent(agentIndex);
      this.obstacles.splice(index, 1);
    }

    building.dispose();
    hideRefillButtons();
    this.deselect();
  }

  public checkRefillOptions(building: BABYLON.TransformNode): {
    canRefillAstronaut: boolean;
    canRefillRover: boolean;
  } {
    const astronautInRange = this.resourceManager.canRefillAstronautFromBuilding(building);
    const roverInRange = this.resourceManager.canRefillRoverFromBuilding(building);
    return {
      canRefillAstronaut: astronautInRange !== null,
      canRefillRover: roverInRange !== null,
    };
  }

  public refillAstronautFromBuilding(building: BABYLON.TransformNode): boolean {
    const astronaut = this.resourceManager.canRefillAstronautFromBuilding(building);
    if (!astronaut) return false;

    const amountRefilled = this.resourceManager.refillAstronautFromBuilding(astronaut, building);
    return amountRefilled > 0;
  }

  public refillRoverFromBuilding(building: BABYLON.TransformNode): boolean {
    const rover = this.resourceManager.canRefillRoverFromBuilding(building);
    if (!rover) return false;

    const amountRefilled = this.resourceManager.refillRoverFromBuilding(rover, building);
    return amountRefilled > 0;
  }

  public handlePointerPick(pick: BABYLON.PickingInfo, event: PointerEvent) {
    this.deselectAllCircles();

    let clickedBuilding: BABYLON.TransformNode | null = null;
    if (pick?.hit && pick.pickedMesh) {
      clickedBuilding =
        this.placedObjects.find((b) => b.getChildMeshes().includes(pick.pickedMesh!)) || null;
    }

    if (clickedBuilding) {
      this.selectedBuilding = clickedBuilding;
      updateResourceInfo(clickedBuilding);

      const refillOptions = this.checkRefillOptions(clickedBuilding);
      (this.scene as any).currentRefillOptions = {
        building: clickedBuilding,
        canRefillAstronaut: refillOptions.canRefillAstronaut,
        canRefillRover: refillOptions.canRefillRover,
      };

      showDestroyButton(clickedBuilding, () => {
        this.removeBuilding(clickedBuilding!);
        this.selectedBuilding = null;
      });

      if (clickedBuilding.metadata?.resource && clickedBuilding.metadata?.radiusMesh) {
        clickedBuilding.metadata.radiusMesh.setEnabled(true);
      }

      for (const mesh of clickedBuilding.getChildMeshes()) {
        this.highlightLayer.addMesh(mesh as BABYLON.Mesh, BABYLON.Color3.Green());
      }
    } else {
      this.deselect();
    }
  }

  private deselectAllCircles() {
    for (const building of this.placedObjects) {
      if (building.metadata?.radiusMesh) {
        building.metadata.radiusMesh.setEnabled(false);
      }
    }
  }

  private deselect() {
    this.deselectAllCircles();

    if (this.selectedBuilding) {
      for (const mesh of this.selectedBuilding.getChildMeshes()) {
        this.highlightLayer.removeMesh(mesh as BABYLON.Mesh);
      }
      this.selectedBuilding = null;
    }
    hideDestroyButton();
    hideRefillButtons();

    (this.scene as any).currentRefillOptions = null;
  }

  public canAffordBuilding(metadata: ModelMetadata): boolean {
    const resourceManager: ResourceManager = (this.scene as any).resourceManager;
    if (!resourceManager) return false;

    const rocksNeeded = metadata.rocksNeeded || 0;
    return resourceManager.getAvailableRocks() >= rocksNeeded;
  }
}
