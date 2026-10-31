'use strict';
// Рушій: годинник ефектів + WebGL-рендер лампи одним шейдером + інтерфейс. Ефекти - у effects.js.
const $ = (id) => document.getElementById(id);
const STORE_KEY = 'smart-lamp-state-v1', PRESET_KEY = 'smart-lamp-presets-v1';
const TICK_MS = 1000 / 30;       // базовий крок ефекту; швидкість множить частоту кроків (як затримка кадру в прошивці)
const lerp = (a, b, t) => a + (b - a) * t;
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const hashId = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const randomId = () => 'LAMP-' + newSeed().toString(16).slice(-6).toUpperCase();
let state = { lampName: 'Smart Lamp', mode: 'fire', brightness: 100, brightnessCurve: 'linear', speed: 1, colors: ['#ff7420', '#12081f', '#ffd9a0'], lampId: randomId() };
let sim = { fps: 60, quality: 1, glow: 100, tilt: 18, size: 100, showFps: false, smooth: true, auto: true, swipeBri: true };
// Час ефектів: абсолютний (від 2026-01-01) і не залежить від кадрів. Швидкість лише змінює темп без стрибків.
const EPOCH = 1767225600000, clock = { T0: Date.now() - EPOCH, A: Date.now(), speed: 1 };
const virtualMs = () => (clock.T0 + (Date.now() - clock.A) * clock.speed) % 4294967296;
function setSpeed(v) { clock.T0 += (Date.now() - clock.A) * clock.speed; clock.A = Date.now(); clock.speed = v; }
function setColors() { [COLOR, COLOR2, COLOR3] = state.colors.map((h) => CRGB(...hexRgb(h))); }
let lampOn = true, level = 1, lvFrom = 1, lvTo = 1, lvAt = 0;
let dirty = true, last = 0, tickAcc = 0, shellLit = 0, xfadeAt = -1, avgDt = 16, dprScale = 1, qualityAt = 4000;
const prev = new Float32Array(768), cur = new Float32Array(768), snap = new Float32Array(768), shown = new Float32Array(768);
const texData = new Uint8Array(1024);
const getEffect = () => EFFECTS.find((e) => e.id === state.mode) || EFFECTS[0];

// ---------- ефект ----------
function runTick() {
  _ms = virtualMs();
  getEffect().draw();
  for (let i = 0; i < NUM_LEDS; i++) { const l = leds[i]; cur[i * 3] = l.r; cur[i * 3 + 1] = l.g; cur[i * 3 + 2] = l.b; }
}
function applyEffect(crossfade = true) {
  if (crossfade) { snap.set(shown); xfadeAt = performance.now(); }
  SEED = hashId(state.lampId); setColors(); if (clock.speed !== state.speed) setSpeed(state.speed);
  FastLED.clear(); cur.fill(0); prev.fill(0);
  if (getEffect().setup) getEffect().setup();
  runTick(); prev.set(cur); tickAcc = 0; dirty = true;
}

