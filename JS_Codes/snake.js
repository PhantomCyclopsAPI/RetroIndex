const GRID_SIZE = 20;
const TILE_SIZE = 20;
const FPS_RENDER = 120;
let movesPerSec = 5;
let MOVE_INTERVAL = 1000 / movesPerSec;

// Colors
const CANVAS_BG = 255;
const BORDER_COLOR = '#dddddd';
const GRAD_START = '#007aff';
const GRAD_END = '#d0e6ff';
const FOOD_COLOR = '#FF5C00';

let flashStartTime = null;
let flashIsShrinkDot = false; // Track if flash is for shrink dot
const FLASH_DURATION = 300; // milliseconds

let shrinkDot = null;
const SHRINK_COLOR = '#007aff';

// State for shrink effect
let shrinkEffectStart = null;
const SHRINK_EFFECT_DURATION = 500; // Increased to 500ms for visibility

// Game state
let snake = [];
let prevSnake = [];
let food;
let score = 0;
let highScore = +localStorage.getItem('snakeHighScore') || 0;
let gameOver = false;
let direction = { x: 1, y: 0 };
let lastMoveMs = 0;
let gameStarted = false;
let paused = false; // Pause state
let particles = [];

// New: Food flip (rotateX) animation state
let foodFlipStartTime = 0;
const FOOD_FLIP_DURATION_FORWARD = 500; // ms for forward flip (fast)
const FOOD_FLIP_DURATION_BACK = 2000; // ms for slow back (gravity-like return)
let foodFlipPhase = 0; // 0: idle, 1: forward, 2: back
let foodFlipSignedAngle = 0; // Dynamic based on score and position (signed for direction)

// New: Shrink flip (rotateY) animation state
let shrinkFlipStartTime = 0;
const SHRINK_FLIP_DURATION_FORWARD = 500; // ms for forward flip
const SHRINK_FLIP_DURATION_BACK = 2000; // ms for slow back
let shrinkFlipPhase = 0; // 0: idle, 1: forward, 2: back
let shrinkFlipSignedAngle = 0; // Fixed magnitude, signed for direction
const SHRINK_FLIP_ANGLE = 30; // Fixed magnitude 30°

function setup() {
  const cnv = createCanvas(GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE);
  cnv.parent('game-canvas');
  cnv.elt.setAttribute('tabindex', '0');
  cnv.elt.focus();
  frameRate(FPS_RENDER);
  colorMode(RGB, 255); // Ensure default RGB mode for other elements

  // Floating card style
  cnv.elt.style.borderRadius = '16px';
  cnv.elt.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)';
  cnv.elt.style.border = '1px solid #ddd';

  // For 3D flips: Set CSS perspective on parent container
  const container = document.getElementById('game-canvas');
  container.style.perspective = '1000px'; // Add perspective for 3D effect

  particles = [];
}

function setSnakeSpeed(s) {
  movesPerSec = constrain(s, 1, 60);
  MOVE_INTERVAL = 1000 / movesPerSec;
}

function startFreshGame() {
  snake = [{ x: floor(GRID_SIZE / 2), y: floor(GRID_SIZE / 2) }];
  prevSnake = snake.map(s => ({ ...s }));
  direction = { x: 1, y: 0 };
  score = 0;
  setSnakeSpeed(5);
  gameOver = false;
  paused = false; // Reset pause state
  shrinkEffectStart = null; // Reset shrink effect
  flashIsShrinkDot = false; // Reset flash type
  lastMoveMs = millis();
  particles = [];
  foodFlipStartTime = 0;
  foodFlipPhase = 0;
  foodFlipSignedAngle = 0;
  shrinkFlipStartTime = 0;
  shrinkFlipPhase = 0;
  shrinkFlipSignedAngle = 0;
  
  spawnFood();
  updateHUD();
  loop();
}

function updateHUD() {
  document.getElementById('score').innerText = score;
  document.getElementById('high-score').innerText = highScore;
}

