let ledMatrix;   // Буфер для точкової матриці 16x16
let glowTexture; // Розмита безшовна текстура
let lampOn = true;
let lightLevel = 1;
let fadeStartLevel = 1;
let fadeTargetLevel = 1;
let fadeStartedAt = 0;
const fadeDuration = 700;

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
  createCanvas(windowWidth, windowHeight, WEBGL);

  smooth();
  pixelDensity(min(window.devicePixelRatio, 2));
  frameRate(60);

  // Буфери текстур
  ledMatrix = createGraphics(cols, rows);
  glowTexture = createGraphics(192, 96);
}

function draw() {
  background(18, 20, 26);

  // Ортографічна проєкція
  ortho(-width / 2, width / 2, -height / 2, height / 2, -1000, 1000);

  const fadeProgress = constrain((millis() - fadeStartedAt) / fadeDuration, 0, 1);
  const easedFadeProgress = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
  lightLevel = lerp(fadeStartLevel, fadeTargetLevel, easedFadeProgress);

  // Плавна інтерполяція скролу
  scrollProgress = lerp(scrollProgress, targetScrollProgress, 0.08);

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
  if ((lampOn || lightLevel > 0.001) && frameCount % 2 === 0) {
    updateEffect();
  }

  // 1. СВІТІННЯ ЗЗАДУ
  if (lightLevel > 0.001) {
    push();
    translate(currentPosX, currentPosY, -150);
    drawBacklightGlow(280, 520, ambientColor, lightLevel);
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

  drawFullLamp(radius, mainHeight, baseHeight, glowTexture);
  pop();
}

// Генерація безшовної текстури
function updateEffect() {
  ledMatrix.background(0);
  ledMatrix.noStroke();

  let t = millis() * 0.0025;
  let totalR = 0, totalG = 0, totalB = 0, count = 0;

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      let u = x / cols;
      let anglePos = u * TWO_PI;
      let nx = cos(anglePos) * 1.0;
      let nz = sin(anglePos) * 1.0;
      let ny = y * 0.12 - t;

      let val = noise(nx + 10, ny, nz + t * 0.3);

      if (val > 0.22) {
        let factor = constrain(map(val, 0.22, 0.85, 0, 1), 0, 1);
        let r = 255;
        let g = lerp(10, 220, factor);
        let b = lerp(0, 30, factor);

        ledMatrix.fill(r, g, b);
        ledMatrix.rect(x, y, 1, 1);

        totalR += r;
        totalG += g;
        totalB += b;
        count++;
      }
    }
  }

  if (count > 0) {
    ambientColor[0] = totalR / count;
    ambientColor[1] = totalG / count;
    ambientColor[2] = totalB / count;
  }

  glowTexture.background(
    lerp(242, 0, lightLevel),
    lerp(245, 0, lightLevel),
    lerp(249, 0, lightLevel)
  );
  let w = glowTexture.width / 3;
  let h = glowTexture.height;

  glowTexture.tint(255, 255 * lightLevel);
  glowTexture.image(ledMatrix, 0, 0, w, h);
  glowTexture.image(ledMatrix, w, 0, w, h);
  glowTexture.image(ledMatrix, w * 2, 0, w, h);
  glowTexture.noTint();

  glowTexture.filter(BLUR, 4);
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
function drawFullLamp(r, mainH, baseH, glow) {
  textureMode(NORMAL);
  const detail = 96;
  const bottomR = r + 4;

  // 1. ВУЗЬКА НИЖНЯ ПІДСТАВКА
  fill(190, 193, 201);
  noStroke();

  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * r, 0, sin(a) * r);
    vertex(cos(a) * bottomR, baseH * 0.4, sin(a) * bottomR);
  }
  endShape();

  fill(155, 158, 167);
  beginShape(QUAD_STRIP);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * bottomR, baseH * 0.4, sin(a) * bottomR);
    vertex(cos(a) * (bottomR - 2), baseH, sin(a) * (bottomR - 2));
  }
  endShape();

  beginShape(TRIANGLE_FAN);
  vertex(0, baseH, 0);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    vertex(cos(a) * (bottomR - 2), baseH, sin(a) * (bottomR - 2));
  }
  endShape();

  // 2. БЕЗШОВНИЙ СУЦІЛЬНИЙ КОРПУС ПЛАФОНА З ПЛАВНИМ КУПОЛОМ
  const roundedTopRadius = r * 0.16; // Радіус купола
  const cylinderTopY = -mainH + roundedTopRadius;
  const topSurfaceR = r - roundedTopRadius;
  const buttonR = r * 0.42;
  const topY = -mainH;

  tint(255, 245);

  // А. Бічна стінка циліндра
  beginShape(QUAD_STRIP);
  texture(glow);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    let texU = map(u, 0, 1, 0.333, 0.666);
    vertex(cos(a) * r, 0, sin(a) * r, texU, 0.98);
    vertex(cos(a) * r, cylinderTopY, sin(a) * r, texU, 0.15);
  }
  endShape();

  // Б. Плавне плавне дугове скруглення купола (Суцільна сітка)
  tint(255, lerp(245, 255, 1 - lightLevel));
  const arcSteps = 24;
  beginShape(TRIANGLES);
  texture(glow);
  for (let step = 0; step < arcSteps; step++) {
    let angle1 = map(step, 0, arcSteps, 0, HALF_PI);
    let angle2 = map(step + 1, 0, arcSteps, 0, HALF_PI);

    let currentR1 = r - roundedTopRadius * (1 - cos(angle1));
    let currentR2 = r - roundedTopRadius * (1 - cos(angle2));
    let currentY1 = cylinderTopY - sin(angle1) * roundedTopRadius;
    let currentY2 = cylinderTopY - sin(angle2) * roundedTopRadius;

    let v1 = map(step, 0, arcSteps, 0.15, 0.04);
    let v2 = map(step + 1, 0, arcSteps, 0.15, 0.04);

    for (let i = 0; i < detail; i++) {
      let u = i / detail;
      let a = u * TWO_PI + PI;
      let texU = map(u, 0, 1, 0.333, 0.666);
      let nextA = ((i + 1) / detail) * TWO_PI + PI;
      let nextTexU = map((i + 1) / detail, 0, 1, 0.333, 0.666);
      let x1 = cos(a) * currentR1;
      let z1 = sin(a) * currentR1;
      let x2 = cos(a) * currentR2;
      let z2 = sin(a) * currentR2;
      let x3 = cos(nextA) * currentR1;
      let z3 = sin(nextA) * currentR1;
      let x4 = cos(nextA) * currentR2;
      let z4 = sin(nextA) * currentR2;

      vertex(x1, currentY1, z1, texU, v1);
      vertex(x2, currentY2, z2, texU, v2);
      vertex(x3, currentY1, z3, nextTexU, v1);
      vertex(x3, currentY1, z3, nextTexU, v1);
      vertex(x2, currentY2, z2, texU, v2);
      vertex(x4, currentY2, z4, nextTexU, v2);
    }
  }
  endShape();

  // В. Верхній плоский торець навколо кнопки
  beginShape(QUAD_STRIP);
  texture(glow);
  for (let i = 0; i <= detail; i++) {
    let u = i / detail;
    let a = u * TWO_PI + PI;
    let texU = map(u, 0, 1, 0.333, 0.666);
    vertex(cos(a) * topSurfaceR, topY, sin(a) * topSurfaceR, texU, 0.04);
    vertex(cos(a) * buttonR, topY, sin(a) * buttonR, texU, 0.01);
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

// Управління скролом
function mouseWheel(event) {
  targetScrollProgress += event.delta * 0.0015;
  targetScrollProgress = constrain(targetScrollProgress, 0, 1);
  return false;
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
  }
}

function mousePressed() {
  if (touchPending || millis() - lastTouchToggleAt < 500) return false;
  if (isLampHit(mouseX, mouseY)) toggleLamp();
  return false;
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

  let deltaY = touchStartY - mouseY;
  touchStartY = mouseY;

  targetScrollProgress += deltaY * 0.003;
  targetScrollProgress = constrain(targetScrollProgress, 0, 1);
  return false;
}

function touchEnded() {
  if (touchStartedOnLamp && !touchMovedEnough) {
    toggleLamp();
    lastTouchToggleAt = millis();
  }
  touchPending = false;
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}