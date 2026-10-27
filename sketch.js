let ledMatrix;   // Буфер для точкової матриці 16x16
let glowTexture; // Розмита безшовна текстура
let effectOverlayTexture;
let mobileQuality = false;
let lampOn = true;
let lightLevel = 1;
let renderLevel = 1;
let fadeStartLevel = 1;
let fadeTargetLevel = 1;
let fadeStartedAt = 0;
let effectNeedsRefresh = true;
const fadeDuration = 700;
const effectOverlayOpacity = 1;
let effectState = {
  mode: 'fire',
  brightness: 100,
  brightnessCurve: 'linear',
  speed: 1,
  color: '#ff7420',
  seed: 1,
  epochMs: Date.now(),
};


// ===== РЕЄСТР ЕФЕКТІВ: щоб додати новий, достатньо додати об'єкт сюди =====
// pixel(c) отримує {x,y,nx,nz,t,seed,color} і повертає [r,g,b,alpha] або null
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const EFFECTS = [
  { id: 'fire', name: 'Вогонь', preview: 'linear-gradient(0deg,#ff2a00,#ff9a1f,#ffd36b)',
    pixel: (c) => {
      const heat = smoothNoise(c.nx, c.y * 0.16 - c.t * 0.8, c.nz + c.t * 0.12, c.seed);
      const th = 0.42 + c.y / rows * 0.12;
      if (heat <= th) return null;
      const k = constrain((heat - th) / (0.9 - th), 0, 1);
      return [255, lerp(12, 220, k), lerp(0, 34, k), lerp(250, 255, k)];
    } },
  { id: 'mono', name: 'Колір', usesColor: true, preview: 'linear-gradient(135deg,#ff7420,#ffb46b)',
    pixel: (c) => [...c.color, 255] },
  { id: 'rainbow', name: 'Райдуга', preview: 'linear-gradient(90deg,#ff3b3b,#ffd23b,#3bff6e,#3bc8ff,#9b3bff)',
    pixel: (c) => [...hsvToRgb(c.x / cols * 360 + c.t * 80 + c.seed % 360), 255] },
  { id: 'aurora', name: 'Аврора', preview: 'linear-gradient(135deg,#00ff96,#4aa8ff,#9646ff)',
    pixel: (c) => {
      const n = smoothNoise(c.nx, c.y * 0.14 + c.t * 0.25, c.nz - c.t * 0.1, c.seed);
      return [...mix([0, 255, 150], [150, 70, 255], n), lerp(190, 255, n)];
    } },
  { id: 'ocean', name: 'Океан', preview: 'linear-gradient(135deg,#0032aa,#14e1eb)',
    pixel: (c) => {
      const w = 0.5 + 0.5 * Math.sin(c.x / cols * TWO_PI * 2 + c.y * 0.45 - c.t * 2);
      return [...mix([0, 50, 170], [20, 225, 235], w), 255];
    } },
  { id: 'sunset', name: 'Захід', preview: 'linear-gradient(0deg,#9632d2,#ffaf32,#ff4628)',
    pixel: (c) => {
      const k = constrain(c.y / (rows - 1) + 0.15 * Math.sin(c.t * 0.5 + c.x * 0.4), 0, 1);
      const col = k < 0.5 ? mix([255, 70, 40], [255, 175, 50], k * 2) : mix([255, 175, 50], [150, 50, 210], (k - 0.5) * 2);
      return [...col, 255];
    } },
  { id: 'breathe', name: 'Дихання', usesColor: true, preview: 'radial-gradient(circle,#ffd9b8,#ff7420 60%,#3a1a0c)',
    pixel: (c) => [...c.color, lerp(60, 255, 0.5 + 0.5 * Math.sin(c.t * 1.6))] },
  { id: 'sparkle', name: 'Іскри', usesColor: true, preview: 'radial-gradient(circle at 30% 30%,#fff 0 6%,transparent 7%),radial-gradient(circle at 70% 60%,#fff 0 5%,transparent 6%),#2a2c36',
    pixel: (c) => hashNoise(c.x, c.y, Math.floor(c.t * 5), c.seed) > 0.86 ? [...c.color, 255] : [...c.color, 55] },
];
function getEffect() { return EFFECTS.find((e) => e.id === effectState.mode) || EFFECTS[0]; }