function drawGridAndBorder(now) {
  background(CANVAS_BG);
  strokeWeight(2);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      stroke(BORDER_COLOR);
      noFill();
      rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // Flash border effect
  if (flashStartTime) {
    const elapsed = now - flashStartTime;
    const t = constrain(elapsed / FLASH_DURATION, 0, 1);
    if (t >= 1) {
      flashStartTime = null;
      flashIsShrinkDot = false;
    }
    let flashColor;
    if (flashIsShrinkDot) {
      // Rainbow gradient flash for shrink dot
      push();
      colorMode(HSB, 360, 100, 100);
      const hue = ((now / 1000) * 360) % 360; // Cycle hues to match shrink dot
      flashColor = color(hue, 100, 100);
      // Fade to border color
      flashColor = lerpColor(flashColor, color(BORDER_COLOR), t);
      pop();
    } else {
      // Default flash for food
      flashColor = lerpColor(color('#007aff'), color(BORDER_COLOR), t);
    }
    stroke(flashColor);
  } else {
    stroke(BORDER_COLOR);
  }

  strokeWeight(4);
  noFill();
  rect(0, 0, width, height, 16);
}

function createParticles(gridX, gridY, count, isRainbow) {
  for (let i = 0; i < count; i++) {
    let c;
    if (isRainbow) {
      colorMode(HSB, 360, 100, 100);
      c = color(random(360), 100, 100);
      colorMode(RGB, 255);
    } else {
      c = color(FOOD_COLOR);
    }
    let life = random(30, 60);
    particles.push({
      x: gridX * TILE_SIZE + TILE_SIZE / 2,
      y: gridY * TILE_SIZE + TILE_SIZE / 2,
      vx: random(-4, 4),
      vy: random(-4, 4),
      life: life,
      maxLife: life,
      color: c
    });
  }
}

