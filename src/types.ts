import { AbstractMesh, Vector3 } from '@babylonjs/core';
import { Astronaut } from './modelCreation/astronaut';

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
