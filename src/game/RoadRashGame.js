import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AudioEngine } from './AudioEngine.js';
import {
  createBike,
  createBuilding,
  createCar,
  createCockpit,
  createMistParticles,
  createMountains,
  createPalm,
  createRoadTexture,
  createSky,
  createStreetLight,
  createWindowTexture,
  mulberry32,
} from './visuals.js';

const ROAD_WIDTH = 18;
const ROAD_HALF = ROAD_WIDTH / 2;
const SEGMENT_LENGTH = 58;
const SEGMENT_COUNT = 26;
const PLAYER_Z = 4.2;
const RACE_LENGTH = 4500;
const MAX_SPEED = 238;
const BOOST_SPEED = 286;

const RIVAL_CONFIG = [
  { name: 'Mako', color: 0xff3a5f, accent: 0xffaa35, lane: -5.9, distance: 16, speed: 51.5 },
  { name: 'Cipher', color: 0x32c7ff, accent: 0xc7ff32, lane: -2.1, distance: 30, speed: 54.4 },
  { name: 'Rook', color: 0xff6a2a, accent: 0xffdf5d, lane: 2.1, distance: 46, speed: 52.8 },
  { name: 'Vanta', color: 0x7658ff, accent: 0x38e2ff, lane: 5.8, distance: 64, speed: 56.4 },
  { name: 'Knox', color: 0xe5e8ea, accent: 0xff3658, lane: -3.8, distance: 84, speed: 58.1 },
  { name: 'Nyx', color: 0xc7ff32, accent: 0x27d9ff, lane: 3.6, distance: 106, speed: 59.0 },
];