const STORE_KEY = 'smart-lamp-state-v1';
let lampDetail = 96;
let fpsAvg = 60, qualityStep = 0, lastFpsText = 0, qualityCheckAt = 4000;

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...effectState, power: lampOn })); } catch (e) {}
}
function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!saved) return;
    const { power, epochMs, ...rest } = saved;
    effectState = { ...effectState, ...rest };
    if (!EFFECTS.some((e) => e.id === effectState.mode)) effectState.mode = 'fire';
    if (power === false) { lampOn = false; lightLevel = fadeStartLevel = fadeTargetLevel = 0; }
  } catch (e) {}
}
function getDensity() {
  const cap = [3, 1.5, 1][qualityStep];
  return min(window.devicePixelRatio || 1, mobileQuality ? 2.5 : 2, cap);
}
// Автоматично знижує якість, якщо пристрій не тягне 60 FPS
function monitorPerformance() {
  fpsAvg = lerp(fpsAvg, frameRate() || 60, 0.05);
  const now = millis();
  if (location.hash === '#debug' && now - lastFpsText > 500) {
    lastFpsText = now;
    const el = document.getElementById('fps-counter');
    el.hidden = false;
    el.textContent = `FPS ${Math.round(fpsAvg)} · q${qualityStep}`;
  }
  if (now > qualityCheckAt && fpsAvg < 38 && qualityStep < 2 && document.visibilityState === 'visible') {
    qualityStep++;
    lampDetail = qualityStep === 1 ? 64 : 40;
    pixelDensity(getDensity());
    qualityCheckAt = now + 4000;
    fpsAvg = 60;
  }
}

const cols = 16;
const rows = 16;
const cells = new Float32Array(cols * rows * 4); // [r,g,b,alpha] кожного світлодіода
const GLOW_W = 20, GLOW_H = 12, GLOW_RX = 4.6, GLOW_RY = 1.9;
const glowGrid = new Float32Array((GLOW_W + 1) * (GLOW_H + 1) * 4);   // те, що малюється (premultiplied)
const glowTarget = new Float32Array((GLOW_W + 1) * (GLOW_H + 1) * 4); // куди плавно рухається
const blurA = new Float32Array(cols * rows * 4);
const blurB = new Float32Array(cols * rows * 4);
const prevCells = new Float32Array(cols * rows * 4);
let transitionStart = -1;
const transitionDuration = 750;
function beginEffectTransition() {
  prevCells.set(cells);
  transitionStart = millis();
}
let shellLit = 0;
let shellLitTarget = 0; // 0 = лампа вимкнена (світліший плафон), 1 = дуже яскравий ефект (темніший)

// Колір плафона: світліший у вимкненому стані, темніший при яскравому ефекті
function shellRGB() {
  const off = [152, 155, 163];   // вимкнений плафон
  const on = [84, 88, 98];       // плафон, коли світлодіодів багато (не чорний, а темносірий)
  return off.map((v, i) => {
    const c = lerp(v, on[i], shellLit);
    return lerp(c, ambientColor[i], 0.06 * shellLit); // легка прозорість: плафон підхоплює колір світла
  });
}
// Верхня площина: завжди трохи світліша за плафон (дає об'єм), а при світінні ловить світло кольору ефекту
// Кнопка: у вимкненому стані ледь сірувата, а коли ефект горить - світліша, підсвічена кольором ефекту
function buttonTone(r, g, b) {
  return [r, g, b].map((v, i) => lerp(v, lerp(ambientColor[i], 255, 0.5), shellLit * 0.7));
}
function topPlaneRGB() {
  const base = shellRGB().map((v) => Math.min(255, v + 10));
  return base.map((v, i) => lerp(v, lerp(ambientColor[i], 255, 0.3), shellLit * 0.85)); // при світінні площина світлішає разом із лампою
}
// Об'ємне затінення плафона: темніші краї, м'який відблиск зліва, легке затемнення донизу
// Єдина таблиця затінення [позиція u на видимій половині, 1=біле/0=чорне, прозорість].
// u=0.5 - правий край, 0.75 - центр, 1 - лівий край. Її використовують і текстура плафона, і верхня площина,
// тому на стику шва не видно.
const TOP_PLANE_GRADIENT = false; // true = затінення верхньої площини по краях (об'ємніше), false = рівна світла площина
const SHADE_STOPS = [[0.5, 0, 0.4], [0.62, 0, 0.13], [0.78, 0, 0], [0.86, 1, 0.14], [0.93, 0, 0.07], [1, 0, 0.4]];

