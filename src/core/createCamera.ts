import * as BABYLON from '@babylonjs/core';

export function createCamera(scene: BABYLON.Scene, canvas: HTMLCanvasElement) {
  const camera = new BABYLON.UniversalCamera('RTSCamera', new BABYLON.Vector3(0, 40, -60), scene);
  const tilt = Math.PI / 4;
  camera.rotation.x = tilt;
  camera.rotation.y = 0;
  camera.rotation.z = 0;
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  // Remove default mouse and keyboard inputs
  camera.inputs.removeByType('FreeCameraMouseInput');
  camera.inputs.removeByType('FreeCameraKeyboardMoveInput');

  // Movement and rotation keys
  const keys = { w: false, a: false, s: false, d: false, q: false, e: false };
  scene.onKeyboardObservable.add((info: { type: number; event: { code: string } }) => {
    const keyDown = info.type === BABYLON.KeyboardEventTypes.KEYDOWN;
    switch (info.event.code) {
      case 'KeyW':
        keys.w = keyDown;
        break;
      case 'KeyA':
        keys.a = keyDown;
        break;
      case 'KeyS':
        keys.s = keyDown;
        break;
      case 'KeyD':
        keys.d = keyDown;
        break;
      case 'KeyQ':
        keys.q = keyDown;
        break;
      case 'KeyE':
        keys.e = keyDown;
        break;
    }
  });

  const moveSpeed = 50;
  const rotationSpeed = 1; // radians per second

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    const yaw = camera.rotation.y;
    const forward = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new BABYLON.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    let dir = BABYLON.Vector3.Zero();
    if (keys.w) dir = dir.add(forward);
    if (keys.s) dir = dir.subtract(forward);
    if (keys.d) dir = dir.add(right);
    if (keys.a) dir = dir.subtract(right);

    // Rotation with Q/E
    if (keys.q) camera.rotation.y -= rotationSpeed * dt;
    if (keys.e) camera.rotation.y += rotationSpeed * dt;

    if (!dir.equalsToFloats(0, 0, 0)) {
      dir = dir.normalize();
      camera.position.addInPlace(dir.scale(moveSpeed * dt));
    }
  });

  const minZoom = 20;
  const maxZoom = 80;
  const zoomStep = 2;

  scene.onPrePointerObservable.add((pointerInfo) => {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
      const event = pointerInfo.event as WheelEvent;
      let newY = camera.position.y + event.deltaY * 0.01 * zoomStep;
      newY = BABYLON.Scalar.Clamp(newY, minZoom, maxZoom);
      if (newY !== camera.position.y) {
        camera.position.y = newY;
        camera.position.z = -camera.position.y / Math.tan(tilt);
      }
    }
  });

  return camera;
}
