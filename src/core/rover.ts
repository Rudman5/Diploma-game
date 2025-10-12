import * as BABYLON from '@babylonjs/core';
import { Astronaut } from './astronaut';
import { hideLeaveButton, showLeaveButton, updateResourceInfo } from './createGui';

export class Rover {
  public mesh!: BABYLON.AbstractMesh;
  private scene: BABYLON.Scene;
  private groundMesh?: BABYLON.GroundMesh;
  private crowdAgent?: number;
  private moveObserver?: BABYLON.Observer<BABYLON.Scene>;
  private _hl?: BABYLON.HighlightLayer;
  private resources = {
    oxygen: 500,
    food: 500,
    water: 500,
  };
  private resourceCapacity = {
    oxygen: 500,
    food: 500,
    water: 500,
  };

  public engineSound?: BABYLON.StaticSound;
  public occupiedBy: Astronaut[] = [];
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
      const groundY = this.groundMesh.getHeightAtCoordinates(
        this.mesh.position.x,
        this.mesh.position.z
      );
      if (typeof groundY === 'number') this.mesh.position.y = groundY;
    }

    await this.loadEngineSound();
    this.addCrowdAgent();
  }

  addCrowdAgent() {
    if (this.crowdAgent) return;

    const scene: any = this.scene;
    const crowd: BABYLON.ICrowd | undefined = scene.crowd;
    const navPlugin: BABYLON.RecastJSPlugin | undefined = scene.navigationPlugin;
    if (!crowd || !navPlugin?.navMesh) return;

    let nearest = navPlugin.getClosestPoint(this.mesh.position);
    if (!nearest || !isFinite(nearest.x) || nearest.equals(BABYLON.Vector3.Zero())) {
      nearest = this.mesh.position.clone();
    }

    const agentParams: BABYLON.IAgentParameters = {
      radius: 3,
      height: 2,
      maxSpeed: 10,
      maxAcceleration: 8,
      collisionQueryRange: 20,
      pathOptimizationRange: 20,
      separationWeight: 5,
    };

    this.crowdAgent = crowd.addAgent(nearest, agentParams, this.mesh);
    crowd.agentTeleport(this.crowdAgent, nearest);
  }

  async driveTo(
    target: BABYLON.Vector3,
    speed = 12,
    callback?: () => void,
    deselectOnComplete = false
  ) {
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
    const ground = scene.getMeshByName('ground') as any;

    let navTarget = navPlugin.getClosestPoint(target) ?? target.clone();
    if (ground?.getHeightAtCoordinates) {
      const gy = ground.getHeightAtCoordinates(navTarget.x, navTarget.z);
      if (typeof gy === 'number') navTarget.y = gy;
    }

    crowd.agentGoto(agent, navTarget);
    if (this.engineSound) this.engineSound.play();

    if (this.moveObserver) scene.onBeforeRenderObservable.remove(this.moveObserver);

    // For smoothing rotation around obstacles
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
        if (this.engineSound) this.engineSound.stop();

        // Stop rotation and clean up safely
        this.mesh.position.copyFrom(navTarget);

        if (crowd && this.crowdAgent != null) {
          crowd.removeAgent(this.crowdAgent);
          this.crowdAgent = undefined;
        }

        scene.onBeforeRenderObservable.remove(this.moveObserver!);
        this.moveObserver = undefined;

        callback?.();
        if (deselectOnComplete) this.deselect();
      }
    });
  }

  stopMove() {
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

  refillResource(type: keyof typeof this.resources, amount: number) {
    this.resources[type] = Math.min(this.resourceCapacity[type], this.resources[type] + amount);
  }

  consumeResource(type: keyof typeof this.resources, amount: number) {
    const available = this.resources[type];
    const consumed = Math.min(available, amount);
    this.resources[type] -= consumed;
    return consumed; // how much we actually could provide
  }

  hasResources(amounts: Partial<typeof this.resources>) {
    for (const key in amounts) {
      const k = key as keyof typeof this.resources;
      if (this.resources[k] < (amounts[k] ?? 0)) return false;
    }
    return true;
  }
}
