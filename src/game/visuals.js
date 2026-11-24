import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const metalDark = new THREE.MeshStandardMaterial({ color: 0x111417, metalness: 0.9, roughness: 0.28 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x08090a, metalness: 0.05, roughness: 0.92 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xb9c4c9, metalness: 1, roughness: 0.15 });

function enableShadows(object) {
  object.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = !node.userData.noShadow;
      node.receiveShadow = !node.userData.noShadow;
    }
  });
  return object;
}

function makeMesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

function createLimb(start, end, radius, material) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const direction = b.clone().sub(a);
  const limb = makeMesh(new THREE.CylinderGeometry(radius, radius * 1.08, direction.length(), 8), material);
  limb.position.copy(mid);
  limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return limb;
}

export function createBike({ color = 0xc7ff32, suitColor = 0x14181b, accent = 0x27d9ff, player = false } = {}) {
  const group = new THREE.Group();
  group.name = player ? 'Player bike' : 'Rival bike';

  const paintColor = new THREE.Color(color).multiplyScalar(0.72);
  const paint = new THREE.MeshPhysicalMaterial({
    color: paintColor,
    metalness: 0.68,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.09,
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2.8, roughness: 0.24 });
  const suit = new THREE.MeshPhysicalMaterial({ color: suitColor, metalness: 0.12, roughness: 0.68, clearcoat: 0.18 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.88 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x121619, metalness: 0.52, roughness: 0.35 });
  const visor = new THREE.MeshPhysicalMaterial({ color: 0x06131b, metalness: 0.72, roughness: 0.06, transmission: 0.18, transparent: true, opacity: 0.88 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0xb71e28, metalness: 0.55, roughness: 0.3 });

  const wheels = [];
  [-1.28, 1.18].forEach((z, index) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 0.48, z);
    const tire = makeMesh(new THREE.TorusGeometry(0.35, index === 0 ? 0.105 : 0.125, 12, 32), rubber, [0, 0, 0], [0, Math.PI / 2, 0]);
    const rim = makeMesh(new THREE.TorusGeometry(0.245, 0.025, 8, 28), chrome, [0, 0, 0], [0, Math.PI / 2, 0]);
    const disc = makeMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.018, 28), chrome, [index === 0 ? 0.11 : -0.1, 0, 0], [0, 0, Math.PI / 2]);
    const hub = makeMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 12), metalDark, [0, 0, 0], [0, 0, Math.PI / 2]);
    const caliper = makeMesh(new RoundedBoxGeometry(0.08, 0.14, 0.06, 2, 0.02), brakeMat, [index === 0 ? 0.13 : -0.12, 0.12, -0.1]);
    wheelGroup.add(tire, rim, disc, hub, caliper);
    for (let spoke = 0; spoke < 7; spoke += 1) {
      const angle = (spoke / 7) * Math.PI * 2;
      wheelGroup.add(createLimb([0, 0, 0], [0, Math.sin(angle) * 0.23, Math.cos(angle) * 0.23], 0.012, metalDark));
    }
    if (index === 0) wheelGroup.rotation.x = -0.035;
    group.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  const frame = makeMesh(new RoundedBoxGeometry(0.22, 0.22, 1.58, 3, 0.04), metalDark, [0, 0.84, 0.02], [-0.03, 0, 0]);
  const engine = makeMesh(new RoundedBoxGeometry(0.66, 0.54, 0.7, 3, 0.08), metalDark, [0, 0.93, 0.17]);
  const engineInset = makeMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 12), chrome, [0, 0.96, 0.18], [0, 0, Math.PI / 2]);
  const fairing = makeMesh(new RoundedBoxGeometry(0.82, 0.72, 1.34, 5, 0.18), paint, [0, 1.08, -0.58], [-0.08, 0, 0]);
  fairing.scale.set(0.9, 1, 1);
  const fairingCut = makeMesh(new RoundedBoxGeometry(0.42, 0.3, 0.82, 3, 0.08), carbon, [0, 0.88, -0.55]);
  const tank = makeMesh(new THREE.SphereGeometry(0.52, 20, 14), paint, [0, 1.31, 0.14]);
  tank.scale.set(0.78, 0.68, 1.05);
  const seat = makeMesh(new RoundedBoxGeometry(0.56, 0.15, 0.76, 3, 0.06), leather, [0, 1.37, 0.78], [-0.08, 0, 0]);
  const tail = makeMesh(new RoundedBoxGeometry(0.48, 0.27, 0.66, 3, 0.07), paint, [0, 1.3, 1.08], [-0.18, 0, 0]);
  const windshield = makeMesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), visor, [0, 1.52, -0.72], [0.16, 0, 0]);
  windshield.scale.set(0.74, 0.7, 0.78);
  const forkLeft = createLimb([-0.22, 1.05, -0.6], [-0.18, 0.53, -1.27], 0.045, chrome);
  const forkRight = createLimb([0.22, 1.05, -0.6], [0.18, 0.53, -1.27], 0.045, chrome);
  const swingLeft = createLimb([-0.23, 0.78, 0.24], [-0.18, 0.5, 1.18], 0.052, metalDark);
  const swingRight = createLimb([0.23, 0.78, 0.24], [0.18, 0.5, 1.18], 0.052, metalDark);
  const handlebar = makeMesh(new THREE.CylinderGeometry(0.028, 0.028, 0.84, 8), metalDark, [0, 1.51, -0.62], [0, 0, Math.PI / 2]);
  const exhaustLeft = createLimb([-0.3, 0.76, 0.1], [-0.35, 0.69, 1.18], 0.07, chrome);
  const exhaustRight = createLimb([0.3, 0.76, 0.1], [0.35, 0.69, 1.18], 0.07, chrome);
  const chain = makeMesh(new THREE.BoxGeometry(0.022, 0.045, 1.08), metalDark, [-0.25, 0.59, 0.71], [-0.13, 0, 0]);
  const leftPanel = makeMesh(new RoundedBoxGeometry(0.08, 0.44, 0.86, 3, 0.04), paint, [-0.43, 1.04, -0.42], [0.05, 0.08, -0.08]);
  const rightPanel = leftPanel.clone();
  rightPanel.position.x = 0.43;
  rightPanel.rotation.y = -0.08;

  const headlightLeft = makeMesh(new RoundedBoxGeometry(0.23, 0.09, 0.035, 2, 0.02), accentMat, [-0.18, 1.23, -1.275], [0, 0, -0.05]);
  const headlightRight = headlightLeft.clone();
  headlightRight.position.x = 0.18;
  const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xff183d, emissive: 0xff183d, emissiveIntensity: 4.5 });
  const tailLight = makeMesh(new RoundedBoxGeometry(0.28, 0.08, 0.04, 2, 0.02), tailLightMat, [0, 1.31, 1.42]);

  const flameMat = new THREE.MeshBasicMaterial({ color: 0x39e6ff, transparent: true, opacity: 0.88 });
  const flames = [-0.35, 0.35].map((x) => {
    const flame = makeMesh(new THREE.ConeGeometry(0.08, 0.58, 10, 1, true), flameMat, [x, 0.69, 1.51], [Math.PI / 2, 0, 0]);
    flame.scale.y = 0.05;
    group.add(flame);
    return flame;
  });

  group.add(frame, engine, engineInset, fairing, fairingCut, tank, seat, tail, windshield, forkLeft, forkRight, swingLeft, swingRight, handlebar, exhaustLeft, exhaustRight, chain, leftPanel, rightPanel, headlightLeft, headlightRight, tailLight);

  const rider = new THREE.Group();
  const pelvis = makeMesh(new THREE.BoxGeometry(0.48, 0.3, 0.42), suit, [0, 1.64, 0.58], [-0.15, 0, 0]);
  const torso = makeMesh(new THREE.CapsuleGeometry(0.34, 0.66, 6, 12), suit, [0, 2.05, 0.04], [1.02, 0, 0]);
  torso.scale.set(0.86, 1, 0.68);
  const backPanel = makeMesh(new RoundedBoxGeometry(0.48, 0.52, 0.08, 2, 0.025), paint, [0, 2.12, 0.36], [0.98, 0, 0]);
  const neck = makeMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.15, 10), suit, [0, 2.38, -0.26]);
  const helmet = makeMesh(new THREE.SphereGeometry(0.27, 18, 14), paint, [0, 2.57, -0.36]);
  helmet.scale.set(0.92, 1, 1.08);
  const helmetVisor = makeMesh(new THREE.SphereGeometry(0.275, 18, 12, 0, Math.PI * 2, 0.25, 0.8), visor, [0, 2.56, -0.39], [0.25, 0, 0]);
  helmetVisor.scale.set(0.94, 0.98, 1.1);
  const helmetStripe = makeMesh(new THREE.BoxGeometry(0.04, 0.24, 0.38), accentMat, [0, 2.63, -0.45], [0.2, 0, 0]);

  const leftLegUpper = createLimb([-0.18, 1.72, 0.55], [-0.37, 1.17, 0.23], 0.13, suit);
  const rightLegUpper = createLimb([0.18, 1.72, 0.55], [0.37, 1.17, 0.23], 0.13, suit);
  const leftLegLower = createLimb([-0.37, 1.17, 0.23], [-0.38, 0.8, 0.73], 0.105, leather);
  const rightLegLower = createLimb([0.37, 1.17, 0.23], [0.38, 0.8, 0.73], 0.105, leather);
  const leftArm = createLimb([-0.25, 2.23, -0.12], [-0.35, 1.55, -0.62], 0.105, suit);

  const attackPivot = new THREE.Group();
  attackPivot.position.set(0.25, 2.23, -0.12);
  const rightArm = createLimb([0, 0, 0], [0.1, -0.68, -0.5], 0.105, suit);
  attackPivot.add(rightArm);

  const leftBoot = makeMesh(new RoundedBoxGeometry(0.16, 0.15, 0.34, 2, 0.04), leather, [-0.38, 0.76, 0.82], [-0.15, 0, 0]);
  const rightBoot = leftBoot.clone();
  rightBoot.position.x = 0.38;
  const leftGlove = makeMesh(new THREE.SphereGeometry(0.12, 12, 8), leather, [-0.35, 1.53, -0.64]);
  const rightGlove = leftGlove.clone();
  rightGlove.position.x = 0.35;
  rider.add(pelvis, torso, backPanel, neck, helmet, helmetVisor, helmetStripe, leftLegUpper, rightLegUpper, leftLegLower, rightLegLower, leftBoot, rightBoot, leftArm, attackPivot, leftGlove, rightGlove);
  group.add(rider);

  if (player) {
    const underglowMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, depthWrite: false });
    const underglow = makeMesh(new THREE.CircleGeometry(1.05, 32), underglowMat, [0, 0.035, 0.2], [-Math.PI / 2, 0, 0]);
    underglow.scale.set(0.5, 1.3, 1);
    group.add(underglow);
  }

  group.userData = { wheels, attackPivot, flames, paint, rider, health: 100, hitFlash: 0 };
  group.scale.setScalar(player ? 1.04 : 0.96);
  return enableShadows(group);
}

