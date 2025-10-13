import { Astronaut } from '../modelCreation/astronaut';
import { PlacementController } from '../modelCreation/placementController';
import * as BABYLON from '@babylonjs/core';
import { Rover } from '../modelCreation/rover';
import { moveCameraTo } from './createCamera';
import { modelFiles } from '../constants';

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
      img.alt = data.metadata.name;
      btn.appendChild(img);

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = data.metadata.name;
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

        placementController.placeModelOnClick(
          data.file,
          ground,
          () => {
            btn.classList.remove('active');
            activeButton = null;
          },
          data.metadata
        );

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
    astronaut.deselect();
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
        updateResourceInfo(astro);
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

export function updateResourceInfo(
  entity: Astronaut | Rover | BABYLON.TransformNode | null | undefined
) {
  if (!entity) return;

  showResourceBar();

  const nameEl = document.getElementById('entity-name');
  const oxygenEl = document.getElementById('oxygen-count');
  const foodEl = document.getElementById('food-count');
  const waterEl = document.getElementById('water-count');
  const energyEl = document.getElementById('energy-count');
  const energyContainer = document.getElementById('energy');

  if (nameEl) {
    if (entity instanceof Astronaut) {
      nameEl.textContent = entity.name ?? 'Astronaut';
    } else if (entity instanceof Rover) {
      nameEl.textContent = 'Rover';
    } else {
      const buildingName = entity.metadata?.name ?? entity.name ?? 'Building';
      nameEl.textContent = buildingName;
    }
  }

  if (entity instanceof Astronaut || entity instanceof Rover) {
    const res = entity.getResources?.() ?? {};
    if (energyContainer) energyContainer.style.display = 'none';
    if (oxygenEl)
      oxygenEl.textContent = res.oxygen !== undefined ? `${Math.floor(res.oxygen)}` : '-';
    if (foodEl) foodEl.textContent = res.food !== undefined ? `${Math.floor(res.food)}` : '-';
    if (waterEl) waterEl.textContent = res.water !== undefined ? `${Math.floor(res.water)}` : '-';
    if (energyEl) energyEl.textContent = '-';
  } else {
    const resource = entity.metadata?.resource;
    if (energyContainer) energyContainer.style.display = 'flex';

    if (resource === 'energy' && energyEl) energyEl.textContent = '+1 / sec';
    else if (energyEl) energyEl.textContent = '-';

    if (resource === 'oxygen' && oxygenEl) oxygenEl.textContent = '+1 / sec';
    else if (oxygenEl) oxygenEl.textContent = '-';

    if (resource === 'food' && foodEl) foodEl.textContent = '+1 / sec';
    else if (foodEl) foodEl.textContent = '-';

    if (resource === 'water' && waterEl) waterEl.textContent = '+1 / sec';
    else if (waterEl) waterEl.textContent = '-';
  }
}

export function showDestroyButton(building: BABYLON.TransformNode, onDestroy: () => void) {
  const destroyBtn = document.getElementById('destroy-building-btn')!;
  if (destroyBtn) destroyBtn.style.display = 'inline-flex';

  const newBtn = destroyBtn.cloneNode(true) as HTMLButtonElement;
  destroyBtn.parentNode!.replaceChild(newBtn, destroyBtn);
  newBtn.onclick = () => {
    onDestroy();
    newBtn.style.display = 'none';
  };
}

export function hideDestroyButton() {
  const destroyBtn = document.getElementById('destroy-building-btn')!;
  if (destroyBtn) destroyBtn.style.display = 'none';
}

export function showResourceBar() {
  const resourceBar = document.getElementById('resource-bar');
  if (resourceBar) resourceBar.style.display = 'flex';
}
export function hideResourceBar() {
  const resourceBar = document.getElementById('resource-bar');
  if (resourceBar) resourceBar.style.display = 'none';
}
