import * as BABYLON from '@babylonjs/core';
import { Astronaut } from '../modelCreation/astronaut';
import { Rover } from '../modelCreation/rover';

import { Rock, RockType } from '../types';

export class RockManager {
  private scene: BABYLON.Scene;
  private rocks: Rock[] = [];
  private groundMesh: BABYLON.GroundMesh;
  private crowd: BABYLON.ICrowd;
  private navPlugin: BABYLON.RecastJSPlugin;
  private mapSize: number = 500;

  constructor(scene: BABYLON.Scene, groundMesh: BABYLON.GroundMesh) {
    this.scene = scene;
    this.groundMesh = groundMesh;
    this.crowd = (scene as any).crowd;
    this.navPlugin = (scene as any).navigationPlugin;
  }

  public scatterRocksAcrossMap(count: number = 50) {
    const smallRockCount = Math.floor(count * 0.7);
    const largeRockCount = count - smallRockCount;

    for (let i = 0; i < smallRockCount; i++) {
      this.createRandomRockOnMap('rock', 1, 5);
    }

    for (let i = 0; i < largeRockCount; i++) {
      this.createRandomRockOnMap('rockLarge', 3, 12);
    }
  }

  public explodeRocks(center: BABYLON.Vector3, count: number = 10, radius: number = 20) {
    const smallRockCount = Math.floor(count * 0.7);
    const largeRockCount = count - smallRockCount;

    for (let i = 0; i < smallRockCount; i++) {
      this.createRandomRock(center, radius, 'rock', 1, 5);
    }

    for (let i = 0; i < largeRockCount; i++) {
      this.createRandomRock(center, radius, 'rockLarge', 3, 12);
    }
  }

  private async createRandomRockOnMap(rockType: RockType, rockValue: number, digTime: number) {
    let attempts = 0;
    let position: BABYLON.Vector3;

    do {
      const x = (Math.random() - 0.5) * this.mapSize;
      const z = (Math.random() - 0.5) * this.mapSize;

      const groundY = this.groundMesh.getHeightAtCoordinates(x, z);
      if (groundY === null) {
        attempts++;
        continue;
      }

      position = new BABYLON.Vector3(x, groundY, z);

      if (this.isPositionOccupied(position, 5)) {
        attempts++;
        continue;
      }

      break;
    } while (attempts < 20);

    if (!position!) return;

    await this.createRock(position, rockType, rockValue, digTime);
  }

  private async createRandomRock(
    center: BABYLON.Vector3,
    radius: number,
    rockType: RockType,
    rockValue: number,
    digTime: number
  ) {
    let attempts = 0;
    let position: BABYLON.Vector3;

    do {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const x = center.x + Math.cos(angle) * distance;
      const z = center.z + Math.sin(angle) * distance;

      const groundY = this.groundMesh.getHeightAtCoordinates(x, z);
      if (groundY === null) {
        attempts++;
        continue;
      }

      position = new BABYLON.Vector3(x, groundY, z);

      if (this.isPositionOccupied(position, 5)) {
        attempts++;
        continue;
      }

      break;
    } while (attempts < 10);

    if (!position!) return;

    await this.createRock(position, rockType, rockValue, digTime);
  }

  private isPositionOccupied(position: BABYLON.Vector3, minDistance: number): boolean {
    for (const astronaut of Astronaut.allAstronauts) {
      if (
        astronaut.mesh &&
        BABYLON.Vector3.Distance(position, astronaut.mesh.position) < minDistance
      ) {
        return true;
      }
    }

    if (Rover.mainRover && Rover.mainRover.mesh) {
      if (BABYLON.Vector3.Distance(position, Rover.mainRover.mesh.position) < minDistance) {
        return true;
      }
    }

    for (const rock of this.rocks) {
      if (BABYLON.Vector3.Distance(position, rock.mesh.position) < minDistance) {
        return true;
      }
    }

    const placementController: any = (this.scene as any).placementController;
    if (placementController && placementController.placedObjects) {
      for (const building of placementController.placedObjects) {
        if (BABYLON.Vector3.Distance(position, building.position) < minDistance) {
          return true;
        }
      }
    }

    return false;
  }