export function createCockpit() {
  const group = new THREE.Group();
  group.name = 'First-person cockpit';
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x202a21, metalness: 0.68, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x0b0e10, metalness: 0.58, roughness: 0.31 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.92 });
  const gloveMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0d0f, roughness: 0.68, clearcoat: 0.18 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8cc9da, transmission: 0.42, transparent: true, opacity: 0.18, metalness: 0.05, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false });
  const mirror = new THREE.MeshPhysicalMaterial({ color: 0x476471, metalness: 0.72, roughness: 0.08, clearcoat: 1 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x061318, emissive: 0x27d9ff, emissiveIntensity: 0.55, roughness: 0.2 });
  const lime = new THREE.MeshStandardMaterial({ color: 0xc7ff32, emissive: 0xc7ff32, emissiveIntensity: 1.4 });

  const tank = makeMesh(new THREE.SphereGeometry(0.9, 28, 18), paint, [0, -1.57, -2.15]);
  tank.scale.set(0.82, 0.62, 1.22);
  const tankPad = makeMesh(new RoundedBoxGeometry(0.45, 0.08, 0.75, 4, 0.09), carbon, [0, -1.17, -2.25], [-0.22, 0, 0]);
  const upperClamp = makeMesh(new RoundedBoxGeometry(0.54, 0.12, 0.34, 3, 0.05), chrome, [0, -1.08, -2.38], [-0.16, 0, 0]);
  const bar = makeMesh(new THREE.CylinderGeometry(0.035, 0.035, 1.72, 12), metalDark, [0, -1.07, -2.42], [0, 0, Math.PI / 2]);
  const leftGrip = makeMesh(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 14), rubberMat, [-0.93, -1.04, -2.42], [0, 0, Math.PI / 2]);
  const rightGrip = leftGrip.clone();
  rightGrip.position.x = 0.93;
  const leftReservoir = makeMesh(new RoundedBoxGeometry(0.23, 0.15, 0.25, 3, 0.04), carbon, [-0.55, -0.9, -2.5]);
  const rightReservoir = leftReservoir.clone();
  rightReservoir.position.x = 0.55;
  const dash = makeMesh(new RoundedBoxGeometry(0.74, 0.4, 0.14, 5, 0.08), carbon, [0, -0.8, -2.68], [-0.18, 0, 0]);
  const dashScreen = makeMesh(new RoundedBoxGeometry(0.58, 0.28, 0.03, 3, 0.04), screen, [0, -0.78, -2.755], [-0.18, 0, 0]);
  const shiftLight = makeMesh(new THREE.BoxGeometry(0.42, 0.025, 0.02), lime, [0, -0.62, -2.73], [-0.18, 0, 0]);

  const windshield = makeMesh(new THREE.SphereGeometry(1.35, 32, 18, 0.55, 2.04, 0.38, 0.78), glass, [0, -0.63, -3.02], [0.04, -1.28, 0]);
  windshield.scale.set(1.08, 0.86, 0.38);
  windshield.userData.noShadow = true;

  const leftMirrorArm = createLimb([-0.65, -0.86, -2.48], [-1.22, -0.57, -2.62], 0.025, metalDark);
  const rightMirrorArm = createLimb([0.65, -0.86, -2.48], [1.22, -0.57, -2.62], 0.025, metalDark);
  const leftMirror = makeMesh(new RoundedBoxGeometry(0.5, 0.28, 0.06, 5, 0.08), mirror, [-1.32, -0.52, -2.66], [0, 0.18, -0.08]);
  const rightMirror = leftMirror.clone();
  rightMirror.position.x = 1.32;
  rightMirror.rotation.y = -0.18;
  rightMirror.rotation.z = 0.08;

  const leftHand = new THREE.Group();
  leftHand.position.set(-0.88, -1.02, -2.42);
  leftHand.add(makeMesh(new RoundedBoxGeometry(0.28, 0.18, 0.28, 4, 0.07), gloveMat));
  const rightHand = new THREE.Group();
  rightHand.position.set(0.88, -1.02, -2.42);
  rightHand.add(makeMesh(new RoundedBoxGeometry(0.28, 0.18, 0.28, 4, 0.07), gloveMat));
  const leftSleeve = createLimb([-0.88, -1.02, -2.42], [-1.12, -1.64, -1.7], 0.12, gloveMat);
  const rightSleeve = createLimb([0.88, -1.02, -2.42], [1.12, -1.64, -1.7], 0.12, gloveMat);

  group.add(tank, tankPad, upperClamp, bar, leftGrip, rightGrip, leftReservoir, rightReservoir, dash, dashScreen, shiftLight, windshield, leftMirrorArm, rightMirrorArm, leftMirror, rightMirror, leftHand, rightHand, leftSleeve, rightSleeve);
  group.userData = { rightHand, leftHand, dashScreen, shiftLight };
  group.position.set(0, 0, 0);
  group.traverse((node) => {
    if (node.isMesh) {
      node.renderOrder = node === windshield ? 2 : 1;
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
  return group;
}

export function createCar(color = 0x36566f) {
  const group = new THREE.Group();
  const variant = Math.abs(color) % 3;
  const rideHeight = variant === 0 ? 0.08 : 0;
  const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color).multiplyScalar(0.72), metalness: 0.7, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x07151f, metalness: 0.58, roughness: 0.06, transmission: 0.18, transparent: true, opacity: 0.92 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x101316, metalness: 0.74, roughness: 0.3 });
  const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xff2447, emissive: 0xff183d, emissiveIntensity: 3.5 });
  const headLightMat = new THREE.MeshStandardMaterial({ color: 0xe6f3ff, emissive: 0xbcdfff, emissiveIntensity: 4.2 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xe9e8d9, roughness: 0.7 });

  const body = makeMesh(new RoundedBoxGeometry(1.9, 0.68 + rideHeight, 4.28, 6, 0.16), paint, [0, 0.69 + rideHeight, 0]);
  const hood = makeMesh(new RoundedBoxGeometry(1.78, 0.25, 1.18, 4, 0.1), paint, [0, 1.02 + rideHeight, -1.45], [-0.04, 0, 0]);
  const trunk = makeMesh(new RoundedBoxGeometry(1.8, 0.24, 0.9, 4, 0.09), paint, [0, 1.02 + rideHeight, 1.62], [0.04, 0, 0]);
  const cabin = makeMesh(new RoundedBoxGeometry(1.53, 0.72 + rideHeight, 2.08, 6, 0.17), glass, [0, 1.33 + rideHeight, 0.03]);
  cabin.scale.set(0.98, 1, 0.92);
  const roof = makeMesh(new RoundedBoxGeometry(1.42, 0.09, 1.3, 4, 0.05), paint, [0, 1.72 + rideHeight, 0.1]);
  const rearLightA = makeMesh(new RoundedBoxGeometry(0.52, 0.13, 0.05, 2, 0.025), tailLightMat, [-0.55, 0.82 + rideHeight, 2.16]);
  const rearLightB = rearLightA.clone();
  rearLightB.position.x = 0.52;
  const frontLightA = makeMesh(new RoundedBoxGeometry(0.5, 0.14, 0.05, 2, 0.025), headLightMat, [-0.55, 0.85 + rideHeight, -2.16]);
  const frontLightB = frontLightA.clone();
  frontLightB.position.x = 0.55;
  const grille = makeMesh(new RoundedBoxGeometry(0.82, 0.28, 0.04, 3, 0.04), trim, [0, 0.67 + rideHeight, -2.17]);
  const frontBumper = makeMesh(new RoundedBoxGeometry(1.82, 0.14, 0.12, 3, 0.04), trim, [0, 0.48 + rideHeight, -2.17]);
  const rearBumper = frontBumper.clone();
  rearBumper.position.z = 2.17;
  const plate = makeMesh(new RoundedBoxGeometry(0.55, 0.16, 0.03, 2, 0.02), plateMat, [0, 0.63 + rideHeight, 2.25]);
  const leftMirror = makeMesh(new RoundedBoxGeometry(0.24, 0.13, 0.12, 3, 0.04), paint, [-1.02, 1.28 + rideHeight, -0.53]);
  const rightMirror = leftMirror.clone();
  rightMirror.position.x = 1.02;
  group.add(body, hood, trunk, cabin, roof, rearLightA, rearLightB, frontLightA, frontLightB, grille, frontBumper, rearBumper, plate, leftMirror, rightMirror);

  const wheels = [];
  [-0.91, 0.91].forEach((x) => {
    [-1.38, 1.38].forEach((z) => {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.42 + rideHeight, z);
      wheel.add(makeMesh(new THREE.TorusGeometry(0.29, 0.105, 12, 28), rubber, [0, 0, 0], [0, Math.PI / 2, 0]));
      wheel.add(makeMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 20), chrome, [0, 0, 0], [0, 0, Math.PI / 2]));
      wheel.add(makeMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.15, 12), trim, [0, 0, 0], [0, 0, Math.PI / 2]));
      group.add(wheel);
      wheels.push(wheel);
    });
  });
  group.userData.wheels = wheels;
  return enableShadows(group);
}

