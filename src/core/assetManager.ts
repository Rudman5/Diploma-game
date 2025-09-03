import * as BABYLON from '@babylonjs/core';
import { Astronaut } from './astronaut';

export async function loadAssets(scene: BABYLON.Scene) {
  const astronaut = new Astronaut(scene);
  await astronaut.load();
  return astronaut;
}
