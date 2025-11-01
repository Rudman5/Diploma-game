import * as BABYLON from '@babylonjs/core';
import { Rover } from './rover';
import { hideLeaveButton, showLeaveButton } from '../core/createGui';
import { extendedScene, InteractionTarget } from '../types';
import { Rock } from '../types';
import { showAlert } from '../core/alertSystem';
import { gameOver } from '../core/App';

export class Astronaut {
  public mesh!: BABYLON.AbstractMesh;
  private scene: extendedScene;
  private animations = new Map<string, BABYLON.AnimationGroup>();
  private moveObserver?: BABYLON.Observer<BABYLON.Scene>;
  private _hl?: BABYLON.HighlightLayer;
  private groundMesh?: BABYLON.GroundMesh;
  private crowdAgent?: number;
  private shovelParts?: BABYLON.AbstractMesh[];
  public walkingSound?: BABYLON.StaticSound;
  public diggingSound?: BABYLON.StaticSound;
  private resources = {
    oxygen: 100,
    food: 100,
    water: 100,
  };
  private resourceConsumptionRates = {
    oxygen: 0.2,
    food: 0.1,
    water: 0.02,
  };
  private criticalThresholds = {
    oxygen: 20,
    food: 10,
    water: 15,
  };

  private resourceObserver?: BABYLON.Observer<BABYLON.Scene>;

  public isAlive = true;
  public rover?: Rover;
  public id: string;
  public name: string;

  public static allAstronauts: Astronaut[] = [];
  public static selectedAstronaut: Astronaut | null = null;

  constructor(scene: extendedScene, groundMesh: BABYLON.GroundMesh, id: string, name: string) {
    this.scene = scene;
    this.groundMesh = groundMesh;
    this.id = id;
    this.name = name;

    Astronaut.allAstronauts.push(this);
  }

  async load(modelName = 'astronautLatest.glb', rootUrl = './models/') {
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
    this.shovelParts = this.mesh.getChildMeshes().filter((m) => m.name.startsWith('Shovel_'));
    this.hideShovel();
    await this.loadWalkingSound();
    await this.loadDiggingSound();
  }

  addCrowdAgent() {
    if (this.crowdAgent) return;

    const scene = this.scene;
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
      separationWeight: 1,
    };

