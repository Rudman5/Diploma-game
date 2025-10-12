import * as BABYLON from '@babylonjs/core';
import { Astronaut } from './astronaut';
import { Rover } from './rover';

export class PlacementController {
  private scene: BABYLON.Scene;
  private currentRoot: BABYLON.TransformNode | null = null;
  private rotating = false;
  private placedObjects: BABYLON.TransformNode[] = [];
  private placedBBoxes: { min: BABYLON.Vector3; max: BABYLON.Vector3 }[] = [];
  private highlightLayer: BABYLON.HighlightLayer;

  private pointerObserver?: BABYLON.Observer<BABYLON.PointerInfo>;
  private rotationObserver?: BABYLON.Observer<BABYLON.Scene>;
  private keyboardObserver?: BABYLON.Observer<BABYLON.KeyboardInfo>;
  private obstacles: any[] = [];

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.highlightLayer = new BABYLON.HighlightLayer('hl', scene);

    this.keyboardObserver = this.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && kbInfo.event.key === 'Escape') {
        this.cancelPlacement();
      }
    });
  }

  public async placeModelOnClick(
    modelPath: string,
    groundMesh: BABYLON.Mesh,
    onPlaced?: () => void,
    options?: { gridSize?: number; yOffset?: number; rotationSpeed?: number; maxSlope?: number }
  ): Promise<void> {
    if (this.currentRoot) this.cancelPlacement();

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

    const root = new BABYLON.TransformNode('modelRoot', this.scene);
    this.currentRoot = root;
    meshes.forEach((mesh) => {
      mesh.checkCollisions = true;
      mesh.parent = root;
    });

    const yOffset = options?.yOffset ?? 0.01;
    const gridSize = options?.gridSize ?? 0;
    const rotationSpeed = options?.rotationSpeed ?? 0.03;
    const maxSlope = options?.maxSlope ?? 0.5;

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

        this.highlightLayer.removeAllMeshes();
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
        this.currentRoot!.freezeWorldMatrix();
        this.placedObjects.push(this.currentRoot!);
        const bbox = this.currentRoot!.getHierarchyBoundingVectors(true);
        this.placedBBoxes.push({ min: bbox.min.clone(), max: bbox.max.clone() });

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
        if (onPlaced) onPlaced();
      }
    });

    // Rotation per frame
    this.rotationObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.currentRoot && this.rotating) this.currentRoot.rotation.y += rotationSpeed;
    });
  }

  public cancelPlacement(): void {
    if (!this.currentRoot) return;
    this.cleanupPlacement(true);
  }

  private cleanupPlacement(disposeCurrent = false) {
    this.highlightLayer.removeAllMeshes();
    if (this.pointerObserver) this.scene.onPointerObservable.remove(this.pointerObserver);
    if (this.rotationObserver) this.scene.onBeforeRenderObservable.remove(this.rotationObserver);
    if (disposeCurrent && this.currentRoot) this.currentRoot.dispose();

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
}