// ---------- WebGL ----------
const canvas = document.createElement('canvas');
$('scene').appendChild(canvas);
const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uC; uniform vec4 uP; uniform vec3 uS; uniform sampler2D uT; uniform sampler2D uG; uniform vec3 uB1; uniform vec3 uB2; uniform vec2 uV; uniform float uQ;
const float TAU = 6.2831853;
float gR, gH;
vec3 tx(float x, float y) { return texture2D(uT, vec2(x, y)).rgb; }
// гладка бікубічна (B-spline) вибірка матриці 16x16: без блоків і ромбів
vec3 led(vec2 uv) {
  vec2 t = uv * 16. - .5, i = floor(t), f = t - i, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1. - f) * (1. - f) * (1. - f) / 6., w1 = (4. - 6. * f2 + 3. * f3) / 6.;
  vec2 w2 = (1. + 3. * f + 3. * f2 - 3. * f3) / 6., w3 = f3 / 6.;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 1. + w1 / g0 + .5) / 16., h1 = (i + 1. + w3 / g1 + .5) / 16.;
  return g0.y * (g0.x * tx(h0.x, h0.y) + g1.x * tx(h1.x, h0.y)) + g1.y * (g0.x * tx(h0.x, h1.y) + g1.x * tx(h1.x, h1.y));
}
vec3 over(vec3 shell, vec3 L) {
  float m = max(L.r, max(L.g, L.b));
  float a = 1. - pow(1. - clamp(m * uS.x, 0., 1.), 3.);
  return mix(shell, L / max(m, 1e-3), a);
}
float sdTop(vec3 p, float y0, float y1, float r, float rr) { // циліндр: скруглений лише зверху, низ плоский
  vec2 q = vec2(length(p.xz) - r + rr, p.y - y1 + rr);
  float d = min(max(q.x, q.y), 0.) + length(max(q, 0.)) - rr;
  return max(d, y0 - p.y);
}
float sdRC(vec3 p, float yc, float hh, float r, float rr) { // циліндр, скруглений і зверху, і знизу
  vec2 q = vec2(length(p.xz) - r + rr, abs(p.y - yc) - hh + rr);
  return min(max(q.x, q.y), 0.) + length(max(q, 0.)) - rr;
}
float dBody(vec3 p) { return sdTop(p, 0., gH, gR, .26 * gR); }
float dBase(vec3 p) { return sdTop(p, -.09 * gR, 0., 1.06 * gR, .035 * gR); }
float dBtn(vec3 p) { return sdRC(p, gH + .022 * gR, .022 * gR, .43 * gR, .02 * gR); }
float scene(vec3 p) { return min(dBody(p), min(dBase(p), dBtn(p))); }
vec3 shade(vec3 q, vec3 shell, float tone, float kk) {
  float R = gR, H = gH, s = uP.z, c = uP.w;
  vec2 e = vec2(.6, -.6);
  vec3 n = normalize(e.xyy * scene(q + e.xyy) + e.yyx * scene(q + e.yyx) + e.yxy * scene(q + e.yxy) + e.xxx * scene(q + e.xxx));
  float db = dBody(q), ds = dBase(q), dt = dBtn(q);
  vec3 ldir = normalize(vec3(-.45, .75, .55)), vdir = vec3(0., s, c), hv = normalize(ldir + vdir);
  float nl = max(dot(n, ldir), 0.), fr = pow(1. - clamp(dot(n, vdir), 0., 1.), 3.);
  vec3 k;
  if (dt < db && dt < ds) {
    k = vec3(.93, .94, .96) * tone * (.62 + .38 * nl) * (1. - .25 * fr);
    k += pow(max(dot(n, hv), 0.), 36.) * .45;
  } else if (ds < db) {
    k = vec3(.86, .875, .9) * tone * (.5 + .5 * nl);
    k += pow(max(dot(n, hv), 0.), 30.) * .2;
  } else {
    vec3 L = led(vec2(fract(atan(q.z, q.x) / TAU + .5), clamp(q.y / H, 0., .97)));
    float diff = .62 + .38 * nl;
    k = over(shell * diff, L) * (.88 + .12 * diff);
    k *= 1. - .4 * kk * fr;
    k += .24 * kk * pow(fr, 5.);
    k += pow(max(dot(n, hv), 0.), 22.) * .3 * kk;
    if (n.y > .9) k *= mix(.78, 1., smoothstep(R * .43, R * .58, length(q.xz)));
  }
  return k;
}
void main() {
  gR = uP.x; gH = uP.y;
  float R = gR, H = gH, s = uP.z, c = uP.w;
  vec2 p = gl_FragCoord.xy - uC;
  vec3 col = mix(uB2, uB1, gl_FragCoord.y / uV.y);
  vec3 shell = mix(vec3(.76, .77, .81), vec3(.33, .345, .384), uS.y);
  float tone = mix(1., .8, uS.y), kk = 1. - .75 * uS.y;
  vec2 q2 = vec2(p.x / (R * 4.6), (p.y - H * c * .5) / (H * .95));
  float gl = length(q2), f = exp(-3.5 * gl * gl) * smoothstep(1., .65, gl);
  float gx = q2.x * 4.6;
  col += texture2D(uG, vec2(.75 - .25 * clamp(gx / (1. + .5 * abs(gx)) * 1.5, -1., 1.), .5 + .4 * clamp(q2.y * 1.9, -1., 1.))).rgb * f * .95 * uS.x * uS.z;
  if (abs(p.x) < R * 1.06 + 3. && p.y > -(.12 * R * c + 1.06 * R * s + 3.) && p.y < H * c + R * s + .2 * R + 3.) {
    vec3 dir = vec3(0., -s, -c), up = vec3(0., c, -s);
    float T0 = H + R * 3.;
    vec3 ro = vec3(p.x, 0., 0.) + up * p.y - dir * T0;
    float t = 0., dmin = 1e9, tmin = 0.; bool hit = false;
    for (int i = 0; i < 100; i++) {
      float d = scene(ro + dir * t);
      if (d < dmin) { dmin = d; tmin = t; }
      if (d < .2) { hit = true; break; }
      t += max(d * .9, .05);
      if (t > T0 * 2.) break;
    }
    if (hit) col = shade(ro + dir * t, shell, tone, kk);
    else if (dmin < 1.5) col = mix(col, shade(ro + dir * tmin, shell, tone, kk), 1. - dmin / 1.5); // м'який край: згладжування без чорної обводки
  }
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 170.;
  gl_FragColor = vec4(col, 1.);
}`;function compile(type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const U = Object.fromEntries(['uC', 'uP', 'uS', 'uT', 'uG', 'uB1', 'uB2', 'uV', 'uQ'].map((n) => [n, gl.getUniformLocation(prog, n)]));
const tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, WIDTH, HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
const texG = gl.createTexture(), glowData = new Uint8Array(1024), tmpG = new Float32Array(768);
gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texG);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, WIDTH, HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, glowData);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
gl.uniform1i(U.uT, 0); gl.uniform1i(U.uG, 1);
const GK = [0.027, 0.065, 0.121, 0.176, 0.222, 0.176, 0.121, 0.065, 0.027];
function blurGlow() { // сильне розмиття по колу й по висоті: світло "розтікається" плавно, без смуг
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) for (let k = 0; k < 3; k++) {
    let a = 0; for (let d = -4; d <= 4; d++) a += texData[(y * WIDTH + ((x + d + WIDTH) & 15)) * 4 + k] * GK[d + 4];
    tmpG[(y * WIDTH + x) * 3 + k] = a;
  }
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    for (let k = 0; k < 3; k++) {
      let a = 0; for (let d = -4; d <= 4; d++) a += tmpG[(constrain(y + d, 0, HEIGHT - 1) * WIDTH + x) * 3 + k] * GK[d + 4];
      glowData[(y * WIDTH + x) * 4 + k] = a;
    }
    glowData[(y * WIDTH + x) * 4 + 3] = 255;
  }
}

// ---------- розкладка (положення лампи залежить від скролу) ----------
const lay = { x: 0, y: 0, tilt: 18, init: false, R: 1, H: 1, sR: 0 };
// Розкладка: на ПК справа панель і смуга іконок; на телефоні, коли вікно відкрите, лампа стає маленьким превʼю в кутку (прямо).
let desk = false, openTab = null, box = { x: 0, y: 70, w: innerWidth, h: innerHeight / 2 }, bgRgb = [[0.051, 0.043, 0.078], [0.051, 0.043, 0.078]];
function measureDock() {
  const W = innerWidth, Ht = innerHeight, tb = $('topbar').offsetHeight + 28, sheet = $('sheet');
  desk = matchMedia('(min-width:900px)').matches;
  box = desk ? { x: 0, y: tb, w: W - 88 - (openTab ? sheet.offsetWidth + 16 : 0), h: Ht - tb - 16 } : { x: 0, y: tb, w: W, h: Ht - tb - 92 };
  dirty = true;
}
function updateLayout(dt) {
  const mini = !desk && !!openTab;
  lay.R = mini ? 19 : constrain(Math.min(box.w * (desk ? 0.2 : 0.17), box.h / 5.3, 170) * sim.size / 100, 12, 260); lay.H = lay.R * 3.7;
  const tx = mini ? 40 : box.x + box.w / 2, ty = mini ? 56 : box.y + box.h / 2, tt = mini ? 0 : sim.tilt;
  const k = lay.init ? 1 - Math.exp(-dt / 130) : 1; lay.init = true;
  const moving = Math.abs(tx - lay.x) + Math.abs(ty - lay.y) + Math.abs(tt - lay.tilt) + Math.abs(lay.R - lay.sR) > 0.05;
  lay.sR += (lay.R - lay.sR) * (lay.sR ? k : 1);
  lay.x += (tx - lay.x) * k; lay.y += (ty - lay.y) * k; lay.tilt += (tt - lay.tilt) * k;
  frameMoving = moving; return moving;
}
let frameMoving = false;
function resize() {
  const d = Math.max(Math.min(devicePixelRatio || 1, 2), 1.5) * dprScale * sim.quality;
  canvas.width = Math.round(innerWidth * d); canvas.height = Math.round(innerHeight * d);
  gl.viewport(0, 0, canvas.width, canvas.height); measureDock(); dirty = true;
}

// ---------- кадр ----------
let skipAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  skipAcc += now - last; last = now;
  if (sim.fps < 60 && skipAcc < 1000 / sim.fps - 2) return; // обмеження FPS
  const dt = Math.min(skipAcc, 100); skipAcc = 0;
  const fp = Math.min((now - lvAt) / 700, 1);
  level = lvFrom + (lvTo - lvFrom) * fp * fp * (3 - 2 * fp);
  const moving = updateLayout(dt);
  if (!(level > 0.001 || fp < 1 || dirty || moving || shellLit > 0.002)) return; // вимкнена й нерухома - не малюємо
  dirty = false;

  let a = 1;
  if (level > 0.001) {
    tickAcc += dt;
    if (tickAcc >= TICK_MS) { tickAcc = Math.min(tickAcc - TICK_MS, TICK_MS); prev.set(cur); runTick(); }
    a = sim.smooth ? tickAcc / TICK_MS : 1; // між кроками ефекту кадри плавно змішуються
  }
  let xf = 1;
  if (xfadeAt >= 0) { xf = Math.min((now - xfadeAt) / 750, 1); xf = xf * xf * (3 - 2 * xf); if (xf >= 1) xfadeAt = -1; }
  let sum = 0;
  for (let i = 0; i < NUM_LEDS; i++) {
    let m = 0;
    const row = Y_ZERO_AT_BOTTOM ? i : (HEIGHT - 1 - (i >> 4)) * WIDTH + (i & 15);
    for (let k = 0; k < 3; k++) {
      const j = i * 3 + k; let v = prev[j] + (cur[j] - prev[j]) * a;
      if (xf < 1) v = snap[j] + (v - snap[j]) * xf;
      shown[j] = v; texData[row * 4 + k] = v; if (v > m) m = v;
    }
    texData[row * 4 + 3] = 255; sum += m;
  }
  const target = level > 0.001 ? Math.pow(constrain(sum / 255 / NUM_LEDS * 1.3, 0, 1), 0.9) * level : 0;
  shellLit += (target - shellLit) * (1 - Math.exp(-dt / 450));
  if (Math.abs(target - shellLit) < 0.002) shellLit = target;

  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, texData);
  blurGlow(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texG);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, glowData);
  gl.activeTexture(gl.TEXTURE0);
  const d = canvas.width / innerWidth, ph = lay.tilt * Math.PI / 180, cs = Math.cos(ph);
  const bottom = lay.y + lay.sR * 3.7 * cs / 2;
  gl.uniform2f(U.uC, lay.x * d, (innerHeight - bottom) * d);
  gl.uniform4f(U.uP, lay.sR * d, lay.sR * 3.7 * d, Math.sin(ph), cs);
  gl.uniform3f(U.uS, level * state.brightness / 100, shellLit, sim.glow / 100);
  gl.uniform3f(U.uB1, ...bgRgb[0]); gl.uniform3f(U.uB2, ...bgRgb[1]); gl.uniform2f(U.uV, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  avgDt += (dt - avgDt) * 0.05;
  if (sim.auto && now > qualityAt && avgDt > 26 && dprScale > 0.75 && document.visibilityState === 'visible') {
    dprScale -= 0.2; qualityAt = now + 3000; avgDt = 16; resize();
  }
  const fe = $('fps-counter'), show = sim.showFps || location.hash === '#debug';
  fe.hidden = !show; if (show) fe.textContent = `${Math.round(1000 / Math.max(avgDt, 1))} FPS · ${canvas.width}×${canvas.height}`;
}
// ---------- стан, збереження ----------
const VERSION = '12';
const curvePower = (c) => (c === 'soft' ? 0.7 : c === 'precise' ? 1.8 : 1);
const SWATCHES = ['#ff3b3b', '#ff7420', '#ffb020', '#ffe066', '#7cf06b', '#16d6a0', '#19c8e8', '#3b82f6', '#8b5cf6', '#c026d3', '#ff4778', '#fff1e0'];
const PALETTES = [['#ff4d2e', '#ffb347', '#7b2ff7'], ['#0b3d91', '#19c8e8', '#e0fbfc'], ['#ff2bd6', '#7c3aed', '#22d3ee'], ['#0f3d2e', '#3ddc84', '#d9f99d'], ['#7a0c0c', '#ff6a00', '#ffd23b'], ['#dbeafe', '#60a5fa', '#a78bfa']];
const mixHex = (a, b, k) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const THEMES = { // кожна тема отримує колір акценту й тонує ним фон і тіла вікон
  minimal: (a) => { const bg = mixHex('#0c0b10', a, 0.05); return { bg: [bg, bg], v: { '--bg': bg, '--panel-bg': mixHex('#121118', a, 0.08), '--card': mixHex('#1a1920', a, 0.1), '--card2': mixHex('#23222b', a, 0.15), '--bar': mixHex('#17161d', a, 0.1) + 'ee' } }; },
  gradient: (a) => ({ bg: [mixHex('#0d0b1a', a, 0.45), mixHex('#06080f', a, 0.06)], v: { '--bg': mixHex('#0a0814', a, 0.2), '--panel-bg': `linear-gradient(180deg, ${mixHex('#121022', a, 0.36)}, ${mixHex('#080a14', a, 0.1)})`, '--card': 'rgba(255,255,255,.07)', '--card2': 'rgba(255,255,255,.12)', '--bar': mixHex('#14122a', a, 0.3) + 'cc' } }),
  midnight: (a) => ({ bg: ['#000000', '#030305'], v: { '--bg': '#000000', '--panel-bg': '#07070a', '--card': '#101014', '--card2': '#18181e', '--bar': '#0c0c10f0' } }),
  sunset: (a) => ({ bg: [mixHex('#3a1038', a, 0.2), '#0f0816'], v: { '--bg': '#14091c', '--panel-bg': `linear-gradient(180deg, ${mixHex('#2c1032', a, 0.2)}, #120a1a)`, '--card': 'rgba(255,255,255,.07)', '--card2': 'rgba(255,255,255,.12)', '--bar': mixHex('#2c1236', a, 0.22) + 'cc' } }),
};
const ACCENTS = [['#3b82f6', '#93c5fd'], ['#14b8a6', '#5eead4'], ['#8b5cf6', '#c4b5fd'], ['#ec4899', '#f9a8d4'], ['#f59e0b', '#fcd34d'], ['#22c55e', '#86efac'], ['#ef4444', '#fca5a5']];
let pend = { style: 'minimal', accent: 0 };
let ui = { lang: detectLang(), style: 'minimal', accent: 0, addr: 'lamp.local' };
state.alarm = { on: false, time: '07:00', dur: 20 };
const effectOf = (id) => EFFECTS.find((e) => e.id === id) || EFFECTS[0];
const cn = (n) => (n === 0 ? t('tag.auto') : n === 1 ? t('tag.1') : t('tag.n', { n }));
function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, power: lampOn, sim, ui })); } catch (e) {} }
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (!s) return;
    const { power, epochMs, alarm, sim: sv, ui: uv, color, seed, ...rest } = s;
    state = { ...state, ...rest, alarm: { ...state.alarm, ...(alarm || {}) } };
    if (color && !rest.colors) state.colors[0] = color;
    if (sv) sim = { ...sim, ...sv };
    if (uv) ui = { ...ui, ...uv };
    if (!EFFECTS.some((e) => e.id === state.mode) || state.mode === 'sunrise') state.mode = 'fire';
    if (power === false) { lampOn = false; level = lvFrom = lvTo = 0; }
  } catch (e) {}
}
const getLampState = () => ({ ...state, power: lampOn });
function publish() { saveState(); window.dispatchEvent(new CustomEvent('lampstatechange', { detail: getLampState() })); }
function change(patch, restart = false) {
  Object.assign(state, patch);
  if (patch.speed !== undefined) setSpeed(state.speed);
  if (restart) applyEffect(); else setColors();
  dirty = true; syncControls(); publish();
}
function toggleLamp() {
  lampOn = !lampOn; lvFrom = level; lvTo = lampOn ? 1 : 0; lvAt = performance.now(); dirty = true;
  if (lampOn) applyEffect(false);
  syncControls(); publish();
}
function showToast(text) {
  const el = $('toast'); el.textContent = text; el.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.remove('show'), 1300);
}

