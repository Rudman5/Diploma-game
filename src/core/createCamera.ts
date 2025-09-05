import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  Matrix,
  Tools,
  PointerEventTypes,
  ICameraInput,
  Scalar,
  GroundMesh,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, Control } from '@babylonjs/gui';

// Define movement sources
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

// Factory to build and initialize the camera with custom inputs
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
  const margin = 0;
  camera.metadata = {
    movedBy: null,
    targetPosition: camera.position.clone(),
    radius: new Vector3(camera.position.x, 0, camera.position.z)
      .subtract(new Vector3(camera.target.x, 0, camera.target.z))
      .length(),
    rotation: Tools.ToRadians(180) + camera.rotation.y,
    rotationSpeed: 0.02,
    minX: -halfWidth - margin,
    maxX: halfWidth + margin,
    minZ: -halfZ - margin,
    maxZ: halfZ + margin,
    targetZoom: camera.fov,
    maxZoom: 1.4,
    minZoom: 0.5,
    zoom: 0.005,
    zoomSteps: 0.2,
  } as CameraMetadata;

  camera.inputs.clear();

  const ui = AdvancedDynamicTexture.CreateFullscreenUI('UI');

  camera.inputs.add(new CameraEdgeScrollInput(ui, camera));
  camera.inputs.add(new CameraKeyboardInput(camera));
  camera.inputs.add(new CameraMouseWheelInput(camera, scene));

  camera.attachControl(canvas, true);
  return camera;
}

// Edge-scrolling input
class CameraEdgeScrollInput implements ICameraInput<UniversalCamera> {
  public camera: UniversalCamera;
  private ui: AdvancedDynamicTexture;

  private _enabled = true;
  private _top = false;
  private _right = false;
  private _bottom = false;
  private _left = false;

  private readonly widthPercent = 0.05;
  private readonly heightPercent = 0.05;
  private readonly alpha = 1.0;

  private topRect = new Rectangle();
  private rightRect = new Rectangle();
  private bottomRect = new Rectangle();
  private leftRect = new Rectangle();

  constructor(ui: AdvancedDynamicTexture, camera: UniversalCamera) {
    this.ui = ui;
    this.camera = camera;
  }

  getClassName(): string {
    return 'CameraEdgeScrollInput';
  }
  getSimpleName(): string {
    return 'edgeScroll';
  }

  attachControl(): void {
    const cam = this.camera;
    const meta = cam.metadata as CameraMetadata;

    const setupRect = (
      rect: Rectangle,
      width: number,
      height: number,
      hAlign: number,
      vAlign: number,
      onEnter: () => void
    ) => {
      rect.thickness = 0;
      rect.width = width;
      rect.height = height;
      rect.horizontalAlignment = hAlign;
      rect.verticalAlignment = vAlign;
      rect.background = 'transparent';
      rect.isPointerBlocker = false;
      rect.alpha = this.alpha;
      this.ui.addControl(rect);
      rect.onPointerEnterObservable.add(onEnter);
      rect.onPointerOutObservable.add(() => {
        this._top = this._right = this._bottom = this._left = false;
      });
    };

    setupRect(
      this.topRect,
      1 - 2 * this.heightPercent,
      this.heightPercent,
      Control.HORIZONTAL_ALIGNMENT_CENTER,
      Control.VERTICAL_ALIGNMENT_TOP,
      () => {
        this._top = true;
        meta.movedBy = meta.movedBy ?? ECameraMovement.MOUSE;
      }
    );

    setupRect(
      this.rightRect,
      this.widthPercent,
      1 - 2 * this.widthPercent,
      Control.HORIZONTAL_ALIGNMENT_RIGHT,
      Control.VERTICAL_ALIGNMENT_CENTER,
      () => {
        this._right = true;
        meta.movedBy = meta.movedBy ?? ECameraMovement.MOUSE;
      }
    );

    setupRect(
      this.bottomRect,
      1 - 2 * this.heightPercent,
      this.heightPercent,
      Control.HORIZONTAL_ALIGNMENT_CENTER,
      Control.VERTICAL_ALIGNMENT_BOTTOM,
      () => {
        this._bottom = true;
        meta.movedBy = meta.movedBy ?? ECameraMovement.MOUSE;
      }
    );

    setupRect(
      this.leftRect,
      this.widthPercent,
      1 - 2 * this.widthPercent,
      Control.HORIZONTAL_ALIGNMENT_LEFT,
      Control.VERTICAL_ALIGNMENT_CENTER,
      () => {
        this._left = true;
        meta.movedBy = meta.movedBy ?? ECameraMovement.MOUSE;
      }
    );
  }

  detachControl(): void {
    [this.topRect, this.rightRect, this.bottomRect, this.leftRect].forEach((r) =>
      this.ui.removeControl(r)
    );
  }

