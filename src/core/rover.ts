import * as BABYLON from '@babylonjs/core';
import { Astronaut } from './astronaut';
import { hideLeaveButton, showLeaveButton } from './createGui';

export class Rover {
  public mesh!: BABYLON.AbstractMesh;
  private scene: BABYLON.Scene;
  private moveObserver?: BABYLON.Observer<BABYLON.Scene>;
  private _hl?: BABYLON.HighlightLayer;
  private groundMesh?: BABYLON.GroundMesh;
  private crowdAgent?: number;
  private engineSound?: BABYLON.StaticSound;

  public occupiedBy: Astronaut | null = null;
  public static selectedRover: Rover | null = null;

  constructor(scene: BABYLON.Scene, groundMesh: BABYLON.GroundMesh) {
    this.scene = scene;
    this.groundMesh = groundMesh;
  }

  async load(modelName: string = 'artemisRover.glb', rootUrl: string = './buildModels/') {
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, modelName, this.scene);

    this.mesh = result.meshes[0];
    this.mesh.isPickable = true;
    this.mesh.getChildMeshes().forEach((m) => (m.isPickable = true));
    this.mesh.checkCollisions = true;
    if (this.groundMesh) {
      this.mesh.position.y =
        this.groundMesh.getHeightAtCoordinates(this.mesh.position.x, this.mesh.position.z) ??
        this.mesh.position.y;
    }
    await this.loadEngineSound();
  }

  containsMesh(mesh: BABYLON.AbstractMesh) {
    return !!this.mesh && mesh.isDescendantOf(this.mesh);
  }

  async select() {
    if (!this.mesh) return;
    if (this.engineSound) this.engineSound.play();

    const hl = this.getHighlightLayer();
    hl.addMesh(this.mesh as BABYLON.Mesh, BABYLON.Color3.Green());
    this.mesh
      .getChildMeshes()
      .forEach((m) => hl.addMesh(m as BABYLON.Mesh, BABYLON.Color3.Green()));
    Rover.selectedRover = this;
    showLeaveButton();
  }

  deselect() {
    if (!this.mesh) return;
    const hl = this.getHighlightLayer();
    hl.removeMesh(this.mesh as BABYLON.Mesh);
    this.mesh.getChildMeshes().forEach((m) => hl.removeMesh(m as BABYLON.Mesh));

    if (Rover.selectedRover === this) Rover.selectedRover = null;
    hideLeaveButton();
  }

  private getHighlightLayer() {
    if (!this._hl) this._hl = new BABYLON.HighlightLayer('hl_rover', this.scene);
    return this._hl;
  }

  async driveTo(
    target: BABYLON.Vector3,
    speed = 3,
    callback?: () => void,
    deselectOnComplete = false
  ) {
    if (!this.mesh) return;

    const scene = this.scene;
    const navPlugin: BABYLON.RecastJSPlugin | undefined = (scene as any).navigationPlugin;
    const crowd: BABYLON.ICrowd | undefined = (scene as any).crowd;

    if (!navPlugin || !navPlugin.navMesh) {
      console.warn('NavMesh not available, falling back to direct move.');
      return;
    }

    if (!crowd) {
      console.warn('Crowd system not initialized.');
      return;
    }

    let agent = this.crowdAgent;
    const agentParams: BABYLON.IAgentParameters = {
      radius: 2,
      height: 2,
      maxSpeed: speed,
      maxAcceleration: 10,
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
    if (this.moveObserver) {
      scene.onBeforeRenderObservable.remove(this.moveObserver);
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
      const distanceToTarget = BABYLON.Vector3.Distance(this.mesh.position, navTarget);
      const speedThreshold = 0.05;

      if (distanceToTarget < 0.3 || vel.length() < speedThreshold) {
        this.mesh.position.copyFrom(navTarget);
        if (this.engineSound) {
          this.engineSound.stop();
        }
        if (callback) callback();
        if (deselectOnComplete) this.deselect();

        scene.onBeforeRenderObservable.remove(this.moveObserver!);
        this.moveObserver = undefined;
        return;
      }

      if (vel.length() > speedThreshold) {
        const dirXZ = new BABYLON.Vector3(vel.x, 0, vel.z).normalize();
        if (dirXZ.length() > 0) {
          const targetYaw = Math.atan2(dirXZ.x, dirXZ.z); // keep Z-forward
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
      }
    });
  }

  stopMove() {
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
  }
  async loadEngineSound() {
    if (!this.mesh) return;

    const sound = await BABYLON.CreateSoundAsync('roverEngine', './sounds/roverSound.mp3', {
      loop: true,
      autoplay: false,
      volume: 0.5,
    });

    this.engineSound = sound;
  }
}