  public async createRock(
    position: BABYLON.Vector3,
    modelType: RockType,
    rockValue: number = 1,
    digTime: number = 5
  ): Promise<Rock> {
    const fileName = modelType === 'rockLarge' ? 'rockLarge.glb' : 'rock.glb';

    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      '',
      './buildModels/',
      fileName,
      this.scene
    );
    const rockMesh = result.meshes[0];

    const finalPosition = position.clone();
    const groundY = this.groundMesh.getHeightAtCoordinates(position.x, position.z);
    if (groundY !== null) {
      finalPosition.y = groundY;
    }

    rockMesh.position = finalPosition;
    rockMesh.isPickable = true;
    rockMesh.checkCollisions = true;

    let obstacleId: number | null = null;
    if (this.crowd && this.navPlugin) {
      const size = rockMesh.getHierarchyBoundingVectors(true);

      const agentParams: BABYLON.IAgentParameters = {
        radius: modelType === 'rockLarge' ? 3 : 1,
        height: size.max.y - size.min.y,
        maxSpeed: 0,
        maxAcceleration: 0,
        collisionQueryRange: 2,
        pathOptimizationRange: 2,
        separationWeight: 1,
      };

      obstacleId = this.crowd.addAgent(finalPosition, agentParams, rockMesh);

      // Single gentle update
      setTimeout(() => {
        if (this.crowd && obstacleId !== null) {
          this.crowd.update(0.016);
        }
      }, 50);
    }

    const rock = new Rock(rockMesh, rockValue, digTime, obstacleId, false, modelType);
    this.rocks.push(rock);
    this.setupRockActions(rock);

    return rock;
  }

  private setupRockActions(rock: Rock) {
    if (!rock.mesh.actionManager) {
      rock.mesh.actionManager = new BABYLON.ActionManager(this.scene);
    }

    rock.mesh.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, (event) => {
        if (Astronaut.selectedAstronaut && !rock.isBeingDug) {
          this.startDigging(Astronaut.selectedAstronaut, rock);
        }
      })
    );
  }

  public startDigging(astronaut: Astronaut, rock: Rock) {
    if (rock.isBeingDug) return;

    rock.isBeingDug = true;
    astronaut.walkToRock(rock, () => {
      const rockPosition = rock.mesh.position.clone();
      const direction = rockPosition.subtract(astronaut.mesh.position).normalize();
      const targetYaw = Math.atan2(direction.x, direction.z) + Math.PI;
      astronaut.mesh.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(targetYaw, 0, 0);

      astronaut.diggingSound!.play();
      astronaut.playAnimation('Digging');

      setTimeout(() => {
        if (rock.mesh.isDisposed()) return;
        astronaut.diggingSound!.stop();
        astronaut.playAnimation('Idle');
        const resourceManager: any = (this.scene as any).resourceManager;
        if (resourceManager && resourceManager.addRocks) {
          resourceManager.addRocks(rock.rockValue);
        }
        this.removeRock(rock);
      }, rock.digTime * 1000);
    });
  }

  public removeRock(rock: Rock) {
    if (rock.obstacleId !== null && this.crowd) {
      this.crowd.removeAgent(rock.obstacleId);
    }

    const index = this.rocks.indexOf(rock);
    if (index > -1) {
      this.rocks.splice(index, 1);
    }

    rock.mesh.dispose();
  }

  public getRocks(): Rock[] {
    return this.rocks;
  }

  public dispose() {
    this.rocks.forEach((rock) => this.removeRock(rock));
    this.rocks = [];
  }

  public findRockFromMesh(mesh: BABYLON.AbstractMesh): Rock | null {
    return this.rocks.find((r) => r.mesh === mesh || mesh.isDescendantOf(r.mesh)) || null;
  }
}