function draw() {
  const now = millis();

  drawGridAndBorder(now);

  if (!gameStarted) {
    textSize(18);
    fill('#000');
    textAlign(CENTER, CENTER);
    text('Press Any Key To Start', width / 2, height / 2);
    return;
  }

  // Draw food
  noStroke();
  fill(FOOD_COLOR);
  ellipse(food.x * TILE_SIZE + TILE_SIZE / 2, food.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.6);

  // Draw shrink dot with rainbow gradient glowing effect
  if (shrinkDot) {
    noStroke();
    // Switch to HSB for rainbow colors
    colorMode(HSB, 360, 100, 100, 100);
    // Glowing effect: draw concentric circles with rainbow gradient
    const pulse = 0.5 + 0.5 * sin(millis() / 300); // Pulsate between 0.5 and 1
    const maxGlowRadius = TILE_SIZE * 0.8;
    const glowSteps = 4;
    for (let i = glowSteps; i >= 1; i--) {
      const radius = (TILE_SIZE * 0.5 + (maxGlowRadius * pulse * i) / glowSteps) / 2;
      const alpha = 50 * (1 - i / glowSteps); // Fade out (50% to 12.5%)
      const hue = ((millis() / 1000) * 360 + i * 20) % 360; // Cycle hues, offset per circle
      fill(hue, 100, 100, alpha); // Rainbow color with alpha
      ellipse(
        shrinkDot.x * TILE_SIZE + TILE_SIZE / 2,
        shrinkDot.y * TILE_SIZE + TILE_SIZE / 2,
        radius * 2
      );
    }
    // Draw main shrink dot with rainbow center
    const mainHue = ((millis() / 1000) * 360) % 360;
    fill(mainHue, 100, 100, 100);
    ellipse(
      shrinkDot.x * TILE_SIZE + TILE_SIZE / 2,
      shrinkDot.y * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE * 0.5
    );
    // Switch back to RGB for other elements
    colorMode(RGB, 255);
  }

  // Draw snake with gradient, shrink effect, and rainbow glowing border
  const colStart = color(GRAD_START);
  const colEnd = color(GRAD_END);
  for (let i = 0; i < snake.length; i++) {
    const cur = snake[i];
    const prev = prevSnake[i] || cur;
    const xPx = lerp(prev.x, cur.x, paused ? 0 : constrain((now - lastMoveMs) / MOVE_INTERVAL, 0, 1)) * TILE_SIZE;
    const yPx = lerp(prev.y, cur.y, paused ? 0 : constrain((now - lastMoveMs) / MOVE_INTERVAL, 0, 1)) * TILE_SIZE;
    const ratio = snake.length === 1 ? 0 : i / (snake.length - 1);

    // Apply shrink effect to last two segments
    if (shrinkEffectStart && i >= snake.length - 2 && i < snake.length && snake.length > 1) {
      const elapsed = now - shrinkEffectStart;
      const t = constrain(elapsed / SHRINK_EFFECT_DURATION, 0, 1);
      if (t >= 1) shrinkEffectStart = null; // End effect
      const flash = sin(millis() / 50) * 0.5 + 0.5; // Rapid flash
      const shrinkScale = lerp(1, 0.5, t); // Shrink to 50% size

      // Draw rainbow glowing border
      push(); // Isolate drawing state
      colorMode(HSB, 360, 100, 100, 100);
      noFill();
      const pulse = 0.5 + 0.5 * sin(millis() / 300); // Match shrink dot pulse
      const maxGlowSize = TILE_SIZE * 1.2; // Slightly larger for visibility
      const glowSteps = 4;
      for (let j = glowSteps; j >= 1; j--) {
        const glowSize = TILE_SIZE * shrinkScale + (maxGlowSize * pulse * j) / glowSteps;
        const alpha = 60 * (1 - j / glowSteps); // Slightly higher opacity (60% to 15%)
        const hue = ((millis() / 1000) * 360 + j * 20) % 360; // Match shrink dot hues
        stroke(hue, 100, 100, alpha);
        strokeWeight(3); // Thicker for visibility
        rect(
          xPx + (TILE_SIZE - glowSize) / 2,
          yPx + (TILE_SIZE - glowSize) / 2,
          glowSize,
          glowSize
        );
      }
      pop(); // Restore drawing state

      // Draw shrinking segment
      fill(lerpColor(color(255), lerpColor(colStart, colEnd, ratio), flash));
      rect(
        xPx + (TILE_SIZE * (1 - shrinkScale)) / 2,
        yPx + (TILE_SIZE * (1 - shrinkScale)) / 2,
        TILE_SIZE * shrinkScale,
        TILE_SIZE * shrinkScale
      );
    } else {
      fill(lerpColor(colStart, colEnd, ratio));
      rect(xPx, yPx, TILE_SIZE, TILE_SIZE);
    }
  }

  // Draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    let alpha = map(p.life, 0, p.maxLife, 0, 200);
    let size = map(p.life, 0, p.maxLife, 2, 6);
    fill(red(p.color), green(p.color), blue(p.color), alpha);
    noStroke();
    ellipse(p.x, p.y, size);
    if (!paused) { // Update particles only when not paused
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  if (paused) {
    textSize(18);
    fill('#000');
    textAlign(CENTER, CENTER);
    text('Paused\nPress Space To Resume', width / 2, height / 2);
  }

  if (gameOver) {
    textSize(18);
    fill('#000');
    textAlign(CENTER, CENTER);
    text('Game Over\nPress Any Key To Restart', width / 2, height / 2);
    noLoop(); // Stop loop after drawing game-over message
  }

  if (paused) return; // Skip game logic updates when paused

  const elapsed = now - lastMoveMs;
  let progress = constrain(elapsed / MOVE_INTERVAL, 0, 1);

  if (!gameOver && elapsed >= MOVE_INTERVAL) {
    prevSnake = snake.map(s => ({ ...s }));
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const hitWall = head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
    const hitSelf = snake.some(s => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      gameOver = true;
    } else {
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        flashStartTime = now;
        flashIsShrinkDot = false; // Set flash type to food
        score++;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('snakeHighScore', highScore);
        }
        updateHUD();
        
        createParticles(head.x, head.y, 10, false);

        // New: Trigger food flip (rotateX) on eating food, direction based on food position
        const baseAngle = constrain(30 + floor((score - 1) / 5) * 5, 30, 70); // Incremental: 30 + 5 per 5 scores, max 70
        const foodPixelY = food.y * TILE_SIZE + TILE_SIZE / 2;
        const sign = foodPixelY < height / 2 ? -1 : 1; // Upper half: negative (top forward), lower: positive (bottom forward)
        foodFlipSignedAngle = baseAngle * sign;
        foodFlipStartTime = now;
        foodFlipPhase = 1; // Start forward flip
        console.log('Food flip triggered with signed angle:', foodFlipSignedAngle);

        if (score >= 5 && random() < 0.3) {
          spawnShrinkDot();
        }

        spawnFood();
      } else {
        snake.pop();

        // Check if shrink dot eaten
        if (shrinkDot && head.x === shrinkDot.x && head.y === shrinkDot.y) {
          if (snake.length > 3) {
            const tail1 = { ...snake[snake.length - 1] };
            const tail2 = { ...snake[snake.length - 2] };
            snake.splice(-2, 2); // Remove last 2 segments
            shrinkEffectStart = now; // Trigger shrink effect
            flashStartTime = now; // Trigger border flash
            flashIsShrinkDot = true; // Set flash type to shrink dot
            createParticles(head.x, head.y, 10, true);
            createParticles(tail1.x, tail1.y, 8, true);
            createParticles(tail2.x, tail2.y, 8, true);

            // New: Trigger shrink flip (rotateY) on eating shrink dot, direction based on position
            const shrinkPixelX = shrinkDot.x * TILE_SIZE + TILE_SIZE / 2;
            const shrinkSign = shrinkPixelX < width / 2 ? -1 : 1; // Left half: negative (left forward), right: positive (right forward)
            shrinkFlipSignedAngle = SHRINK_FLIP_ANGLE * shrinkSign;
            shrinkFlipStartTime = now;
            shrinkFlipPhase = 1; // Start forward flip
            console.log('Shrink flip triggered with signed angle:', shrinkFlipSignedAngle);
          }
          shrinkDot = null;
        }
      }
      lastMoveMs = now;
    }
  }

  // New: Apply food flip (rotateX) animation
  let xAngle = 0;
  if (foodFlipPhase > 0) {
    const elapsedFoodFlip = now - foodFlipStartTime;
    if (foodFlipPhase === 1) { // Forward flip to foodFlipSignedAngle
      const t = constrain(elapsedFoodFlip / FOOD_FLIP_DURATION_FORWARD, 0, 1);
      xAngle = foodFlipSignedAngle * t;
      if (t >= 1) {
        foodFlipStartTime = now;
        foodFlipPhase = 2;
      }
    } else if (foodFlipPhase === 2) { // Slow back to 0
      const t = constrain(elapsedFoodFlip / FOOD_FLIP_DURATION_BACK, 0, 1);
      xAngle = foodFlipSignedAngle * (1 - t);
      if (t >= 1) {
        foodFlipPhase = 0;
      }
    }
  }

  // New: Apply shrink flip (rotateY) animation
  let yAngle = 0;
  if (shrinkFlipPhase > 0) {
    const elapsedShrinkFlip = now - shrinkFlipStartTime;
    if (shrinkFlipPhase === 1) { // Forward flip to shrinkFlipSignedAngle
      const t = constrain(elapsedShrinkFlip / SHRINK_FLIP_DURATION_FORWARD, 0, 1);
      yAngle = shrinkFlipSignedAngle * t;
      if (t >= 1) {
        shrinkFlipStartTime = now;
        shrinkFlipPhase = 2;
      }
    } else if (shrinkFlipPhase === 2) { // Slow back to 0
      const t = constrain(elapsedShrinkFlip / SHRINK_FLIP_DURATION_BACK, 0, 1);
      yAngle = shrinkFlipSignedAngle * (1 - t);
      if (t >= 1) {
        shrinkFlipPhase = 0;
      }
    }
  }

  // Apply combined CSS transform if any animation active
  if (foodFlipPhase > 0 || shrinkFlipPhase > 0) {
    const container = document.getElementById('game-canvas');
    container.style.transform = `rotateX(${xAngle}deg) rotateY(${yAngle}deg)`;
  } else {
    const container = document.getElementById('game-canvas');
    container.style.transform = ''; // Reset when idle
  }
}

