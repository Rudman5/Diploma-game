import {
  Scene,
  Engine,
  Mesh,
  TransformNode,
  Vector3,
  SceneLoader,
  PointerEventTypes,
  PointerInfo,
} from '@babylonjs/core';

export class PlacementController {
  private scene: Scene;
  private engine: Engine;
  private currentlyMovingMesh: TransformNode | null = null;

  constructor(scene: Scene, engine: Engine) {
    this.scene = scene;
    this.engine = engine;
  }

  public async startPlacingModel(modelPath: string): Promise<void> {
    // Dispose old moving mesh if exists
    if (this.currentlyMovingMesh) {
      this.currentlyMovingMesh.dispose();
      this.currentlyMovingMesh = null;
    }

    // Load model meshes
    const result = await SceneLoader.ImportMeshAsync('', './buildModels/', modelPath, this.scene);

    const meshes = result.meshes.filter((m): m is Mesh => m instanceof Mesh);
    if (meshes.length === 0) {
      console.error('No mesh found to place');
      return;
    }

    // Create a root node for the model
    const root = new TransformNode('modelRoot', this.scene);
    meshes.forEach((m) => (m.parent = root));
    this.currentlyMovingMesh = root;

    // Make mesh semi-transparent
    meshes.forEach((mesh) => {
      if (mesh.material) {
        const matClone = mesh.material.clone(`${mesh.name}_placementMat`);
        if (matClone) matClone.alpha = 0.6;
        mesh.material = matClone;
      }
    });

    this.currentlyMovingMesh.position = Vector3.Zero();

    // Pointer move: follow mouse
    const pointerMoveObserver = this.scene.onPointerObservable.add((pi: PointerInfo) => {
      if (!this.currentlyMovingMesh) return;
      if (
        pi.type === PointerEventTypes.POINTERMOVE &&
        pi.pickInfo?.hit &&
        pi.pickInfo.pickedPoint
      ) {
        this.currentlyMovingMesh.position.copyFrom(pi.pickInfo.pickedPoint);
      }
    });

    // Pointer down: place mesh
    const pointerDownObserver = this.scene.onPointerObservable.add((pi: PointerInfo) => {
      if (!this.currentlyMovingMesh) return;
      if (
        pi.type === PointerEventTypes.POINTERDOWN &&
        pi.pickInfo?.hit &&
        pi.pickInfo.pickedPoint
      ) {
        this.currentlyMovingMesh.position.copyFrom(pi.pickInfo.pickedPoint);

        // Restore opacity
        meshes.forEach((mesh) => {
          if (mesh.material) mesh.material.alpha = 1;
        });

        this.currentlyMovingMesh = null;

        // Remove observers
        this.scene.onPointerObservable.remove(pointerMoveObserver);
        this.scene.onPointerObservable.remove(pointerDownObserver);
      }
    });
  }
}
