// ===== FastLED-подібна обгортка. Тут нічого змінювати не потрібно =====
// Дає ефектам з прошивки ті самі імена: leds[], XY(), CRGB, CHSV, millis(), sin8(), beatsin8(), inoise8() ...
const WIDTH = 16, HEIGHT = 16, NUM_LEDS = 256, PI2 = Math.PI * 2;
const Y_ZERO_AT_BOTTOM = true; // y=0 - низ лампи. Якщо ефекти перевернуті - поставте false
const { abs, sin, cos, sqrt, min, max, floor, PI } = Math;
const TWO_PI = PI2;
let SEED = 1, _ms = 0;          // задає рушій
class C {
  constructor(r = 0, g = 0, b = 0) { this.r = r; this.g = g; this.b = b; }
  nscale8(s) { this.r = this.r * s / 256 | 0; this.g = this.g * s / 256 | 0; this.b = this.b * s / 256 | 0; return this; }
  fadeToBlackBy(n) { return this.nscale8(255 - n); }
}
const CRGB = (r = 0, g, b) => g === undefined ? new C(r >> 16 & 255, r >> 8 & 255, r & 255) : new C(r, g, b);
let COLOR = CRGB(255, 116, 32), COLOR2 = CRGB(26, 16, 48), COLOR3 = CRGB(255, 217, 160); // кольори, обрані в застосунку
const leds = Array.from({ length: NUM_LEDS }, () => new C());
const XY = (x, y) => y * WIDTH + (((x | 0) % WIDTH) + WIDTH) % WIDTH;
const millis = () => _ms; // абсолютний час (мс), однаковий для всіх ламп із тим самим ID
const constrain = (v, a, b) => v < a ? a : v > b ? b : v;
const map = (v, a, b, c, d) => (v - a) * (d - c) / (b - a) + c;
const random = (a, b) => b === undefined ? Math.random() * a | 0 : a + (Math.random() * (b - a) | 0);
const random8 = (a, b) => a === undefined ? random(256) : random(a, b), random16 = random8;
const scale8 = (i, s) => i * (1 + s) >> 8;
const qadd8 = (a, b) => min(255, a + b), qsub8 = (a, b) => max(0, a - b);
const sin8 = (t) => Math.round(sin((t & 255) / 256 * PI2) * 127.5 + 127.5);
const cos8 = (t) => Math.round(cos((t & 255) / 256 * PI2) * 127.5 + 127.5);
const beat8 = (bpm, tb = 0) => ((millis() - tb) * bpm * 256 / 60000) & 255;
const beatsin8 = (bpm, lo = 0, hi = 255, tb = 0, ph = 0) => lo + scale8(sin8(beat8(bpm, tb) + ph), hi - lo);
const beatsin16 = (bpm, lo = 0, hi = 65535, tb = 0, ph = 0) => lo + (hi - lo) * (0.5 + 0.5 * sin(((millis() - tb) * bpm / 60000) * PI2 + ph / 65536 * PI2));
function hashNoise(x, y, z) { // 0..1, залежить від SEED
  let v = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041) + SEED) | 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
}
function inoise8(x, y = 0, z = 0) { // 0..255; 256 одиниць = одна клітинка шуму (наближення FastLED)
  x /= 256; y /= 256; z /= 256;
  const x0 = floor(x), y0 = floor(y), z0 = floor(z), fx = x - x0, fy = y - y0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t, h = (i, j, k) => hashNoise(x0 + i, y0 + j, z0 + k);
  return 255 * L(L(L(h(0, 0, 0), h(1, 0, 0), sx), L(h(0, 1, 0), h(1, 1, 0), sx), sy),
                 L(L(h(0, 0, 1), h(1, 0, 1), sx), L(h(0, 1, 1), h(1, 1, 1), sx), sy), sz);
}
function CHSV(h, s = 255, v = 255) { // як hsv2rgb_rainbow з FastLED
  h &= 255; const off = (h & 31) << 3, third = scale8(off, 85), two = scale8(off, 171); let r, g, b;
  if (!(h & 128)) {
    if (!(h & 64)) { if (!(h & 32)) { r = 255 - third; g = third; b = 0; } else { r = 171; g = 85 + third; b = 0; } }
    else if (!(h & 32)) { r = 171 - two; g = 170 + third; b = 0; } else { r = 0; g = 255 - third; b = third; }
  } else if (!(h & 64)) { if (!(h & 32)) { r = 0; g = 171 - two; b = 85 + two; } else { r = third; g = 0; b = 255 - third; } }
  else if (!(h & 32)) { r = 85 + third; g = 0; b = 171 - third; } else { r = 170 + third; g = 0; b = 85 - third; }
  if (s !== 255) { const d = 255 - s, ds = scale8(d, d), k = 255 - ds; r = scale8(r, k) + ds; g = scale8(g, k) + ds; b = scale8(b, k) + ds; }
  if (v !== 255) { r = scale8(r, v); g = scale8(g, v); b = scale8(b, v); }
  return new C(r, g, b);
}
const hsv2rgb_rainbow = CHSV;
const blend = (a, b, amt) => new C(a.r + (b.r - a.r) * amt / 255 | 0, a.g + (b.g - a.g) * amt / 255 | 0, a.b + (b.b - a.b) * amt / 255 | 0);
const nblend = (a, b, amt) => { Object.assign(a, blend(a, b, amt)); return a; };
const fadeToBlackBy = (...a) => { const n = a[a.length - 1]; leds.forEach((l) => l.fadeToBlackBy(n)); };
const fill_solid = (arr, n, c) => { for (let i = 0; i < NUM_LEDS; i++) leds[i] = new C(c.r, c.g, c.b); };
const fill_rainbow = (arr, n, h, d = 5) => { for (let i = 0; i < NUM_LEDS; i++) leds[i] = CHSV(h + i * d, 255, 255); };
const FastLED = { clear() { leds.forEach((l) => { l.r = l.g = l.b = 0; }); }, show() {}, setBrightness() {} };
