let ledMatrix;   // Буфер для точкової матриці 16x16
let glowTexture; // Розмита безшовна текстура
let mobileQuality = false;
let lampOn = true;
let lightLevel = 1;
let renderLevel = 1;
let fadeStartLevel = 1;
let fadeTargetLevel = 1;
let fadeStartedAt = 0;
let effectNeedsRefresh = true;
const fadeDuration = 700;
let effectState = {
  mode: 'fire',
  brightness: 100,
  speed: 1,
  color: '#ff7420',
  seed: 1,
  epochMs: Date.now(),
};

const cols = 16;
const rows = 16;

// Змінні прогресу скролу (від 0.0 до 1.0)
let scrollProgress = 0;
let targetScrollProgress = 0;

// Анімовані параметри
let currentAngleX = -20;
let currentPosY = 0;
let currentPosX = 0;

// Середній колір для світіння ззаду
let ambientColor = [255, 100, 20];

function setup() {
  setAttributes('antialias', true);
  createCanvas(windowWidth, windowHeight, WEBGL).parent('scene');

  smooth();
  mobileQuality = min(windowWidth, windowHeight) < 768;
  pixelDensity(mobileQuality ? min(window.devicePixelRatio, 3) : min(window.devicePixelRatio, 2));
  frameRate(60);

  // Буфери текстур
  ledMatrix = createGraphics(cols, rows);
  glowTexture = createGraphics(192, 96);
  effectState.seed = createEffectSeed();
  effectState.epochMs = Date.now();
  setupControls();
}

function draw() {
  background(18, 20, 26);

  // Ортографічна проєкція
  ortho(-width / 2, width / 2, -height / 2, height / 2, -1000, 1000);

  const fadeProgress = constrain((millis() - fadeStartedAt) / fadeDuration, 0, 1);
  const easedFadeProgress = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
  lightLevel = lerp(fadeStartLevel, fadeTargetLevel, easedFadeProgress);
  renderLevel = lightLevel * effectState.brightness / 100;

  scrollProgress = constrain(window.scrollY / max(height, 1), 0, 1);

  let isPortrait = height > width;

  // Поворот та позиціонування
  let targetAngleX = map(scrollProgress, 0, 1, -20, 20);
  currentAngleX = lerp(currentAngleX, targetAngleX, 0.1);

  let targetX, targetY;

  if (isPortrait) {
    targetX = 0;
    targetY = map(scrollProgress, 0, 1, 0, -height * 0.15);
  } else {
    targetX = map(scrollProgress, 0, 1, -width * 0.25, -width * 0.3);
    targetY = 0;
  }

  currentPosX = lerp(currentPosX, targetX, 0.08);
  currentPosY = lerp(currentPosY, targetY, 0.08);

  // Оновлюємо ефект вогню
  const effectUpdateInterval = mobileQuality ? 4 : 2;
  if ((renderLevel > 0.001 || effectNeedsRefresh) && frameCount % effectUpdateInterval === 0) {
    updateEffect();
    effectNeedsRefresh = false;
  }
  // 1. СВІТІННЯ ЗЗАДУ
  if (renderLevel > 0.001) {
    push();
    translate(currentPosX, currentPosY, -150);
    drawBacklightGlow(280, 520, ambientColor, renderLevel);
    pop();
  }

  // 2. 3D РЕНДЕР ЛАМПИ
  push();
  translate(currentPosX, currentPosY, 0);
  rotateX(radians(currentAngleX));

  const radius = isPortrait ? width * 0.17 : height * 0.14;
  const mainHeight = radius * 3.7;
  const baseHeight = radius * 0.18;

  translate(0, (mainHeight - baseHeight) / 2, 0);

  drawFullLamp(radius, mainHeight, baseHeight, glowTexture, renderLevel);
  pop();
}

function createEffectSeed() {
  const seedBuffer = new Uint32Array(1);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(seedBuffer);
    return seedBuffer[0];
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function hashNoise(x, y, z, seed) {
  let value = Math.imul(x | 0, 374761393);
  value = (value + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041) + seed) | 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x, y, z, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);

  const n000 = hashNoise(x0, y0, z0, seed);
  const n100 = hashNoise(x0 + 1, y0, z0, seed);
  const n010 = hashNoise(x0, y0 + 1, z0, seed);
  const n110 = hashNoise(x0 + 1, y0 + 1, z0, seed);
  const n001 = hashNoise(x0, y0, z0 + 1, seed);
  const n101 = hashNoise(x0 + 1, y0, z0 + 1, seed);
  const n011 = hashNoise(x0, y0 + 1, z0 + 1, seed);
  const n111 = hashNoise(x0 + 1, y0 + 1, z0 + 1, seed);
  const lower = lerp(lerp(n000, n100, sx), lerp(n010, n110, sx), sy);
  const upper = lerp(lerp(n001, n101, sx), lerp(n011, n111, sx), sy);
  return lerp(lower, upper, sz);
}