function shadeColor(u, c, k) {
  u = constrain(u, 0.5, 1);
  let i = 0;
  while (i < SHADE_STOPS.length - 2 && u > SHADE_STOPS[i + 1][0]) i++;
  const a = SHADE_STOPS[i], b = SHADE_STOPS[i + 1];
  const t = (u - a[0]) / (b[0] - a[0]);
  const white = lerp(a[1], b[1], t) * 255, alpha = lerp(a[2], b[2], t) * k;
  return c.map((v) => v * (1 - alpha) + white * alpha);
}

let shadeCanvas = null;
function applyShellShading() {
  const ctx = glowTexture.drawingContext;
  const w = glowTexture.width / 3, h = glowTexture.height, x0 = w;
  // Коли світлодіоди горять, затінення майже зникає, щоб не приглушувати кольори
  const k = 1 - 0.75 * shellLit;
  const stops = [];
  SHADE_STOPS.forEach(([u, white, alpha]) => { stops.push([u, white, alpha]); stops.push([1 - u, white, alpha]); });
  stops.sort((p, q) => p[0] - q[0]);

  // Бічне затінення малюється окремо і плавно зникає на заокругленому верху (без смуг і плям)
  if (!shadeCanvas) {
    shadeCanvas = document.createElement('canvas');
    shadeCanvas.width = 128;
    shadeCanvas.height = 192;
  }
  const sx = shadeCanvas.getContext('2d');
  const W = shadeCanvas.width, H = shadeCanvas.height;
  sx.clearRect(0, 0, W, H);
  sx.globalCompositeOperation = 'source-over';
  const side = sx.createLinearGradient(0, 0, W, 0);
  let last = -1;
  stops.forEach(([f, white, alpha]) => {
    if (Math.abs(f - last) < 1e-6) return;
    last = f;
    side.addColorStop(f, `rgba(${white * 255},${white * 255},${white * 255},${alpha * k})`);
  });
  sx.fillStyle = side;
  sx.fillRect(0, 0, W, H);
  sx.globalCompositeOperation = 'destination-in';
  const mask = sx.createLinearGradient(0, 0, 0, H);
  [[0, 0], [0.16, 0], [0.2, 0.1], [0.26, 0.4], [0.32, 0.8], [0.38, 1], [1, 1]]
    .forEach(([p, a]) => mask.addColorStop(p, `rgba(0,0,0,${a})`));
  sx.fillStyle = mask;
  sx.fillRect(0, 0, W, H);
  sx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shadeCanvas, x0, 0, w, h);
  const down = ctx.createLinearGradient(0, h * 0.15, 0, h * 0.98);
  down.addColorStop(0, 'rgba(0,0,0,0)');
  down.addColorStop(1, `rgba(0,0,0,${0.16 * k})`);
  ctx.fillStyle = down;
  ctx.fillRect(x0, h * 0.15, w, h);
  ctx.restore();
}
// Верхня площина й кнопка йдуть за кольором плафона, але на d одиниць світліші
function ringTone(d) {
  return shellRGB().map((v) => Math.min(255, v + d));
}
function setShellBackground() {
  glowTexture.background(shellRGB());
}
function tone(r, g, b) {
  const k = lerp(1, 0.8, shellLit); // білий пластик ледь темнішає, коли лампа яскраво світить
  return [r * k, g * k, b * k];
}
// Білінійна вибірка матриці світлодіодів (колонки замкнені по колу)
function sampleCell(cf, rf) {
  const c0 = Math.floor(cf), r0 = Math.floor(rf), fc = cf - c0, fr = rf - r0;
  const o = [0, 0, 0, 0];
  for (let dc = 0; dc < 2; dc++) for (let dr = 0; dr < 2; dr++) {
    const w = (dc ? fc : 1 - fc) * (dr ? fr : 1 - fr);
    const i = ((((c0 + dc) % cols) + cols) % cols * rows + constrain(r0 + dr, 0, rows - 1)) * 4;
    o[0] += blurA[i] * w; o[1] += blurA[i + 1] * w; o[2] += blurA[i + 2] * w; o[3] += blurA[i + 3] * w;
  }
  return o;
}
// Сильне розмиття матриці (по колу і по висоті), щоб окремих пікселів у підсвітці не було видно
function blurCells() {
  for (let i = 0; i < cols * rows; i++) {
    const a = cells[i * 4 + 3] / 255;
    blurA[i * 4] = cells[i * 4] * a; blurA[i * 4 + 1] = cells[i * 4 + 1] * a;
    blurA[i * 4 + 2] = cells[i * 4 + 2] * a; blurA[i * 4 + 3] = a;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) for (let k = 0; k < 4; k++) {
      let sum = 0;
      for (let d = -3; d <= 3; d++) sum += blurA[(((x + d + cols) % cols) * rows + y) * 4 + k];
      blurB[(x * rows + y) * 4 + k] = sum / 7;
    }
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) for (let k = 0; k < 4; k++) {
      let sum = 0;
      for (let d = -2; d <= 2; d++) sum += blurB[(x * rows + constrain(y + d, 0, rows - 1)) * 4 + k];
      blurA[(x * rows + y) * 4 + k] = sum / 5;
    }
  }
}
// Заднє світло повторює розподіл світла на видимій половині лампи: де лівіше більше діодів - там яскравіше
function buildGlowGrid() {
  blurCells();
  for (let gy = 0; gy <= GLOW_H; gy++) {
    const ny = gy / GLOW_H * 2 - 1;
    for (let gx = 0; gx <= GLOW_W; gx++) {
      const nx = gx / GLOW_W * 2 - 1;
      const o = sampleCell(cols * (0.75 - 0.25 * constrain(nx * GLOW_RX, -1, 1)),
                           2.4 + (constrain(ny * GLOW_RY, -1, 1) * 0.5 + 0.5) * 13.3);
      const f = Math.pow(Math.max(0, 1 - Math.sqrt(nx * nx + ny * ny)), 1.6);
      const i = (gy * (GLOW_W + 1) + gx) * 4;
      glowTarget[i] = o[0] * f; glowTarget[i + 1] = o[1] * f; glowTarget[i + 2] = o[2] * f; glowTarget[i + 3] = o[3] * f;
    }
  }
}