export function createRoadTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#15171a');
  gradient.addColorStop(0.5, '#1d2023');
  gradient.addColorStop(1, '#141619');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const noise = Math.random() * 28 - 14;
    pixels[i] += noise;
    pixels[i + 1] += noise;
    pixels[i + 2] += noise;
  }
  ctx.putImageData(image, 0, 0);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#08090a';
  ctx.lineWidth = 3;
  for (let i = 0; i < 70; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + Math.random() * 35, y + 40, x - Math.random() * 28, y + 80, x + Math.random() * 20, y + 140);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#e6b83f';
  ctx.fillRect(503, 0, 6, 2048);
  ctx.fillRect(515, 0, 6, 2048);

  ctx.fillStyle = '#d8dde0';
  [255, 769].forEach((x) => {
    for (let y = 0; y < 2048; y += 280) ctx.fillRect(x - 3, y, 6, 154);
  });

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#e8ecef';
  ctx.fillRect(18, 0, 8, 2048);
  ctx.fillRect(998, 0, 8, 2048);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

export function createWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const skyReflection = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyReflection.addColorStop(0, '#315268');
  skyReflection.addColorStop(0.42, '#1c3443');
  skyReflection.addColorStop(1, '#0b151c');
  ctx.fillStyle = '#11171b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bayWidth = 64;
  const floorHeight = 58;
  for (let y = 5; y < canvas.height; y += floorHeight) {
    for (let x = 5; x < canvas.width; x += bayWidth) {
      const lit = Math.random() > 0.68;
      ctx.fillStyle = skyReflection;
      ctx.fillRect(x + 4, y + 4, bayWidth - 13, floorHeight - 13);
      if (lit) {
        ctx.fillStyle = Math.random() > 0.55 ? 'rgba(255,191,105,.62)' : 'rgba(171,214,226,.42)';
        ctx.fillRect(x + 6, y + 6, bayWidth - 17, floorHeight - 17);
        if (Math.random() > 0.5) {
          ctx.fillStyle = 'rgba(28,24,22,.55)';
          ctx.fillRect(x + 28, y + 8, 2, floorHeight - 21);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      ctx.fillRect(x + 6, y + 6, bayWidth - 17, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function createBuilding(windowTexture, seed = 1, side = 1) {
  const random = mulberry32(seed * 9277 + 41);
  const width = 7 + random() * 14;
  const depth = 8 + random() * 12;
  const height = 14 + random() * 38;
  const hue = random() > 0.55 ? 0x283238 : 0x3b3733;
  const glassTower = random() > 0.58;
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: hue, metalness: glassTower ? 0.48 : 0.22, roughness: glassTower ? 0.38 : 0.66 });
  const concrete = new THREE.MeshStandardMaterial({ color: glassTower ? 0x27333a : 0x68615a, metalness: 0.16, roughness: 0.72 });
  const darkTrim = new THREE.MeshStandardMaterial({ color: 0x12191d, metalness: 0.58, roughness: 0.36 });
  const podiumHeight = 2.5 + random() * 2.3;
  const podium = makeMesh(new RoundedBoxGeometry(width * 1.08, podiumHeight, depth * 1.08, 3, 0.12), concrete, [0, podiumHeight / 2, 0]);
  const body = makeMesh(new RoundedBoxGeometry(width, height - podiumHeight, depth, 4, glassTower ? 0.08 : 0.18), baseMat, [0, podiumHeight + (height - podiumHeight) / 2, 0]);
  group.add(podium, body);

  const windows = windowTexture.clone();
  windows.needsUpdate = true;
  windows.repeat.set(Math.max(1, Math.round(width / 5.5)), Math.max(2, Math.round(height / 7.5)));
  const windowMat = new THREE.MeshStandardMaterial({
    map: windows,
    emissiveMap: windows,
    emissive: 0x233e4f,
    emissiveIntensity: 0.28,
    metalness: 0.48,
    roughness: 0.24,
  });
  const facadeHeight = height - podiumHeight - 0.6;
  const facadeY = podiumHeight + facadeHeight / 2;
  const roadFacade = makeMesh(new THREE.PlaneGeometry(width * 0.91, facadeHeight), windowMat, [0, facadeY, side > 0 ? -depth / 2 - 0.025 : depth / 2 + 0.025], [0, side > 0 ? 0 : Math.PI, 0]);
  const rearFacade = roadFacade.clone();
  rearFacade.position.z *= -1;
  rearFacade.rotation.y += Math.PI;
  const sideWindows = windows.clone();
  sideWindows.repeat.set(Math.max(1, Math.round(depth / 5.5)), Math.max(2, Math.round(height / 7.5)));
  sideWindows.needsUpdate = true;
  const sideWindowMat = windowMat.clone();
  sideWindowMat.map = sideWindows;
  sideWindowMat.emissiveMap = sideWindows;
  const leftFacade = makeMesh(new THREE.PlaneGeometry(depth * 0.91, facadeHeight), sideWindowMat, [-width / 2 - 0.025, facadeY, 0], [0, -Math.PI / 2, 0]);
  const rightFacade = leftFacade.clone();
  rightFacade.position.x *= -1;
  rightFacade.rotation.y = Math.PI / 2;
  [roadFacade, rearFacade, leftFacade, rightFacade].forEach((facade) => { facade.userData.noShadow = true; });
  group.add(roadFacade, rearFacade, leftFacade, rightFacade);

  const columnCount = Math.max(2, Math.floor(width / 5));
  for (let column = 0; column <= columnCount; column += 1) {
    const x = -width / 2 + (column / columnCount) * width;
    const frontColumn = makeMesh(new THREE.BoxGeometry(0.14, facadeHeight, 0.18), darkTrim, [x, facadeY, side > 0 ? -depth / 2 - 0.08 : depth / 2 + 0.08]);
    group.add(frontColumn);
  }

  const bandCount = Math.min(6, Math.floor(height / 8));
  for (let band = 1; band <= bandCount; band += 1) {
    const y = podiumHeight + (band / (bandCount + 1)) * facadeHeight;
    const bandMesh = makeMesh(new THREE.BoxGeometry(width + 0.22, 0.09, depth + 0.22), darkTrim, [0, y, 0]);
    group.add(bandMesh);
  }

  const parapetFront = makeMesh(new THREE.BoxGeometry(width + 0.24, 0.55, 0.24), concrete, [0, height + 0.27, -depth / 2]);
  const parapetRear = parapetFront.clone();
  parapetRear.position.z *= -1;
  const parapetLeft = makeMesh(new THREE.BoxGeometry(0.24, 0.55, depth), concrete, [-width / 2, height + 0.27, 0]);
  const parapetRight = parapetLeft.clone();
  parapetRight.position.x *= -1;
  const rooftop = makeMesh(new RoundedBoxGeometry(width * 0.34, 1.25, depth * 0.3, 3, 0.08), metalDark, [0, height + 0.63, 0]);
  const ventA = makeMesh(new THREE.CylinderGeometry(0.26, 0.32, 1.1, 12), chrome, [-width * 0.24, height + 0.56, depth * 0.18]);
  const ventB = ventA.clone();
  ventB.position.x *= -1;
  group.add(parapetFront, parapetRear, parapetLeft, parapetRight, rooftop, ventA, ventB);

  if (random() > 0.45) {
    const antenna = makeMesh(new THREE.CylinderGeometry(0.035, 0.055, 4 + random() * 5, 8), metalDark, [0, height + 2.6, 0]);
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff3658, emissive: 0xff3658, emissiveIntensity: 4 });
    const beacon = makeMesh(new THREE.SphereGeometry(0.12, 10, 8), beaconMat, [0, antenna.position.y + antenna.geometry.parameters.height / 2, 0]);
    group.add(antenna, beacon);
  }

  group.userData.width = width;
  group.userData.height = height;
  return enableShadows(group);
}

export function createPalm(seed = 1) {
  const random = mulberry32(seed * 3181);
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x60402a, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: random() > 0.5 ? 0x315c38 : 0x264d36, roughness: 0.85, side: THREE.DoubleSide });
  const height = 3.8 + random() * 2.2;
  const trunk = makeMesh(new THREE.CylinderGeometry(0.13, 0.22, height, 8), trunkMat, [0, height / 2, 0], [0.03, 0, -0.05]);
  group.add(trunk);
  for (let i = 0; i < 8; i += 1) {
    const leaf = makeMesh(new THREE.ConeGeometry(0.42, 2.4, 5, 1, true), leafMat, [0, height, 0], [Math.PI / 2.5, i * Math.PI / 4, 0]);
    leaf.scale.set(0.5, 1, 0.18);
    group.add(leaf);
  }
  return enableShadows(group);
}

