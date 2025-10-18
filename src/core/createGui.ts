import { Astronaut } from '../modelCreation/astronaut';
import { PlacementController } from '../modelCreation/placementController';
import * as BABYLON from '@babylonjs/core';
import { Rover } from '../modelCreation/rover';
import { moveCameraTo } from './createCamera';
import { modelFiles } from '../constants';
import { ResourceManager } from './resourceManager';

export function createGui(
  placementController: PlacementController,
  ground: BABYLON.GroundMesh,
  scene: BABYLON.Scene
) {
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
  setupRefillButtons(scene, placementController);
  updateGlobalResourceDisplay(scene);
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
  if (entity instanceof BABYLON.TransformNode && entity.metadata?.resource) {
    const scene = (entity as any).getScene?.();
    if (scene) {
      updateRefillButtons(scene);
    }
  }
  const nameEl = document.getElementById('entity-name');
  const oxygenEl = document.getElementById('oxygen-count');
  const foodEl = document.getElementById('food-count');
  const waterEl = document.getElementById('water-count');
  const energyEl = document.getElementById('energy-count');

  const oxygenContainer = document.getElementById('oxygen');
  const foodContainer = document.getElementById('food');
  const waterContainer = document.getElementById('water');
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

    if (oxygenContainer) oxygenContainer.style.display = 'flex';
    if (foodContainer) foodContainer.style.display = 'flex';
    if (waterContainer) waterContainer.style.display = 'flex';
    if (energyContainer) energyContainer.style.display = 'none';

    if (oxygenEl)
      oxygenEl.textContent = res.oxygen !== undefined ? `${Math.floor(res.oxygen)}` : '-';
    if (foodEl) foodEl.textContent = res.food !== undefined ? `${Math.floor(res.food)}` : '-';
    if (waterEl) waterEl.textContent = res.water !== undefined ? `${Math.floor(res.water)}` : '-';
    if (energyEl) energyEl.textContent = '-';
  } else {
    const resource = entity.metadata?.resource;
    const productionRate = entity.metadata?.productionRate || 0;
    const energyConsumption = entity.metadata?.energyConsumption || 0;

    if (oxygenContainer) oxygenContainer.style.display = 'none';
    if (foodContainer) foodContainer.style.display = 'none';
    if (waterContainer) waterContainer.style.display = 'none';
    if (energyContainer) energyContainer.style.display = 'none';

    if (resource === 'energy') {
      if (energyContainer) energyContainer.style.display = 'flex';
      if (energyEl) energyEl.textContent = `+${productionRate}`;
    } else if (resource === 'oxygen') {
      if (oxygenContainer) oxygenContainer.style.display = 'flex';
      if (oxygenEl) oxygenEl.textContent = `+${productionRate}/sec`;
      if (energyContainer) energyContainer.style.display = 'flex';
      if (energyEl) energyEl.textContent = `-${energyConsumption}`;
    } else if (resource === 'food') {
      if (foodContainer) foodContainer.style.display = 'flex';
      if (foodEl) foodEl.textContent = `+${productionRate}/sec`;
      if (energyContainer) energyContainer.style.display = 'flex';
      if (energyEl) energyEl.textContent = `-${energyConsumption}`;
    } else if (resource === 'water') {
      if (waterContainer) waterContainer.style.display = 'flex';
      if (waterEl) waterEl.textContent = `+${productionRate}/sec`;
      if (energyContainer) energyContainer.style.display = 'flex';
      if (energyEl) energyEl.textContent = `-${energyConsumption}`;
    }
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
export function updateGlobalResourceDisplay(scene: BABYLON.Scene) {
  const resourceManager: ResourceManager = (scene as any).resourceManager;
  if (!resourceManager) return;

  const resources = resourceManager.getResourceStats();

  const nameEl = document.getElementById('entity-name');
  const oxygenEl = document.getElementById('oxygen-count');
  const foodEl = document.getElementById('food-count');
  const waterEl = document.getElementById('water-count');
  const energyEl = document.getElementById('energy-count');

  const oxygenContainer = document.getElementById('oxygen');
  const foodContainer = document.getElementById('food');
  const waterContainer = document.getElementById('water');
  const energyContainer = document.getElementById('energy');

  if (nameEl) {
    nameEl.textContent = 'Global Resources';
  }

  if (oxygenContainer) oxygenContainer.style.display = 'flex';
  if (foodContainer) foodContainer.style.display = 'flex';
  if (waterContainer) waterContainer.style.display = 'flex';
  if (energyContainer) energyContainer.style.display = 'flex';

  if (oxygenEl) {
    const productionText =
      resources.oxygenProduction > 0 ? ` (+${Math.floor(resources.oxygenProduction)}/s)` : '';
    oxygenEl.textContent = `${Math.floor(resources.oxygen)}${productionText}`;
  }

  if (foodEl) {
    const productionText =
      resources.foodProduction > 0 ? ` (+${Math.floor(resources.foodProduction)}/s)` : '';
    foodEl.textContent = `${Math.floor(resources.food)}${productionText}`;
  }

  if (waterEl) {
    const productionText =
      resources.waterProduction > 0 ? ` (+${Math.floor(resources.waterProduction)}/s)` : '';
    waterEl.textContent = `${Math.floor(resources.water)}${productionText}`;
  }

  if (energyEl) {
    const production = Math.floor(resources.energyProduction);
    const required = Math.floor(resources.energyRequired);

    energyEl.textContent = `${required}/${production}`;

    if (required > production) {
      energyEl.style.color = '#FF6B6B';
    } else {
      energyEl.style.color = '#ffffff';
    }
  }
}
export function setupRefillButtons(scene: BABYLON.Scene, placementController: PlacementController) {
  const refillAstronautBtn = document.getElementById('refill-astronaut');
  const refillRoverBtn = document.getElementById('refill-rover');

  if (refillAstronautBtn) {
    refillAstronautBtn.onclick = () => {
      const refillOptions = (scene as any).currentRefillOptions;
      if (refillOptions?.building && refillOptions.canRefillAstronaut) {
        const success = placementController.refillAstronautFromBuilding(refillOptions.building);
        if (success) {
          console.log('Astronaut refilled successfully');
          if (Astronaut.selectedAstronaut) {
            updateResourceInfo(Astronaut.selectedAstronaut);
          }
        }
      }
    };
  }

  if (refillRoverBtn) {
    refillRoverBtn.onclick = () => {
      const refillOptions = (scene as any).currentRefillOptions;
      if (refillOptions?.building && refillOptions.canRefillRover) {
        const success = placementController.refillRoverFromBuilding(refillOptions.building);
        if (success) {
          console.log('Rover refilled successfully');
          if (Rover.selectedRover) {
            updateResourceInfo(Rover.selectedRover);
          }
        }
      }
    };
  }
}

export function updateRefillButtons(scene: BABYLON.Scene) {
  const refillOptions = (scene as any).currentRefillOptions;
  const refillAstronautBtn = document.getElementById('refill-astronaut');
  const refillRoverBtn = document.getElementById('refill-rover');

  if (refillAstronautBtn) {
    refillAstronautBtn.style.display = refillOptions?.canRefillAstronaut ? 'inline-flex' : 'none';
  }

  if (refillRoverBtn) {
    refillRoverBtn.style.display = refillOptions?.canRefillRover ? 'inline-flex' : 'none';
  }
}

export function hideRefillButtons() {
  const refillAstronautBtn = document.getElementById('refill-astronaut');
  const refillRoverBtn = document.getElementById('refill-rover');

  if (refillAstronautBtn) refillAstronautBtn.style.display = 'none';
  if (refillRoverBtn) refillRoverBtn.style.display = 'none';
}
