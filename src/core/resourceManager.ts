import * as BABYLON from '@babylonjs/core';

export class ResourceManager {
  private scene: BABYLON.Scene;
  private accumulatedResources: Record<string, number> = {
    oxygen: 100,
    food: 0,
    water: 0,
    energy: 50,
  };

  private productionRates = new Map<
    BABYLON.TransformNode,
    {
      type: string;
      rate: number;
      radius: number;
      energyConsumption: number;
      isActive: boolean;
    }
  >();

  private lastUpdateTime: number = 0;
  private energyProduction: number = 0;
  private energyConsumption: number = 0;

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
    });

    if (resourceType === 'energy') {
      this.energyProduction += productionRate;
    }
  }

  public unregisterBuilding(building: BABYLON.TransformNode) {
    const production = this.productionRates.get(building);
    if (production) {
      if (production.type === 'energy') {
        this.energyProduction -= production.rate;
      }
      this.productionRates.delete(building);
    }
  }

  private startProductionLoop() {
    this.scene.onBeforeRenderObservable.add(() => {
      const now = Date.now();
      const dt = this.lastUpdateTime > 0 ? (now - this.lastUpdateTime) / 1000 : 0.016;
      this.lastUpdateTime = now;

      this.energyConsumption = 0;
      let totalEnergyProduced = 0;

      this.productionRates.forEach((production, building) => {
        if (building.isDisposed()) {
          this.unregisterBuilding(building);
          return;
        }

        if (production.type === 'energy') {
          this.accumulatedResources.energy += production.rate * dt;
          totalEnergyProduced += production.rate * dt;
        }
      });

      let totalEnergyNeeded = 0;
      this.productionRates.forEach((production, building) => {
        if (production.type !== 'energy' && production.isActive) {
          totalEnergyNeeded += production.energyConsumption * dt;
        }
      });

      const hasEnoughEnergy = this.accumulatedResources.energy >= totalEnergyNeeded;

      this.productionRates.forEach((production, building) => {
        if (production.type === 'energy') return;

        if (hasEnoughEnergy && production.isActive) {
          const energyCost = production.energyConsumption * dt;
          this.accumulatedResources.energy -= energyCost;
          this.energyConsumption += energyCost;

          this.accumulatedResources[production.type] += production.rate * dt;
        }
      });

      this.energyProduction = totalEnergyProduced / dt;

      if (this.accumulatedResources.energy <= 10) {
        console.warn('LOW ENERGY: Build more solar panels!');
      }
    });
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
      current: this.accumulatedResources.energy,
      production: this.energyProduction,
      consumption: this.energyConsumption,
      net: this.energyProduction - this.energyConsumption,
    };
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
    return {
      energy: this.accumulatedResources.energy,
      oxygen: this.accumulatedResources.oxygen,
      food: this.accumulatedResources.food,
      water: this.accumulatedResources.water,
      energyProduction: this.energyProduction,
      energyConsumption: this.energyConsumption,
    };
  }
}
