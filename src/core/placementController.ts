import {
  Scene,
  Engine,
  Mesh,
  TransformNode,
  Vector3,
  SceneLoader,
  PointerEventTypes,
  PointerInfo,
  HighlightLayer,
  Color3,
} from '@babylonjs/core';

export class PlacementController {
  private scene: Scene;
  private engine: Engine;
  private currentRoot: TransformNode | null = null;
  private rotating = false;
  private placedObjects: TransformNode[] = [];
  private highlightLayer: HighlightLayer;

  private moveObserver: any = null;
  private clickObserver: any = null;
  private rotationObserver: any = null;
  private keyboardObserver: any = null;

  constructor(scene: Scene, engine: Engine) {
    this.scene = scene;
    this.engine = engine;
    this.highlightLayer = new HighlightLayer('hl', scene);

    this.keyboardObserver = this.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === 1 && kbInfo.event.key === 'Escape') this.cancelPlacement();
    });
  }

  public async placeModelOnClick(
    modelPath: string,
    groundMesh: Mesh,
    onPlaced?: () => void,
    options?: { gridSize?: number; yOffset?: number; rotationSpeed?: number; maxSlope?: number }
  ): Promise<void> {
    if (this.currentRoot) this.cancelPlacement();

    const result = await SceneLoader.ImportMeshAsync('', './buildModels/', modelPath, this.scene);
    const meshes = result.meshes.filter((m): m is Mesh => m instanceof Mesh);
    if (meshes.length === 0) {
      console.error('No mesh found to place');
      return;
    }

    const root = new TransformNode('modelRoot', this.scene);
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

    this.moveObserver = this.scene.onPointerObservable.add((pi: PointerInfo) => {
      if (!this.currentRoot || this.rotating || pi.type !== PointerEventTypes.POINTERMOVE) return;

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

      const normal = pick.getNormal(true) ?? Vector3.Up();
      const slope = Math.acos(Vector3.Dot(normal, Vector3.Up()));
      canPlace = slope <= maxSlope;

      const bboxA = root.getHierarchyBoundingVectors(true);
      for (const other of this.placedObjects) {
        const bboxB = other.getHierarchyBoundingVectors(true);
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
        this.highlightLayer.addMesh(mesh, canPlace ? Color3.Green() : Color3.Red());

      const forward = new Vector3(0, 0, 1);
      const right = Vector3.Cross(forward, normal).normalize();
      const correctedForward = Vector3.Cross(normal, right).normalize();
      root.rotationQuaternion = null;
      root.rotation = Vector3.RotationFromAxis(right, normal, correctedForward);
    });

    this.scene.onPointerObservable.add((pi: PointerInfo) => {
      if (!this.currentRoot) return;
      if (pi.type === PointerEventTypes.POINTERDOWN && pi.event.button === 2) this.rotating = true;
      if (pi.type === PointerEventTypes.POINTERUP && pi.event.button === 2) this.rotating = false;
    });

    this.rotationObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.currentRoot && this.rotating) this.currentRoot.rotation.y += rotationSpeed;
    });

    this.clickObserver = this.scene.onPointerObservable.add((pi: PointerInfo) => {
      if (!this.currentRoot || pi.type !== PointerEventTypes.POINTERDOWN || pi.event.button !== 0)
        return;
      if (!canPlace) return;

      this.placedObjects.push(this.currentRoot);
      this.cleanupPlacement();
      if (onPlaced) onPlaced();
    });
  }

  public cancelPlacement(): void {
    if (!this.currentRoot) return;
    this.cleanupPlacement(true);
  }

  private cleanupPlacement(disposeCurrent = false) {
    this.highlightLayer.removeAllMeshes();

    if (this.moveObserver) this.scene.onPointerObservable.remove(this.moveObserver);
    if (this.clickObserver) this.scene.onPointerObservable.remove(this.clickObserver);
    if (this.rotationObserver) this.scene.onBeforeRenderObservable.remove(this.rotationObserver);

    if (disposeCurrent && this.currentRoot) this.currentRoot.dispose();
    this.currentRoot = null;
    this.rotating = false;

    this.moveObserver = null;
    this.clickObserver = null;
    this.rotationObserver = null;
  }

  public dispose() {
    this.cancelPlacement();
    if (this.keyboardObserver) this.scene.onKeyboardObservable.remove(this.keyboardObserver);
  }
}
