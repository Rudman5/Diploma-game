import * as BABYLON from 'babylonjs';
export class AppOne {
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.engine = new BABYLON.Engine(canvas);
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
    this.scene = createScene(this.engine, this.canvas);
  }

  debug(debugOn: boolean = true) {
    if (debugOn) {
      this.scene.debugLayer.show({ overlay: true });
    } else {
      this.scene.debugLayer.hide();
    }
  }

  run() {
    // this.debug(true);
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }
}

const createScene = function (engine: BABYLON.Engine, canvas: HTMLCanvasElement) {
  // this is the default code from the playground:

  // This creates a basic Babylon Scene object (non-mesh)
  const scene = new BABYLON.Scene(engine);

  // This creates and positions a free camera (non-mesh)
  const camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5, -10), scene);

  // This targets the camera to scene origin
  camera.setTarget(BABYLON.Vector3.Zero());

  // This attaches the camera to the canvas
  camera.attachControl(canvas, true);

  // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);

  // Default intensity is 1. Let's dim the light a small amount
  light.intensity = 0.7;

  // Our built-in 'sphere' shape.
  const sphere = BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: 2, segments: 32 }, scene);
  // Move the sphere upward 1/2 its height
  let startPos = 2;
  sphere.position.y = startPos;

  // Our built-in 'ground' shape.
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, scene);
  const groundMaterial = new BABYLON.StandardMaterial('groundMaterial', scene);
  groundMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.8, 0.5); // RGB for a greenish color
  ground.material = groundMaterial;
  groundMaterial.bumpTexture = new BABYLON.Texture('./normal.jpg', scene);
  //groundMaterial.bumpTexture.level = 0.125;

  const redMaterial = new BABYLON.StandardMaterial('redMaterial', scene);
  redMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0); // RGB for red
  sphere.material = redMaterial;

  let sphereVelocity = 0;
  const gravity = 0.009;
  const reboundLoss = 0.1;

  scene.registerBeforeRender(() => {
    sphereVelocity += gravity;
    let newY = sphere.position.y - sphereVelocity;
    sphere.position.y -= sphereVelocity;
    if (newY < 1) {
      sphereVelocity = (reboundLoss - 1) * sphereVelocity;
      newY = 1;
    }
    sphere.position.y = newY;
    if (Math.abs(sphereVelocity) <= gravity && newY < 1 + gravity) {
      sphere.position.y = startPos++;
    }
  });

  return scene;
};