// Змінні прогресу скролу (від 0.0 до 1.0)
let scrollProgress = 0;
let targetScrollProgress = 0;

// Анімовані параметри
let currentAngleX = -20;
let currentPosY = 0;
let currentPosX = 0;

// Середній колір для світіння ззаду
let ambientColor = [255, 100, 20];
let effectHasLight = true;

function setup() {
  setAttributes('antialias', true);
  createCanvas(windowWidth, windowHeight, WEBGL).parent('scene');

  smooth();
  mobileQuality = min(windowWidth, windowHeight) < 768;
  pixelDensity(getDensity());
  frameRate(60);
  lampDetail = mobileQuality ? 64 : 96;

  // Буфери текстур
  ledMatrix = createGraphics(cols, rows);
  glowTexture = createGraphics(192, 96);
  effectOverlayTexture = createGraphics(192, 96);
  effectState.seed = createEffectSeed();
  effectState.epochMs = Date.now();
  loadSavedState();
  setupControls();
}

function draw() {
  background(18, 20, 26);
  monitorPerformance();

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
  shellLit += (shellLitTarget - shellLit) * (1 - Math.exp(-deltaTime / 450));
  if (Math.abs(shellLitTarget - shellLit) < 0.002) shellLit = shellLitTarget;
  const effectUpdateInterval = mobileQuality || qualityStep ? 4 : 3;
  if ((renderLevel > 0.001 || effectNeedsRefresh || shellLit !== shellLitTarget) && frameCount % effectUpdateInterval === 0) {
    updateEffect();
    effectNeedsRefresh = false;
  }
  const radius = isPortrait ? width * 0.17 : height * 0.14;
  const mainHeight = radius * 3.7;
  const baseHeight = radius * 0.18;

  // 1. СВІТІННЯ ЗЗАДУ
  if (renderLevel > 0.001 && effectHasLight) {
    push();
    translate(currentPosX, currentPosY, -150);
    drawBacklightGlow(radius, mainHeight, renderLevel);
    pop();
  }

  // 2. 3D РЕНДЕР ЛАМПИ
  push();
  translate(currentPosX, currentPosY, 0);
  rotateX(radians(currentAngleX));

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
  saveState();
  window.dispatchEvent(new CustomEvent('lampstatechange', { detail: getLampState() }));
}