    this.crowdAgent = crowd.addAgent(nearest, agentParams, this.mesh);
    crowd.agentTeleport(this.crowdAgent, nearest);
    if (this.crowdAgent >= 0) {
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      crowd.update(dt);
    }
  }
  async walkTo(
    target: BABYLON.Vector3 | InteractionTarget,
    callback?: () => void,
    arrivalDistance: number = 2.0
  ) {
    if (!this.mesh) return;
    this.stopWalk();

    const scene = this.scene;
    const particles = new BABYLON.ParticleSystem('particles', 1000, scene);
    particles.emitter = this.mesh;

    particles.particleTexture = new BABYLON.Texture(
      'https://assets.babylonjs.com/textures/flare.png',
      scene
    );
    particles.minSize = 0;
    particles.maxSize = 0.25;
    particles.maxLifeTime = 0.5;
    particles.emitRate = 50;

    particles.start();
    const navPlugin: BABYLON.RecastJSPlugin | undefined = scene.navigationPlugin;
    const crowd: BABYLON.ICrowd | undefined = scene.crowd;

    if (!navPlugin?.navMesh || !crowd) {
      return;
    }

    this.addCrowdAgent();
    const agent = this.crowdAgent!;

    let interactionTarget: InteractionTarget | null = null;
    let navTarget: BABYLON.Vector3;

    if (this.isInteractionTarget(target)) {
      interactionTarget = target;
      navTarget = navPlugin.getClosestPoint(target.position) || target.position.clone();
    } else {
      navTarget = navPlugin.getClosestPoint(target) || target.clone();
    }

    const ground = scene.getMeshByName('ground') as BABYLON.GroundMesh;
    if (ground?.getHeightAtCoordinates) {
      const groundY = ground.getHeightAtCoordinates(navTarget.x, navTarget.z);
      if (typeof groundY === 'number') navTarget.y = groundY;
    }

    crowd.agentGoto(agent, navTarget);
    this.playAnimation('Walking');
    this.walkingSound!.play();

    let stuckCounter = 0;
    const lastPosition = this.mesh.position.clone();
    const stuckThreshold = 5.0;

    this.moveObserver = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      crowd.update(dt);

      const pos = crowd.getAgentPosition(agent);
      if (pos) {
        this.mesh.position.copyFrom(pos);
      }

      const vel = crowd.getAgentVelocity(agent);

      const velXZ = new BABYLON.Vector3(vel.x, 0, vel.z);
      const velLen = velXZ.length();
      if (velLen > 0.05) {
        const targetYaw = Math.atan2(velXZ.x, velXZ.z) + Math.PI;
        if (!this.mesh.rotationQuaternion)
          this.mesh.rotationQuaternion = BABYLON.Quaternion.Identity();

        BABYLON.Quaternion.SlerpToRef(
          this.mesh.rotationQuaternion,
          BABYLON.Quaternion.RotationYawPitchRoll(targetYaw, 0, 0),
          0.2,
          this.mesh.rotationQuaternion
        );
      }

      if (interactionTarget) {
        const distanceToNavTarget = BABYLON.Vector3.Distance(this.mesh.position, navTarget);
        if (distanceToNavTarget <= interactionTarget.interactionRadius) {
          this.stopWalk();
          particles.stop();
          interactionTarget.onInteract(this);
          callback?.();
          return;
        }

        const velocity = crowd.getAgentVelocity(agent);
        if (distanceToNavTarget < 1.0 && velocity && velocity.length() < 0.1) {
          this.stopWalk();
          particles.stop();
          interactionTarget.onInteract(this);
          callback?.();
          return;
        }
      }

      const distanceToNavTarget = BABYLON.Vector3.Distance(this.mesh.position, navTarget);
      if (!interactionTarget && distanceToNavTarget < arrivalDistance) {
        this.stopWalk();
        particles.stop();
        callback?.();
        return;
      }

      const distanceMoved = BABYLON.Vector3.Distance(this.mesh.position, lastPosition);
      if (distanceMoved < 0.1) {
        stuckCounter += dt;
      } else {
        stuckCounter = 0;
        lastPosition.copyFrom(this.mesh.position);
      }

      if (interactionTarget && stuckCounter > stuckThreshold) {
        const distanceToTarget = BABYLON.Vector3.Distance(
          this.mesh.position,
          interactionTarget.position
        );
        if (distanceToTarget <= interactionTarget.interactionRadius * 2) {
          this.stopWalk();

          particles.stop();

          interactionTarget.onInteract(this);
          callback?.();
        }
      }
    });
  }

  private isInteractionTarget(
    target: BABYLON.Vector3 | InteractionTarget
  ): target is InteractionTarget {
    return (
      target &&
      typeof target === 'object' &&
      'interactionRadius' in target &&
      'onInteract' in target
    );
  }

  walkToRover(rover: Rover, callback?: () => void) {
    const interactionTarget = {
      position: rover.mesh.getAbsolutePosition(),
      interactionRadius: 6.0,
      onInteract: (astronaut: Astronaut) => {
        rover.addOccupant(astronaut);
        astronaut.enterRover(rover);
      },
      type: 'rover',
    };

    this.walkTo(interactionTarget, callback);
  }

  walkToRock(rock: Rock, callback?: () => void) {
    const interactionTarget = {
      position: rock.mesh.position,
      interactionRadius: rock.rockType === 'rockLarge' ? 5 : 3,
      onInteract: (astronaut: Astronaut) => {
        const rockManager = this.scene.rockManager;
        if (rockManager) {
          rockManager.startDigging(astronaut, rock);
        }
        callback?.();
      },
      type: 'rock',
    };

    this.walkTo(interactionTarget, callback);
  }

  stopWalk() {
    this.walkingSound?.stop();

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

    this.playAnimation('Idle');
  }

  enterRover(rover: Rover) {
    if (!this.mesh) return;
    this.rover = rover;
    rover.addOccupant(this);

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
    const scene = this.scene;

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

    const ground = scene.getMeshByName('ground') as BABYLON.GroundMesh;
    if (ground && typeof ground.getHeightAtCoordinates === 'function') {
      const gy = ground.getHeightAtCoordinates(exitWorld.x, exitWorld.z);
      exitWorld.y = typeof gy === 'number' ? gy + 0.05 : rover.mesh.position.y;
    } else {
      exitWorld.y = rover.mesh.position.y;
    }

    this.mesh.parent = null;
    this.mesh.setEnabled(true);
    rover.removeOccupant(this);
    this.rover = undefined;

    this.addCrowdAgent();

    const crowd: BABYLON.ICrowd | undefined = scene.crowd;
    if (crowd && this.crowdAgent) {
      crowd.agentTeleport(this.crowdAgent, exitWorld);
    }
    this.pauseResourceConsumption(false);
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

  playAnimation(name: string) {
    this.animations.forEach((a) => a.stop());
    if (name !== 'Digging') {
      this.hideShovel();
    }

    if (name === 'Digging') {
      this.showShovel();
    }

    this.animations.get(name)?.start(true);
  }

  hideShovel() {
    this.shovelParts?.forEach((m) => m.setEnabled(false));
  }

  showShovel() {
    this.shovelParts?.forEach((m) => m.setEnabled(true));
  }

  startResourceConsumption() {
    if (this.resourceObserver) return;

    this.resourceObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.isAlive) return;

      const dt = this.scene.getEngine().getDeltaTime() / 1000;

      if (this.rover) {
        const oxygenFromRover = this.rover.consumeResource(
          'oxygen',
          this.resourceConsumptionRates.oxygen * dt
        );
        this.resources.oxygen = Math.min(100, this.resources.oxygen + oxygenFromRover);

        const foodFromRover = this.rover.consumeResource(
          'food',
          this.resourceConsumptionRates.food * dt
        );
        this.resources.food = Math.min(100, this.resources.food + foodFromRover);

        const waterFromRover = this.rover.consumeResource(
          'water',
          this.resourceConsumptionRates.water * dt
        );
        this.resources.water = Math.min(100, this.resources.water + waterFromRover);
      } else {
        this.resources.oxygen -= this.resourceConsumptionRates.oxygen * dt;
        this.resources.oxygen = Math.max(0, this.resources.oxygen);

        if (this.resources.food > 0) {
          this.resources.food -= this.resourceConsumptionRates.food * dt;
          this.resources.food = Math.max(0, this.resources.food);
        }

        if (this.resources.water > 0) {
          this.resources.water -= this.resourceConsumptionRates.water * dt;
          this.resources.water = Math.max(0, this.resources.water);
        }
      }

      this.checkCriticalLevels();
      this.checkDeathConditions();
    });
  }

  private checkCriticalLevels() {
    if (this.resources.oxygen < this.criticalThresholds.oxygen) {
      showAlert(`${this.name} has critically low oxygen!`, 'error');
    }
    if (this.resources.food < this.criticalThresholds.food) {
      showAlert(`${this.name} is starving!`, 'error');
    }
    if (this.resources.water < this.criticalThresholds.water) {
      showAlert(`${this.name} is dehydrated!`, 'error');
    }
  }

  private checkDeathConditions() {
    if (this.resources.oxygen <= 0) {
      this.die();
      return;
    }

    if (this.resources.food <= 0 && this.resources.water <= 0) {
      this.die();
      return;
    }
  }

  pauseResourceConsumption(paused: boolean) {
    if (!this.resourceObserver) return;

    if (paused) {
      this.scene.onBeforeRenderObservable.remove(this.resourceObserver);
      this.resourceObserver = undefined;
    } else {
      this.startResourceConsumption();
    }
  }

  getResources() {
    return { ...this.resources };
  }
  refill(resource: 'oxygen' | 'food' | 'water', amount: number): number {
    if (amount <= 0) return 0;

    const before = this.resources[resource];
    this.resources[resource] = Math.min(100, this.resources[resource] + amount);
    const actualRefilled = this.resources[resource] - before;

    return actualRefilled;
  }

  die() {
    gameOver(this);
    return;
  }

  async loadWalkingSound() {
    const sound = await BABYLON.CreateSoundAsync('roverEngine', './sounds/walking.mp3', {
      loop: true,
      autoplay: false,
      volume: 0.5,
    });
    this.walkingSound = sound;
  }

  async loadDiggingSound() {
    const sound = await BABYLON.CreateSoundAsync('roverEngine', './sounds/digging.mp3', {
      loop: true,
      autoplay: false,
      volume: 0.5,
      playbackRate: 1.3,
    });
    this.diggingSound = sound;
  }
}
