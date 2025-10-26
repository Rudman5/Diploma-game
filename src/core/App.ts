import * as BABYLON from '@babylonjs/core';
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
    showGameObjective();

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
  const gameDetailsContainer = document.getElementById('game-details');
  const gameWonContainer = document.getElementById('game-won');
  const startNewButton = document.getElementById('start-new');

  if (!gameWonContainer || !startNewButton || !gameDetailsContainer) return;

  gameWonContainer.classList.remove('hidden');
  gameDetailsContainer.classList.remove('hidden');

  startNewButton.replaceWith(startNewButton.cloneNode(true));
  const newButton = document.getElementById('start-new-won');
  if (newButton) {
    newButton.addEventListener('click', startNewGame);
  }
}

export function gameOver(astronaut: Astronaut) {
  const gameDetailsContainer = document.getElementById('game-details');
  const gameOverContainer = document.getElementById('game-over');
  const astronautName = document.getElementById('astronaut-name');
  const startNewButton = document.getElementById('start-new');

  if (!gameOverContainer || !astronautName || !startNewButton || !gameDetailsContainer) return;

  gameOverContainer.classList.remove('hidden');
  gameDetailsContainer.classList.remove('hidden');
  astronautName.innerHTML = astronaut.name + ' has died';

  startNewButton.replaceWith(startNewButton.cloneNode(true));
  const newButton = document.getElementById('start-new');
  if (newButton) {
    newButton.addEventListener('click', startNewGame);
  }
}

export function startNewGame() {
  const gameOverContainer = document.getElementById('game-over');
  const gameWonContainer = document.getElementById('game-won');
  const gameObjectiveContainer = document.getElementById('game-objective');
  const gameDetailsContainer = document.getElementById('game-details');

  if (gameOverContainer) {
    gameOverContainer.classList.add('hidden');
  }
  if (gameWonContainer) {
    gameWonContainer.classList.add('hidden');
  }
  if (gameObjectiveContainer) {
    gameObjectiveContainer.classList.add('hidden');
  }
  if (gameDetailsContainer) {
    gameDetailsContainer.classList.add('hidden');
  }

  window.location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  const objectiveButton = document.querySelector('.gui-btn');
  if (objectiveButton) {
    objectiveButton.addEventListener('click', showGameObjective);
  }

  const closeObjectiveButton = document.getElementById('close-objective');
  if (closeObjectiveButton) {
    closeObjectiveButton.addEventListener('click', hideGameObjective);
  }
});

export function showGameObjective() {
  const gameObjectiveContainer = document.getElementById('game-objective');
  const gameDetailsContainer = document.getElementById('game-details');

  if (gameObjectiveContainer) {
    gameObjectiveContainer.classList.remove('hidden');
  }
  if (gameDetailsContainer) {
    gameDetailsContainer.classList.remove('hidden');
  }
}

export function hideGameObjective() {
  const gameObjectiveContainer = document.getElementById('game-objective');
  const gameDetailsContainer = document.getElementById('game-details');

  if (gameObjectiveContainer) {
    gameObjectiveContainer.classList.add('hidden');
  }
  if (gameDetailsContainer) {
    gameDetailsContainer.classList.add('hidden');
  }
}