function hexToRgb(hex) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
}

function hsvToRgb(hue) {
  const sector = ((hue % 360) + 360) % 360 / 60;
  const chroma = 1;
  const x = chroma * (1 - abs(sector % 2 - 1));
  let rgb;
  if (sector < 1) rgb = [chroma, x, 0];
  else if (sector < 2) rgb = [x, chroma, 0];
  else if (sector < 3) rgb = [0, chroma, x];
  else if (sector < 4) rgb = [0, x, chroma];
  else if (sector < 5) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  return rgb.map((channel) => Math.round(channel * 255));
}

function getLampState() {
  return {
    ...effectState,
    power: lampOn,
  };
}

function publishLampState() {
  window.dispatchEvent(new CustomEvent('lampstatechange', { detail: getLampState() }));
}

function syncControls() {
  const brightnessControlValue = constrain((effectState.brightness - 50) * 2, 0, 100);
  document.getElementById('brightness').value = brightnessControlValue;
  document.getElementById('brightness-value').textContent = `${Math.round(brightnessControlValue)}%`;
  document.getElementById('effect-speed').value = Math.round(effectState.speed * 100);
  document.getElementById('effect-speed-value').textContent = `${effectState.speed.toFixed(1)}×`;
  document.getElementById('mono-color').value = effectState.color;
  document.getElementById('mono-config').hidden = effectState.mode !== 'mono';
  document.getElementById('effect-seed').textContent = (effectState.seed >>> 0).toString(16).slice(-6).toUpperCase();

  document.querySelectorAll('[data-effect]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.effect === effectState.mode));
  });
}

function setupControls() {
  const brightnessInput = document.getElementById('brightness');
  const speedInput = document.getElementById('effect-speed');

  brightnessInput.addEventListener('input', () => {
    effectState.brightness = lerp(50, 100, Number(brightnessInput.value) / 100);
    syncControls();
    effectNeedsRefresh = true;
    publishLampState();
  });

  speedInput.addEventListener('input', () => {
    effectState.speed = Number(speedInput.value) / 100;
    syncControls();
    effectNeedsRefresh = true;
    publishLampState();
  });

  document.getElementById('mono-color').addEventListener('input', (event) => {
    effectState.color = event.target.value;
    effectNeedsRefresh = true;
    publishLampState();
  });

  document.querySelectorAll('[data-effect]').forEach((button) => {
    button.addEventListener('click', () => {
      effectState.mode = button.dataset.effect;
      effectState.epochMs = Date.now() + 250;
      effectNeedsRefresh = true;
      syncControls();
      publishLampState();
    });
  });

  document.getElementById('new-seed').addEventListener('click', () => {
    effectState.seed = createEffectSeed();
    effectState.epochMs = Date.now() + 250;
    effectNeedsRefresh = true;
    syncControls();
    publishLampState();
  });

  document.querySelectorAll('[data-color]').forEach((button) => {
    button.addEventListener('click', () => {
      effectState.color = button.dataset.color;
      effectState.mode = 'mono';
      effectState.epochMs = Date.now() + 250;
      effectNeedsRefresh = true;
      syncControls();
      publishLampState();
    });
  });

  window.getLampState = getLampState;
  window.applyLampState = (nextState) => {
    effectState = { ...effectState, ...nextState };
    if (typeof nextState.power === 'boolean') {
      lampOn = nextState.power;
      fadeStartLevel = lightLevel;
      fadeTargetLevel = lampOn ? 1 : 0;
      fadeStartedAt = millis();
    }
    effectNeedsRefresh = true;
    syncControls();
  };

  syncControls();
  publishLampState();
}

