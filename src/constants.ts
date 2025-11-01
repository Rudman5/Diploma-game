import { ModelFiles } from './types';
import * as BABYLON from '@babylonjs/core';

export const modelFiles: ModelFiles = {
  solarPanelStructure: {
    file: 'solarPanelStructure.glb',
    img: 'solarPanelStructureThumb.png',
    metadata: {
      name: 'Solar Panel',
      resource: 'energy',
      energyConsumption: 0,
      productionRate: 20,
      rocksNeeded: 5,
    },
  },
  baseLarge: {
    file: 'baseLarge.glb',
    img: 'baseLargeThumb.png',
    metadata: {
      name: 'Water processing plant',
      resource: 'water',
      energyConsumption: 10,
      productionRate: 2,
      rocksNeeded: 20,
    },
  },
  buildingPod: {
    file: 'buildingPod.glb',
    img: 'buildingPodThumb.png',
    metadata: {
      name: 'Restaurant',
      resource: 'food',
      energyConsumption: 5,
      productionRate: 2,
      rocksNeeded: 10,
    },
  },
  laboratory: {
    file: 'laboratory.glb',
    img: 'laboratoryThumb.png',
    metadata: {
      name: 'Oxygen plant',
      resource: 'oxygen',
      energyConsumption: 20,
      productionRate: 4,
      rocksNeeded: 15,
    },
  },
  landingPad: {
    file: 'landingPad.glb',
    img: 'landingPadThumb.png',
    metadata: {
      name: 'Artemis landing pad',
      energyConsumption: 0,
      rocksNeeded: 50,
    },
  },
  //   livingQuarters: {
  //     file: 'livingQuarters.glb',
  //     img: 'livingQuartersThumb.png',
  //     metadata: {
  //       name: 'Living Quarters',
  //       energyConsumption: 1,
  //     },
  //   },
};

export const RESOURCE_COLORS: Record<string, BABYLON.Color3> = {
  water: BABYLON.Color3.FromHexString('#2e90b0'),
  food: BABYLON.Color3.FromHexString('#c9112d'),
  oxygen: BABYLON.Color3.FromHexString('#27de48'),
  energy: BABYLON.Color3.FromHexString('#ffff00'),
};
