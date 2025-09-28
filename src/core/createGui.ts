import { PlacementController } from './placementController';
import * as BABYLON from '@babylonjs/core';

const modelFiles: Record<string, { name: string; file: string; img: string }> = {
  apolloLunarModule: {
    name: 'Apollo Lunar Module',
    file: 'apolloLunarModule.glb',
    img: 'apolloLunarThumb.png',
  },
  artemisRover: { name: 'Artemis Rover', file: 'artemisRover.glb', img: 'artemisRoverThumb.png' },
  baseLarge: { name: 'Base Large', file: 'baseLarge.glb', img: 'baseLargeThumb.png' },
  buildingPod: { name: 'Building Pod', file: 'buildingPod.glb', img: 'buildingPodThumb.png' },
  // laboratory: { name: 'Laboratory', file: 'laboratory.glb', img: 'laboratoryThumb.png' },
  solarPanelStructure: {
    name: 'Solar Panel Structure',
    file: 'solarPanelStructure.glb',
    img: 'solarPanelStructureThumb.png',
  },
  livingQuarters: {
    name: 'Living Quarters',
    file: 'livingQuarters.glb',
    img: 'livingQuartersThumb.png',
  },
};

export function createGui(placementController: PlacementController, ground: BABYLON.GroundMesh) {
  const mainMenu = document.getElementById('main-menu')!;
  const subMenu = document.getElementById('sub-menu')!;
  const backBtn = document.getElementById('back-btn')!;
  const modelButtonsContainer = document.getElementById('model-buttons')!;
  let activeButton: HTMLButtonElement | null = null;

  mainMenu.querySelector('[data-action="buildings"]')!.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    subMenu.classList.remove('hidden');
  });

  mainMenu.querySelector('[data-action="test"]')!.addEventListener('click', () => {
    console.log('Test clicked');
  });

  backBtn.addEventListener('click', () => {
    subMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');

    if (activeButton) {
      placementController.cancelPlacement();
      activeButton.classList.remove('active');
      activeButton = null;
    }
  });

  function refreshSubMenu() {
    Object.entries(modelFiles).forEach(([key, data]) => {
      const btn = document.createElement('button');
      btn.className = 'menu-btn model-btn';

      const img = document.createElement('img');
      img.src = `assets/${data.img}`;
      img.alt = data.name;
      btn.appendChild(img);

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = data.name;
      btn.appendChild(tooltip);

      btn.addEventListener('click', () => {
        if (activeButton === btn) {
          placementController.cancelPlacement();
          btn.classList.remove('active');
          activeButton = null;
          return;
        }

        if (activeButton && activeButton !== btn) {
          placementController.cancelPlacement();
          activeButton.classList.remove('active');
        }

        placementController.placeModelOnClick(data.file, ground, () => {
          btn.classList.remove('active');
          activeButton = null;
        });

        btn.classList.add('active');
        activeButton = btn;
      });

      modelButtonsContainer.appendChild(btn);
    });
  }

  refreshSubMenu();
}