// Генерація синхронізованої текстури ефекту.
function updateEffect() {
  ledMatrix.background(0);
  ledMatrix.noStroke();

  const elapsed = Math.max(0, Date.now() - effectState.epochMs) * 0.001 * effectState.speed;
  const seed = effectState.seed >>> 0;
  const monoColor = hexToRgb(effectState.color);
  const totalColor = [0, 0, 0];
  let litCount = 0;

  for (let x = 0; x < cols; x++) {
    const angle = x / cols * TWO_PI;
    const nx = cos(angle) * 2.5 + 3;
    const nz = sin(angle) * 2.5 + 3;

    for (let y = 0; y < rows; y++) {
      let pixelColor = null;
      if (effectState.mode === 'mono') {
        pixelColor = monoColor;
      } else if (effectState.mode === 'rainbow') {
        pixelColor = hsvToRgb(x / cols * 360 + elapsed * 80 + seed % 360);
      } else {
        const heat = smoothNoise(nx, y * 0.16 - elapsed * 0.8, nz + elapsed * 0.12, seed);
        const threshold = 0.28 + y / rows * 0.12;
        if (heat > threshold) {
          const strength = constrain(map(heat, threshold, 0.9, 0, 1), 0, 1);
          pixelColor = [255, lerp(12, 220, strength), lerp(0, 34, strength)];
        }
      }

      if (pixelColor) {
        ledMatrix.fill(pixelColor[0], pixelColor[1], pixelColor[2]);
        ledMatrix.rect(x, y, 1, 1);
        totalColor[0] += pixelColor[0];
        totalColor[1] += pixelColor[1];
        totalColor[2] += pixelColor[2];
        litCount++;
      }
    }
  }

  if (litCount > 0) {
    ambientColor[0] = totalColor[0] / litCount;
    ambientColor[1] = totalColor[1] / litCount;
    ambientColor[2] = totalColor[2] / litCount;
  }

  glowTexture.background(
    lerp(242, 0, renderLevel),
    lerp(245, 0, renderLevel),
    lerp(249, 0, renderLevel)
  );
  const tileWidth = glowTexture.width / 3;
  glowTexture.tint(255, 255 * renderLevel);
  glowTexture.image(ledMatrix, 0, 0, tileWidth, glowTexture.height);
  glowTexture.image(ledMatrix, tileWidth, 0, tileWidth, glowTexture.height);
  glowTexture.image(ledMatrix, tileWidth * 2, 0, tileWidth, glowTexture.height);
  glowTexture.noTint();
  glowTexture.filter(BLUR, 2);
}

// Заднє сяйво
function drawBacklightGlow(w, h, col, strength) {
  noStroke();
  beginShape(TRIANGLE_FAN);
  fill(col[0], col[1], col[2], 130 * strength);
  vertex(0, 0, 0);
  fill(col[0], col[1], col[2], 0);

  const detail = 32;
  for (let i = 0; i <= detail; i++) {
    let a = (i / detail) * TWO_PI;
    let rx = cos(a) * w * 1.3;
    let ry = sin(a) * h * 0.8;
    vertex(rx, ry, 0);
  }
  endShape();
}