function keyPressed() {
  if (!gameStarted) {
    gameStarted = true;
    startFreshGame();
    return;
  }
  if (gameOver) {
    startFreshGame();
    gameStarted = true;
    return;
  }
  if (key === ' ') { // Toggle pause on spacebar
    paused = !paused;
    if (!paused) loop(); // Resume drawing if unpaused
    return;
  }
 
  const { x, y } = direction;
 
  if ((keyCode === LEFT_ARROW || key === 'a' || key === 'A') && x !== 1) direction = { x: -1, y: 0 };
  if ((keyCode === RIGHT_ARROW || key === 'd' || key === 'D') && x !== -1) direction = { x: 1, y: 0 };
  if ((keyCode === UP_ARROW || key === 'w' || key === 'W') && y !== 1) direction = { x: 0, y: -1 };
  if ((keyCode === DOWN_ARROW || key === 's' || key === 'S') && y !== -1) direction = { x: 0, y: 1 };
}

function spawnFood() {
  do {
    food = { x: floor(random(GRID_SIZE)), y: floor(random(GRID_SIZE)) };
  } while (snake.some(s => s.x === food.x && s.y === food.y));
}

function spawnShrinkDot() {
  do {
    shrinkDot = { x: floor(random(GRID_SIZE)), y: floor(random(GRID_SIZE)) };
  } while (
    snake.some(s => s.x === shrinkDot.x && s.y === shrinkDot.y) ||
    (food && food.x === shrinkDot.x && food.y === shrinkDot.y)
  );
}