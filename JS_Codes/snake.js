const GRID_SIZE = 20;
const TILE_SIZE = 20;
const FPS_RENDER = 120;
let movesPerSec = 5;
let MOVE_INTERVAL = 1000 / movesPerSec;

const SPEED_INCREASE_PER_TWO_SCORES = 0.4;

const CANVAS_BG = 255;
const BORDER_COLOR = '#dddddd';
const GRAD_START = '#007aff';
const GRAD_END = '#d0e6ff';
const FOOD_COLOR = '#FF5C00';

let flashStartTime = null;
let flashIsShrinkDot = false;
const FLASH_DURATION = 300;

let shrinkDot = null;
const SHRINK_COLOR = '#007aff';
let speedDot = null;
const SPEED_DOT_COLOR = '#007aff'; // Changed to blue
const SPEED_BOOST_DURATION = 5000;
let speedBoostEndTime = null;

let shrinkEffectStart = null;
const SHRINK_EFFECT_DURATION = 500;

let snake = [];
let prevSnake = [];
let food;
let score = 0;
let highScore = +localStorage.getItem('snakeHighScore') || 0;
let gameOver = false;
let direction = { x: 1, y: 0 };
let lastMoveMs = 0;
let gameStarted = false;
let paused = false;
let particles = [];
let scoreAnimations = [];

function setup() {
  const cnv = createCanvas(GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE);
  cnv.parent('game-canvas');
  cnv.elt.setAttribute('tabindex', '0');
  cnv.elt.focus();
  frameRate(FPS_RENDER);
  colorMode(RGB, 255);

  cnv.elt.style.borderRadius = '16px';
  cnv.elt.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)';
  cnv.elt.style.border = '1px solid #ddd';

  particles = [];
  scoreAnimations = [];
}

function setSnakeSpeed(s) {
  movesPerSec = constrain(s, 1, 9);
  MOVE_INTERVAL = 1000 / movesPerSec;
}