  checkInputs(): void {
    if (!this._enabled) return;

    const cam = this.camera;
    const meta = cam.metadata as CameraMetadata;
    const dir = new Vector3();

    if (this._top) dir.z += cam.speed;
    if (this._bottom) dir.z -= cam.speed;
    if (this._left) dir.x -= cam.speed;
    if (this._right) dir.x += cam.speed;

    if (!dir.equals(Vector3.Zero())) {
      const move = Vector3.TransformCoordinates(dir, Matrix.RotationY(cam.rotation.y));
      meta.targetPosition.addInPlace(move);
      meta.movedBy = ECameraMovement.MOUSE;
    }

    meta.targetPosition.x = Scalar.Clamp(meta.targetPosition.x, meta.minX, meta.maxX);
    meta.targetPosition.z = Scalar.Clamp(meta.targetPosition.z, meta.minZ, meta.maxZ);

    const diff = meta.targetPosition.subtract(cam.position).length();
    if (diff > 0 && meta.movedBy === ECameraMovement.MOUSE) {
      const t = diff < 0.01 ? 1 : 0.02;
      cam.position = Vector3.Lerp(cam.position, meta.targetPosition, t);
      if (t === 1) meta.movedBy = null;
    }
  }
}

// Keyboard movement + rotation
class CameraKeyboardInput implements ICameraInput<UniversalCamera> {
  public camera: UniversalCamera;
  private keys: number[] = [];

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
    this.keys = [];
  }

  checkInputs(): void {
    const cam = this.camera;
    const meta = cam.metadata as CameraMetadata;

    this.keys.forEach((kc) => {
      const dir = new Vector3();

      if (this.keysLeft.includes(kc)) dir.x -= cam.speed;
      if (this.keysRight.includes(kc)) dir.x += cam.speed;
      if (this.keysUp.includes(kc)) dir.z += cam.speed;
      if (this.keysDown.includes(kc)) dir.z -= cam.speed;

      if (!dir.equals(Vector3.Zero())) {
        const move = Vector3.TransformCoordinates(dir, Matrix.RotationY(cam.rotation.y));
        meta.targetPosition.addInPlace(move);
        meta.movedBy = ECameraMovement.KEYS;
      } else if (this.rotateLeft.includes(kc)) {
        meta.rotation += meta.rotationSpeed;
        this.updateRotation();
      } else if (this.rotateRight.includes(kc)) {
        meta.rotation -= meta.rotationSpeed;
        this.updateRotation();
      }
    });

    meta.targetPosition.x = Scalar.Clamp(meta.targetPosition.x, meta.minX, meta.maxX);
    meta.targetPosition.z = Scalar.Clamp(meta.targetPosition.z, meta.minZ, meta.maxZ);

    const diff = meta.targetPosition.subtract(cam.position).length();
    if (diff > 0 && meta.movedBy === ECameraMovement.KEYS) {
      const t = diff < 0.01 ? 1 : 0.02;
      cam.position = Vector3.Lerp(cam.position, meta.targetPosition, t);
      if (t === 1) meta.movedBy = null;
    }
  }

  private onKeyDown = (evt: KeyboardEvent) => {
    if (
      this.keysUp.includes(evt.keyCode) ||
      this.keysDown.includes(evt.keyCode) ||
      this.keysLeft.includes(evt.keyCode) ||
      this.keysRight.includes(evt.keyCode) ||
      this.rotateLeft.includes(evt.keyCode) ||
      this.rotateRight.includes(evt.keyCode)
    ) {
      if (!this.keys.includes(evt.keyCode)) this.keys.push(evt.keyCode);
      evt.preventDefault();

      const meta = this.camera.metadata as CameraMetadata;
      if (meta.movedBy === null) meta.movedBy = ECameraMovement.KEYS;
    }
  };

  private onKeyUp = (evt: KeyboardEvent) => {
    const idx = this.keys.indexOf(evt.keyCode);
    if (idx >= 0) this.keys.splice(idx, 1);
    evt.preventDefault();
  };

  private updateRotation(): void {
    const cam = this.camera;
    const meta = cam.metadata as CameraMetadata;

    const tx = cam.target.x;
    const tz = cam.target.z;
    const x = tx + meta.radius * Math.sin(meta.rotation);
    const z = tz + meta.radius * Math.cos(meta.rotation);

    cam.position = new Vector3(x, cam.position.y, z);
    cam.setTarget(new Vector3(tx, 0, tz));
    meta.targetPosition.copyFrom(cam.position);
  }
}

// Mouse wheel zoom input
class CameraMouseWheelInput implements ICameraInput<UniversalCamera> {
  public camera: UniversalCamera;
  private scene: Scene;
  private wheelDelta = 0;

  constructor(camera: UniversalCamera, scene: Scene) {
    this.camera = camera;
    this.scene = scene;
  }

  getClassName(): string {
    return 'CameraMouseWheelInput';
  }
  getSimpleName(): string {
    return 'mouseWheel';
  }

  attachControl(): void {
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERWHEEL && info.event) {
        this.wheelDelta += (info.event as WheelEvent).deltaY;
      }
    }, PointerEventTypes.POINTERWHEEL);
  }

  detachControl(): void {
    // No explicit observer removal here for brevity
  }

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

    if (Math.abs(diff) <= meta.zoom) {
      cam.fov = meta.targetZoom;
    } else {
      cam.fov += diff > 0 ? -meta.zoom : meta.zoom;
    }
  }
}
