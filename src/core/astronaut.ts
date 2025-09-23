import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { Selectable } from './selectionManager';

export class Astronaut implements Selectable {
  public mesh!: BABYLON.AbstractMesh;
  public skeleton?: BABYLON.Skeleton;
  private scene: BABYLON.Scene;
  private animations = new Map<string, BABYLON.AnimationGroup>();
  private moveObserver?: BABYLON.Observer<BABYLON.Scene>;
  private groundMesh?: BABYLON.GroundMesh;

  private static _highlightLayer?: BABYLON.HighlightLayer;
  private _tmpDir = new BABYLON.Vector3();
  private _tmpDirXZ = new BABYLON.Vector3();
  private _tmpNextPos = new BABYLON.Vector3();
  private _tmpQuat = new BABYLON.Quaternion();

  constructor(scene: BABYLON.Scene, groundMesh?: BABYLON.GroundMesh) {
    this.scene = scene;
    this.groundMesh = groundMesh;
    if (!Astronaut._highlightLayer) {
      Astronaut._highlightLayer = new BABYLON.HighlightLayer('hl', this.scene);
    }
  }

  // --- LOAD MODEL ---
  async load(modelName: string = 'astronaut.glb', rootUrl: string = './models/') {
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, modelName, this.scene);
    this.mesh = result.meshes[0];
    this.mesh.isPickable = true;
    this.mesh.metadata = { selectable: this };

    this.mesh.getChildMeshes().forEach((m) => {
      m.isPickable = true;
      m.metadata = { selectable: this };
    });

    result.animationGroups.forEach((ag) => this.animations.set(ag.name, ag));

    // Place on ground if available
    if (this.groundMesh) {
      this.mesh.position.y =
        this.groundMesh.getHeightAtCoordinates(this.mesh.position.x, this.mesh.position.z) ??
        this.mesh.position.y;
    }
  }

  // --- SELECTION ---
  select() {
    const hl = Astronaut._highlightLayer!;
    hl.addMesh(this.mesh as BABYLON.Mesh, BABYLON.Color3.Green());
    this.mesh
      .getChildMeshes()
      .forEach((m) => hl.addMesh(m as BABYLON.Mesh, BABYLON.Color3.Green()));
  }

  deselect() {
    const hl = Astronaut._highlightLayer!;
    hl.removeMesh(this.mesh as BABYLON.Mesh);
    this.mesh.getChildMeshes().forEach((m) => hl.removeMesh(m as BABYLON.Mesh));
  }

  // --- PLAY ANIMATION ---
  playAnimation(name: string, loop = true) {
    const current = Array.from(this.animations.values()).find((a) => a.isPlaying);
    current?.stop();
    const ag = this.animations.get(name);
    ag?.start(loop);
  }

  // --- WALK TO TARGET WITH TERRAIN FOLLOW ---
  walkTo(target: BABYLON.Vector3, speed = 2, callback?: () => void) {
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

      // Direction to target
      target.subtractToRef(this.mesh.position, this._tmpDir);
      this._tmpDirXZ.set(this._tmpDir.x, 0, this._tmpDir.z);
      const dist = this._tmpDirXZ.length();

      if (dist <= stopDistance) {
        walking?.stop();
        idle?.start(true);
        this.scene.onBeforeRenderObservable.remove(this.moveObserver!);
        this.moveObserver = undefined;
        callback?.();
        return;
      }

      this._tmpDirXZ.normalize();

      // Rotate smoothly
      BABYLON.Quaternion.RotationYawPitchRollToRef(
        Math.atan2(this._tmpDirXZ.x, this._tmpDirXZ.z) + forwardCorrection,
        0,
        0,
        this._tmpQuat
      );

      if (!this.mesh.rotationQuaternion)
        this.mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
      BABYLON.Quaternion.SlerpToRef(
        this.mesh.rotationQuaternion,
        this._tmpQuat,
        dt * 5,
        this.mesh.rotationQuaternion
      );

      // Move step along X/Z
      const step = Math.min(speed * dt, dist);
      this.mesh.position.addToRef(this._tmpDirXZ.scale(step), this._tmpNextPos);

      // Follow terrain
      if (this.groundMesh) {
        this._tmpNextPos.y =
          this.groundMesh.getHeightAtCoordinates(this._tmpNextPos.x, this._tmpNextPos.z) ??
          this._tmpNextPos.y;
      }
      this.mesh.position.copyFrom(this._tmpNextPos);
    });
  }
}
