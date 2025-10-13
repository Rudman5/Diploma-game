import { ModelFiles } from './types';

export const modelFiles: ModelFiles = {
  solarPanelStructure: {
    file: 'solarPanelStructure.glb',
    img: 'solarPanelStructureThumb.png',
    metadata: {
      name: 'Solar Panel',
      resource: 'energy',
      energyConsumption: 0,
      productionRate: 20,
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
    },
  },
  laboratory: {
    file: 'laboratory.glb',
    img: 'laboratoryThumb.png',
    metadata: {
      name: 'Oxygen plant',
      resource: 'oxygen',
      energyConsumption: 20,
      productionRate: 3,
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
