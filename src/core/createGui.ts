import { Astronaut } from './astronaut';
import { PlacementController } from './placementController';
import * as BABYLON from '@babylonjs/core';
import { Rover } from './rover';
import { moveCameraTo } from './createCamera';

const modelFiles: Record<string, { name: string; file: string; img: string }> = {
  apolloLunarModule: {
    name: 'Apollo Lunar Module',
    file: 'apolloLunarModule.glb',
    img: 'apolloLunarThumb.png',
  },
  // artemisRover: { name: 'Artemis Rover', file: 'artemisRover.glb', img: 'artemisRoverThumb.png' },
  baseLarge: { name: 'Base Large', file: 'baseLarge.glb', img: 'baseLargeThumb.png' },
  buildingPod: { name: 'Building Pod', file: 'buildingPod.glb', img: 'buildingPodThumb.png' },
  laboratory: { name: 'Laboratory', file: 'laboratory.glb', img: 'laboratoryThumb.png' },
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
  setupLeaveButton();
  refreshSubMenu();
}

export function setupLeaveButton() {
  const leaveBtn = document.getElementById('leave-rover-btn')!;
  if (!leaveBtn) return;

  leaveBtn.onclick = () => {
    const astronaut = Astronaut.allAstronauts.find((a) => a.rover);
    if (!astronaut) {
      console.warn('No astronaut found inside a rover.');
      return;
    }

    astronaut.exitRover();
    hideLeaveButton();
  };
}

export function showLeaveButton() {
  const leaveBtn = document.getElementById('leave-rover-btn')!;
  if (leaveBtn) leaveBtn.style.display = 'inline-flex';
}

export function hideLeaveButton() {
  const leaveBtn = document.getElementById('leave-rover-btn')!;
  if (leaveBtn) leaveBtn.style.display = 'none';
}

export function setupAstronautThumbnails(scene: BABYLON.Scene, camera: BABYLON.UniversalCamera) {
  let activeThumb: HTMLElement | null = null;

  Astronaut.allAstronauts.forEach((astro) => {
    const thumb = document.getElementById(astro.id);
    if (!thumb) return;

    const astronautImg = thumb.querySelector('img:nth-of-type(1)') as HTMLImageElement;
    const roverImg = thumb.querySelector('img:nth-of-type(2)') as HTMLImageElement;

    function updateThumbnail() {
      if (astro.rover) {
        astronautImg.style.display = 'none';
        roverImg.style.display = 'inline';
      } else {
        astronautImg.style.display = 'inline';
        roverImg.style.display = 'none';
      }
    }

    function setActiveThumb(newThumb: HTMLElement | null) {
      if (activeThumb && activeThumb !== newThumb) activeThumb.classList.remove('active');
      activeThumb = newThumb;
      if (activeThumb) activeThumb.classList.add('active');
    }

    thumb.addEventListener('click', () => {
      if (astro.rover) {
        if (Rover.selectedRover && Rover.selectedRover !== astro.rover)
          Rover.selectedRover.deselect();
        astro.rover.select();
        moveCameraTo(camera, astro.rover.mesh.position);
      } else {
        if (Astronaut.selectedAstronaut && Astronaut.selectedAstronaut !== astro)
          Astronaut.selectedAstronaut.deselect();
        if (Rover.selectedRover) Rover.selectedRover.deselect();
        astro.select();
        moveCameraTo(camera, astro.mesh.position);
      }
      updateThumbnail();
      setActiveThumb(thumb);
    });

    if (!astro.mesh.actionManager) astro.mesh.actionManager = new BABYLON.ActionManager(scene);
    astro.mesh.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
        if (astro.rover) {
          if (Rover.selectedRover && Rover.selectedRover !== astro.rover)
            Rover.selectedRover.deselect();
          astro.rover.select();
        } else {
          if (Astronaut.selectedAstronaut && Astronaut.selectedAstronaut !== astro)
            Astronaut.selectedAstronaut.deselect();
          if (Rover.selectedRover) Rover.selectedRover.deselect();
          astro.select();
        }
        updateThumbnail();
        setActiveThumb(thumb);
      })
    );

    const originalSelect = astro.select.bind(astro);
    astro.select = () => {
      originalSelect();
      updateThumbnail();
      setActiveThumb(thumb);
    };

    const originalDeselect = astro.deselect.bind(astro);
    astro.deselect = () => {
      originalDeselect();
      updateThumbnail();
      if (activeThumb && activeThumb === thumb) activeThumb.classList.remove('active');
    };

    Object.defineProperty(astro, 'rover', {
      get: function () {
        return this._rover;
      },
      set: function (val) {
        this._rover = val;
        updateThumbnail();
      },
      configurable: true,
      enumerable: true,
    });

    updateThumbnail();
  });
}
