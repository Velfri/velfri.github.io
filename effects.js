// ===== ЕФЕКТИ =====
// Вставляйте код з прошивки в draw() - він працює у FastLED-стилі.
// Ефект - це чиста функція часу й ID лампи: millis() (абсолютний час) та SEED (з ID лампи). Не накопичуйте стан між викликами,
// тоді кілька ламп з однаковим ID показують однакову картинку, а швидкість не викликає стрибків.
// Доступно: leds[], XY(x,y), WIDTH, HEIGHT, NUM_LEDS, millis(), SEED, hashNoise(x,y,z),
//   COLOR, COLOR2, COLOR3 (кольори, обрані в застосунку; їх кількість задає поле colors),
//   CRGB(r,g,b), CHSV(h,s,v), blend(), fill_solid(), sin8(), cos8(), beatsin8(), inoise8(x,y,z), constrain(), map()
// x - по колу (0..15), y: 0 = низ лампи, 15 = верх. Чорний (0,0,0) = діод вимкнений.
// Поля: id, name, desc (підпис у меню), colors (0 = власна палітра, 1..3 = скільки кольорів можна міняти),
//   labels (назви кольорів), defaults (кольори за замовчуванням), preview (CSS-градієнт для списку), hidden.
const EFFECTS = [
  { id: 'fire', name: 'Вогонь', desc: 'Язики полум’я знизу вгору', colors: 0, preview: 'linear-gradient(90deg,#ff2a00,#ff9a1f,#ffd36b)',
    draw() {
      const t = millis() / 1000;
      for (let x = 0; x < WIDTH; x++) {
        const a = x / WIDTH * PI2, nx = cos(a) * 2.5 + 3, nz = sin(a) * 2.5 + 3;
        for (let y = 0; y < HEIGHT; y++) {
          const heat = inoise8(nx * 256, (y * 0.16 - t * 0.8) * 256, (nz + t * 0.12) * 256) / 255;
          const th = 0.42 + y / HEIGHT * 0.12, k = constrain((heat - th) / (0.9 - th), 0, 1);
          leds[XY(x, y)] = heat > th ? CRGB(255, 12 + 208 * k, 34 * k) : CRGB(0, 0, 0);
        }
      }
    } },
  { id: 'mono', name: 'Колір', desc: 'Один суцільний колір', colors: 1, labels: ['Колір'], preview: 'linear-gradient(90deg,#ff7420,#ffb46b)',
    draw() { fill_solid(leds, NUM_LEDS, COLOR); } },
  { id: 'gradient', name: 'Градієнт', desc: 'Три кольори плавно течуть по колу', colors: 3, labels: ['Колір 1', 'Колір 2', 'Колір 3'], defaults: ['#ff3b8d', '#8b5cf6', '#19c8e8'], preview: 'linear-gradient(90deg,#ff3b8d,#8b5cf6,#19c8e8)',
    draw() {
      const t = millis() / 1000, cols = [COLOR, COLOR2, COLOR3];
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        const k = (((x / WIDTH + t * 0.05 + y / HEIGHT * 0.25) % 1) + 1) % 1 * 3, i = floor(k);
        leds[XY(x, y)] = blend(cols[i % 3], cols[(i + 1) % 3], (k - i) * 255);
      }
    } },
  { id: 'fireflies', name: 'Світлячки', desc: 'Світні цятки літають на тлі', colors: 2, labels: ['Фон', 'Світлячки'], defaults: ['#0b0618', '#ffe27a'], preview: 'radial-gradient(circle at 30% 40%,#ffe27a 0 6%,transparent 8%),radial-gradient(circle at 70% 60%,#ffe27a 0 5%,transparent 7%),#0b0618',
    draw() {
      const t = millis() / 1000;
      fill_solid(leds, NUM_LEDS, COLOR);
      for (let i = 0; i < 9; i++) {
        const h = (k) => hashNoise(i, k, 7);
        const fx = h(1) * WIDTH + sin(t * (0.15 + h(2) * 0.2) + h(3) * 6.28) * 3 + t * (h(4) - 0.5) * 0.8;
        const fy = HEIGHT * (0.5 + 0.42 * sin(t * (0.12 + h(5) * 0.18) + h(6) * 6.28));
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (0.9 + h(7) * 1.2) + h(8) * 6.28));
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const px = floor(fx) + dx, py = floor(fy) + dy; if (py < 0 || py >= HEIGHT) continue;
          const dxw = ((px - fx + WIDTH * 1.5) % WIDTH) - WIDTH / 2, w = max(0, 1 - sqrt(dxw * dxw + (py - fy) * (py - fy)) / 2.2) * pulse;
          if (w > 0) leds[XY(px, py)] = blend(leds[XY(px, py)], COLOR2, w * 255);
        }
      }
    } },
  { id: 'rainbow', name: 'Райдуга', desc: 'Повний спектр обертається навколо', colors: 0, preview: 'linear-gradient(90deg,#ff3b3b,#ffd23b,#3bff6e,#3bc8ff,#9b3bff)',
    draw() { for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) leds[XY(x, y)] = CHSV(x * 16 + millis() * 0.0569 + SEED); } },
  { id: 'aurora', name: 'Аврора', desc: 'Північне сяйво зелено-фіолетове', colors: 0, preview: 'linear-gradient(90deg,#00ff96,#4aa8ff,#9646ff)',
    draw() {
      const t = millis() / 1000;
      for (let x = 0; x < WIDTH; x++) {
        const a = x / WIDTH * PI2, nx = cos(a) * 2.5 + 3, nz = sin(a) * 2.5 + 3;
        for (let y = 0; y < HEIGHT; y++) {
          const n = inoise8(nx * 256, (y * 0.14 + t * 0.25) * 256, (nz - t * 0.1) * 256);
          leds[XY(x, y)] = blend(CRGB(0, 255, 150), CRGB(150, 70, 255), n).nscale8(190 + n * 65 / 255);
        }
      }
    } },
  { id: 'ocean', name: 'Океан', desc: 'Хвилі морської води', colors: 0, preview: 'linear-gradient(90deg,#0032aa,#14e1eb)',
    draw() {
      const t = millis() / 1000;
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++)
        leds[XY(x, y)] = blend(CRGB(0, 50, 170), CRGB(20, 225, 235), (0.5 + 0.5 * sin(x / WIDTH * PI2 * 2 + y * 0.45 - t * 2)) * 255);
    } },
  { id: 'waves', name: 'Хвилі', desc: 'Дві фарби перетікають хвилями', colors: 2, labels: ['Колір 1', 'Колір 2'], defaults: ['#6d28d9', '#22d3ee'], preview: 'linear-gradient(90deg,#6d28d9,#22d3ee,#6d28d9)',
    draw() {
      const t = millis() / 1000;
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++)
        leds[XY(x, y)] = blend(COLOR, COLOR2, (0.5 + 0.5 * sin(x / WIDTH * PI2 * 2 + y * 0.3 - t * 1.6)) * 255);
    } },
  { id: 'sunset', name: 'Захід', desc: 'Від червоного горизонту до фіолетового неба', colors: 0, preview: 'linear-gradient(90deg,#ff4628,#ffaf32,#9632d2)',
    draw() {
      const t = millis() / 1000;
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        const k = constrain(y / (HEIGHT - 1) + 0.15 * sin(t * 0.5 + x * 0.4), 0, 1);
        leds[XY(x, y)] = k < 0.5 ? blend(CRGB(255, 70, 40), CRGB(255, 175, 50), k * 2 * 255) : blend(CRGB(255, 175, 50), CRGB(150, 50, 210), (k - 0.5) * 2 * 255);
      }
    } },
  { id: 'breathe', name: 'Дихання', desc: 'Колір повільно світлішає й темнішає', colors: 1, labels: ['Колір'], preview: 'linear-gradient(90deg,#3a1a0c,#ff7420,#ffd9b8,#ff7420,#3a1a0c)',
    draw() {
      const v = 60 + 195 * (0.5 + 0.5 * sin(millis() / 1000 * 1.6));
      for (let i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(COLOR.r, COLOR.g, COLOR.b).nscale8(v);
    } },
  { id: 'sparkle', name: 'Іскри', desc: 'Яскраві спалахи на тлі', colors: 2, labels: ['Фон', 'Іскри'], defaults: ['#2b1450', '#ffffff'], preview: 'radial-gradient(circle at 25% 35%,#fff 0 5%,transparent 6%),radial-gradient(circle at 70% 65%,#fff 0 4%,transparent 5%),#2b1450',
    draw() {
      const f = floor(millis() / 200);
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) { const c = hashNoise(x, y, f) > 0.9 ? COLOR2 : COLOR; leds[XY(x, y)] = CRGB(c.r, c.g, c.b); }
    } },
  { id: 'lava', name: 'Лава-лампа', desc: 'Повільні світні краплі здіймаються й опускаються', colors: 2, labels: ['Фон', 'Лава'], defaults: ['#2a0845', '#ff5a36'], preview: 'radial-gradient(circle at 30% 70%,#ff5a36 0 22%,transparent 24%),radial-gradient(circle at 68% 32%,#ff8a5c 0 18%,transparent 20%),#2a0845',
    draw() {
      const t = millis() / 1000, B = [];
      for (let i = 0; i < 5; i++) {
        const h = (k) => hashNoise(i, k, 3);
        B.push({ x: h(1) * WIDTH + sin(t * (0.08 + h(2) * 0.1) + h(3) * 6.28) * 3, y: HEIGHT * (0.5 + 0.4 * sin(t * (0.1 + h(4) * 0.12) + h(5) * 6.28)), r: 1.5 + h(6) * 1.3 });
      }
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        let f = 0;
        for (const b of B) { const dx = ((((x - b.x) % WIDTH) + WIDTH * 1.5) % WIDTH) - WIDTH / 2, dy = y - b.y; f += b.r * b.r / (dx * dx + dy * dy + 0.5); }
        leds[XY(x, y)] = blend(COLOR, COLOR2, constrain((f - 0.8) / 0.5, 0, 1) * 255);
      }
    } },
  { id: 'police', name: 'Поліція', desc: 'Червоно-сині мигалки', colors: 2, labels: ['Колір 1', 'Колір 2'], defaults: ['#ff1010', '#1038ff'], preview: 'linear-gradient(90deg,#ff1010 0 50%,#1038ff 50%)',
    draw() {
      const ph = millis() % 1000, q = ph % 500, on = q < 90 || (q > 170 && q < 260), c = ph < 500 ? COLOR : COLOR2;
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        const v = on ? (0.65 + 0.35 * cos(x / WIDTH * PI2 * 2 + millis() * 0.004)) : 0;
        leds[XY(x, y)] = CRGB(c.r, c.g, c.b).nscale8(v * 255);
      }
    } },
  { id: 'sun', name: 'Сонце', desc: 'Тепле сонце повільно гойдається перед лампою', colors: 0, preview: 'radial-gradient(circle at 50% 50%,#fff6cd 0 14%,#ff962a 34%,#aa1900 62%,#190200)',
    draw() {
      const t = millis() / 1000, xc = 12 + sin(t * 0.3) * 4.5, yc = 7.5 + sin(t * 0.4) * 1.5; // сонце гойдається перед лампою
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        const dx = ((((x - xc) % WIDTH) + WIDTH * 1.5) % WIDTH) - WIDTH / 2, dy = y - yc, d = sqrt(dx * dx + dy * dy);
        const rays = 1 + 0.22 * sin(Math.atan2(dy, dx) * 6 + t * 0.7) * constrain(d / 4, 0, 1), k = constrain(1 - d / (9 * rays), 0, 1);
        leds[XY(x, y)] = k > 0.7 ? blend(CRGB(255, 150, 40), CRGB(255, 246, 205), (k - 0.7) / 0.3 * 255)
          : k > 0.3 ? blend(CRGB(170, 25, 0), CRGB(255, 150, 40), (k - 0.3) / 0.4 * 255) : blend(CRGB(70, 8, 0), CRGB(170, 25, 0), k / 0.3 * 255);
      }
    } },
  // Світанок: SUNRISE (0..1) задає будильник; лампа наповнюється знизу теплим світлом
  { id: 'sunrise', name: 'Світанок', desc: 'Будильник', colors: 0, hidden: true, preview: 'linear-gradient(90deg,#ff5a1f,#ffb347,#fff1d6)',
    draw() {
      const p = SUNRISE;
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        const v = constrain(p * 1.3 - y / HEIGHT * 0.3, 0, 1);
        const c = p < 0.5 ? blend(CRGB(120, 10, 0), CRGB(255, 90, 20), p * 2 * 255) : blend(CRGB(255, 90, 20), CRGB(255, 225, 170), (p - 0.5) * 2 * 255);
        leds[XY(x, y)] = c.nscale8(v * 255);
      }
    } },
];
let SUNRISE = 0; // прогрес світанку 0..1
