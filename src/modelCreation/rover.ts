import * as BABYLON from '@babylonjs/core';
import { Astronaut } from './astronaut';
import { hideLeaveButton, showLeaveButton, updateResourceInfo } from '../core/createGui';
import { extendedScene } from '../types';

export class Rover {
  public static mainRover: Rover;
  public mesh!: BABYLON.AbstractMesh;
  private scene: extendedScene;
  private groundMesh?: BABYLON.GroundMesh;
  private crowdAgent?: number;
  private moveObserver?: BABYLON.Observer<BABYLON.Scene>;
  private _hl?: BABYLON.HighlightLayer;
  public resources = {
    oxygen: 0,
    food: 0,
    water: 0,
  };
  private resourceCapacity = {
    oxygen: 500,
    food: 500,
    water: 500,
  };

  public engineSound?: BABYLON.StaticSound;
  public occupiedBy: Astronaut[] = [];
  public static selectedRover: Rover | null = null;

  constructor(scene: extendedScene, groundMesh: BABYLON.GroundMesh) {
    this.scene = scene;
    this.groundMesh = groundMesh;
    Rover.mainRover = this;
  }

  async load(modelName: string = 'artemisRover.glb', rootUrl: string = './buildModels/') {
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, modelName, this.scene);

    this.mesh = result.meshes[0];
    this.mesh.isPickable = true;
    this.mesh.getChildMeshes().forEach((m) => (m.isPickable = true));
    this.mesh.checkCollisions = true;

    if (this.groundMesh) {
      const groundY = this.groundMesh.getHeightAtCoordinates(
        this.mesh.position.x,
        this.mesh.position.z
      );
      if (typeof groundY === 'number') this.mesh.position.y = groundY;
    }

