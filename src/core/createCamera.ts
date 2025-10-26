/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  Matrix,
  Tools,
  Scalar,
  TmpVectors,
  PointerEventTypes,
  ICameraInput,
} from '@babylonjs/core';

enum ECameraMovement {
  KEYS = 0,
  MOUSE = 1,
}

interface CameraMetadata {
  movedBy: ECameraMovement | null;
  targetPosition: Vector3;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  targetZoom: number;
  maxZoom: number;
  minZoom: number;
  zoom: number;
  zoomSteps: number;
}

export function createRTSCamera(
  canvas: HTMLCanvasElement,
  engine: Engine,
  scene: Scene,
  groundWidth: number,
  groundLength: number
): UniversalCamera {
  const camera = new UniversalCamera('rtsCam', new Vector3(-14, 20, 10), scene);
  camera.setTarget(Vector3.Zero());
  camera.mode = UniversalCamera.PERSPECTIVE_CAMERA;
  camera.speed = 1;
  camera.fov = 1.0;

  const halfWidth = groundWidth / 2;
  const halfZ = groundLength / 2;

  camera.metadata = {
    movedBy: null,
    targetPosition: camera.position.clone(),
    radius: new Vector3(camera.position.x, 0, camera.position.z)
      .subtract(new Vector3(camera.target.x, 0, camera.target.z))
      .length(),
    rotation: Tools.ToRadians(180) + camera.rotation.y,
    rotationSpeed: 0.02,
    minX: -halfWidth,
    maxX: halfWidth,
    minZ: -halfZ,
    maxZ: halfZ,
    targetZoom: camera.fov,
    maxZoom: 1.4,
    minZoom: 0.5,
    zoom: 0.005,
    zoomSteps: 0.2,
  } as CameraMetadata;

  camera.inputs.clear();

  // camera.inputs.add(new CameraEdgeScrollInput(canvas, camera));
  camera.inputs.add(new CameraKeyboardInput(camera));
  camera.inputs.add(new CameraMouseWheelInput(camera, scene));

  camera.attachControl(canvas, true);
  return camera;
}

// ---------- Edge scrolling ----------
class CameraEdgeScrollInput implements ICameraInput<UniversalCamera> {
  public camera: UniversalCamera;
  private canvas: HTMLCanvasElement;
  private _enabled = true;

  private mouseX = 0;
  private mouseY = 0;
  private canvasWidth: number;
  private canvasHeight: number;

  private readonly widthPercent = 0.05;
  private readonly heightPercent = 0.05;

  constructor(canvas: HTMLCanvasElement, camera: UniversalCamera) {
    this.canvas = canvas;
    this.camera = camera;
    this.canvasWidth = canvas.clientWidth;
    this.canvasHeight = canvas.clientHeight;

    window.addEventListener('resize', () => {
      this.canvasWidth = canvas.clientWidth;
      this.canvasHeight = canvas.clientHeight;
    });
  }

  getClassName(): string {
    return 'CameraEdgeScrollInput';
  }
  getSimpleName(): string {
    return 'edgeScroll';
  }

  attachControl(): void {
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.canvas.addEventListener('mouseenter', this.onMouseEnter);
  }

  detachControl(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('mouseenter', this.onMouseEnter);
  }
  private onMouseMove = (evt: MouseEvent) => {
    this.mouseX = evt.offsetX / this.canvasWidth;
    this.mouseY = evt.offsetY / this.canvasHeight;
  };

  private onMouseLeave = () => {
    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this._enabled = false;
  };

  private onMouseEnter = () => {
    this._enabled = true;
  };

  checkInputs(): void {
    if (!this._enabled) return;

    const cam = this.camera;
    const meta = cam.metadata as CameraMetadata;
    const dir = TmpVectors.Vector3[0].set(0, 0, 0);

    if (this.mouseY <= this.heightPercent) dir.z += cam.speed;
    if (this.mouseY >= 1 - this.heightPercent) dir.z -= cam.speed;
    if (this.mouseX <= this.widthPercent) dir.x -= cam.speed;
    if (this.mouseX >= 1 - this.widthPercent) dir.x += cam.speed;

    if (!dir.equals(Vector3.Zero())) {
      const rotMat = TmpVectors.Matrix[0];
      Matrix.RotationYToRef(cam.rotation.y, rotMat);
      Vector3.TransformCoordinatesToRef(dir, rotMat, dir);
      meta.targetPosition.addInPlace(dir);
      meta.movedBy = ECameraMovement.MOUSE;
    }

    meta.targetPosition.x = Scalar.Clamp(meta.targetPosition.x, meta.minX, meta.maxX);
    meta.targetPosition.z = Scalar.Clamp(meta.targetPosition.z, meta.minZ, meta.maxZ);

    const tmp = TmpVectors.Vector3[1];
    meta.targetPosition.subtractToRef(cam.position, tmp);
    const diff = tmp.length();
    if (diff > 0 && meta.movedBy === ECameraMovement.MOUSE) {
      const t = diff < 0.01 ? 1 : 0.02;
      Vector3.LerpToRef(cam.position, meta.targetPosition, t, cam.position);
      if (t === 1) meta.movedBy = null;
    }
  }
}

// ---------- Keyboard ----------
class CameraKeyboardInput implements ICameraInput<UniversalCamera> {
  public camera: UniversalCamera;
  private keys = new Set<number>();

  private keysUp = [38, 87];
  private keysDown = [40, 83];
  private keysLeft = [37, 65];
  private keysRight = [39, 68];
  private rotateLeft = [81]; // Q
  private rotateRight = [69]; // E

