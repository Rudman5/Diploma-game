import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { AdvancedDynamicTexture, Button, StackPanel, Control } from '@babylonjs/gui';
import { PlacementController } from './placementController';

const modelFiles: string[] = [
  'apolloLunarModule.glb',
  'artemisRover.glb',
  'baseLarge.glb',
  'buildingPod.glb',
  'laboratory.glb',
  'solarPanelStructure.glb',
  'livingQuarters.glb',
];

export function createGUI(scene: BABYLON.Scene, engine: BABYLON.Engine) {
  const guiTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI');

  const MENU_WIDTH_PX = 700;
  const MENU_HEIGHT_PX = 100;
  const BUTTON_SIZE_PX = 80;
  const BUTTON_MARGIN_PX = 10;
  const BUTTONS_PER_ROW = Math.floor(
    (MENU_WIDTH_PX + BUTTON_MARGIN_PX) / (BUTTON_SIZE_PX + BUTTON_MARGIN_PX)
  );

  const placementController = new PlacementController(scene, engine);

  const mainMenuPanel = new StackPanel();
  mainMenuPanel.width = `${MENU_WIDTH_PX}px`;
  mainMenuPanel.height = `${MENU_HEIGHT_PX}px`;
  mainMenuPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  mainMenuPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  mainMenuPanel.isVertical = false;
  mainMenuPanel.spacing = BUTTON_MARGIN_PX;
  guiTexture.addControl(mainMenuPanel);

  const subMenuPanel = new StackPanel();
  subMenuPanel.width = `${MENU_WIDTH_PX}px`;
  subMenuPanel.height = `${MENU_HEIGHT_PX}px`;
  subMenuPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  subMenuPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  subMenuPanel.isVertical = false;
  subMenuPanel.spacing = BUTTON_MARGIN_PX;
  subMenuPanel.isVisible = false;
  guiTexture.addControl(subMenuPanel);

  function createButton(text: string, callback: () => void, isPlaceholder = false) {
    const btn = Button.CreateSimpleButton(text, text);
    btn.width = `${BUTTON_SIZE_PX}px`;
    btn.height = `${BUTTON_SIZE_PX}px`;
    btn.color = isPlaceholder ? 'transparent' : 'white';
    btn.background = isPlaceholder ? 'transparent' : 'gray';
    btn.cornerRadius = 10;
    btn.thickness = isPlaceholder ? 0 : 1;
    if (!isPlaceholder) {
      btn.onPointerUpObservable.add(callback);
    } else {
      btn.isHitTestVisible = false;
    }
    return btn;
  }

  mainMenuPanel.addControl(
    createButton('Buildings', () => {
      mainMenuPanel.isVisible = false;
      subMenuPanel.isVisible = true;
      refreshSubMenu();
    })
  );

  mainMenuPanel.addControl(
    createButton('Test', () => {
      console.log('Test clicked');
    })
  );

  const backButton = createButton('⬅ Back', () => {
    subMenuPanel.isVisible = false;
    mainMenuPanel.isVisible = true;
  });

  function refreshSubMenu() {
    subMenuPanel.clearControls();
    subMenuPanel.addControl(backButton);

    modelFiles.forEach((file) => {
      const name = file.replace('.glb', '');
      subMenuPanel.addControl(
        createButton(name, () => {
          placementController.startPlacingModel(file);
        })
      );
    });

    const totalButtons = modelFiles.length + 1;
    const placeholdersNeeded =
      BUTTONS_PER_ROW - (totalButtons % BUTTONS_PER_ROW || BUTTONS_PER_ROW);
    for (let i = 0; i < placeholdersNeeded; i++) {
      const placeholder = createButton('', () => {}, true);
      subMenuPanel.addControl(placeholder);
    }
  }
}
