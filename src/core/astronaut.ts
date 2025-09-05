import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

export class Astronaut {
  public mesh!: BABYLON.AbstractMesh;
  public skeleton?: BABYLON.Skeleton;
  private scene: BABYLON.Scene;
  private animations = new Map<string, BABYLON.AnimationGroup>();
  private moveObserver?: BABYLON.Observer<BABYLON.Scene>;
  private _hl?: BABYLON.HighlightLayer;
  private groundMesh?: BABYLON.GroundMesh;

  // Static references for selection
  public static selectedAstronaut: Astronaut | null = null;
  public static allAstronauts: Astronaut[] = [];

  constructor(scene: BABYLON.Scene, groundMesh?: BABYLON.GroundMesh) {
    this.scene = scene;
    this.groundMesh = groundMesh;
    Astronaut.allAstronauts.push(this);
  }

  // --- LOAD MODEL ---
  async load(modelName: string = 'astronaut.glb', rootUrl: string = './models/') {
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, modelName, this.scene);

    this.mesh = result.meshes[0];
    this.mesh.isPickable = true;
    this.mesh.getChildMeshes().forEach((m) => (m.isPickable = true));

    result.animationGroups.forEach((ag) => this.animations.set(ag.name, ag));

    // Place on ground if available
    if (this.groundMesh) {
      this.mesh.position.y =
        this.groundMesh.getHeightAtCoordinates(this.mesh.position.x, this.mesh.position.z) ??
        this.mesh.position.y;
    }
  }

  // --- CHECK IF A MESH BELONGS TO THIS ASTRONAUT ---
  containsMesh(mesh: BABYLON.AbstractMesh) {
    return !!this.mesh && mesh.isDescendantOf(this.mesh);
  }

  // --- HIGHLIGHT ---
  select() {
    if (!this.mesh) return;
    const hl = this.getHighlightLayer();
    hl.addMesh(this.mesh as BABYLON.Mesh, BABYLON.Color3.Green());
    this.mesh
      .getChildMeshes()
      .forEach((m) => hl.addMesh(m as BABYLON.Mesh, BABYLON.Color3.Green()));
    Astronaut.selectedAstronaut = this;
  }

  deselect() {
    if (!this.mesh) return;
    const hl = this.getHighlightLayer();
    hl.removeMesh(this.mesh as BABYLON.Mesh);
    this.mesh.getChildMeshes().forEach((m) => hl.removeMesh(m as BABYLON.Mesh));

    if (Astronaut.selectedAstronaut === this) Astronaut.selectedAstronaut = null;
  }

  private getHighlightLayer() {
    if (!this._hl) this._hl = new BABYLON.HighlightLayer('hl', this.scene);
    return this._hl;
  }

  // --- PLAY ANIMATION ---
  playAnimation(name: string, loop = true) {
    this.animations.forEach((a) => a.stop());
    const ag = this.animations.get(name);
    ag?.start(loop);
  }

  // --- WALK TO TARGET WITH TERRAIN FOLLOW ---
  walkTo(target: BABYLON.Vector3, speed = 2, callback?: () => void, deselectOnComplete = false) {
    if (!this.mesh) return;

    // Cancel previous movement
    if (this.moveObserver) {
      this.scene.onBeforeRenderObservable.remove(this.moveObserver);
      this.moveObserver = undefined;
    }

    const walking = this.animations.get('Walking');
    const idle = this.animations.get('Idle');

    walking?.start(true);

    const stopDistance = 0.15;
    const forwardCorrection = Math.PI; // Mixamo -Z forward

    this.moveObserver = this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      const dir = target.subtract(this.mesh.position);
      const dirXZ = new BABYLON.Vector3(dir.x, 0, dir.z);
      const dist = dirXZ.length();

      if (dist <= stopDistance) {
        walking?.stop();
        idle?.start(true);

        this.scene.onBeforeRenderObservable.remove(this.moveObserver!);
        this.moveObserver = undefined;

        callback?.();
        if (deselectOnComplete) this.deselect();
        return;
      }

      dirXZ.normalize();

      // Rotate smoothly
      const targetYaw = Math.atan2(dirXZ.x, dirXZ.z) + forwardCorrection;
      const targetQuat = BABYLON.Quaternion.RotationYawPitchRoll(targetYaw, 0, 0);
      if (!this.mesh.rotationQuaternion)
        this.mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
      BABYLON.Quaternion.SlerpToRef(
        this.mesh.rotationQuaternion,
        targetQuat,
        dt * 5,
        this.mesh.rotationQuaternion
      );

      // Move step along X/Z
      const step = Math.min(speed * dt, dist);
      const nextPos = this.mesh.position.add(dirXZ.scale(step));

      // Follow terrain
      if (this.groundMesh) {
        nextPos.y = this.groundMesh.getHeightAtCoordinates(nextPos.x, nextPos.z) ?? nextPos.y;
      }

      this.mesh.position.copyFrom(nextPos);
    });
    this.deselect();
  }

  dig(position: BABYLON.Vector3) {
    console.log('Digging at', position);
    this.walkTo(
      position,
      2,
      () => {
        console.log('Finished digging at', position);
      },
      true
    );
  }

  build(position: BABYLON.Vector3) {
    console.log('Building at', position);
    this.walkTo(
      position,
      2,
      () => {
        console.log('Finished building at', position);
      },
      true
    );
  }
}
