import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders';
import { createScene } from './createScene';
import { Astronaut } from '../modelCreation/astronaut';

export class App {
  engine: BABYLON.Engine;
  scene!: BABYLON.Scene;
  private guiContainer: HTMLElement | null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.engine = new BABYLON.Engine(canvas, true);
    this.guiContainer = document.getElementById('gui-container');
    window.addEventListener('resize', () => this.engine.resize());
  }

  async run() {
    this.showLoadingScreen();
    this.hideGuiContainer();

    await BABYLON.CreateAudioEngineAsync({ resumeOnInteraction: true });

    this.scene = await createScene(this.engine, this.canvas);

    this.hideLoadingScreen();
    this.showGuiContainer();

    this.engine.runRenderLoop(() => this.scene.render());
  }

  private showLoadingScreen() {
    this.engine.displayLoadingUI();
  }

  private hideLoadingScreen() {
    this.engine.hideLoadingUI();
  }

  private showGuiContainer() {
    if (this.guiContainer) {
      this.guiContainer.style.display = 'flex';
    }
  }

  private hideGuiContainer() {
    if (this.guiContainer) {
      this.guiContainer.style.display = 'none';
    }
  }
}

export function gameWon() {
  const gameWonContainer = document.getElementById('game-won');
  const startNewButton = document.getElementById('start-new');

  if (!gameWonContainer || !startNewButton) return;

  gameWonContainer.classList.remove('hidden');

  if (startNewButton) {
    startNewButton.addEventListener('click', startNewGame);
  }
}

export function gameOver(astronaut: Astronaut) {
  const gameOverContainer = document.getElementById('game-over');
  const astronautName = document.getElementById('astronaut-name');
  const startNewButton = document.getElementById('start-new');

  if (!gameOverContainer || !astronautName || !startNewButton) return;

  gameOverContainer.classList.remove('hidden');
  astronautName.innerHTML = astronaut.name + ' has died';

  if (startNewButton) {
    startNewButton.addEventListener('click', startNewGame);
  }
}

export function startNewGame() {
  const gameOverContainer = document.getElementById('game-over');
  if (gameOverContainer) {
    gameOverContainer.style.display = 'none';
  }

  window.location.reload();
}
