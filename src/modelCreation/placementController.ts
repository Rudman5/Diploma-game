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
  private resourceCounts: Record<string, number> = { water: 0, food: 0, oxygen: 0, energy: 0 };
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

    if (metadata?.rocksNeeded) {
      const resourceManager: ResourceManager = (this.scene as any).resourceManager;
      if (!resourceManager || !resourceManager.consumeRocks(metadata.rocksNeeded)) {
        console.warn(`Not enough rocks! Need ${metadata.rocksNeeded}`);
        return;
      }
    }
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

        for (const mesh of meshes)
          this.highlightLayer.addMesh(
            mesh,
            canPlace ? BABYLON.Color3.Green() : BABYLON.Color3.Red()
          );

        const forward = new BABYLON.Vector3(0, 0, 1);
        const right = BABYLON.Vector3.Cross(forward, normal).normalize();
        const correctedForward = BABYLON.Vector3.Cross(normal, right).normalize();
        root.rotationQuaternion = null;
        root.rotation = BABYLON.Vector3.RotationFromAxis(right, normal, correctedForward);
      }

      if (pi.type === BABYLON.PointerEventTypes.POINTERDOWN && pi.event.button === 0 && canPlace) {
        for (const astro of Astronaut.allAstronauts) astro.stopWalk();
        Rover.selectedRover?.stopMove();
        this.placedObjects.push(this.currentRoot!);
        const bbox = this.currentRoot!.getHierarchyBoundingVectors(true);
        this.placedBBoxes.push({ min: bbox.min.clone(), max: bbox.max.clone() });

        if (this.currentRoot!.metadata?.resource) {
          const resourceType = this.currentRoot!.metadata.resource;

          const productionRates: Record<string, number> = {
            oxygen: 2.0,
            food: 1.0,
            water: 1.0,
            energy: 30.0,
          };

          const productionRate = productionRates[resourceType] || 1.0;
          const energyConsumption = this.currentRoot!.metadata.energyConsumption || 0;

          const width = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z);
          const radius = width * 1.5;

          this.resourceManager.registerBuilding(
            this.currentRoot!,
            resourceType,
            productionRate,
            radius,
            energyConsumption
          );

          this.currentRoot!.metadata.productionRate = productionRate;
          this.currentRoot!.metadata.radius = radius;

          const segments = 64;
          const points: BABYLON.Vector3[] = [];

          const ground = groundMesh;
          const pos = this.currentRoot!.getAbsolutePosition();
          for (let i = 0; i <= segments; i++) {
            const angle = (2 * Math.PI * i) / segments;
            const x = pos.x + Math.cos(angle) * radius;
            const z = pos.z + Math.sin(angle) * radius;

            const pick = this.scene.pickWithRay(
              new BABYLON.Ray(new BABYLON.Vector3(x, 1000, z), BABYLON.Vector3.Down(), 2000),
              (m) => m === ground
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
          this.currentRoot!.metadata.radiusMesh = circle;
        }

        const crowd: BABYLON.ICrowd | undefined = (this.scene as any).crowd;
        const navPlugin: any = (this.scene as any).navigationPlugin;

        if (crowd && navPlugin) {
          const center = this.currentRoot!.position.clone();
          const size = this.currentRoot!.getHierarchyBoundingVectors(true);
          const agentParams: BABYLON.IAgentParameters = {
            radius: Math.max(size.max.x - size.min.x, size.max.z - size.min.z) / 2,
            height: size.max.y - size.min.y,
            maxSpeed: 0,
            maxAcceleration: 0,
            collisionQueryRange: Math.max(size.max.x - size.min.x, size.max.z - size.min.z) * 2,
            pathOptimizationRange: 10,
            separationWeight: 50,
          };

          const agentIndex = crowd.addAgent(center, agentParams, this.currentRoot!);
          if (agentIndex >= 0) this.obstacles.push(agentIndex);
          const dt = this.scene.getEngine().getDeltaTime() / 1000;
          crowd.update(dt);
        }

        this.cleanupPlacement();
        this.deselect();
        if (onPlaced) onPlaced();
      }
    });

    this.rotationObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.currentRoot && this.rotating) this.currentRoot.rotation.y += rotationSpeed;
    });
  }

  public cancelPlacement(): void {
    if (!this.currentRoot) return;
    this.cleanupPlacement(true);
  }

  private cleanupPlacement(disposeCurrent = false) {
    if (this.pointerObserver) this.scene.onPointerObservable.remove(this.pointerObserver);
    if (this.rotationObserver) this.scene.onBeforeRenderObservable.remove(this.rotationObserver);
    if (disposeCurrent && this.currentRoot) this.currentRoot.dispose();
    this.deselect();

    if (this.currentRoot) {
      for (const mesh of this.currentRoot.getChildMeshes()) {
        this.highlightLayer.removeMesh(mesh as BABYLON.Mesh);
      }
    }

    this.currentRoot = null;
    this.pointerObserver = undefined;
    this.rotationObserver = undefined;
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
    let clickedBuilding: BABYLON.TransformNode | null = null;
    if (pick?.hit && pick.pickedMesh) {
      clickedBuilding =
        this.placedObjects.find((b) => b.getChildMeshes().includes(pick.pickedMesh!)) || null;
    }

    if (clickedBuilding) {
      this.deselect();
      this.selectedBuilding = clickedBuilding;
      updateResourceInfo(clickedBuilding);

      const refillOptions = this.checkRefillOptions(clickedBuilding);
      (this.scene as any).currentRefillOptions = {
        building: clickedBuilding,
        canRefillAstronaut: refillOptions.canRefillAstronaut,
        canRefillRover: refillOptions.canRefillRover,
      };

      showDestroyButton(clickedBuilding, () => {
        this.removeBuilding(clickedBuilding);
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

  private deselect() {
    if (this.selectedBuilding) {
      if (this.selectedBuilding.metadata?.radiusMesh) {
        this.selectedBuilding.metadata.radiusMesh.setEnabled(false);
      }

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
