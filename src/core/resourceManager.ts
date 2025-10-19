import * as BABYLON from '@babylonjs/core';
import { Astronaut } from '../modelCreation/astronaut';
import { Rover } from '../modelCreation/rover';

export class ResourceManager {
  private scene: BABYLON.Scene;
  private accumulatedResources: Record<string, number> = {
    oxygen: 100,
    food: 0,
    water: 0,
    energy: 0,
    rocks: 100,
  };

  private productionRates = new Map<
    BABYLON.TransformNode,
    {
      type: string;
      rate: number;
      radius: number;
      energyConsumption: number;
      isActive: boolean;
      priority: number;
    }
  >();

  private resourceProductionRates: Record<string, number> = {
    oxygen: 0,
    food: 0,
    water: 0,
    energy: 0,
  };

  private energyProduction: number = 0;
  private totalEnergyRequired: number = 0;
  private actualEnergyConsumption: number = 0;
  private lastUpdateTime: number = 0;

  private resourcePriorities: Record<string, number> = {
    oxygen: 3,
    water: 2,
    food: 1,
    energy: 0,
  };

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.startProductionLoop();
  }

  public registerBuilding(
    building: BABYLON.TransformNode,
    resourceType: string,
    productionRate: number,
    radius: number,
    energyConsumption: number
  ) {
    this.productionRates.set(building, {
      type: resourceType,
      rate: productionRate,
      radius,
      energyConsumption,
      isActive: true,
      priority: this.resourcePriorities[resourceType] || 0,
    });

    if (resourceType === 'energy') {
      this.energyProduction += productionRate;
      this.resourceProductionRates.energy += productionRate;
    } else {
      this.resourceProductionRates[resourceType] += productionRate;
      this.totalEnergyRequired += energyConsumption;
    }
  }

  public unregisterBuilding(building: BABYLON.TransformNode) {
    const production = this.productionRates.get(building);
    if (production) {
      if (production.type === 'energy') {
        this.energyProduction -= production.rate;
        this.resourceProductionRates.energy -= production.rate;
      } else {
        this.resourceProductionRates[production.type] -= production.rate;
        this.totalEnergyRequired -= production.energyConsumption;
      }
      this.productionRates.delete(building);
    }
  }

  private startProductionLoop() {
    this.scene.onBeforeRenderObservable.add(() => {
      const now = Date.now();
      const dt = this.lastUpdateTime > 0 ? (now - this.lastUpdateTime) / 1000 : 0.016;
      this.lastUpdateTime = now;

      this.actualEnergyConsumption = 0;

      const hasEnoughEnergy = this.energyProduction >= this.totalEnergyRequired;

      if (hasEnoughEnergy) {
        this.actualEnergyConsumption = this.totalEnergyRequired;

        this.productionRates.forEach((production, building) => {
          if (production.type === 'energy') return;

          production.isActive = true;
          this.accumulatedResources[production.type] += production.rate * dt;
        });
      } else {
        this.prioritizeBuildingProduction(dt);
      }
    });
  }

  private prioritizeBuildingProduction(dt: number) {
    this.productionRates.forEach((production) => {
      if (production.type !== 'energy') {
        production.isActive = false;
      }
    });

    const buildingsArray = Array.from(this.productionRates.entries())
      .filter(([_, production]) => production.type !== 'energy')
      .sort(([_, a], [__, b]) => b.priority - a.priority);

    let remainingEnergy = this.energyProduction;

    for (const [building, production] of buildingsArray) {
      if (production.energyConsumption <= remainingEnergy) {
        production.isActive = true;
        this.actualEnergyConsumption += production.energyConsumption;
        remainingEnergy -= production.energyConsumption;
        this.accumulatedResources[production.type] += production.rate * dt;
      }
    }
  }

  public consumeResource(type: string, amount: number): number {
    const available = this.accumulatedResources[type];
    const consumed = Math.min(available, amount);
    this.accumulatedResources[type] -= consumed;
    return consumed;
  }

  public getAvailableResource(type: string): number {
    return this.accumulatedResources[type];
  }

  public getEnergyStats() {
    return {
      production: this.energyProduction,
      required: this.totalEnergyRequired,
      consumption: this.actualEnergyConsumption,
      hasEnoughEnergy: this.energyProduction >= this.totalEnergyRequired,
    };
  }

  public getResourceProductionRates() {
    const activeProductionRates: Record<string, number> = {
      oxygen: 0,
      food: 0,
      water: 0,
      energy: this.energyProduction,
    };

    this.productionRates.forEach((production) => {
      if (production.type !== 'energy' && production.isActive) {
        activeProductionRates[production.type] += production.rate;
      }
    });

    return activeProductionRates;
  }

  public getBuildingResourceType(building: BABYLON.TransformNode): string | null {
    const production = this.productionRates.get(building);
    return production ? production.type : null;
  }

  public isEntityInRange(entityPos: BABYLON.Vector3, building: BABYLON.TransformNode): boolean {
    const production = this.productionRates.get(building);
    if (!production || !production.isActive) return false;

    const buildingPos = building.getAbsolutePosition();
    const distance = BABYLON.Vector3.Distance(entityPos, buildingPos);
    return distance <= production.radius;
  }

  public getResourceStats() {
    const productionRates = this.getResourceProductionRates();
    const energyStats = this.getEnergyStats();

    return {
      energy: 0,
      oxygen: this.accumulatedResources.oxygen,
      food: this.accumulatedResources.food,
      water: this.accumulatedResources.water,
      rocks: this.accumulatedResources.rocks,
      energyProduction: this.energyProduction,
      energyRequired: this.totalEnergyRequired,
      energyConsumption: this.actualEnergyConsumption,
      hasEnoughEnergy: energyStats.hasEnoughEnergy,
      oxygenProduction: productionRates.oxygen,
      foodProduction: productionRates.food,
      waterProduction: productionRates.water,
    };
  }

  public canPlaceBuilding(energyConsumption: number): boolean {
    return this.energyProduction >= this.totalEnergyRequired + energyConsumption;
  }

  public canRefillAstronautFromBuilding(building: BABYLON.TransformNode): Astronaut | null {
    const resourceType = building.metadata?.resource;
    if (!resourceType || !['oxygen', 'food', 'water'].includes(resourceType)) return null;

    const production = this.productionRates.get(building);
    if (!production || !production.isActive) return null;

    for (const astronaut of Astronaut.allAstronauts) {
      if (
        astronaut.isAlive &&
        this.isEntityInRange(astronaut.mesh.getAbsolutePosition(), building)
      ) {
        return astronaut;
      }
    }
    return null;
  }

  public canRefillRoverFromBuilding(building: BABYLON.TransformNode): Rover | null {
    const resourceType = building.metadata?.resource;
    if (!resourceType || !['oxygen', 'food', 'water'].includes(resourceType)) return null;

    const production = this.productionRates.get(building);
    if (!production || !production.isActive) return null;

    if (
      Rover.mainRover &&
      Rover.mainRover.mesh &&
      this.isEntityInRange(Rover.mainRover.mesh.getAbsolutePosition(), building)
    ) {
      return Rover.mainRover;
    }
    return null;
  }

  public refillAstronautFromBuilding(
    astronaut: Astronaut,
    building: BABYLON.TransformNode
  ): number {
    const resourceType = building.metadata?.resource;
    if (!resourceType || !['oxygen', 'food', 'water'].includes(resourceType)) return 0;

    const refillAmount = 50;
    const available = this.consumeResource(resourceType, refillAmount);

    if (available > 0) {
      astronaut.refill(resourceType as 'oxygen' | 'food' | 'water', available);
      return available;
    }
    return 0;
  }

  public refillRoverFromBuilding(rover: Rover, building: BABYLON.TransformNode): number {
    const resourceType = building.metadata?.resource;
    if (!resourceType || !['oxygen', 'food', 'water'].includes(resourceType)) return 0;

    const refillAmount = 100;
    const available = this.consumeResource(resourceType, refillAmount);

    if (available > 0) {
      rover.refillResource(resourceType as keyof typeof rover.resources, available);
      rover.occupiedBy.forEach((astronaut) => {
        const smallRefill = Math.min(20, available / rover.occupiedBy.length);
        astronaut.refill(resourceType as 'oxygen' | 'food' | 'water', smallRefill);
      });
      return available;
    }
    return 0;
  }

  public addRocks(amount: number) {
    this.accumulatedResources.rocks += amount;
    const scene = this.scene as any;
    if (scene.refreshBuildingMenu) {
      scene.refreshBuildingMenu();
    }
  }

  public consumeRocks(amount: number): boolean {
    if (this.accumulatedResources.rocks >= amount) {
      this.accumulatedResources.rocks -= amount;
      const scene = this.scene as any;
      if (scene.refreshBuildingMenu) {
        scene.refreshBuildingMenu();
      }
      return true;
    }
    return false;
  }

  public getAvailableRocks(): number {
    return this.accumulatedResources.rocks;
  }
}
