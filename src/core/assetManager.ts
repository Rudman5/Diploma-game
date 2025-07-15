import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

export async function loadCharacter(scene: BABYLON.Scene) {
  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    '',
    './models/',
    'animatedAstronaut.glb',
    scene
  );
  const hero = result.meshes[0];
  console.log(result);

  hero.scaling.scaleInPlace(1);

  const animName = 'Digging';
  if (animName) {
    const animationGroup = scene.getAnimationGroupByName(animName);
    animationGroup?.start(true);
  } else {
    console.warn('No animations found in model');
  }
}
