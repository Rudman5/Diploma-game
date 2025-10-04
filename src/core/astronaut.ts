import * as BABYLON from '@babylonjs/core';

export class Astronaut {
  public mesh!: BABYLON.AbstractMesh;
  public skeleton?: BABYLON.Skeleton;
  private scene: BABYLON.Scene;
  private animations = new Map<string, BABYLON.AnimationGroup>();
  private moveObserver?: BABYLON.Observer<BABYLON.Scene>;
  private _hl?: BABYLON.HighlightLayer;
  private groundMesh?: BABYLON.GroundMesh;
  private crowdAgent?: number;
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
      this.mesh.rotation.y = Math.PI;
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

  async walkTo(
    target: BABYLON.Vector3,
    speed = 2,
    callback?: () => void,
    deselectOnComplete = false
  ) {
    if (!this.mesh) return;

    const scene = this.scene;
    const navPlugin: BABYLON.RecastJSPlugin | undefined = (scene as any).navigationPlugin;
    const crowd: BABYLON.ICrowd | undefined = (scene as any).crowd;

    if (!navPlugin || !navPlugin.navMesh) {
      console.warn('NavMesh not available, falling back to manual walk.');
      return;
    }

    if (!crowd) {
      console.warn('Crowd system not created.');
      return;
    }

    let agent = this.crowdAgent;
    const agentParams: BABYLON.IAgentParameters = {
      radius: 1.5,
      height: 2,
      maxSpeed: speed,
      maxAcceleration: 8,
      collisionQueryRange: 10,
      pathOptimizationRange: 10,
      separationWeight: 5,
    };

    const start = this.mesh.position.clone();

    if (!agent) {
      let nearest = navPlugin.getClosestPoint(start);
      if (!nearest || !isFinite(nearest.x) || nearest.equals(BABYLON.Vector3.Zero())) {
        nearest = start.clone();
      }

      agent = crowd.addAgent(nearest, agentParams, this.mesh);
      this.crowdAgent = agent;
    }

    let navTarget = navPlugin.getClosestPoint(target);
    if (!navTarget || !isFinite(navTarget.x) || navTarget.equals(BABYLON.Vector3.Zero())) {
      navTarget = target.clone();
      const ground = scene.getMeshByName('ground') as any;
      if (ground && typeof ground.getHeightAtCoordinates === 'function') {
        const gy = ground.getHeightAtCoordinates(navTarget.x, navTarget.z);
        if (typeof gy === 'number') navTarget.y = gy;
      }
    }

    crowd.agentGoto(agent, navTarget);

    const walking = this.animations.get('Walking');
    const idle = this.animations.get('Idle');
    walking?.start(true);

    if (this.moveObserver) {
      scene.onBeforeRenderObservable.remove(
        this.moveObserver as BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>>
      );
      this.moveObserver = undefined;
    }

    this.moveObserver = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      crowd.update(dt);

      const agentPos = crowd.getAgentPosition(agent);
      if (agentPos) {
        this.mesh.position.copyFrom(agentPos);

        const groundY = (scene.getMeshByName('ground') as any)?.getHeightAtCoordinates?.(
          agentPos.x,
          agentPos.z
        );
        if (typeof groundY === 'number') this.mesh.position.y = groundY;
      }

      const vel = crowd.getAgentVelocity(agent);
      const speedThreshold = 0.01;
      const distanceToTarget = BABYLON.Vector3.Distance(this.mesh.position, navTarget);

      if (distanceToTarget < 0.2 || vel.length() < speedThreshold) {
        walking?.stop();
        idle?.start(true);

        this.mesh.position.copyFrom(navTarget);

        if (callback) callback();
        if (deselectOnComplete) this.deselect();

        scene.onBeforeRenderObservable.remove(this.moveObserver!);
        this.moveObserver = undefined;
        return;
      }

      if (vel.length() > speedThreshold) {
        const dirXZ = new BABYLON.Vector3(vel.x, 0, vel.z).normalize();
        const mixamoForwardOffset = Math.PI;
        const targetYaw = Math.atan2(dirXZ.x, dirXZ.z) + mixamoForwardOffset;
        const targetQuat = BABYLON.Quaternion.RotationYawPitchRoll(targetYaw, 0, 0);

        if (!this.mesh.rotationQuaternion)
          this.mesh.rotationQuaternion = BABYLON.Quaternion.Identity();

        BABYLON.Quaternion.SlerpToRef(
          this.mesh.rotationQuaternion,
          targetQuat,
          0.1,
          this.mesh.rotationQuaternion
        );
      }
    });
  }
  stopWalk() {
    if (this.moveObserver) {
      this.scene.onBeforeRenderObservable.remove(this.moveObserver);
      this.moveObserver = undefined;
    }

    const crowd: BABYLON.ICrowd | undefined = (this.scene as any).crowd;
    const agent = this.crowdAgent;
    if (crowd && agent !== undefined && agent !== null) {
      crowd.removeAgent(agent);
      this.crowdAgent = undefined;
    }

    this.animations.get('Walking')?.stop();
    this.animations.get('Idle')?.start(true);
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