export function createStreetLight(side = 1) {
  const group = new THREE.Group();
  const pole = makeMesh(new THREE.CylinderGeometry(0.055, 0.08, 5.7, 8), metalDark, [0, 2.85, 0]);
  const arm = makeMesh(new THREE.CylinderGeometry(0.045, 0.045, 1.55, 8), metalDark, [-side * 0.68, 5.65, 0], [0, 0, Math.PI / 2]);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd69a, emissive: 0xffb24a, emissiveIntensity: 5 });
  const lamp = makeMesh(new THREE.SphereGeometry(0.12, 10, 8), lampMat, [-side * 1.38, 5.6, 0]);
  group.add(pole, arm, lamp);
  return group;
}

export function createSky() {
  const uniforms = {
    topColor: { value: new THREE.Color(0x152d4f) },
    middleColor: { value: new THREE.Color(0xc6674f) },
    bottomColor: { value: new THREE.Color(0xf7b96d) },
    sunColor: { value: new THREE.Color(0xffe7a3) },
    sunDirection: { value: new THREE.Vector3(-0.42, 0.14, -0.9).normalize() },
  };
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = normalize(world.xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 topColor;
      uniform vec3 middleColor;
      uniform vec3 bottomColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
      void main() {
        float h = clamp(vWorld.y * 0.72 + 0.42, 0.0, 1.0);
        vec3 sky = mix(bottomColor, middleColor, smoothstep(0.04, 0.38, h));
        sky = mix(sky, topColor, smoothstep(0.38, 0.96, h));
        float sun = pow(max(dot(vWorld, sunDirection), 0.0), 620.0);
        float halo = pow(max(dot(vWorld, sunDirection), 0.0), 18.0);
        sky += sunColor * sun * 3.2 + vec3(1.0, 0.38, 0.12) * halo * 0.44;
        float grain = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(sky + grain, 1.0);
      }
    `,
  });
  return makeMesh(new THREE.SphereGeometry(600, 40, 24), material);
}

export function createMountains() {
  const group = new THREE.Group();
  const farMat = new THREE.MeshStandardMaterial({ color: 0x26343b, roughness: 1, fog: true });
  for (let i = 0; i < 26; i += 1) {
    const height = 15 + Math.sin(i * 1.8) * 7 + Math.random() * 18;
    const mountain = makeMesh(new THREE.ConeGeometry(17 + Math.random() * 20, height, 5), farMat, [(i - 13) * 25, height / 2 - 2, -310 - Math.random() * 100], [0, Math.random(), 0]);
    group.add(mountain);
  }
  return group;
}

export function createMistParticles(count = 720) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 70;
    positions[i * 3 + 1] = 0.4 + Math.random() * 14;
    positions[i * 3 + 2] = -Math.random() * 240 + 20;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.PointsMaterial({ color: 0xe7f5ff, size: 0.07, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geometry, material);
  points.userData.initial = positions.slice();
  return points;
}

export function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