function startFreshGame() {
  snake = [{ x: floor(GRID_SIZE / 2), y: floor(GRID_SIZE / 2) }];
  prevSnake = snake.map(s => ({ ...s }));
  direction = { x: 1, y: 0 };
  score = 0;
  setSnakeSpeed(5);
  gameOver = false;
  paused = false;
  shrinkEffectStart = null;
  flashIsShrinkDot = false;
  lastMoveMs = millis();
  particles = [];
  scoreAnimations = [];
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

  if (flashStartTime) {
    const elapsed = now - flashStartTime;
    const t = constrain(elapsed / FLASH_DURATION, 0, 1);
    if (t >= 1) {
      flashStartTime = null;
      flashIsShrinkDot = false;
    }
    let flashColor;
    if (flashIsShrinkDot) {
      push();
      colorMode(HSB, 360, 100, 100);
      const hue = ((now / 1000) * 360) % 360;
      flashColor = color(hue, 100, 100);
      flashColor = lerpColor(flashColor, color(BORDER_COLOR), t);
      pop();
    } else {
      flashColor = lerpColor(color(FOOD_COLOR), color(BORDER_COLOR), t); // Changed to FOOD_COLOR
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

  if (speedBoostEndTime && now > speedBoostEndTime) {
    setSnakeSpeed(min(movesPerSec - 2, 9));
    speedBoostEndTime = null;
  }

  drawGridAndBorder(now);

  if (!gameStarted) {
    textSize(18);
    fill('#000');
    textAlign(CENTER, CENTER);
    text('Press Any Key To Start', width / 2, height / 2);
    return;
  }

  noStroke();
  fill(FOOD_COLOR);
  ellipse(food.x * TILE_SIZE + TILE_SIZE / 2, food.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.6);

  if (shrinkDot) {
    noStroke();
    colorMode(HSB, 360, 100, 100, 100);
    const pulse = 0.5 + 0.5 * sin(millis() / 300);
    const maxGlowRadius = TILE_SIZE * 0.8;
    const glowSteps = 4;
    for (let i = glowSteps; i >= 1; i--) {
      const radius = (TILE_SIZE * 0.5 + (maxGlowRadius * pulse * i) / glowSteps) / 2;
      const alpha = 50 * (1 - i / glowSteps);
      const hue = ((millis() / 1000) * 360 + i * 20) % 360;
      fill(hue, 100, 100, alpha);
      ellipse(
        shrinkDot.x * TILE_SIZE + TILE_SIZE / 2,
        shrinkDot.y * TILE_SIZE + TILE_SIZE / 2,
        radius * 2
      );
    }
    const mainHue = ((millis() / 1000) * 360) % 360;
    fill(mainHue, 100, 100, 100);
    ellipse(
      shrinkDot.x * TILE_SIZE + TILE_SIZE / 2,
      shrinkDot.y * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE * 0.5
    );
    colorMode(RGB, 255);
  }

  if (speedDot) {
    noStroke();
    fill(SPEED_DOT_COLOR);
    ellipse(
      speedDot.x * TILE_SIZE + TILE_SIZE / 2,
      speedDot.y * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE * 0.5
    );
  }

  const colStart = color(GRAD_START);
  const colEnd = color(GRAD_END);
  for (let i = 0; i < snake.length; i++) {
    const cur = snake[i];
    const prev = prevSnake[i] || cur;
    const xPx = lerp(prev.x, cur.x, paused ? 0 : constrain((now - lastMoveMs) / MOVE_INTERVAL, 0, 1)) * TILE_SIZE;
    const yPx = lerp(prev.y, cur.y, paused ? 0 : constrain((now - lastMoveMs) / MOVE_INTERVAL, 0, 1)) * TILE_SIZE;
    const ratio = snake.length === 1 ? 0 : i / (snake.length - 1);

    if (shrinkEffectStart && i >= snake.length - 2 && i < snake.length && snake.length > 1) {
      const elapsed = now - shrinkEffectStart;
      const t = constrain(elapsed / SHRINK_EFFECT_DURATION, 0, 1);
      if (t >= 1) shrinkEffectStart = null;
      const flash = sin(millis() / 50) * 0.5 + 0.5;
      const shrinkScale = lerp(1, 0.5, t);

      push();
      colorMode(HSB, 360, 100, 100, 100);
      noFill();
      const pulse = 0.5 + 0.5 * sin(millis() / 300);
      const maxGlowSize = TILE_SIZE * 1.2;
      const glowSteps = 4;
      for (let j = glowSteps; j >= 1; j--) {
        const glowSize = TILE_SIZE * shrinkScale + (maxGlowSize * pulse * j) / glowSteps;
        const alpha = 60 * (1 - j / glowSteps);
        const hue = ((millis() / 1000) * 360 + j * 20) % 360;
        stroke(hue, 100, 100, alpha);
        strokeWeight(3);
        rect(
          xPx + (TILE_SIZE - glowSize) / 2,
          yPx + (TILE_SIZE - glowSize) / 2,
          glowSize,
          glowSize
        );
      }
      pop();

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

  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    let alpha = map(p.life, 0, p.maxLife, 0, 200);
    let size = map(p.life, 0, p.maxLife, 2, 6);
    fill(red(p.color), green(p.color), blue(p.color), alpha);
    noStroke();
    ellipse(p.x, p.y, size);
    if (!paused) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  scoreAnimations.forEach((anim, i) => {
    let alpha = map(anim.life, 0, anim.maxLife, 0, 255);
    fill(0, 0, 0, alpha);
    textSize(14);
    textAlign(CENTER, CENTER);
    text(anim.text, anim.x, anim.y - anim.life * 0.5);
    if (!paused) {
      anim.life -= 1;
      if (anim.life <= 0) {
        scoreAnimations.splice(i, 1);
      }
    }
  });

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
    noLoop();
  }

  if (paused) return;

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
        flashIsShrinkDot = false;
        score++;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('snakeHighScore', highScore);
        }
        updateHUD();
        
        createParticles(head.x, head.y, 10, false);
        scoreAnimations.push({
          x: head.x * TILE_SIZE + TILE_SIZE / 2,
          y: head.y * TILE_SIZE + TILE_SIZE / 2,
          text: '+1',
          life: 60,
          maxLife: 60
        });

        if (score % 2 === 0 && score <= 20) {
          setSnakeSpeed(movesPerSec + SPEED_INCREASE_PER_TWO_SCORES);
        }

        if (score >= 2 && random() < 0.3) {
          if (random() < 0.5) {
            shrinkDot = spawnSpecialDot('shrink');
          } else {
            speedDot = spawnSpecialDot('speed');
          }
        }

        spawnFood();
      } else {
        snake.pop();

        if (shrinkDot && head.x === shrinkDot.x && head.y === shrinkDot.y) {
          if (snake.length > 3) {
            const tail1 = { ...snake[snake.length - 1] };
            const tail2 = { ...snake[snake.length - 2] };
            snake.splice(-2, 2);
            score = max(0, score - 2); // Decrease score by 2, not below 0
            updateHUD();
            shrinkEffectStart = now;
            flashStartTime = now;
            flashIsShrinkDot = true;
            createParticles(head.x, head.y, 10, true);
            createParticles(tail1.x, tail1.y, 8, true);
            createParticles(tail2.x, tail2.y, 8, true);
            scoreAnimations.push({
              x: head.x * TILE_SIZE + TILE_SIZE / 2,
              y: head.y * TILE_SIZE + TILE_SIZE / 2,
              text: '-2',
              life: 60,
              maxLife: 60
            });
          }
          shrinkDot = null;
        }

        if (speedDot && head.x === speedDot.x && head.y === speedDot.y) {
          setSnakeSpeed(movesPerSec + 2);
          speedBoostEndTime = now + SPEED_BOOST_DURATION;
          flashStartTime = now; // Trigger orange flash
          flashIsShrinkDot = false;
          createParticles(head.x, head.y, 10, false);
          scoreAnimations.push({
            x: head.x * TILE_SIZE + TILE_SIZE / 2,
            y: head.y * TILE_SIZE + TILE_SIZE / 2,
            text: 'Speed Up!',
            life: 60,
            maxLife: 60
          });
          speedDot = null;
        }
      }
      lastMoveMs = now;
    }
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
  if (key === ' ') {
    paused = !paused;
    if (!paused) loop();
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

function spawnSpecialDot(type) {
  let dot;
  do {
    dot = { x: floor(random(GRID_SIZE)), y: floor(random(GRID_SIZE)) };
  } while (
    snake.some(s => s.x === dot.x && s.y === dot.y) ||
    (food && food.x === dot.x && food.y === dot.y) ||
    (type === 'shrink' && speedDot && speedDot.x === dot.x && speedDot.y === dot.y) ||
    (type === 'speed' && shrinkDot && shrinkDot.x === dot.x && shrinkDot.y === dot.y)
  );
  return dot;
}