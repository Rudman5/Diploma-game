import { Astronaut } from '../modelCreation/astronaut';
import { PlacementController } from '../modelCreation/placementController';
import * as BABYLON from '@babylonjs/core';
import { Rover } from '../modelCreation/rover';
import { moveCameraTo } from './createCamera';
import { modelFiles } from '../constants';
import { ResourceManager } from './resourceManager';
import { showAlert } from './alertSystem';

let clickSound: BABYLON.StaticSound | null = null;
let landingPadTargetArea: { center: BABYLON.Vector3; radius: number } | null = null;
let distanceUpdateInterval: number | null = null;
let landingPadUnlocked = false;

function playClickSound() {
  if (clickSound) {
    clickSound.play();
  }
}

export function createGui(
  placementController: PlacementController,
  ground: BABYLON.GroundMesh,
  scene: BABYLON.Scene
) {
  BABYLON.CreateSoundAsync('clickSound', './sounds/click.mp3', {
    loop: false,
    autoplay: false,
    volume: 0.5,
  })
    .then((sound) => {
      clickSound = sound;
    })
    .catch((error) => {
      console.warn('Could not load click sound:', error);
    });

  landingPadTargetArea = {
    center: new BABYLON.Vector3(-1889.55, 0, 1214.24),
    // center: new BABYLON.Vector3(120, 0, -1594.7614144),
    radius: 50,
  };
  createLandingPadTargetCircle(scene, ground);
  startLandingPadDistanceTracking(scene);

  const modelButtonsContainer = document.getElementById('model-buttons')!;
  let activeButton: HTMLButtonElement | null = null;

  function refreshSubMenu() {
    const resourceManager: ResourceManager = (scene as any).resourceManager;
    modelButtonsContainer.innerHTML = '';

    Object.entries(modelFiles).forEach(([key, data]) => {
      const btn = document.createElement('button');
      btn.className = 'menu-btn model-btn';

      const img = document.createElement('img');
      img.src = `assets/${data.img}`;
      img.alt = data.metadata.name;
      btn.appendChild(img);

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';

      const rockCost = data.metadata.rocksNeeded || 0;
      const canAfford = resourceManager ? resourceManager.getAvailableRocks() >= rockCost : true;

      const isLandingPad = data.metadata.name === 'Artemis landing pad';

      if (!canAfford) {
        btn.classList.add('disabled');
        tooltip.textContent = `${data.metadata.name} (Cost: ${rockCost} rocks) - Not enough rocks`;
        btn.title = `Requires ${rockCost} rocks`;
      } else if (isLandingPad && !landingPadUnlocked) {
        btn.classList.add('disabled');
        tooltip.textContent = `${data.metadata.name} (Cost: ${rockCost} rocks) - Bring an astronaut to the landing zone first`;
        btn.title = 'Bring an astronaut to the landing zone first';
      } else {
        tooltip.textContent = `${data.metadata.name} (Cost: ${rockCost} rocks)`;
      }

      btn.appendChild(tooltip);

      btn.addEventListener('click', () => {
        playClickSound();
        if (btn.classList.contains('disabled')) {
          if (isLandingPad && !landingPadUnlocked) {
            showAlert('Bring an astronaut to the landing zone first!', 'warning');
          }
          return;
        }

        if (!canAfford) {
          return;
        }

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

  (scene as any).refreshBuildingMenu = refreshSubMenu;
  setupLeaveButton();
  refreshSubMenu();
  setupRefillButtons(scene, placementController);
  updateGlobalResourceDisplay(scene);
}

export function updateBuildingButtons(scene: BABYLON.Scene) {
  const refreshSubMenu = (scene as any).refreshBuildingMenu;
  if (refreshSubMenu) {
    refreshSubMenu();
  }
}

function setupLeaveButton() {
  const leaveBtn = document.getElementById('leave-rover-btn')!;
  if (!leaveBtn) return;

  leaveBtn.onclick = () => {
    playClickSound();

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
      playClickSound();
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
  const rocksContainer = document.getElementById('rocks');
  if (rocksContainer) rocksContainer.style.display = 'none';

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
    playClickSound();
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
  const rocksEl = document.getElementById('rocks-count');

  const oxygenContainer = document.getElementById('oxygen');
  const foodContainer = document.getElementById('food');
  const waterContainer = document.getElementById('water');
  const energyContainer = document.getElementById('energy');
  const rocksContainer = document.getElementById('rocks');

  if (nameEl) {
    nameEl.textContent = 'Global Resources';
  }

  if (oxygenContainer) oxygenContainer.style.display = 'flex';
  if (foodContainer) foodContainer.style.display = 'flex';
  if (waterContainer) waterContainer.style.display = 'flex';
  if (energyContainer) energyContainer.style.display = 'flex';
  if (rocksContainer) rocksContainer.style.display = 'flex';

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

  if (rocksEl) {
    rocksEl.textContent = `${Math.floor(resources.rocks)}`;
  }
}

export function setupRefillButtons(scene: BABYLON.Scene, placementController: PlacementController) {
  const refillAstronautBtn = document.getElementById('refill-astronaut');
  const refillRoverBtn = document.getElementById('refill-rover');

  if (refillAstronautBtn) {
    refillAstronautBtn.onclick = () => {
      playClickSound();
      const refillOptions = (scene as any).currentRefillOptions;
      if (refillOptions?.building && refillOptions.canRefillAstronaut) {
        const success = placementController.refillAstronautFromBuilding(refillOptions.building);
        if (success) {
          showAlert('Astronaut refilled successfully', 'success');
          if (Astronaut.selectedAstronaut) {
            updateResourceInfo(Astronaut.selectedAstronaut);
          }
        }
      }
    };
  }

  if (refillRoverBtn) {
    refillRoverBtn.onclick = () => {
      playClickSound();
      const refillOptions = (scene as any).currentRefillOptions;
      if (refillOptions?.building && refillOptions.canRefillRover) {
        const success = placementController.refillRoverFromBuilding(refillOptions.building);
        if (success) {
          showAlert('Rover refilled successfully', 'success');
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

function startLandingPadDistanceTracking(scene: BABYLON.Scene) {
  if (distanceUpdateInterval) {
    clearInterval(distanceUpdateInterval);
  }

  distanceUpdateInterval = window.setInterval(() => {
    updateLandingPadDistanceInfo(scene);
  }, 500);
}

function updateLandingPadDistanceInfo(scene: BABYLON.Scene) {
  if (!landingPadTargetArea) return;

  const closestInfo = findClosestAstronautToLandingPad();
  const distanceElement = document.getElementById('landing-distance');

  if (!distanceElement) return;

  if (Astronaut.allAstronauts.length > 0) {
    if (closestInfo) {
      const distance = Math.floor(closestInfo.distance);
      distanceElement.textContent = `${distance}m`;

      if (distance <= landingPadTargetArea.radius) {
        if (!landingPadUnlocked) {
          landingPadUnlocked = true;
          unlockLandingPadButton();
          showAlert(
            `${closestInfo.astronaut.name} has reached the landing zone! Landing pad unlocked!`,
            'success'
          );
        }
      }
    } else {
      distanceElement.textContent = '-';
      distanceElement.style.color = '#ffffff';
    }
  }
}

function findClosestAstronautToLandingPad(): { astronaut: Astronaut; distance: number } | null {
  if (!landingPadTargetArea || Astronaut.allAstronauts.length === 0) {
    return null;
  }

  let closestAstronaut: Astronaut | null = null;
  let minDistance = Number.MAX_VALUE;

  for (const astronaut of Astronaut.allAstronauts) {
    let position: BABYLON.Vector3;

    if (astronaut.rover && astronaut.rover.mesh) {
      position = astronaut.rover.mesh.position;
    } else if (astronaut.mesh) {
      position = astronaut.mesh.position;
    } else {
      continue;
    }

    const distance = BABYLON.Vector3.Distance(position, landingPadTargetArea.center);

    if (distance < minDistance) {
      minDistance = distance;
      closestAstronaut = astronaut;
    }
  }
  console.log(closestAstronaut);
  return closestAstronaut ? { astronaut: closestAstronaut, distance: minDistance } : null;
}

function unlockLandingPadButton() {
  const landingPadButton = findLandingPadButton();
  if (landingPadButton) {
    landingPadButton.classList.remove('disabled');
    landingPadButton.title = 'Place Landing Pad';

    landingPadButton.style.border = '2px solid #4CAF50';
    landingPadButton.style.boxShadow = '0 0 10px #4CAF50';

    setTimeout(() => {
      if (landingPadButton) {
        landingPadButton.style.border = '';
        landingPadButton.style.boxShadow = '';
      }
    }, 2000);

    const refreshSubMenu = (window as any).refreshBuildingMenu;
    if (refreshSubMenu) {
      refreshSubMenu();
    }
  }
}

function findLandingPadButton(): HTMLButtonElement | null {
  const modelButtonsContainer = document.getElementById('model-buttons');
  if (!modelButtonsContainer) return null;

  const buttons = modelButtonsContainer.querySelectorAll('.model-btn');
  for (const button of buttons) {
    const img = button.querySelector('img');
    if (img) {
      const altText = img.alt.toLowerCase();
      if (altText.includes('landing') || altText.includes('landingpad')) {
        return button as HTMLButtonElement;
      }
    }
  }

  return null;
}

export function isPositionInLandingPadArea(position: BABYLON.Vector3): boolean {
  if (!landingPadTargetArea) return false;

  const distance = BABYLON.Vector3.Distance(position, landingPadTargetArea.center);
  return distance <= landingPadTargetArea.radius;
}

function createLandingPadTargetCircle(scene: BABYLON.Scene, ground: BABYLON.GroundMesh) {
  const segments = 64;
  const points: BABYLON.Vector3[] = [];
  const center = landingPadTargetArea!.center;
  const radius = landingPadTargetArea!.radius;

  for (let i = 0; i <= segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    const x = center.x + Math.cos(angle) * radius;
    const z = center.z + Math.sin(angle) * radius;

    const pick = scene.pickWithRay(
      new BABYLON.Ray(new BABYLON.Vector3(x, 1000, z), BABYLON.Vector3.Down(), 2000),
      (m) => m === ground
    );
    const y = pick?.hit && pick.pickedPoint ? pick.pickedPoint.y + 0.1 : center.y + 0.1;

    points.push(new BABYLON.Vector3(x, y, z));
  }

  const circle = BABYLON.MeshBuilder.CreateLines(
    'landingPadTargetCircle',
    { points: points },
    scene
  );

  circle.color = new BABYLON.Color3(0, 1, 0);
  circle.alpha = 0.7;
  circle.isPickable = false;
  return circle;
}