const CAR_COLORS = [0x375a70, 0x7b3435, 0x525a60, 0xb7b9b4, 0x29333a, 0x6d6447];
const LANES = [-6.05, -2.03, 2.03, 6.05];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(current, target, speed, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * dt));
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export class RoadRashGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.clock = new THREE.Clock();
    this.audio = new AudioEngine();

    this.state = 'menu';
    this.keys = new Set();
    this.speed = 92;
    this.distance = 0;
    this.health = 100;
    this.nitro = 100;
    this.playerLane = 0;
    this.steer = 0;
    this.raceTime = 0;
    this.topSpeed = 0;
    this.takedowns = 0;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.collisionCooldown = 0;
    this.edgeDamageTimer = 0;
    this.cameraShake = 0;
    this.cameraRoll = 0;
    this.boosting = false;
    this.previousBoosting = false;
    this.countdownToken = 0;

    this.player = null;
    this.cockpit = null;
    this.rivals = [];
    this.traffic = [];
    this.roadSegments = [];
    this.mist = null;
    this.sparkSystem = null;
    this.windowTexture = null;
    this.roadMaterial = null;

    this.dom = this.collectDom();
    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  collectDom() {
    const byId = (id) => document.getElementById(id);
    return {
      boot: byId('boot-screen'),
      start: byId('start-button'),
      how: byId('how-button'),
      controls: byId('controls-panel'),
      hud: byId('hud'),
      countdown: byId('countdown'),
      pause: byId('pause-screen'),
      result: byId('result-screen'),
      resume: byId('resume-button'),
      pauseButton: byId('pause-button'),
      restartPause: byId('restart-pause-button'),
      restart: byId('restart-button'),
      speed: byId('speed-value'),
      gear: byId('gear-value'),
      position: byId('position-value'),
      distance: byId('distance-value'),
      time: byId('time-value'),
      progress: byId('progress-fill'),
      checkpoint: byId('checkpoint-label'),
      health: byId('health-value'),
      healthFill: byId('health-fill'),
      nitro: byId('nitro-value'),
      nitroFill: byId('nitro-fill'),
      combat: byId('combat-prompt'),
      damage: byId('damage-flash'),
      speedLines: byId('speed-lines'),
      revBars: [...document.querySelectorAll('#rev-bars i')],
      resultEyebrow: byId('result-eyebrow'),
      resultTitle: byId('result-title'),
      resultPosition: byId('result-position'),
      resultTime: byId('result-time'),
      resultSpeed: byId('result-speed'),
      resultTakedowns: byId('result-takedowns'),
      touchControls: byId('touch-controls'),
    };
  }

  init() {
    this.setupRenderer();
    this.setupWorld();
    this.setupRacers();
    this.setupTraffic();
    this.setupEvents();
    this.updateWorld(0);
    this.updateHud();
    this.animate();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14243b);
    this.scene.fog = new THREE.FogExp2(0x43505a, 0.0076);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 720);
    this.camera.position.set(0, 2.48, PLAYER_Z - 0.42);
    this.camera.lookAt(0, 1.18, -30);
    this.scene.add(this.camera);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.34, 0.68, 0.81);
    bloom.threshold = 0.74;
    bloom.strength = 0.34;
    bloom.radius = 0.62;
    this.composer.addPass(bloom);
  }

  setupWorld() {
    this.scene.add(createSky());
    this.scene.add(createMountains());

    const hemisphere = new THREE.HemisphereLight(0xa9cbea, 0x412a21, 2.3);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffd39a, 5.6);
    sun.position.set(-72, 86, -126);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -58;
    sun.shadow.camera.right = 58;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.00012;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x4ebcff, 2.1);
    rim.position.set(35, 22, 18);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 2200),
      new THREE.MeshStandardMaterial({ color: 0x1c2927, roughness: 0.98 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.54, -780);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(620, 1500, 4, 12),
      new THREE.MeshPhysicalMaterial({ color: 0x183c50, metalness: 0.45, roughness: 0.24, clearcoat: 0.8, transparent: true, opacity: 0.87 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(305, -0.34, -650);
    this.scene.add(ocean);

    this.windowTexture = createWindowTexture();
    const roadTexture = createRoadTexture(this.renderer);
    this.roadMaterial = new THREE.MeshPhysicalMaterial({
      map: roadTexture,
      color: 0xffffff,
      metalness: 0.22,
      roughness: 0.45,
      clearcoat: 0.68,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.7,
    });

    for (let i = 0; i < SEGMENT_COUNT; i += 1) {
      const segment = this.createRoadSegment(i);
      this.roadSegments.push(segment);
      this.scene.add(segment);
    }

    this.mist = createMistParticles();
    this.scene.add(this.mist);
    this.sparkSystem = this.createSparkSystem();
    this.scene.add(this.sparkSystem.points);
  }

  createRoadSegment(index) {
    const random = mulberry32(7700 + index * 71);
    const group = new THREE.Group();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH + 1.8), this.roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.receiveShadow = true;
    group.add(road);

    const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x5d6265, metalness: 0.18, roughness: 0.66 });
    const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0xb6bcc0, metalness: 0.65, roughness: 0.36 });
    [-1, 1].forEach((side) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, SEGMENT_LENGTH + 1), curbMaterial);
      curb.position.set(side * (ROAD_HALF + 0.72), 0.06, 0);
      curb.receiveShadow = true;
      group.add(curb);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, SEGMENT_LENGTH + 1), barrierMaterial);
      rail.position.set(side * (ROAD_HALF + 1.36), 0.72, 0);
      rail.castShadow = true;
      group.add(rail);
      for (let z = -SEGMENT_LENGTH / 2; z <= SEGMENT_LENGTH / 2; z += 5.8) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.76, 0.12), barrierMaterial);
        post.position.set(side * (ROAD_HALF + 1.36), 0.38, z);
        post.castShadow = true;
        group.add(post);
      }

      const lamp = createStreetLight(side);
      lamp.position.set(side * (ROAD_HALF + 2.25), 0, random() * 15 - 7.5);
      group.add(lamp);

      if ((index + (side > 0 ? 1 : 0)) % 3 === 0) {
        const palm = createPalm(index * 9 + side * 3);
        palm.position.set(side * (ROAD_HALF + 3.5), 0, random() * 22 - 11);
        group.add(palm);
      }

      const building = createBuilding(this.windowTexture, index * 13 + (side > 0 ? 5 : 2), side);
      building.position.set(side * (ROAD_HALF + 9 + random() * 10), -0.42, random() * 28 - 14);
      building.rotation.y = side > 0 ? -0.04 : 0.04;
      group.add(building);

      if (index % 4 === 1) {
        const rearBuilding = createBuilding(this.windowTexture, index * 29 + (side > 0 ? 7 : 4), side);
        rearBuilding.position.set(side * (ROAD_HALF + 22 + random() * 11), -0.44, random() * 30 - 15);
        rearBuilding.scale.setScalar(1.12 + random() * 0.55);
        group.add(rearBuilding);
      }
    });

    group.userData.worldDistance = (index - 1) * SEGMENT_LENGTH;
    group.userData.segmentIndex = index;

    return group;
  }

  setupRacers() {
    this.player = createBike({ color: 0xc7ff32, suitColor: 0x13181b, accent: 0x27d9ff, player: true });
    this.player.position.set(0, 0.03, PLAYER_Z);
    this.player.visible = false;
    this.scene.add(this.player);

    this.cockpit = createCockpit();
    this.camera.add(this.cockpit);

    this.rivals = RIVAL_CONFIG.map((config, index) => {
      const bike = createBike({ color: config.color, suitColor: 0x151719, accent: config.accent });
      bike.scale.multiplyScalar(0.96);
      this.scene.add(bike);
      return {
        ...config,
        startDistance: config.distance,
        baseSpeed: config.speed,
        bike,
        targetLane: config.lane,
        laneTimer: 1.4 + index * 0.42,
        wobble: 0,
        health: 100,
        takedown: false,
        finishTime: null,
        attackCooldown: 0,
      };
    });
  }

  setupTraffic() {
    this.traffic = Array.from({ length: 16 }, (_, index) => {
      const car = createCar(CAR_COLORS[index % CAR_COLORS.length]);
      car.scale.setScalar(0.92 + (index % 3) * 0.04);
      this.scene.add(car);
      return {
        car,
        lane: LANES[(index * 3 + 1) % LANES.length],
        distance: 82 + index * 105 + (index % 4) * 18,
        speed: 20 + (index % 5) * 2.6,
        hit: false,
      };
    });
  }

  setupEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', (event) => {
      const key = event.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(key)) event.preventDefault();
      this.keys.add(key);
      if (key === 'Space' && !event.repeat) this.tryAttack();
      if ((key === 'KeyP' || key === 'Escape') && !event.repeat) this.togglePause();
      if (key === 'Enter' && !event.repeat && (this.state === 'menu' || this.state === 'finished')) this.beginRace();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pauseGame();
    });

    this.dom.start.addEventListener('click', () => this.beginRace());
    this.dom.how.addEventListener('click', () => {
      const visible = this.dom.controls.classList.toggle('is-visible');
      this.dom.controls.setAttribute('aria-hidden', String(!visible));
      this.dom.how.setAttribute('aria-expanded', String(visible));
    });
    this.dom.pauseButton.addEventListener('click', () => this.pauseGame());
    this.dom.resume.addEventListener('click', () => this.resumeGame());
    this.dom.restartPause.addEventListener('click', () => this.beginRace());
    this.dom.restart.addEventListener('click', () => this.beginRace());

    document.querySelectorAll('[data-control]').forEach((button) => {
      const control = button.dataset.control;
      const code = {
        left: 'ArrowLeft',
        right: 'ArrowRight',
        throttle: 'ArrowUp',
        boost: 'ShiftLeft',
        attack: 'Space',
      }[control];
      const down = (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add('is-active');
        this.keys.add(code);
        if (control === 'attack') this.tryAttack();
      };
      const up = (event) => {
        event.preventDefault();
        button.classList.remove('is-active');
        this.keys.delete(code);
      };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('pointerleave', up);
    });
  }

  async beginRace() {
    this.countdownToken += 1;
    const token = this.countdownToken;
    this.resetRace();
    this.audio.start();
    this.state = 'countdown';
    this.dom.boot.classList.remove('is-visible');
    this.dom.pause.classList.remove('is-visible');
    this.dom.result.classList.remove('is-visible');
    this.dom.hud.classList.add('is-visible');
    this.dom.touchControls.classList.add('is-visible');

    const values = ['3', '2', '1', 'GO'];
    for (let i = 0; i < values.length; i += 1) {
      if (token !== this.countdownToken) return;
      this.dom.countdown.innerHTML = `<span>${values[i]}</span>`;
      this.dom.countdown.classList.remove('is-visible');
      void this.dom.countdown.offsetWidth;
      this.dom.countdown.classList.add('is-visible');
      this.audio.countdown(i === 3 ? 3 : i);
      await delay(i === 3 ? 620 : 860);
    }
    if (token !== this.countdownToken) return;
    this.dom.countdown.classList.remove('is-visible');
    this.state = 'playing';
    this.clock.getDelta();
  }

  resetRace() {
    this.distance = 0;
    this.speed = 0;
    this.health = 100;
    this.nitro = 100;
    this.playerLane = 0;
    this.steer = 0;
    this.raceTime = 0;
    this.topSpeed = 0;
    this.takedowns = 0;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.collisionCooldown = 0;
    this.edgeDamageTimer = 0;
    this.cameraShake = 0;
    this.cameraRoll = 0;
    this.boosting = false;
    this.keys.clear();
    this.player.position.set(0, 0.03, PLAYER_Z);
    this.player.rotation.set(0, 0, 0);
    this.player.userData.attackPivot.rotation.set(0, 0, 0);
    this.camera.position.set(0, 2.48, PLAYER_Z - 0.42);
    if (this.cockpit) {
      this.cockpit.rotation.set(0, 0, 0);
      this.cockpit.userData.rightHand.position.set(0.88, -1.02, -2.42);
      this.cockpit.userData.rightHand.rotation.set(0, 0, 0);
    }
    this.roadSegments.forEach((segment, index) => {
      segment.userData.worldDistance = (index - 1) * SEGMENT_LENGTH;
      segment.visible = true;
    });

    this.rivals.forEach((rival, index) => {
      const config = RIVAL_CONFIG[index];
      rival.distance = config.distance;
      rival.speed = 18 + index * 0.7;
      rival.lane = config.lane;
      rival.targetLane = config.lane;
      rival.health = 100;
      rival.wobble = 0;
      rival.takedown = false;
      rival.finishTime = null;
      rival.attackCooldown = 0;
      rival.bike.visible = true;
      rival.bike.rotation.set(0, 0, 0);
    });

    this.traffic.forEach((traffic, index) => {
      traffic.distance = 82 + index * 105 + (index % 4) * 18;
      traffic.lane = LANES[(index * 3 + 1) % LANES.length];
      traffic.hit = false;
      traffic.car.visible = true;
    });
    this.updateHud();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.dom.pause.classList.add('is-visible');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.dom.pause.classList.remove('is-visible');
    this.clock.getDelta();
    this.audio.context?.resume();
  }

  togglePause() {
    if (this.state === 'playing') this.pauseGame();
    else if (this.state === 'paused') this.resumeGame();
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.045);

    if (this.state === 'menu') {
      this.updateDemo(dt);
    } else if (this.state === 'playing') {
      this.updateGame(dt);
    } else if (this.state === 'countdown') {
      this.updateCountdownScene(dt);
    } else if (this.state === 'paused') {
      this.audio.update(this.speed, 0, false, true);
    }

    this.updateCamera(dt);
    this.updateSparks(dt);
    this.composer.render();
  }

  updateDemo(dt) {
    const cruise = 27;
    this.distance += cruise * dt;
    this.speed = 97 + Math.sin(performance.now() * 0.0008) * 5;
    this.playerLane = Math.sin(this.distance * 0.015) * 0.75;
    this.rivals.forEach((rival, index) => {
      rival.distance += cruise * dt;
      rival.lane = Math.sin(this.distance * 0.009 + index) * 2.8 + (index % 2 ? 1.4 : -1.4);
    });
    this.traffic.forEach((traffic) => { traffic.distance += cruise * dt; });
    this.updateWorld(dt);
    this.updateBikeAnimation(dt, false);
    this.audio.update(this.speed, 0.3, false, false);
  }

  updateCountdownScene(dt) {
    this.updateWorld(dt);
    this.updateBikeAnimation(dt, false);
    this.audio.update(18, 0.75, false, false);
  }

  updateGame(dt) {
    this.raceTime += dt;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    this.edgeDamageTimer = Math.max(0, this.edgeDamageTimer - dt);

    const throttle = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const braking = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const boostHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    if (throttle) this.speed += (68 - this.speed * 0.055) * dt;
    else this.speed -= (11 + this.speed * 0.018) * dt;
    if (braking) this.speed -= 94 * dt;

    this.boosting = boostHeld && this.nitro > 0.4 && this.speed > 48;
    if (this.boosting) {
      this.speed += 84 * dt;
      this.nitro = Math.max(0, this.nitro - 25 * dt);
      if (!this.previousBoosting) this.audio.boost();
    } else {
      this.nitro = Math.min(100, this.nitro + 7.2 * dt);
      if (this.speed > MAX_SPEED) this.speed -= 46 * dt;
    }
    this.previousBoosting = this.boosting;
    this.speed = clamp(this.speed, 0, BOOST_SPEED);
    this.topSpeed = Math.max(this.topSpeed, this.speed);

    const steerInput = (right ? 1 : 0) - (left ? 1 : 0);
    this.steer = lerp(this.steer, steerInput, 9, dt);
    const steeringRate = 4.5 + this.speed * 0.012;
    this.playerLane += this.steer * steeringRate * dt;
    this.playerLane = clamp(this.playerLane, -8.0, 8.0);

    if (Math.abs(this.playerLane) > 7.25) {
      this.speed -= 44 * dt;
      this.cameraShake = Math.max(this.cameraShake, 0.18);
      if (this.edgeDamageTimer <= 0 && this.speed > 90) {
        this.takeDamage(3.5, this.playerLane > 0 ? -1 : 1, 0.45);
        this.edgeDamageTimer = 0.48;
      }
    }

    this.distance += (this.speed / 3.6) * dt;
    this.updateRivals(dt);
    this.updateTraffic(dt);
    this.handleCollisions();
    this.updateWorld(dt);
    this.updateBikeAnimation(dt, this.boosting);
    this.updateHud();
    this.audio.update(this.speed, throttle ? 1 : 0, this.boosting, false);

    if (this.health <= 0) this.finishRace(true);
    else if (this.distance >= RACE_LENGTH) this.finishRace(false);
  }

  updateRivals(dt) {
    this.rivals.forEach((rival, index) => {
      rival.attackCooldown = Math.max(0, rival.attackCooldown - dt);
      if (!rival.takedown) {
        const relative = rival.distance - this.distance;
        let desiredSpeed = rival.baseSpeed + Math.sin(this.raceTime * 0.55 + index * 1.4) * 2.2;
        if (relative < -80) desiredSpeed += 10;
        if (relative > 170) desiredSpeed -= 7;
        rival.speed = lerp(rival.speed, desiredSpeed, 0.9, dt);
        rival.distance += rival.speed * dt;

        rival.laneTimer -= dt;
        if (rival.laneTimer <= 0) {
          const laneIndex = (Math.floor(this.raceTime * 0.23 + index * 1.7) + index) % LANES.length;
          rival.targetLane = LANES[laneIndex];
          rival.laneTimer = 2.8 + ((index * 1.17) % 2.4);
        }
        rival.lane = lerp(rival.lane, rival.targetLane, 0.7, dt);

        const longitudinal = Math.abs(relative);
        const lateral = Math.abs(rival.lane - this.playerLane);
        if (longitudinal < 2.3 && lateral < 1.45 && rival.attackCooldown <= 0 && Math.random() < dt * 0.42) {
          this.takeDamage(9 + index % 3, rival.lane > this.playerLane ? -1 : 1, 0.85);
          rival.attackCooldown = 2.4;
        }
      } else {
        rival.speed = Math.max(5, rival.speed - 18 * dt);
        rival.distance += rival.speed * dt;
        rival.wobble += dt * 4;
      }

      if (rival.distance >= RACE_LENGTH && rival.finishTime === null) rival.finishTime = this.raceTime;
    });
  }

  updateTraffic(dt) {
    this.traffic.forEach((traffic, index) => {
      traffic.distance += traffic.speed * dt;
      if (traffic.distance < this.distance - 75) {
        traffic.distance = this.distance + 760 + index * 82 + Math.random() * 160;
        traffic.lane = LANES[(index + Math.floor(this.distance / 300)) % LANES.length];
        traffic.hit = false;
      }
    });
  }

  handleCollisions() {
    if (this.collisionCooldown > 0) return;

    for (const traffic of this.traffic) {
      const dz = traffic.distance - this.distance;
      const dx = traffic.lane - this.playerLane;
      if (Math.abs(dz) < 2.65 && Math.abs(dx) < 1.35) {
        this.takeDamage(19, dx > 0 ? -1 : 1, 1.5);
        this.speed *= 0.54;
        traffic.hit = true;
        traffic.car.rotation.z = dx > 0 ? -0.12 : 0.12;
        this.collisionCooldown = 1.1;
        return;
      }
    }

    for (const rival of this.rivals) {
      if (rival.takedown) continue;
      const dz = rival.distance - this.distance;
      const dx = rival.lane - this.playerLane;
      if (Math.abs(dz) < 1.8 && Math.abs(dx) < 0.92) {
        this.takeDamage(5.5, dx > 0 ? -1 : 1, 0.72);
        rival.wobble = dx > 0 ? 0.35 : -0.35;
        this.collisionCooldown = 0.72;
        return;
      }
    }
  }

  tryAttack() {
    if (this.state !== 'playing' || this.attackCooldown > 0) return;
    this.attackTimer = 0.42;
    this.attackCooldown = 0.55;
    this.audio.strike();

    let target = null;
    let targetScore = Infinity;
    this.rivals.forEach((rival) => {
      if (rival.takedown) return;
      const dz = Math.abs(rival.distance - this.distance);
      const dx = Math.abs(rival.lane - this.playerLane);
      const score = dz + dx;
      if (dz < 4.3 && dx < 2.15 && score < targetScore) {
        target = rival;
        targetScore = score;
      }
    });

    if (!target) return;
    target.health -= 38;
    target.wobble = target.lane > this.playerLane ? -0.72 : 0.72;
    target.speed = Math.max(30, target.speed - 11);
    this.audio.impact(0.75);
    this.spawnSparks(target.bike.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 17);
    if (target.health <= 0) {
      target.takedown = true;
      target.wobble = target.lane > this.playerLane ? -1.2 : 1.2;
      this.takedowns += 1;
    }
  }

  takeDamage(amount, shove, strength = 1) {
    this.health = Math.max(0, this.health - amount);
    this.playerLane = clamp(this.playerLane + shove * 0.32 * strength, -8, 8);
    this.cameraShake = Math.max(this.cameraShake, 0.48 * strength);
    this.audio.impact(strength);
    this.dom.damage.classList.remove('is-active');
    void this.dom.damage.offsetWidth;
    this.dom.damage.classList.add('is-active');
    this.spawnSparks(this.player.position.clone().add(new THREE.Vector3(-shove * 0.45, 0.75, -0.2)), Math.round(12 + strength * 13));
  }

  updateWorld(dt) {
    const curveOrigin = this.roadCurve(this.distance);
    const recycleSpan = SEGMENT_COUNT * SEGMENT_LENGTH;
    for (const segment of this.roadSegments) {
      let worldDistance = segment.userData.worldDistance;
      while (worldDistance < this.distance - SEGMENT_LENGTH * 1.7) worldDistance += recycleSpan;
      segment.userData.worldDistance = worldDistance;
      const relative = worldDistance - this.distance;
      segment.visible = relative > -SEGMENT_LENGTH * 1.8 && relative < 760;
      if (!segment.visible) continue;
      segment.position.x = this.roadCurve(worldDistance) - curveOrigin;
      segment.position.z = PLAYER_Z - relative;
      segment.rotation.y = this.roadHeading(worldDistance);
    }

    this.updateRacerTransforms(dt, curveOrigin);
    this.updateTrafficTransforms(dt, curveOrigin);
    this.updateMist(dt);
  }

  updateRacerTransforms(dt, curveOrigin) {
    this.rivals.forEach((rival, index) => {
      const relative = rival.distance - this.distance;
      const bike = rival.bike;
      bike.visible = relative > -22 && relative < 540;
      if (!bike.visible) return;
      bike.position.x = this.roadCurve(rival.distance) - curveOrigin + rival.lane;
      bike.position.z = PLAYER_Z - relative;
      bike.position.y = 0.03 + Math.sin(this.raceTime * 9 + index) * 0.012;
      const aiLean = (rival.targetLane - rival.lane) * -0.08;
      if (rival.takedown) {
        bike.rotation.z = lerp(bike.rotation.z, rival.wobble > 0 ? 1.52 : -1.52, 1.9, dt);
        bike.position.y = Math.max(-0.25, bike.position.y - 0.4);
      } else {
        bike.rotation.z = lerp(bike.rotation.z, aiLean + rival.wobble, 6, dt);
        bike.rotation.y = this.roadHeading(rival.distance) * 0.72;
        rival.wobble = lerp(rival.wobble, 0, 4.5, dt);
      }
      bike.userData.wheels.forEach((wheel) => { wheel.rotation.x -= rival.speed * dt / 0.46; });
    });
  }

  updateTrafficTransforms(dt, curveOrigin) {
    this.traffic.forEach((traffic) => {
      const relative = traffic.distance - this.distance;
      traffic.car.visible = relative > -32 && relative < 600;
      if (!traffic.car.visible) return;
      traffic.car.position.set(
        this.roadCurve(traffic.distance) - curveOrigin + traffic.lane,
        0.02,
        PLAYER_Z - relative,
      );
      traffic.car.rotation.y = this.roadHeading(traffic.distance) * 0.72;
      traffic.car.rotation.z = lerp(traffic.car.rotation.z, 0, 2.4, dt);
      traffic.car.userData.wheels?.forEach((wheel) => { wheel.rotation.x -= traffic.speed * dt / 0.3; });
    });
  }

  updateBikeAnimation(dt, boosting) {
    const speedMS = this.speed / 3.6;
    this.player.position.x = lerp(this.player.position.x, this.playerLane, 10, dt);
    this.player.position.y = 0.035 + Math.sin(performance.now() * 0.018) * Math.min(0.018, this.speed * 0.00008);
    this.player.rotation.z = lerp(this.player.rotation.z, -this.steer * (0.18 + this.speed / 950), 8, dt);
    this.player.rotation.y = lerp(this.player.rotation.y, -this.steer * 0.025, 8, dt);
    this.player.userData.wheels.forEach((wheel) => { wheel.rotation.x -= speedMS * dt / 0.46; });

    const attackProgress = this.attackTimer > 0 ? 1 - this.attackTimer / 0.42 : 0;
    const swing = this.attackTimer > 0 ? Math.sin(attackProgress * Math.PI) : 0;
    this.player.userData.attackPivot.rotation.z = -swing * 1.55;
    this.player.userData.attackPivot.rotation.y = swing * 0.4;

    if (this.cockpit) {
      const rightHand = this.cockpit.userData.rightHand;
      rightHand.position.x = 0.88 + swing * 0.72;
      rightHand.position.y = -1.02 + swing * 0.32;
      rightHand.position.z = -2.42 + swing * 0.2;
      rightHand.rotation.z = -swing * 1.15;
      rightHand.rotation.y = swing * 0.38;
      this.cockpit.rotation.z = lerp(this.cockpit.rotation.z, -this.steer * 0.045, 9, dt);
      this.cockpit.position.y = Math.sin(this.distance * 0.82) * Math.min(0.006, speedMS * 0.00011);
      this.cockpit.userData.dashScreen.material.emissiveIntensity = 0.5 + (this.speed / BOOST_SPEED) * 0.5;
      this.cockpit.userData.shiftLight.material.emissiveIntensity = this.speed > 220 ? 4.2 : 1.35;
    }

    this.player.userData.flames.forEach((flame, index) => {
      const active = boosting ? 1 : Math.max(0.06, this.speed / 900);
      flame.scale.y = lerp(flame.scale.y, active, 16, dt);
      flame.scale.x = 0.8 + Math.sin(performance.now() * 0.04 + index) * 0.2;
      flame.material.opacity = boosting ? 0.9 : 0.35;
    });

    this.dom.speedLines.classList.toggle('is-boosting', boosting);
  }

  updateCamera(dt) {
    if (!this.camera) return;
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.15);
    const speedFactor = clamp(this.speed / BOOST_SPEED, 0, 1);
    const time = performance.now() * 0.001;
    const roadBuzz = speedFactor * (Math.sin(this.distance * 0.53) * 0.004 + Math.sin(this.distance * 1.31) * 0.002);
    const impactX = Math.sin(time * 39) * this.cameraShake * 0.1;
    const impactY = Math.sin(time * 53 + 0.8) * this.cameraShake * 0.075;
    const targetX = this.playerLane + impactX;
    const targetY = 2.48 + roadBuzz + impactY;
    const targetZ = PLAYER_Z - 0.42 + Math.sin(this.distance * 0.37) * speedFactor * 0.002;
    this.camera.position.x = lerp(this.camera.position.x, targetX, 13, dt);
    this.camera.position.y = lerp(this.camera.position.y, targetY, 11, dt);
    this.camera.position.z = lerp(this.camera.position.z, targetZ, 10, dt);
    const lookDistance = 38 + speedFactor * 18;
    const curveAhead = this.roadCurve(this.distance + lookDistance) - this.roadCurve(this.distance);
    const lookAt = new THREE.Vector3(curveAhead + this.playerLane * 0.16, 1.12, PLAYER_Z - lookDistance);
    this.camera.lookAt(lookAt);
    const impactRoll = Math.sin(time * 31) * this.cameraShake * 0.025;
    this.cameraRoll = lerp(this.cameraRoll, -this.steer * (0.035 + speedFactor * 0.025) + impactRoll, 8, dt);
    this.camera.rotateZ(this.cameraRoll);
    this.camera.fov = lerp(this.camera.fov, 72 + speedFactor * 11 + (this.boosting ? 4 : 0), 4.8, dt);
    this.camera.updateProjectionMatrix();
  }

  updateMist(dt) {
    if (!this.mist) return;
    const positions = this.mist.geometry.attributes.position.array;
    const move = (this.speed / 3.6) * dt;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 2] += move;
      if (positions[i + 2] > 24) {
        positions[i + 2] = -235 - Math.random() * 25;
        positions[i] = (Math.random() - 0.5) * 70;
        positions[i + 1] = 0.4 + Math.random() * 14;
      }
    }
    this.mist.geometry.attributes.position.needsUpdate = true;
  }

  roadCurve(distance) {
    return Math.sin(distance * 0.00175) * 9.5 + Math.sin(distance * 0.0041 + 0.8) * 3.4;
  }

  roadHeading(distance) {
    const lookAhead = 4;
    const delta = this.roadCurve(distance + lookAhead) - this.roadCurve(distance - lookAhead);
    return -Math.atan2(delta, lookAhead * 2);
  }

  getPosition() {
    return 1 + this.rivals.filter((rival) => rival.distance > this.distance).length;
  }

  isRivalInRange() {
    return this.rivals.some((rival) => !rival.takedown && Math.abs(rival.distance - this.distance) < 4.3 && Math.abs(rival.lane - this.playerLane) < 2.15);
  }

  updateHud() {
    const remaining = Math.max(0, RACE_LENGTH - this.distance);
    const progress = clamp(this.distance / RACE_LENGTH, 0, 1);
    const gear = this.speed < 4 ? 'N' : Math.min(6, Math.max(1, Math.floor(this.speed / 43) + 1));
    const healthColor = this.health < 25 ? 'var(--damage)' : this.health < 50 ? 'var(--orange)' : 'var(--lime)';
    const revCount = Math.round((this.speed / BOOST_SPEED) * this.dom.revBars.length);

    this.dom.speed.textContent = String(Math.round(this.speed));
    this.dom.gear.textContent = String(gear);
    this.dom.position.textContent = String(this.getPosition());
    this.dom.distance.textContent = remaining >= 1000 ? `${(remaining / 1000).toFixed(1)} KM` : `${Math.ceil(remaining)} M`;
    this.dom.time.textContent = this.formatTime(this.raceTime);
    this.dom.progress.style.width = `${progress * 100}%`;
    this.dom.checkpoint.textContent = progress < 0.25 ? 'CHECKPOINT 1' : progress < 0.5 ? 'CHECKPOINT 2' : progress < 0.75 ? 'CHECKPOINT 3' : 'FINAL SECTOR';
    this.dom.health.textContent = `${Math.round(this.health)}%`;
    this.dom.healthFill.style.transform = `scaleX(${this.health / 100})`;
    this.dom.healthFill.style.background = healthColor;
    this.dom.nitro.textContent = `${Math.round(this.nitro)}%`;
    this.dom.nitroFill.style.transform = `scaleX(${this.nitro / 100})`;
    this.dom.combat.classList.toggle('is-visible', this.isRivalInRange());
    this.dom.revBars.forEach((bar, index) => {
      bar.classList.toggle('is-active', index < revCount);
      bar.classList.toggle('is-redline', index < revCount && index >= 10);
    });
  }

  finishRace(crashed) {
    if (this.state !== 'playing') return;
    this.state = 'finished';
    this.speed *= crashed ? 0.15 : 0.72;
    this.dom.hud.classList.remove('is-visible');
    this.dom.touchControls.classList.remove('is-visible');
    this.dom.result.classList.add('is-visible');
    this.dom.resultEyebrow.textContent = crashed ? 'RUN TERMINATED' : 'PACIFIC RUN COMPLETE';
    this.dom.resultTitle.textContent = crashed ? 'WRECKED' : this.getPosition() === 1 ? 'VICTORY' : 'FINISH';
    this.dom.resultPosition.textContent = crashed ? 'DNF' : `${this.getPosition()} / 7`;
    this.dom.resultTime.textContent = this.formatTime(this.raceTime);
    this.dom.resultSpeed.textContent = `${Math.round(this.topSpeed)} KM/H`;
    this.dom.resultTakedowns.textContent = String(this.takedowns);
    this.audio.update(this.speed, 0, false, true);
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  createSparkSystem() {
    const count = 130;
    const positions = new Float32Array(count * 3);
    positions.fill(9999);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xff9b3d,
      size: 0.12,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return {
      points: new THREE.Points(geometry, material),
      velocity: Array.from({ length: count }, () => new THREE.Vector3()),
      life: new Float32Array(count),
    };
  }

  spawnSparks(position, amount = 18) {
    let spawned = 0;
    for (let i = 0; i < this.sparkSystem.life.length && spawned < amount; i += 1) {
      if (this.sparkSystem.life[i] > 0) continue;
      const positions = this.sparkSystem.points.geometry.attributes.position.array;
      positions[i * 3] = position.x + (Math.random() - 0.5) * 0.25;
      positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.25;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.25;
      this.sparkSystem.velocity[i].set((Math.random() - 0.5) * 6, 1.5 + Math.random() * 5.5, (Math.random() - 0.5) * 5.5);
      this.sparkSystem.life[i] = 0.35 + Math.random() * 0.55;
      spawned += 1;
    }
    this.sparkSystem.points.geometry.attributes.position.needsUpdate = true;
  }

  updateSparks(dt) {
    const positions = this.sparkSystem.points.geometry.attributes.position.array;
    for (let i = 0; i < this.sparkSystem.life.length; i += 1) {
      if (this.sparkSystem.life[i] <= 0) continue;
      this.sparkSystem.life[i] -= dt;
      if (this.sparkSystem.life[i] <= 0) {
        positions[i * 3] = 9999;
        continue;
      }
      const velocity = this.sparkSystem.velocity[i];
      velocity.y -= 9.8 * dt;
      positions[i * 3] += velocity.x * dt;
      positions[i * 3 + 1] += velocity.y * dt;
      positions[i * 3 + 2] += velocity.z * dt;
    }
    this.sparkSystem.points.geometry.attributes.position.needsUpdate = true;
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.composer.setSize(width, height);
  }
}