function syncControls() {
  const $ = (id) => document.getElementById(id);
  const effect = getEffect();
  cells.fill(0);
  const curvePower = getBrightnessCurvePower(effectState.brightnessCurve);
  const normalized = constrain((effectState.brightness - 50) / 50, 0, 1);
  const sliderValue = Math.pow(normalized, 1 / curvePower) * 100;
  $('brightness').value = sliderValue;
  $('brightness-value').textContent = `${Math.round(sliderValue)}%`;
  $('led-brightness').textContent = `${Math.round(effectState.brightness)}%`;
  $('effect-speed').value = Math.round(effectState.speed * 100);
  $('effect-speed-value').textContent = `${effectState.speed.toFixed(1)}×`;
  $('mono-color').value = effectState.color;
  $('color-row').hidden = !effect.usesColor;
  $('effect-name').textContent = effect.name;
  $('effect-seed').textContent = (effectState.seed >>> 0).toString(16).slice(-6).toUpperCase();
  document.querySelectorAll('input[type="range"]').forEach((r) => {
    r.style.setProperty('--p', `${(r.value - r.min) / (r.max - r.min) * 100}%`);
  });
  document.querySelectorAll('[data-effect]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.effect === effectState.mode));
  });
  document.querySelectorAll('[data-curve]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.curve === effectState.brightnessCurve));
  });
}

function getBrightnessCurvePower(curve) {
  if (curve === 'soft') return 0.7;
  if (curve === 'precise') return 1.8;
  return 1;
}


// ===== МОЇ НАЛАШТУВАННЯ (пресети): ефект + колір + швидкість + яскравість =====
const PRESET_KEY = 'smart-lamp-presets-v1';
let presets = [];
let activePreset = 0;

