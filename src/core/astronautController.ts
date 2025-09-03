import * as BABYLON from '@babylonjs/core';
import { Astronaut } from './astronaut';

export class AstronautController {
  private scene: BABYLON.Scene;
  private camera: BABYLON.Camera;
  private astronaut: Astronaut;
  private isSelected = false;

  constructor(scene: BABYLON.Scene, camera: BABYLON.Camera, astronaut: Astronaut) {
    this.scene = scene;
    this.camera = camera;
    this.astronaut = astronaut;

    this.setupSelection();
    this.setupClickCommands();
  }

  // Allow selecting astronaut by clicking
  private setupSelection() {
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERPICK) {
        const pick = pointerInfo.pickInfo;
        if (!pick?.hit) return;
        console.log(pick.pickedMesh);
        if (pick.pickedMesh && this.astronaut.isMesh(pick.pickedMesh)) {
          this.isSelected = true;
          this.astronaut.select();
          console.log('Astronaut selected!');
        } else {
          this.isSelected = false;
        }
      }
    });
  }

  // Allow clicking ground or objects to command astronaut
  private setupClickCommands() {
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.isSelected) return;
      if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;

      const pick = pointerInfo.pickInfo;
      if (!pick?.hit || !pick.pickedPoint) return;

      const target = pick.pickedPoint.clone();
      console.log('Moving astronaut to:', target);
      this.astronaut.walkTo(target);
    });
  }
}