// Плавне дугове скруглення купола без сходинок
function drawFullLamp(r, mainH, baseH, glow, brightness) {
  textureMode(NORMAL);
  const detail = 128;
  const bottomR = r + 4;

  // 1. ВУЗЬКА НИЖНЯ ПІДСТАВКА
  fill(190, 193, 201);
  noStroke();

  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    const u = i / detail;
    const angle = u * TWO_PI + PI;
    vertex(cos(angle) * r, 0, sin(angle) * r);
    vertex(cos(angle) * bottomR, baseH * 0.4, sin(angle) * bottomR);
  }
  endShape();

  fill(155, 158, 167);
  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    const u = i / detail;
    const angle = u * TWO_PI + PI;
    vertex(cos(angle) * bottomR, baseH * 0.4, sin(angle) * bottomR);
    vertex(cos(angle) * (bottomR - 2), baseH, sin(angle) * (bottomR - 2));
  }
  endShape();

  beginShape(TRIANGLE_FAN);
  vertex(0, baseH, 0);
  for (let i = 0; i <= detail; i++) {
    const u = i / detail;
    const angle = u * TWO_PI + PI;
    vertex(cos(angle) * (bottomR - 2), baseH, sin(angle) * (bottomR - 2));
  }
  endShape();

  // Боковина, скруглення й торець утворюють одну безперервну сітку.
  const roundedTopRadius = r * 0.16;
  const cylinderTopY = -mainH + roundedTopRadius;
  const topSurfaceR = r - roundedTopRadius;
  const buttonR = r * 0.42;
  const topY = -mainH;
  const shellAlpha = lerp(245, 255, 1 - brightness);
  const arcSteps = 16;
  const shellRings = [
    { radius: r, y: baseH * 0.3, v: 0.98 },
    { radius: r, y: cylinderTopY, v: 0.15 },
  ];

  for (let step = 1; step <= arcSteps; step++) {
    const angle = map(step, 0, arcSteps, 0, HALF_PI);
    shellRings.push({
      radius: r - roundedTopRadius * (1 - cos(angle)),
      y: cylinderTopY - sin(angle) * roundedTopRadius,
      v: map(step, 0, arcSteps, 0.15, 0.04),
    });
  }
  tint(255, shellAlpha);
  beginShape(TRIANGLES);
  texture(glow);
  for (let ring = 0; ring < shellRings.length - 1; ring++) {
    for (let i = 0; i < detail; i++) {
      const u = i / detail;
      const angle = u * TWO_PI + PI;
      const nextAngle = (i + 1) / detail * TWO_PI + PI;
      const texU = map(u, 0, 1, 0.333, 0.666);
      const nextTexU = map((i + 1) / detail, 0, 1, 0.333, 0.666);
      const currentRing = shellRings[ring];
      const nextRing = shellRings[ring + 1];
      const currentX = cos(angle) * currentRing.radius;
      const currentZ = sin(angle) * currentRing.radius;
      const nextX = cos(angle) * nextRing.radius;
      const nextZ = sin(angle) * nextRing.radius;
      const currentNextX = cos(nextAngle) * currentRing.radius;
      const currentNextZ = sin(nextAngle) * currentRing.radius;
      const nextNextX = cos(nextAngle) * nextRing.radius;
      const nextNextZ = sin(nextAngle) * nextRing.radius;

      vertex(currentX, currentRing.y, currentZ, texU, currentRing.v);
      vertex(currentNextX, currentRing.y, currentNextZ, nextTexU, currentRing.v);
      vertex(nextX, nextRing.y, nextZ, texU, nextRing.v);
      vertex(currentNextX, currentRing.y, currentNextZ, nextTexU, currentRing.v);
      vertex(nextNextX, nextRing.y, nextNextZ, nextTexU, nextRing.v);
      vertex(nextX, nextRing.y, nextZ, texU, nextRing.v);
    }
  }
  endShape();
  noTint();

  tint(255, shellAlpha);
  beginShape(QUAD_STRIP);
  texture(glow);
  for (let i = 0; i <= detail; i++) {
    const u = i / detail;
    const angle = u * TWO_PI + PI;
    const texU = map(u, 0, 1, 0.333, 0.666);
    vertex(cos(angle) * topSurfaceR, topY, sin(angle) * topSurfaceR, texU, 0.02);
    vertex(cos(angle) * (buttonR + 0.5), topY, sin(angle) * (buttonR + 0.5), texU, 0.02);
  }
  endShape();
  noTint();

  // 3. ОБ'ЄМНА КНОПКА В ЦЕНТРІ
  const buttonHeight = 3.5;
  const btnTopY = topY - buttonHeight;

  fill(175, 178, 185);
  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * buttonR, topY, sin(a) * buttonR);
    vertex(cos(a) * buttonR, btnTopY + 0.8, sin(a) * buttonR);
  }
  endShape();

  fill(190, 193, 200);
  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * buttonR, btnTopY + 0.8, sin(a) * buttonR);
    vertex(cos(a) * (buttonR - 1.2), btnTopY, sin(a) * (buttonR - 1.2));
  }
  endShape();

  fill(215, 218, 225);
  beginShape(TRIANGLE_FAN);
  vertex(0, btnTopY, 0);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * (buttonR - 1.2), btnTopY, sin(a) * (buttonR - 1.2));
  }
  endShape();
}

let touchStartY = 0;
let touchStartX = 0;
let touchStartedOnLamp = false;
let touchMovedEnough = false;
let touchPending = false;
let lastTouchToggleAt = -Infinity;

function isLampHit(x, y) {
  const isPortrait = height > width;
  const radius = isPortrait ? width * 0.17 : height * 0.14;
  const mainHeight = radius * 3.7;
  const centerX = width / 2 + currentPosX;
  const centerY = height / 2 + currentPosY;

  return abs(x - centerX) <= radius * 1.15 && abs(y - centerY) <= mainHeight * 0.55;
}

function toggleLamp() {
  lampOn = !lampOn;
  fadeStartLevel = lightLevel;
  fadeTargetLevel = lampOn ? 1 : 0;
  fadeStartedAt = millis();
  if (lampOn) {
    updateEffect();
    effectNeedsRefresh = false;
  } else {
    effectNeedsRefresh = true;
  }
  syncControls();
  publishLampState();
}

function mousePressed(event) {
  const canvas = document.querySelector('#scene canvas');
  if (!event || event.target !== canvas) return;
  if (touchPending || millis() - lastTouchToggleAt < 500) return;
  if (isLampHit(mouseX, mouseY)) {
    toggleLamp();
    return false;
  }
}

function touchStarted() {
  touchStartY = mouseY;
  touchStartX = mouseX;
  touchStartedOnLamp = isLampHit(mouseX, mouseY);
  touchMovedEnough = false;
  touchPending = true;
}

function touchMoved() {
  if (dist(mouseX, mouseY, touchStartX, touchStartY) > 12) touchMovedEnough = true;
}

function touchEnded() {
  if (touchStartedOnLamp && !touchMovedEnough) {
    toggleLamp();
    lastTouchToggleAt = millis();
  }
  touchPending = false;
}

function windowResized() {
  mobileQuality = min(windowWidth, windowHeight) < 768;
  pixelDensity(mobileQuality ? min(window.devicePixelRatio, 3) : min(window.devicePixelRatio, 2));
  resizeCanvas(windowWidth, windowHeight);
}