// ---------- HSV і випадкова палітра ----------
function hexToHsv(hex) {
  const [r, g, b] = hexRgb(hex).map((v) => v / 255), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
function hsvToHex(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
function randomPalette(darkFirst) { // гармонійна палітра: аналогова, тріада, спліт-комплементарна або комплементарна
  const h = Math.random() * 360, offs = [[0, 28, -28], [0, 120, 240], [0, 150, 210], [0, 180, 24]][Math.floor(Math.random() * 4)];
  const cols = offs.map((o) => hsvToHex((h + o + 360) % 360, 0.62 + Math.random() * 0.33, 0.85 + Math.random() * 0.15));
  if (darkFirst) cols[0] = hsvToHex(h, 0.5 + Math.random() * 0.4, 0.08 + Math.random() * 0.1);
  return cols;
}

// ---------- будильник "Світанок" ----------
let alarmRun = null, lastAlarmDay = '';
function startAlarm(start, dur, test) {
  alarmRun = { start, dur, test, prev: state.mode, wasOn: lampOn }; SUNRISE = 0;
  if (!lampOn) toggleLamp();
  change({ mode: 'sunrise' }, true); showToast(t('toast.sunrise'));
}
function stopAlarm() {
  if (!alarmRun) return; const r = alarmRun; alarmRun = null;
  if (r.test) { change({ mode: r.prev }, true); if (!r.wasOn) toggleLamp(); }
}
setInterval(() => {
  if (alarmRun) { SUNRISE = constrain((Date.now() - alarmRun.start) / alarmRun.dur, 0, 1); if (SUNRISE >= 1 && alarmRun.test) stopAlarm(); return; }
  const a = state.alarm; if (!a.on) return;
  const d = new Date(), [h, m] = a.time.split(':').map(Number), end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime(), dur = a.dur * 60000;
  if (Date.now() >= end - dur && Date.now() < end && lastAlarmDay !== d.toDateString()) { lastAlarmDay = d.toDateString(); startAlarm(end - dur, dur, false); }
}, 250);

// ---------- пресети ----------
let presets = [], activePreset = 0;
const presetFromState = (name) => { const { mode, colors, speed, brightness, brightnessCurve } = state; return { name, mode, colors: [...colors], speed, brightness, brightnessCurve }; };
function loadPresets() {
  try {
    const p = JSON.parse(localStorage.getItem(PRESET_KEY) || 'null');
    if (p && Array.isArray(p.list)) {
      presets = p.list.filter((x) => EFFECTS.some((e) => e.id === x.mode)).map((x) => ({ ...x, colors: x.colors || [x.color || '#ff7420', '#12081f', '#ffd9a0'] }));
      activePreset = constrain(p.active | 0, 0, Math.max(presets.length - 1, 0));
    }
  } catch (e) {}
  if (!presets.length) presets = ['fire', 'rainbow', 'ocean'].map((id) => ({ name: fxName(effectOf(id)), mode: id, colors: ['#ff7420', '#12081f', '#ffd9a0'], speed: 1, brightness: 100, brightnessCurve: 'linear' }));
}
const savePresets = () => { try { localStorage.setItem(PRESET_KEY, JSON.stringify({ list: presets, active: activePreset })); } catch (e) {} };
function applyPreset(i) {
  const p = presets[i]; if (!p) return;
  activePreset = i; const { name, ...rest } = p; Object.assign(state, rest, { colors: [...p.colors] });
  applyEffect(); syncControls(); renderPresets(); savePresets(); publish(); showToast(p.name);
}
const stepPreset = (dir) => { if (presets.length > 1) applyPreset((activePreset + dir + presets.length) % presets.length); };
const dots = (cols, n = 3) => cols.slice(0, n).map((c) => `<i style="background:${c}"></i>`).join('');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderPresets() {
  const list = $('preset-list'); list.innerHTML = '';
  presets.forEach((p, i) => {
    const eff = effectOf(p.mode), row = document.createElement('div'); row.className = 'preset'; row.setAttribute('aria-current', String(i === activePreset));
    row.innerHTML = `<button type="button" data-preset="${i}"><span class="strip sm" style="background:${eff.preview}"></span><span class="txt"><b>${esc(p.name)}</b><small>${fxName(eff)} · ${p.speed.toFixed(1)}× · ${Math.round(constrain((p.brightness - 50) / 50, 0, 1) * 100)}%</small></span><span class="dots">${eff.colors ? dots(p.colors, eff.colors) : ''}</span></button>` +
      (presets.length > 1 ? `<button type="button" class="x" data-del="${i}" aria-label="×">×</button>` : '');
    list.appendChild(row);
  });
  $('cur-name').value = presets[activePreset] ? presets[activePreset].name : '';
}

// ---------- відображення ----------
let slot = 0, hsv = [24, 0.87, 1], fxFilter = 'all', subPage = null;
const MENU = ['lamp', 'lang', 'bri', 'sim', 'look', 'conn', 'data'];
function renderFx() {
  const q = $('fx-search').value.trim().toLowerCase(), list = $('effect-list'); list.innerHTML = '';
  EFFECTS.filter((e) => !e.hidden && (fxFilter === 'all' || (fxFilter === 'auto') === (e.colors === 0)) && fxName(e).toLowerCase().includes(q)).forEach((e) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fx'; b.dataset.effect = e.id; b.setAttribute('aria-pressed', String(e.id === state.mode));
    b.innerHTML = `<span class="strip" style="background:${e.preview}"></span><span class="txt"><b>${fxName(e)}</b><small>${fxDesc(e)}</small></span><span class="tag">${cn(e.colors)}</span>`;
    list.appendChild(b);
  });
  if (!list.children.length) list.innerHTML = `<p class="hint">${t('fx.empty')}</p>`;
}
function renderPalettes() {
  const box = $('palettes'); box.innerHTML = '';
  PALETTES.forEach((cols, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.palette = i; b.innerHTML = `<span style="background:linear-gradient(90deg,${cols.join(',')})"></span>${t('pal.' + i)}`; box.appendChild(b); });
}
function setThemeVars(el, style, ai) {
  const ac = ACCENTS[ai] || ACCENTS[0], th = (THEMES[style] || THEMES.minimal)(ac[0]);
  Object.entries(th.v).forEach(([k, v]) => el.style.setProperty(k, v)); el.style.setProperty('--acc', ac[0]); el.style.setProperty('--acc2', ac[1]); return th;
}
function renderStyles() {
  $('styles').innerHTML = Object.keys(THEMES).map((k) => `<button type="button" class="opt" data-style="${k}" aria-pressed="${pend.style === k}"><span class="st" style="background:linear-gradient(135deg,${THEMES[k](ACCENTS[pend.accent][0]).bg[0]},${THEMES[k](ACCENTS[pend.accent][0]).bg[1]});box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)"></span>${t('st.' + k)}</button>`).join('');
  $('accents').innerHTML = ACCENTS.map((a, i) => `<button type="button" class="opt" data-accent="${i}" aria-pressed="${pend.accent === i}" aria-label="${a[0]}"><i style="background:${a[0]}"></i></button>`).join('');
  const pv = $('look-preview'), th = setThemeVars(pv, pend.style, pend.accent); pv.style.setProperty('--pv1', th.bg[0]); pv.style.setProperty('--pv2', th.bg[1]);
}
function menuValue(k) {
  return { lamp: state.lampName, lang: LANG === 'uk' ? 'Українська' : 'English', bri: t({ soft: 'bri.soft', linear: 'bri.lin', precise: 'bri.prec' }[state.brightnessCurve]),
    sim: `${sim.fps === 999 ? t('sim.max') : sim.fps} FPS`, look: t('st.' + ui.style), conn: ui.addr || '', data: '', about: `v${VERSION}` }[k];
}
function renderSettingsMenu() {
  $('set-menu').innerHTML = MENU.map((k) => `<button type="button" class="mi" data-sub="${k}"><b>${t('set.' + k)}</b><small>${esc(menuValue(k))}</small><svg class="i"><use href="#i-chev"/></svg></button>`).join('');
}
function updateSetView() {
  const inSet = openTab === 'set';
  $('set-menu').hidden = !!subPage; $('about-foot').hidden = !!subPage;
  document.querySelectorAll('.sub').forEach((s) => { s.hidden = s.dataset.sp !== subPage; });
  $('back').hidden = !(inSet && subPage);
  if (openTab) $('stitle').textContent = inSet && subPage ? t('set.' + subPage) : t('title.' + openTab);
}
function syncColorUI() {
  const eff = getEffect(), n = eff.colors;
  $('color-none').hidden = n > 0; $('color-ui').hidden = n === 0;
  if (!n) return;
  slot = Math.min(slot, n - 1);
  const sl = $('slots'); sl.innerHTML = '';
  for (let i = 0; i < n; i++) { const b = document.createElement('button'); b.type = 'button'; b.dataset.slot = i; b.setAttribute('aria-pressed', String(i === slot)); b.innerHTML = `<i style="background:${state.colors[i]}"></i>${fxLabel(eff, i)}`; sl.appendChild(b); }
  const [h, s, v] = hsv, a = (h - 90) * Math.PI / 180;
  $('ring-thumb').style.cssText = `left:${50 + 50 * s * Math.cos(a)}%;top:${50 + 50 * s * Math.sin(a)}%;background:${state.colors[slot]}`;
  $('disc').style.setProperty('--dk', (1 - v).toFixed(3));
  $('val').value = Math.round(v * 100); $('val').style.cssText = `--g1:#000;--g2:${hsvToHex(h, s, 1)}`;
  document.querySelectorAll('#swatches [data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === state.colors[slot])));
}
function syncControls() {
  const eff = getEffect(), norm = constrain((state.brightness - 50) / 50, 0, 1), sv = Math.pow(norm, 1 / curvePower(state.brightnessCurve)) * 100;
  $('brightness').value = sv; $('brightness-value').textContent = `${Math.round(sv)}%`;
  $('effect-speed').value = Math.round(state.speed * 100); $('effect-speed-value').textContent = `${state.speed.toFixed(1)}×`;
  $('lamp-title').textContent = state.lampName; $('now').textContent = lampOn ? fxName(eff) : `${t('now.off')} · ${fxName(eff)}`;
  $('lamp-name').value = state.lampName; $('lamp-id').value = state.lampId; $('about-foot').textContent = t('about.foot', { v: VERSION, id: state.lampId });
  $('conn-addr').value = ui.addr; if (!$('conn-status').dataset.set) $('conn-status').textContent = t('conn.none');
  $('alarm-on').checked = state.alarm.on; $('alarm-time').value = state.alarm.time; $('alarm-dur').value = state.alarm.dur; $('alarm-dur-val').textContent = `${state.alarm.dur} ${t('sun.min')}`;
  $('cur-sum').innerHTML = `<span class="strip sm" style="background:${eff.preview}"></span><span class="txt"><b>${fxName(eff)}</b><small>${state.speed.toFixed(1)}× · ${Math.round(sv)}%</small></span><span class="dots">${eff.colors ? dots(state.colors, eff.colors) : ''}</span>`;
  document.querySelectorAll('[data-curve]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.curve === state.brightnessCurve)));
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  document.querySelectorAll('[data-seg]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === sim[g.dataset.seg]))));
  document.querySelectorAll('[data-sim]').forEach((c) => { c.checked = !!sim[c.dataset.sim]; });
  document.querySelectorAll('[data-simr]').forEach((r) => { r.value = sim[r.dataset.simr]; $(`${r.dataset.simr}-val`).textContent = r.dataset.simr === 'tilt' ? `${sim.tilt}°` : `${sim[r.dataset.simr]}%`; });
  document.querySelectorAll('input[type="range"]:not(.grad)').forEach((r) => r.style.setProperty('--p', `${(r.value - r.min) / (r.max - r.min) * 100}%`));
  document.querySelectorAll('#effect-list [data-effect]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.effect === state.mode)));
  renderSettingsMenu(); syncColorUI();
}
function applyUI() { // мова, стиль, акцент
  LANG = ui.lang; applyI18n(); pend = { style: ui.style, accent: ui.accent };
  const th = setThemeVars(document.documentElement, ui.style, ui.accent);
  bgRgb = th.bg.map((h) => hexRgb(h).map((v) => v / 255)); document.querySelector('meta[name=theme-color]').content = th.bg[0];
  renderFx(); renderPresets(); renderPalettes(); renderStyles(); syncControls(); updateSetView(); dirty = true;
}
// мінівікно вибору (мова, яскравість)
function closePop() { $('pop').hidden = true; $('pop-bg').hidden = true; }
function setCurve(c) { const sv = Number($('brightness').value); state.brightnessCurve = c; change({ brightness: lerp(50, 100, Math.pow(sv / 100, curvePower(c))) }); }
function openPop(kind, anchor) {
  const opts = kind === 'lang' ? [['uk', 'Українська'], ['en', 'English']] : [['soft', t('bri.soft')], ['linear', t('bri.lin')], ['precise', t('bri.prec')]];
  const cur = kind === 'lang' ? ui.lang : state.brightnessCurve, pop = $('pop');
  pop.innerHTML = opts.map(([v, l]) => `<button type="button" class="po" data-pop="${kind}" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join('');
  pop.hidden = false; $('pop-bg').hidden = false;
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  let top = r.bottom + 6; if (top + h > innerHeight - 12) top = Math.max(12, r.top - h - 6);
  pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.right - w))}px`; pop.style.top = `${top}px`;
}

// ---------- вікно (шторка) ----------
function showTab(name) {
  if (name === openTab) openTab = null; else { openTab = name; subPage = null; }
  document.body.classList.toggle('sheet-open', !!openTab); $('sheet').classList.toggle('open', !!openTab);
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === openTab)));
  document.querySelectorAll('.page').forEach((p) => { p.hidden = p.dataset.p !== openTab; });
  closePop(); updateSetView(); $('pages').scrollTop = 0; measureDock();
}

function setupControls() {
  $('fx-search').addEventListener('input', () => { renderFx(); });
  $('fx-filters').addEventListener('click', (ev) => { const b = ev.target.closest('[data-filter]'); if (!b) return; fxFilter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderFx(); });
  $('effect-list').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-effect]'); if (!b) return; const e = effectOf(b.dataset.effect), colors = [...state.colors];
    (e.defaults || []).forEach((c, i) => { colors[i] = c; }); slot = 0; hsv = hexToHsv(colors[0]); change({ mode: e.id, colors }, true); renderFx();
  });
  // колір
  SWATCHES.forEach((c) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.color = c; b.style.background = c; b.setAttribute('aria-label', c); $('swatches').appendChild(b); });
  const setSlot = (hex, keepHsv) => { const colors = [...state.colors]; colors[slot] = hex; if (!keepHsv) hsv = hexToHsv(hex); change({ colors }); };
  $('swatches').addEventListener('click', (ev) => { const b = ev.target.closest('[data-color]'); if (b) setSlot(b.dataset.color); });
  $('palettes').addEventListener('click', (ev) => { const b = ev.target.closest('[data-palette]'); if (!b) return; const colors = [...PALETTES[b.dataset.palette]]; hsv = hexToHsv(colors[slot]); change({ colors }); });
  $('rand-pal').addEventListener('click', () => { const eff = getEffect(), dark = eff.defaults && hexToHsv(eff.defaults[0])[2] < 0.3; const colors = randomPalette(dark); hsv = hexToHsv(colors[slot]); change({ colors }); });
  $('slots').addEventListener('click', (ev) => { const b = ev.target.closest('[data-slot]'); if (!b) return; slot = Number(b.dataset.slot); hsv = hexToHsv(state.colors[slot]); syncControls(); });
  $('val').addEventListener('input', (e) => { hsv[2] = e.target.value / 100; setSlot(hsvToHex(...hsv), true); });
  const disc = $('disc'); let drag = false;
  const discMove = (ev) => { const r = disc.getBoundingClientRect(), dx = ev.clientX - r.left - r.width / 2, dy = ev.clientY - r.top - r.height / 2; hsv[0] = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360; hsv[1] = Math.min(1, Math.hypot(dx, dy) / (r.width / 2)); if (hsv[2] < 0.05) hsv[2] = 1; setSlot(hsvToHex(...hsv), true); };
  disc.addEventListener('pointerdown', (ev) => { drag = true; disc.setPointerCapture(ev.pointerId); discMove(ev); });
  disc.addEventListener('pointermove', (ev) => { if (drag) discMove(ev); });
  ['pointerup', 'pointercancel'].forEach((n) => disc.addEventListener(n, () => { drag = false; }));
  $('to-mono').addEventListener('click', () => { change({ mode: 'mono' }, true); renderFx(); });
  // збережені
  loadPresets();
  $('preset-list').addEventListener('click', (ev) => {
    const pick = ev.target.closest('[data-preset]'), del = ev.target.closest('[data-del]');
    if (del) { presets.splice(Number(del.dataset.del), 1); activePreset = constrain(activePreset, 0, presets.length - 1); savePresets(); renderPresets(); }
    else if (pick) { applyPreset(Number(pick.dataset.preset)); renderFx(); }
  });
  const curName = () => $('cur-name').value.trim();
  $('preset-add').addEventListener('click', () => { presets.push(presetFromState(curName() || `${fxName(getEffect())} ${presets.length + 1}`)); activePreset = presets.length - 1; savePresets(); renderPresets(); showToast(t('toast.saved')); });
  $('preset-update').addEventListener('click', () => { presets[activePreset] = presetFromState(curName() || presets[activePreset].name); savePresets(); renderPresets(); showToast(t('toast.upd')); });
  // швидке керування
  const bright = $('brightness'), fromSlider = () => lerp(50, 100, Math.pow(Number(bright.value) / 100, curvePower(state.brightnessCurve)));
  bright.addEventListener('input', () => change({ brightness: fromSlider() }));
  $('effect-speed').addEventListener('input', (e) => change({ speed: Number(e.target.value) / 100 }));
  document.querySelectorAll('[data-curve]').forEach((b) => b.addEventListener('click', () => { state.brightnessCurve = b.dataset.curve; change({ brightness: fromSlider() }); }));
  // світанок
  $('alarm-on').addEventListener('change', (e) => { state.alarm.on = e.target.checked; lastAlarmDay = ''; syncControls(); publish(); });
  $('alarm-time').addEventListener('input', (e) => { state.alarm.time = e.target.value || '07:00'; lastAlarmDay = ''; publish(); });
  $('alarm-dur').addEventListener('input', (e) => { state.alarm.dur = Number(e.target.value); syncControls(); publish(); });
  $('alarm-test').addEventListener('click', () => { if (alarmRun) stopAlarm(); else startAlarm(Date.now(), 12000, true); });
  // налаштування: пункти й сторінки
  $('set-menu').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sub]'); if (!b) return;
    if (b.dataset.sub === 'lang' || b.dataset.sub === 'bri') openPop(b.dataset.sub, b); else { subPage = b.dataset.sub; updateSetView(); $('pages').scrollTop = 0; }
  });
  $('pop-bg').addEventListener('click', closePop);
  $('pop').addEventListener('click', (ev) => { const b = ev.target.closest('[data-pop]'); if (!b) return; closePop(); if (b.dataset.pop === 'lang') { ui.lang = b.dataset.v; applyUI(); publish(); } else setCurve(b.dataset.v); });
  $('back').addEventListener('click', () => { subPage = null; updateSetView(); });
  $('styles').addEventListener('click', (ev) => { const b = ev.target.closest('[data-style]'); if (b) { pend.style = b.dataset.style; renderStyles(); } });
  $('accents').addEventListener('click', (ev) => { const b = ev.target.closest('[data-accent]'); if (b) { pend.accent = Number(b.dataset.accent); renderStyles(); } });
  $('look-apply').addEventListener('click', () => { ui.style = pend.style; ui.accent = pend.accent; applyUI(); publish(); showToast(t('toast.applied')); });
  const applySim = () => { dprScale = 1; resize(); dirty = true; syncControls(); publish(); };
  document.querySelectorAll('[data-seg] button').forEach((b) => b.addEventListener('click', () => { sim[b.parentElement.dataset.seg] = Number(b.dataset.v); applySim(); }));
  document.querySelectorAll('[data-sim]').forEach((c) => c.addEventListener('change', () => { sim[c.dataset.sim] = c.checked; applySim(); }));
  document.querySelectorAll('[data-simr]').forEach((r) => r.addEventListener('input', () => { sim[r.dataset.simr] = Number(r.value); applySim(); }));
  $('lamp-name').addEventListener('change', (e) => change({ lampName: e.target.value.trim() || 'Smart Lamp' }));
  $('lamp-id').addEventListener('change', (e) => change({ lampId: e.target.value.trim() || randomId() }, true));
  $('lamp-id-rand').addEventListener('click', () => change({ lampId: randomId() }, true));
  $('conn-check').addEventListener('click', async () => {
    const a = $('conn-addr').value.trim(); ui.addr = a; publish(); const st = $('conn-status'); st.dataset.set = '1'; st.textContent = t('conn.checking');
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 3000);
    try { await fetch(`http://${a}/`, { mode: 'no-cors', signal: ctl.signal }); st.textContent = t('conn.ok'); } catch (e) { st.textContent = t('conn.fail'); }
  });
  $('data-export').addEventListener('click', () => {
    saveState(); const blob = new Blob([JSON.stringify({ app: 'smart-lamp', state: localStorage.getItem(STORE_KEY), presets: localStorage.getItem(PRESET_KEY) }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'smart-lamp-settings.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('data-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (e) => {
    try { const j = JSON.parse(await e.target.files[0].text()); if (j.app !== 'smart-lamp') throw 0; if (j.state) localStorage.setItem(STORE_KEY, j.state); if (j.presets) localStorage.setItem(PRESET_KEY, j.presets); location.reload(); } catch (err) { showToast('Invalid file'); }
  });
  $('preset-reset').addEventListener('click', () => { localStorage.removeItem(PRESET_KEY); presets = []; loadPresets(); activePreset = 0; renderPresets(); showToast(t('toast.reset')); });
  $('reset-all').addEventListener('click', () => { localStorage.removeItem(PRESET_KEY); localStorage.removeItem(STORE_KEY); location.reload(); });
  // навігація
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  // шторка на телефоні: тягнеться за верхню смужку слідом за пальцем; свайп вниз закриває
  const sheet = $('sheet'), grab = $('grab'); let gd = null;
  grab.addEventListener('pointerdown', (e) => { if (desk || e.target.closest('#back')) return; gd = { y: e.clientY }; grab.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
  grab.addEventListener('pointermove', (e) => { if (gd) sheet.style.transform = `translateY(${Math.max(0, e.clientY - gd.y)}px)`; });
  const gend = (e) => { if (!gd) return; const dy = e.clientY - gd.y; gd = null; sheet.style.transition = ''; if (dy > 90) showTab(openTab); sheet.style.transform = ''; };
  grab.addEventListener('pointerup', gend); grab.addEventListener('pointercancel', gend);
  // сцена: свайп - пресети, тап по лампі (також по маленькій) - живлення
  const scene = $('scene'); let start = null;
  scene.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, mode: null, v0: Number($('brightness').value) }; });
  scene.addEventListener('pointermove', (e) => {
    if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!start.mode && sim.swipeBri && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.3) { start.mode = 'bri'; scene.setPointerCapture(e.pointerId); }
    if (start.mode === 'bri') { const v = constrain(start.v0 - dy / (innerHeight * 0.45) * 100, 0, 100); $('brightness').value = v; change({ brightness: lerp(50, 100, Math.pow(v / 100, curvePower(state.brightnessCurve))) }); showToast(`${Math.round(v)}%`); }
  });
  scene.addEventListener('pointercancel', () => { start = null; });
  scene.addEventListener('pointerup', (e) => {
    if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y, mode = start.mode; start = null;
    if (mode === 'bri') return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) stepPreset(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 12 && isLampHit(e.clientX, e.clientY)) toggleLamp();
    else if (Math.hypot(dx, dy) < 12 && openTab && !desk) showTab(openTab);
  });
  window.getLampState = getLampState;
  window.applyLampState = (next) => { const { power, ...rest } = next; Object.assign(state, rest); if (typeof power === 'boolean' && power !== lampOn) toggleLamp(); applyEffect(false); syncControls(); };
}
function isLampHit(x, y) { return Math.abs(x - lay.x) <= Math.max(lay.sR * 1.15, 30) && Math.abs(y - lay.y) <= Math.max(lay.sR * 3.7 * 0.55, 42); }

loadState(); hsv = hexToHsv(state.colors[0]); setupControls(); applyUI(); applyEffect(false); syncControls(); publish(); resize();
if (desk) showTab('fx'); // на ПК панель відкрита одразу
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { last = performance.now(); });
requestAnimationFrame((t0) => { last = t0; frame(t0); });