    await this.loadEngineSound();
  }

  addCrowdAgent() {
    if (this.crowdAgent) return;

    const scene = this.scene;
    const crowd: BABYLON.ICrowd | undefined = scene.crowd;
    const navPlugin: BABYLON.RecastJSPlugin | undefined = scene.navigationPlugin;
    if (!crowd || !navPlugin?.navMesh) return;

    let nearest = navPlugin.getClosestPoint(this.mesh.position);
    if (!nearest || !isFinite(nearest.x) || nearest.equals(BABYLON.Vector3.Zero())) {
      nearest = this.mesh.position.clone();
    }

    const agentParams: BABYLON.IAgentParameters = {
      radius: 4,
      height: 2,
      maxSpeed: 12,
      maxAcceleration: 8,
      collisionQueryRange: 10,
      pathOptimizationRange: 10,
      separationWeight: 4,
    };

    this.crowdAgent = crowd.addAgent(nearest, agentParams, this.mesh);
    crowd.agentTeleport(this.crowdAgent, nearest);

    if (this.crowdAgent >= 0) {
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      crowd.update(dt);
    }
  }

  async driveTo(target: BABYLON.Vector3, callback?: () => void, deselectOnComplete = false) {
    if (!this.mesh) return;

    const scene = this.scene;
    const navPlugin: BABYLON.RecastJSPlugin | undefined = scene.navigationPlugin;
    const crowd: BABYLON.ICrowd | undefined = scene.crowd;
    if (!navPlugin?.navMesh || !crowd) {
      console.warn('Crowd or navmesh not available.');
      return;
    }

    this.addCrowdAgent();
    const agent = this.crowdAgent!;
    const ground = scene.getMeshByName('ground') as BABYLON.GroundMesh;
    const particles = new BABYLON.ParticleSystem('particles', 1000, scene);
    particles.emitter = this.mesh;

    particles.particleTexture = new BABYLON.Texture(
      'https://assets.babylonjs.com/textures/flare.png',
      scene
    );
    particles.minSize = 1;
    particles.maxSize = 1.25;
    particles.maxLifeTime = 0.5;
    particles.emitRate = 50;

    particles.start();
    const navTarget = navPlugin.getClosestPoint(target) ?? target.clone();
    if (ground?.getHeightAtCoordinates) {
      const gy = ground.getHeightAtCoordinates(navTarget.x, navTarget.z);
      if (typeof gy === 'number') navTarget.y = gy;
    }

    crowd.agentGoto(agent, navTarget);
    if (this.engineSound) this.engineSound.play();

    if (this.moveObserver) scene.onBeforeRenderObservable.remove(this.moveObserver);

    const smoothDir = new BABYLON.Vector3();

    this.moveObserver = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      crowd.update(dt);

      const pos = crowd.getAgentPosition(agent);
      if (pos) {
        this.mesh.position.copyFrom(pos);
        const gy = ground?.getHeightAtCoordinates?.(pos.x, pos.z);
        if (typeof gy === 'number') this.mesh.position.y = gy;
      }

      const vel = crowd.getAgentVelocity(agent);
      if (!vel) return;

      const velXZ = new BABYLON.Vector3(vel.x, 0, vel.z);
      const velLen = velXZ.length();

      BABYLON.Vector3.LerpToRef(smoothDir, velXZ, 0.25, smoothDir);

      if (smoothDir.length() > 0.05) {
        const dirNorm = smoothDir.normalize();
        const targetYaw = Math.atan2(dirNorm.x, dirNorm.z);
        if (!this.mesh.rotationQuaternion)
          this.mesh.rotationQuaternion = BABYLON.Quaternion.Identity();

        BABYLON.Quaternion.SlerpToRef(
          this.mesh.rotationQuaternion,
          BABYLON.Quaternion.RotationYawPitchRoll(targetYaw, 0, 0),
          0.2,
          this.mesh.rotationQuaternion
        );
      }

      const distanceToTarget = BABYLON.Vector3.Distance(this.mesh.position, navTarget);
      const arriveDist = 1.5;
      const speedThreshold = 0.05;

      if (distanceToTarget < arriveDist || velLen < speedThreshold) {
        particles.stop();
        if (this.engineSound) this.engineSound.stop();

        scene.onBeforeRenderObservable.remove(this.moveObserver!);
        this.moveObserver = undefined;

        callback?.();
        if (deselectOnComplete) this.deselect();
      }
    });
  }

  stopMove() {
    const scene = this.scene;
    if (this.moveObserver) {
      scene.onBeforeRenderObservable.remove(this.moveObserver);
      this.moveObserver = undefined;
    }

    const crowd: BABYLON.ICrowd | undefined = scene.crowd;
    if (crowd && this.crowdAgent != null) {
      crowd.removeAgent(this.crowdAgent);
      this.crowdAgent = undefined;
    }

    if (this.engineSound) this.engineSound.stop();
  }

  async loadEngineSound() {
    const sound = await BABYLON.CreateSoundAsync('roverEngine', './sounds/roverSound.mp3', {
      loop: true,
      autoplay: false,
      volume: 0.5,
    });
    this.engineSound = sound;
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
    Rover.selectedRover = this;
    updateResourceInfo(this);
    if (this.occupiedBy.length > 0) showLeaveButton();
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

  addOccupant(astronaut: Astronaut) {
    this.occupiedBy.push(astronaut);
    return true;
  }

  removeOccupant(astronaut: Astronaut) {
    this.occupiedBy = this.occupiedBy.filter((a) => a !== astronaut);
  }

  getResources() {
    return { ...this.resources };
  }

  refillResource(type: keyof typeof this.resources, amount: number): number {
    if (amount <= 0) return 0;

    const before = this.resources[type];
    this.resources[type] = Math.min(this.resourceCapacity[type], this.resources[type] + amount);
    const actualRefilled = this.resources[type] - before;

    return actualRefilled;
  }

  consumeResource(type: keyof typeof this.resources, amount: number) {
    const available = this.resources[type];
    const consumed = Math.min(available, amount);
    this.resources[type] -= consumed;
    return consumed;
  }

  hasResources(amounts: Partial<typeof this.resources>) {
    for (const key in amounts) {
      const k = key as keyof typeof this.resources;
      if (this.resources[k] < (amounts[k] ?? 0)) return false;
    }
    return true;
  }
}
