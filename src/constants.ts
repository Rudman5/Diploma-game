import { ModelFiles } from './types';

export const modelFiles: ModelFiles = {
  baseLarge: {
    file: 'baseLarge.glb',
    img: 'baseLargeThumb.png',
    metadata: {
      name: 'Water processing plant',
      resource: 'water',
      energyConsumption: 1,
    },
  },
  buildingPod: {
    file: 'buildingPod.glb',
    img: 'buildingPodThumb.png',
    metadata: {
      name: 'Restaurant',
      resource: 'food',
      energyConsumption: 1,
    },
  },
  laboratory: {
    file: 'laboratory.glb',
    img: 'laboratoryThumb.png',
    metadata: {
      name: 'Oxygen plant',
      resource: 'oxygen',
      energyConsumption: 2,
    },
  },
  solarPanelStructure: {
    file: 'solarPanelStructure.glb',
    img: 'solarPanelStructureThumb.png',
    metadata: {
      name: 'Solar Panel',
      resource: 'energy',
    },
  },
  livingQuarters: {
    file: 'livingQuarters.glb',
    img: 'livingQuartersThumb.png',
    metadata: {
      name: 'Living Quarters',
      energyConsumption: 1,
    },
  },
};