function presetFromState(name) {
  const { mode, color, speed, brightness, brightnessCurve, seed } = effectState;
  return { name, mode, color, speed, brightness, brightnessCurve, seed };
}
function loadPresets() {
  try {
    const p = JSON.parse(localStorage.getItem(PRESET_KEY) || 'null');
    if (p && Array.isArray(p.list)) {
      presets = p.list.filter((x) => EFFECTS.some((e) => e.id === x.mode));
      activePreset = constrain(p.active | 0, 0, Math.max(presets.length - 1, 0));
    }
  } catch (e) {}
  if (!presets.length) {
    presets = ['fire', 'rainbow', 'ocean'].map((id) => ({
      name: EFFECTS.find((e) => e.id === id).name, mode: id, color: '#ff7420', speed: 1,
      brightness: 100, brightnessCurve: 'linear', seed: createEffectSeed(),
    }));
    activePreset = 0;
  }
}
function savePresets() {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify({ list: presets, active: activePreset })); } catch (e) {}
}
function showToast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove('show'), 1300);
}
function applyPreset(i) {
  const p = presets[i];
  if (!p) return;
  activePreset = i;
  beginEffectTransition();
  effectState = { ...effectState, mode: p.mode, color: p.color, speed: p.speed, brightness: p.brightness,
    brightnessCurve: p.brightnessCurve, seed: p.seed ?? effectState.seed, epochMs: Date.now() + 250 };
  effectNeedsRefresh = true;
  syncControls();
  renderPresets();
  savePresets();
  publishLampState();
  showToast(p.name);
}
function stepPreset(dir) {
  if (presets.length > 1) applyPreset((activePreset + dir + presets.length) % presets.length);
}
function renderPresets() {
  const list = document.getElementById('preset-list');
  list.innerHTML = '';
  presets.forEach((p, i) => {
    const effect = EFFECTS.find((e) => e.id === p.mode) || EFFECTS[0];
    const chip = document.createElement('div');
    chip.className = 'preset-chip';
    chip.setAttribute('aria-current', String(i === activePreset));
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.dataset.preset = i;
    const dot = document.createElement('span');
    dot.className = 'chip-sw';
    dot.style.background = effect.usesColor ? p.color : effect.preview;
    pick.append(dot, document.createTextNode(p.name));
    chip.appendChild(pick);
    if (presets.length > 1) {
      const del = document.createElement('button');
      del.type = 'button';
      del.dataset.del = i;
      del.setAttribute('aria-label', `Видалити ${p.name}`);
      del.textContent = '×';
      chip.appendChild(del);
    }
    list.appendChild(chip);
  });
}
function setupPresetsAndGestures() {
  loadPresets();
  renderPresets();
  document.getElementById('preset-list').addEventListener('click', (event) => {
    const pick = event.target.closest('[data-preset]');
    const del = event.target.closest('[data-del]');
    if (del) {
      presets.splice(Number(del.dataset.del), 1);
      activePreset = constrain(activePreset, 0, presets.length - 1);
      savePresets(); renderPresets();
    } else if (pick) applyPreset(Number(pick.dataset.preset));
  });
  document.getElementById('preset-add').addEventListener('click', () => {
    presets.push(presetFromState(`${getEffect().name} ${presets.length + 1}`));
    activePreset = presets.length - 1;
    savePresets(); renderPresets(); showToast('Збережено');
  });
  document.getElementById('preset-update').addEventListener('click', () => {
    presets[activePreset] = presetFromState(presets[activePreset].name);
    savePresets(); renderPresets(); showToast('Оновлено');
  });

  // Свайп вліво/вправо по сцені - наступний/попередній пресет, тап по лампі - вмикання/вимкнення
  const scene = document.getElementById('scene');
  let start = null;
  scene.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
  scene.addEventListener('pointercancel', () => { start = null; });
  scene.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) stepPreset(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 12 && isLampHit(e.clientX, e.clientY)) toggleLamp();
  });
}

