import './global.css';
import { RoadRashGame } from './game/RoadRashGame.js';

const canvas = document.querySelector('#game-canvas');

try {
  const game = new RoadRashGame(canvas);
  game.init();
  window.roadRashGame = game;
} catch (error) {
  console.error(error);
  document.querySelector('#webgl-error')?.classList.add('is-visible');
}

