import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

export class Astronaut {
  private scene: BABYLON.Scene;
  private mesh: BABYLON.AbstractMesh | null = null;
  private animations: Map<string, BABYLON.AnimationGroup> = new Map();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  // Load astronaut model and animations
  async load() {
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      '',
      './models/',
      'animatedAstronaut.glb',
      this.scene
    );

    this.mesh = result.meshes[0];
    this.mesh.scaling.scaleInPlace(1);
    this.mesh.isPickable = true;

    // Store animations
    result.animationGroups.forEach((anim) => {
      this.animations.set(anim.name, anim);
    });

    console.log('Astronaut loaded with animations:', [...this.animations.keys()]);
  }

  // Play a named animation
  playAnimation(name: string, loop = true) {
    this.animations.forEach((anim) => anim.stop()); // stop all
    const anim = this.animations.get(name);
    if (anim) anim.start(loop);
  }

  // Example actions
  walkTo(target: BABYLON.Vector3) {
    if (!this.mesh) return;
    this.playAnimation('Walking');

    const speed = 0.1;
    const scene = this.scene;
    scene.onBeforeRenderObservable.add(() => {
      if (!this.mesh) return;
      const dir = target.subtract(this.mesh.position);
      if (dir.length() > 0.1) {
        dir.normalize();
        this.mesh.moveWithCollisions(dir.scale(speed));
      } else {
        this.playAnimation('Idle'); // stop walking when reached
      }
    });
  }

  dig() {
    this.playAnimation('Digging');
  }

  build() {
    this.playAnimation('Building');
  }

  select() {
    if (!this.mesh) return;
    console.log('Astronaut selected!');
    // You can add highlight or outline effect here
  }
  isMesh(mesh: BABYLON.AbstractMesh) {
    return mesh === this.mesh;
  }
}
