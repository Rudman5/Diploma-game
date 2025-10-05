import * as BABYLON from '@babylonjs/core';
import { Rover } from './rover';
import { hideLeaveButton, showLeaveButton } from './createGui';

export class Astronaut {
  public mesh!: BABYLON.AbstractMesh;
  private skeleton?: BABYLON.Skeleton;
  private scene: BABYLON.Scene;
  private animations = new Map<string, BABYLON.AnimationGroup>();
  private moveObserver?: BABYLON.Observer<BABYLON.Scene>;
  private _hl?: BABYLON.HighlightLayer;
  private groundMesh?: BABYLON.GroundMesh;
  private crowdAgent?: number;

  public rover?: Rover;
  public id: string;

  public static allAstronauts: Astronaut[] = [];
  public static selectedAstronaut: Astronaut | null = null;

  constructor(scene: BABYLON.Scene, groundMesh: BABYLON.GroundMesh, id: string) {
    this.scene = scene;
    this.groundMesh = groundMesh;
    this.id = id;

    Astronaut.allAstronauts.push(this);
  }

  /** Load the 3D model and animations */
  async load(modelName = 'astronaut.glb', rootUrl = './models/') {
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

    this.addCrowdAgent();
  }

  addCrowdAgent() {
    if (this.crowdAgent) return;

    const scene: any = this.scene;
    const crowd: BABYLON.ICrowd | undefined = scene.crowd;
    const navPlugin: BABYLON.RecastJSPlugin | undefined = scene.navigationPlugin;

    if (!crowd || !navPlugin || !navPlugin.navMesh) return;

    let nearest = navPlugin.getClosestPoint(this.mesh.position);
    if (!nearest || !isFinite(nearest.x) || nearest.equals(BABYLON.Vector3.Zero())) {
      nearest = this.mesh.position.clone();
    }

    const agentParams: BABYLON.IAgentParameters = {
      radius: 1.5,
      height: 2,
      maxSpeed: 2,
      maxAcceleration: 8,
      collisionQueryRange: 10,
      pathOptimizationRange: 10,
      separationWeight: 10,
    };

    this.crowdAgent = crowd.addAgent(nearest, agentParams, this.mesh);
    crowd.agentTeleport(this.crowdAgent, nearest);
  }

  async walkTo(target: BABYLON.Vector3, speed = 2, callback?: () => void) {
    if (!this.mesh) return;

    const scene: any = this.scene;
    const navPlugin: BABYLON.RecastJSPlugin | undefined = scene.navigationPlugin;
    const crowd: BABYLON.ICrowd | undefined = scene.crowd;

    if (!navPlugin?.navMesh || !crowd) {
      console.warn('Crowd or navmesh not available.');
      return;
    }

    this.addCrowdAgent();
    const agent = this.crowdAgent!;

    let navTarget = navPlugin.getClosestPoint(target) ?? target.clone();
    const ground = scene.getMeshByName('ground') as any;
    if (ground?.getHeightAtCoordinates) {
      const gy = ground.getHeightAtCoordinates(navTarget.x, navTarget.z);
      if (typeof gy === 'number') navTarget.y = gy;
    }

    crowd.agentGoto(agent, navTarget);

    this.animations.get('Walking')?.start(true);

    if (this.moveObserver) scene.onBeforeRenderObservable.remove(this.moveObserver);
    this.moveObserver = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      crowd.update(dt);

      const pos = crowd.getAgentPosition(agent);
      if (pos) this.mesh.position.copyFrom(pos);

      const vel = crowd.getAgentVelocity(agent);
      const distanceToTarget = BABYLON.Vector3.Distance(this.mesh.position, navTarget);
      const threshold = 0.05;

      if (distanceToTarget < 1 || vel.length() < threshold) {
        this.animations.get('Walking')?.stop();
        this.animations.get('Idle')?.start(true);

        this.mesh.position.copyFrom(navTarget);
        callback?.();

        scene.onBeforeRenderObservable.remove(this.moveObserver!);
        this.moveObserver = undefined;
      } else if (vel.length() > threshold) {
        const dirXZ = new BABYLON.Vector3(vel.x, 0, vel.z).normalize();
        const targetYaw = Math.atan2(dirXZ.x, dirXZ.z) + Math.PI;
        if (!this.mesh.rotationQuaternion)
          this.mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
        BABYLON.Quaternion.SlerpToRef(
          this.mesh.rotationQuaternion,
          BABYLON.Quaternion.RotationYawPitchRoll(targetYaw, 0, 0),
          0.1,
          this.mesh.rotationQuaternion
        );
      }
    });
  }

  stopWalk() {
    const scene: any = this.scene;
    if (this.moveObserver) {
      scene.onBeforeRenderObservable.remove(this.moveObserver);
      this.moveObserver = undefined;
    }

    const crowd: BABYLON.ICrowd | undefined = scene.crowd;
    if (crowd && this.crowdAgent != null) {
      crowd.removeAgent(this.crowdAgent);
      this.crowdAgent = undefined;
    }

    this.animations.get('Walking')?.stop();
    this.animations.get('Idle')?.start(true);
  }

  enterRover(rover: Rover) {
    if (!this.mesh) return;
    this.rover = rover;
    rover.occupiedBy = this;

    this.mesh.parent = rover.mesh;
    this.mesh.setEnabled(false);
    showLeaveButton();
  }

  exitRover() {
    if (!this.rover) return;
    if (this.rover.engineSound) {
      this.rover.engineSound.stop();
    }
    const rover = this.rover;
    const scene: any = this.scene;

    const hlRover = rover['_hl'] as BABYLON.HighlightLayer | undefined;
    if (hlRover) {
      hlRover.removeMesh(this.mesh as BABYLON.Mesh);
      this.mesh.getChildMeshes().forEach((m) => hlRover.removeMesh(m as BABYLON.Mesh));
    }

    if (Rover.selectedRover === rover) rover.deselect();

    const center = rover.mesh.getAbsolutePosition();
    const rightDir = new BABYLON.Vector3(3, 0, 0);
    const distance = 7;
    const exitWorld = center.add(rightDir.normalize().scale(distance));

    const ground = scene.getMeshByName('ground') as any;
    if (ground && typeof ground.getHeightAtCoordinates === 'function') {
      const gy = ground.getHeightAtCoordinates(exitWorld.x, exitWorld.z);
      exitWorld.y = typeof gy === 'number' ? gy + 0.05 : rover.mesh.position.y;
    } else {
      exitWorld.y = rover.mesh.position.y;
    }

    this.mesh.parent = null;
    this.mesh.setEnabled(true);
    rover.occupiedBy = undefined;
    this.rover = undefined;

    this.addCrowdAgent();

    const crowd: BABYLON.ICrowd | undefined = scene.crowd;
    if (crowd && this.crowdAgent) {
      crowd.agentTeleport(this.crowdAgent, exitWorld);
    }

    hideLeaveButton();
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
}
