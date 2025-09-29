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

  public static selectedAstronaut: Astronaut | null = null;
  public static allAstronauts: Astronaut[] = [];

  constructor(scene: BABYLON.Scene, groundMesh: BABYLON.GroundMesh) {
    this.scene = scene;
    this.groundMesh = groundMesh;
    Astronaut.allAstronauts.push(this);
  }

  async load(modelName: string = 'astronaut.glb', rootUrl: string = './models/') {
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, modelName, this.scene);

    this.mesh = result.meshes[0];
    this.mesh.isPickable = true;
    this.mesh.getChildMeshes().forEach((m) => (m.isPickable = true));
    this.mesh.ellipsoid = new BABYLON.Vector3(1.5, 4, 1.5);

    this.mesh.checkCollisions = true;

    result.animationGroups.forEach((ag) => this.animations.set(ag.name, ag));

    if (this.groundMesh) {
      this.mesh.position.y =
        this.groundMesh.getHeightAtCoordinates(this.mesh.position.x, this.mesh.position.z) ??
        this.mesh.position.y;
    }
  }

  containsMesh(mesh: BABYLON.AbstractMesh) {
    return !!this.mesh && mesh.isDescendantOf(this.mesh);
  }

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

  playAnimation(name: string, loop = true) {
    this.animations.forEach((a) => a.stop());
    const ag = this.animations.get(name);
    ag?.start(loop);
  }

  walkTo(
    target: BABYLON.Vector3,
    speed = 2,
    callback?: () => void,
    deselectOnComplete = false,
    obstacles: BABYLON.AbstractMesh[] = []
  ) {
    if (!this.mesh) return;

    if (this.moveObserver) {
      this.scene.onBeforeRenderObservable.remove(this.moveObserver);
      this.moveObserver = undefined;
    }

    const walking = this.animations.get('Walking');
    const idle = this.animations.get('Idle');

    walking?.start(true);

    const stopDistance = 0.15;
    const forwardCorrection = Math.PI;

    let lastPosition = this.mesh.position.clone();
    let stuckTime = 0;

    this.moveObserver = this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.scene.getEngine().getDeltaTime() / 1000;

      let dir = target.subtract(this.mesh.position);
      const dist = dir.length();

      // Target reached
      if (dist <= stopDistance) {
        walking?.stop();
        idle?.start(true);
        this.scene.onBeforeRenderObservable.remove(this.moveObserver!);
        this.moveObserver = undefined;
        callback?.();
        if (deselectOnComplete) this.deselect();
        return;
      }

      let dirXZ = new BABYLON.Vector3(dir.x, 0, dir.z).normalize();

      obstacles.forEach((obs) => {
        if (obs.intersectsMesh(this.mesh, false)) {
          const angle = Math.PI / 4;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          dirXZ = new BABYLON.Vector3(
            dirXZ.x * cos - dirXZ.z * sin,
            0,
            dirXZ.x * sin + dirXZ.z * cos
          ).normalize();
        }
      });

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

      const step = Math.min(speed * dt, dist);
      const nextPos = this.mesh.position.add(dirXZ.scale(step));

      if (this.groundMesh) {
        nextPos.y = this.groundMesh.getHeightAtCoordinates(nextPos.x, nextPos.z) ?? nextPos.y;
      }

      if (this.mesh.checkCollisions) {
        this.mesh.moveWithCollisions(nextPos.subtract(this.mesh.position));
      } else {
        this.mesh.position.copyFrom(nextPos);
      }

      const movedDistance = BABYLON.Vector3.Distance(this.mesh.position, lastPosition);
      if (movedDistance < 0.01) {
        stuckTime += dt;
        if (stuckTime >= 1) {
          walking?.stop();
          idle?.play();
          if (this.moveObserver) {
            this.scene.onBeforeRenderObservable.remove(this.moveObserver);
            this.moveObserver = undefined;
          }
          console.warn('Astronaut stopped: stuck for more than 1 second.');
          return;
        }
      } else {
        stuckTime = 0;
        walking?.start(true);
      }

      lastPosition.copyFrom(this.mesh.position);
    });
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
