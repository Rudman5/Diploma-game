import {
  AbstractMesh,
  ICrowd,
  RecastJSPlugin,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { Astronaut } from './modelCreation/astronaut';
import { ResourceManager } from './core/resourceManager';
import { RockManager } from './core/rockManager';
import { PlacementController } from './modelCreation/placementController';

export interface ModelData {
  file: string;
  img: string;
  metadata: ModelMetadata;
}

export interface ModelMetadata {
  name: string;
  resource?: string;
  energyConsumption?: number;
  productionRate?: number;
  rocksNeeded: number;
}
export type ModelFiles = Record<string, ModelData>;

export interface InteractionTarget {
  position: Vector3;
  interactionRadius: number;
  onInteract: (astronaut: Astronaut) => void;
  type: string;
}
export type RockType = 'rock' | 'rockLarge';

export class Rock {
  constructor(
    public mesh: AbstractMesh,
    public rockValue: number,
    public digTime: number,
    public obstacleId: number | null,
    public isBeingDug: boolean = false,
    public rockType: RockType
  ) {}
}

export interface RockData {
  position: Vector3;
  type: RockType;
  value: number;
  digTime: number;
}

export interface extendedScene extends Scene {
  resourceManager: ResourceManager;
  rockManager: RockManager;
  crowd: ICrowd;
  navigationPlugin: RecastJSPlugin;
  placementController: PlacementController;
  currentRefillOptions: refillOptions | null;
  refreshBuildingMenu: () => void;
}

interface refillOptions {
  building: TransformNode;
  canRefillRover: boolean;
  canRefillAstronaut: boolean;
}
