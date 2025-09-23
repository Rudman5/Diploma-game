import * as BABYLON from '@babylonjs/core';

export interface Selectable {
  mesh: BABYLON.AbstractMesh;
  select(): void;
  deselect(): void;
}

export class SelectionManager {
  private static _selected: Selectable | null = null;

  static setSelection(obj: Selectable | null) {
    if (SelectionManager._selected === obj) return;

    SelectionManager._selected?.deselect();
    SelectionManager._selected = obj;
    SelectionManager._selected?.select();
  }

  static getSelected(): Selectable | null {
    return SelectionManager._selected;
  }

  static clear() {
    SelectionManager.setSelection(null);
  }
}