  constructor(camera: UniversalCamera) {
    this.camera = camera;
  }

  getClassName(): string {
    return 'CameraKeyboardInput';
  }
  getSimpleName(): string {
    return 'keyboard';
  }

  attachControl(): void {
    const element = this.camera.getEngine().getInputElement() as HTMLElement;
    element.tabIndex = 1;
    element.addEventListener('keydown', this.onKeyDown);
    element.addEventListener('keyup', this.onKeyUp);
  }
  detachControl(): void {
    const element = this.camera.getEngine().getInputElement() as HTMLElement;
    element.removeEventListener('keydown', this.onKeyDown);
    element.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  checkInputs(): void {
    const cam = this.camera;
    const meta = cam.metadata as CameraMetadata;
    const dir = TmpVectors.Vector3[2].set(0, 0, 0);

    this.keys.forEach((kc) => {
      if (this.keysLeft.includes(kc)) dir.x -= cam.speed;
      if (this.keysRight.includes(kc)) dir.x += cam.speed;
      if (this.keysUp.includes(kc)) dir.z += cam.speed;
      if (this.keysDown.includes(kc)) dir.z -= cam.speed;

      if (this.rotateLeft.includes(kc)) this.updateRotation(meta.rotation + meta.rotationSpeed);
      if (this.rotateRight.includes(kc)) this.updateRotation(meta.rotation - meta.rotationSpeed);
    });

    if (!dir.equals(Vector3.Zero())) {
      const rotMat = TmpVectors.Matrix[1];
      Matrix.RotationYToRef(cam.rotation.y, rotMat);
      Vector3.TransformCoordinatesToRef(dir, rotMat, dir);
      meta.targetPosition.addInPlace(dir);
      meta.movedBy = ECameraMovement.KEYS;
    }

    meta.targetPosition.x = Scalar.Clamp(meta.targetPosition.x, meta.minX, meta.maxX);
    meta.targetPosition.z = Scalar.Clamp(meta.targetPosition.z, meta.minZ, meta.maxZ);

    const tmp = TmpVectors.Vector3[3];
    meta.targetPosition.subtractToRef(cam.position, tmp);
    const diff = tmp.length();
    if (diff > 0 && meta.movedBy === ECameraMovement.KEYS) {
      const t = diff < 0.01 ? 1 : 0.02;
      Vector3.LerpToRef(cam.position, meta.targetPosition, t, cam.position);
      if (t === 1) meta.movedBy = null;
    }
  }

  private onKeyDown = (evt: KeyboardEvent) => {
    if (
      [
        ...this.keysUp,
        ...this.keysDown,
        ...this.keysLeft,
        ...this.keysRight,
        ...this.rotateLeft,
        ...this.rotateRight,
      ].includes(evt.keyCode)
    ) {
      this.keys.add(evt.keyCode);
      evt.preventDefault();
      const meta = this.camera.metadata as CameraMetadata;
      if (meta.movedBy === null) meta.movedBy = ECameraMovement.KEYS;
    }
  };

  private onKeyUp = (evt: KeyboardEvent) => {
    this.keys.delete(evt.keyCode);
    evt.preventDefault();
  };

  private updateRotation(newRotation: number): void {
    const cam = this.camera;
    const meta = cam.metadata as CameraMetadata;
    meta.rotation = newRotation;

    const tx = cam.target.x;
    const tz = cam.target.z;
    const x = tx + meta.radius * Math.sin(meta.rotation);
    const z = tz + meta.radius * Math.cos(meta.rotation);

    cam.position.set(x, cam.position.y, z);
    cam.setTarget(new Vector3(tx, 0, tz));
    meta.targetPosition.copyFrom(cam.position);
  }
}

// ---------- Mouse wheel ----------
class CameraMouseWheelInput implements ICameraInput<UniversalCamera> {
  public camera: UniversalCamera;
  private scene: Scene;
  private wheelDelta = 0;

  constructor(camera: UniversalCamera, scene: Scene) {
    this.camera = camera;
    this.scene = scene;

    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERWHEEL && info.event) {
        this.wheelDelta += (info.event as WheelEvent).deltaY;
      }
    });
  }

  getClassName(): string {
    return 'CameraMouseWheelInput';
  }
  getSimpleName(): string {
    return 'mouseWheel';
  }

  attachControl(): void {}
  detachControl(): void {}

  checkInputs(): void {
    if (!this.wheelDelta) return;

    const cam = this.camera;
    const meta = cam.metadata as CameraMetadata;
    meta.targetZoom = Scalar.Clamp(
      meta.targetZoom + (this.wheelDelta > 0 ? meta.zoomSteps : -meta.zoomSteps),
      meta.minZoom,
      meta.maxZoom
    );

    this.wheelDelta = 0;
    const diff = cam.fov - meta.targetZoom;
    if (Math.abs(diff) <= meta.zoom) cam.fov = meta.targetZoom;
    else cam.fov += diff > 0 ? -meta.zoom : meta.zoom;
  }
}

export function moveCameraTo(camera: UniversalCamera, target: Vector3) {
  const meta = camera.metadata as CameraMetadata;
  const radius = meta.radius;
  const rotation = meta.rotation;
  const newPosX = target.x + radius * Math.sin(rotation);
  const newPosZ = target.z + radius * Math.cos(rotation);
  const newPosY = camera.position.y;
  meta.targetPosition.copyFrom(camera.position.set(newPosX, newPosY, newPosZ));
}