function buildEffectList() {
  const list = document.getElementById('effect-list');
  EFFECTS.forEach((e) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'effect-tile';
    b.dataset.effect = e.id;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="tile-swatch" style="background:${e.preview}"></span><span class="tile-name">${e.name}</span>`;
    list.appendChild(b);
  });
}

function setupControls() {
  buildEffectList();
  setupPresetsAndGestures();
  const brightnessInput = document.getElementById('brightness');
  const speedInput = document.getElementById('effect-speed');

  brightnessInput.addEventListener('input', () => {
    const sliderPosition = Number(brightnessInput.value) / 100;
    const curvePower = getBrightnessCurvePower(effectState.brightnessCurve);
    effectState.brightness = lerp(50, 100, Math.pow(sliderPosition, curvePower));
    syncControls();
    effectNeedsRefresh = true;
    publishLampState();
  });

  document.querySelectorAll('[data-curve]').forEach((button) => {
    button.addEventListener('click', () => {
      effectState.brightnessCurve = button.dataset.curve;
      const sliderPosition = Number(brightnessInput.value) / 100;
      effectState.brightness = lerp(
        50,
        100,
        Math.pow(sliderPosition, getBrightnessCurvePower(effectState.brightnessCurve))
      );
      syncControls();
      effectNeedsRefresh = true;
      publishLampState();
    });
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
      beginEffectTransition();
      effectState.mode = button.dataset.effect;
      effectState.epochMs = Date.now() + 250;
      effectNeedsRefresh = true;
      syncControls();
      publishLampState();
    });
  });

  document.getElementById('new-seed').addEventListener('click', () => {
    beginEffectTransition();
    effectState.seed = createEffectSeed();
    effectState.epochMs = Date.now() + 250;
    effectNeedsRefresh = true;
    syncControls();
    publishLampState();
  });

  document.querySelectorAll('[data-color]').forEach((button) => {
    button.addEventListener('click', () => {
      beginEffectTransition();
      effectState.color = button.dataset.color;
      if (!getEffect().usesColor) effectState.mode = 'mono';
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
  if (renderLevel <= 0.001) {
    shellLitTarget = 0;
    setShellBackground();
    applyShellShading();
    effectOverlayTexture.clear();
    glowTexture.noTint();
    return;
  }

  const elapsed = Math.max(0, Date.now() - effectState.epochMs) * 0.001 * effectState.speed;
  const seed = effectState.seed >>> 0;
  const monoColor = hexToRgb(effectState.color);
  const effect = getEffect();
  cells.fill(0);

  for (let x = 0; x < cols; x++) {
    const angle = x / cols * TWO_PI;
    const nx = cos(angle) * 2.5 + 3;
    const nz = sin(angle) * 2.5 + 3;
    for (let y = 0; y < rows; y++) {
      const c = effect.pixel({ x, y, nx, nz, t: elapsed, seed, color: monoColor });
      if (c) {
        const ci = (x * rows + y) * 4;
        cells[ci] = c[0]; cells[ci + 1] = c[1]; cells[ci + 2] = c[2]; cells[ci + 3] = c[3] ?? 255;
      }
    }
  }

  // Плавне змішування зі збереженим попереднім станом
  if (transitionStart >= 0) {
    const p = constrain((millis() - transitionStart) / transitionDuration, 0, 1);
    const t = p * p * (3 - 2 * p);
    for (let i = 0; i < cells.length; i += 4) {
      const pa = prevCells[i + 3] * (1 - t), na = cells[i + 3] * t, a = pa + na;
      for (let k = 0; k < 3; k++) cells[i + k] = a > 0 ? (prevCells[i + k] * pa + cells[i + k] * na) / a : 0;
      cells[i + 3] = a;
    }
    if (p >= 1) transitionStart = -1;
  }

  ledMatrix.clear();
  ledMatrix.noStroke();
  const totalColor = [0, 0, 0];
  let totalAlpha = 0;
  let litSum = 0;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const i = (x * rows + y) * 4;
      const a = cells[i + 3];
      if (a <= 0.5) continue;
      ledMatrix.fill(cells[i], cells[i + 1], cells[i + 2], a);
      ledMatrix.rect(x, y, 1, 1);
      totalColor[0] += cells[i] * a; totalColor[1] += cells[i + 1] * a; totalColor[2] += cells[i + 2] * a;
      totalAlpha += a;
      litSum += a / 255 * Math.max(cells[i], cells[i + 1], cells[i + 2]) / 255;
    }
  }

  if (totalAlpha > 0) {
    effectHasLight = true;
    ambientColor[0] = totalColor[0] / totalAlpha;
    ambientColor[1] = totalColor[1] / totalAlpha;
    ambientColor[2] = totalColor[2] / totalAlpha;
  } else {
    effectHasLight = false;
    ambientColor[0] = ambientColor[1] = ambientColor[2] = 0;
  }

  const coverageLit = Math.pow(constrain(litSum / (cols * rows) * 1.3, 0, 1), 0.9) * renderLevel;
  shellLitTarget = coverageLit; // чим більше світлих пікселів, тим темніший плафон (плавно, див. draw)
  setShellBackground();
  buildGlowGrid();

  const tileWidth = glowTexture.width / 3;
  const blurAmount = qualityStep ? 2 : 3;
  glowTexture.tint(255, 255 * renderLevel * effectOverlayOpacity);
  for (let pass = 0; pass < 3; pass++) for (let k = 0; k < 3; k++) glowTexture.image(ledMatrix, tileWidth * k, 0, tileWidth, glowTexture.height);
  glowTexture.noTint();
  glowTexture.filter(BLUR, blurAmount);
  applyShellShading();

  effectOverlayTexture.clear();
  effectOverlayTexture.tint(255, 255 * renderLevel * effectOverlayOpacity);
  for (let pass = 0; pass < 3; pass++) for (let k = 0; k < 3; k++) effectOverlayTexture.image(ledMatrix, tileWidth * k, 0, tileWidth, effectOverlayTexture.height);
  effectOverlayTexture.noTint();
  effectOverlayTexture.filter(BLUR, blurAmount);
}

// Заднє сяйво
function drawBacklightGlow(r, mainH, strength) {
  for (let i = 0; i < glowGrid.length; i++) glowGrid[i] += (glowTarget[i] - glowGrid[i]) * 0.14; // плавний перехід
  noStroke();
  const hw = r * GLOW_RX, hh = mainH / 2 * GLOW_RY;
  for (let gy = 0; gy < GLOW_H; gy++) {
    beginShape(TRIANGLE_STRIP);
    for (let gx = 0; gx <= GLOW_W; gx++) {
      for (let k = 0; k < 2; k++) {
        const row = gy + k, i = (row * (GLOW_W + 1) + gx) * 4, a = glowGrid[i + 3];
        if (a > 0.001) fill(glowGrid[i] / a, glowGrid[i + 1] / a, glowGrid[i + 2] / a, 190 * strength * a);
        else fill(0, 0, 0, 0);
        vertex((gx / GLOW_W * 2 - 1) * hw, (row / GLOW_H * 2 - 1) * hh, 0);
      }
    }
    endShape();
  }
}

// Плавне дугове скруглення купола без сходинок
function drawFullLamp(r, mainH, baseH, glow, brightness) {
  textureMode(NORMAL);
  const detail = lampDetail;
  const bottomR = r + 4;

  // 1. ВУЗЬКА НИЖНЯ ПІДСТАВКА
  fill(tone(228, 229, 234));
  noStroke();

  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    const u = i / detail;
    const angle = u * TWO_PI + PI;
    vertex(cos(angle) * r, 0, sin(angle) * r);
    vertex(cos(angle) * bottomR, baseH * 0.4, sin(angle) * bottomR);
  }
  endShape();

  fill(tone(192, 195, 202));
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
  const shellAlpha = 255;
  const arcSteps = lampDetail >= 96 ? 14 : 8;
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

  const topBase = topPlaneRGB();
  const shadeK = 1 - 0.4 * shellLit;
  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    const angle = i / detail * TWO_PI + PI;
    const uEq = 0.75 - 0.25 * cos(angle); // те саме затінення за положенням по X, що й на плафоні
    fill(TOP_PLANE_GRADIENT ? shadeColor(uEq, topBase, shadeK) : topBase);
    vertex(cos(angle) * topSurfaceR, topY, sin(angle) * topSurfaceR);
    fill(TOP_PLANE_GRADIENT ? shadeColor(uEq, topBase, shadeK * 0.4).map((v) => Math.min(255, v + 5)) : topBase);
    vertex(cos(angle) * (buttonR + 0.5), topY, sin(angle) * (buttonR + 0.5));
  }
  endShape();

  if (brightness > 0.001) {
    tint(255, shellAlpha * effectOverlayOpacity);
    beginShape(QUAD_STRIP);
    texture(effectOverlayTexture);
    for (let i = 0; i <= detail; i++) {
      const u = i / detail;
      const angle = i / detail * TWO_PI + PI;
      const texU = map(u, 0, 1, 0.333, 0.666);
      vertex(cos(angle) * topSurfaceR, topY - 0.01, sin(angle) * topSurfaceR, texU, 0.02);
      vertex(cos(angle) * (buttonR + 0.5), topY - 0.01, sin(angle) * (buttonR + 0.5), texU, 0.02);
    }
    endShape();
    noTint();
  }

  // 3. ОБ'ЄМНА КНОПКА В ЦЕНТРІ
  const buttonHeight = 3.5;
  const btnTopY = topY - buttonHeight;

  fill(buttonTone(230, 231, 235));
  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * buttonR, topY, sin(a) * buttonR);
    vertex(cos(a) * buttonR, btnTopY + 0.8, sin(a) * buttonR);
  }
  endShape();

  fill(buttonTone(236, 237, 240));
  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * buttonR, btnTopY + 0.8, sin(a) * buttonR);
    vertex(cos(a) * (buttonR - 1.2), btnTopY, sin(a) * (buttonR - 1.2));
  }
  endShape();

  fill(buttonTone(242, 243, 246));
  beginShape(TRIANGLE_FAN);
  vertex(0, btnTopY, 0);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * (buttonR - 1.2), btnTopY, sin(a) * (buttonR - 1.2));
  }
  endShape();
}


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





function windowResized() {
  mobileQuality = min(windowWidth, windowHeight) < 768;
  pixelDensity(getDensity());
  resizeCanvas(windowWidth, windowHeight);
}