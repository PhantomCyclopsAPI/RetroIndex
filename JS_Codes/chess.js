// =========================
// 五子棋（统一五连胜） - 完整版 chess.js
// - 三个难度规则一致：WIN_LENGTH = 5
// - 简单：空盘占中、中心偏好、先赢先堵、轻量搜索
// - 适中：小深度极小极大
// - 困难：迭代加深 + Alpha-Beta + 置换表 + 强排序 + 时间预算 + 候选半径2
// - 简单/适中高亮AI上一步（呼吸闪烁）；困难默认不高亮
// =========================

const boardSize = 15;
const WIN_LENGTH = 5; // 统一五连胜

// 困难模式专用参数
const HARD_TIME_BUDGET_MS = 500;    // 困难模式单步思考时间预算
const HARD_BASE_DEPTH = 3;          // 起始深度（会逐步迭代加深）
const CANDIDATE_RADIUS = 2;         // 困难模式候选点扩展半径
const TT = new Map();               // 置换表（简易键）

let board = [];
let currentPlayer = 'black';
let gameOver = false;
let difficulty = 'easy';

/** 注入 AI 上一步棋子的呼吸闪烁特效（只需注入一次） */
function ensureAiLastMoveStyles() {
  if (document.getElementById('ai-last-move-style')) return;
  const style = document.createElement('style');
  style.id = 'ai-last-move-style';
  style.textContent = `
    /* 让 AI 最新落子的棋子在原有 drop 动画基础上叠加呼吸光晕 */
    .cell.ai-last-move::after {
      animation: drop 0.3s ease-out forwards, ai-breath 1.5s infinite ease-in-out;
      box-shadow: 0 0 10px 3px rgba(0, 150, 255, 0.6);
    }
    @keyframes ai-breath {
      0%   { box-shadow: 0 0 6px 2px rgba(0,150,255,0.3); }
      50%  { box-shadow: 0 0 14px 5px rgba(0,150,255,0.8); }
      100% { box-shadow: 0 0 6px 2px rgba(0,150,255,0.3); }
    }
  `;
  document.head.appendChild(style);
}

function setups() {
  ensureAiLastMoveStyles();
  board = Array(boardSize).fill().map(() => Array(boardSize).fill(null));
  initBoard();
  document.getElementById('game-container').classList.add('blurred');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('easy').addEventListener('click', () => startGame('easy'));
  document.getElementById('medium').addEventListener('click', () => startGame('medium'));
  document.getElementById('hard').addEventListener('click', () => startGame('hard'));
}

function startGame(selectedDifficulty) {
  difficulty = selectedDifficulty;
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('game-container').classList.remove('blurred');
  document.getElementById('board').style.display = 'grid';
  document.getElementById('message').style.display = 'block';
  document.getElementById('reset-button').style.display = 'block';

  clearBoard();
  document.getElementById('message').textContent = '轮到玩家 (黑棋)';
}

function initBoard() {
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = '';
  for (let i = 0; i < boardSize; i++) {
    board[i] = [];
    for (let j = 0; j < boardSize; j++) {
      board[i][j] = null;
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = i;
      cell.dataset.col = j;
      cell.addEventListener('click', () => handleClick(i, j));
      boardDiv.appendChild(cell);
    }
  }
}

function handleClick(row, col) {
  if (gameOver || board[row][col]) return;
  placeStone(row, col, 'black');
  if (checkWin(row, col, 'black')) {
    document.getElementById('message').textContent = '玩家 (黑棋) 胜利！';
    gameOver = true;
    return;
  }
  if (isBoardFull()) {
    document.getElementById('message').textContent = '平局！';
    gameOver = true;
    return;
  }
  currentPlayer = 'white';
  document.getElementById('message').textContent = '轮到AI (白棋)';
  setTimeout(() => aiMove(), difficulty === 'easy' ? 1000 : 500);
}

function placeStone(row, col, color) {
  board[row][col] = color;
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (cell) cell.classList.add(color);
}

function checkWin(row, col, color) {
  const directions = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  for (let [dr, dc] of directions) {
    let count = 1;
    for (let i = 1; i < WIN_LENGTH; i++) {
      let r = row + i * dr, c = col + i * dc;
      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize || board[r][c] !== color) break;
      count++;
    }
    for (let i = 1; i < WIN_LENGTH; i++) {
      let r = row - i * dr, c = col - i * dc;
      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize || board[r][c] !== color) break;
      count++;
    }
    if (count >= WIN_LENGTH) return true;
  }
  return false;
}

function isBoardFull() {
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (!board[i][j]) return false;
    }
  }
  return true;
}

function aiMove() {
  let move = null;
  if (difficulty === 'easy') {
    move = aiEasy();
  } else if (difficulty === 'medium') {
    move = aiMedium();
  } else {
    move = aiHard(); // 升级后的困难AI
  }

  if (move) {
    const [row, col] = move;
    // 清除上一次 AI 的高亮提示
    document.querySelectorAll('.ai-last-move').forEach(cell => cell.classList.remove('ai-last-move'));
    // 落子
    placeStone(row, col, 'white');
    // 简单/适中：给最新落子加呼吸闪烁特效
    if (difficulty === 'easy' || difficulty === 'medium') {
      const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
      if (cell) cell.classList.add('ai-last-move');
    }
    if (checkWin(row, col, 'white')) {
      document.getElementById('message').textContent = 'AI (白棋) 胜利！';
      gameOver = true;
      return;
    }
    if (isBoardFull()) {
      document.getElementById('message').textContent = '平局！';
      gameOver = true;
      return;
    }
  }
  currentPlayer = 'black';
  document.getElementById('message').textContent = '轮到玩家 (黑棋)';
}

// ============== 简单模式增强逻辑 ==============

function isBoardEmpty() {
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (board[i][j]) return false;
    }
  }
  return true;
}

function pickCenterBiasedMove(candidates) {
  const mid = (boardSize - 1) / 2;
  candidates.sort((a, b) => {
    const da = Math.abs(a[0] - mid) + Math.abs(a[1] - mid);
    const db = Math.abs(b[0] - mid) + Math.abs(b[1] - mid);
    return da - db;
  });
  return candidates[0] || null;
}

function aiEasy() {
  if (isBoardEmpty()) {
    const mid = Math.floor(boardSize / 2);
    return [mid, mid];
  }
  let winMove = findWinningMove('white');
  if (winMove) return winMove;

  let blockWin = findWinningMove('black');
  if (blockWin) return blockWin;

  let makeFour = findThreatMove('white', WIN_LENGTH - 1);
  if (makeFour) return makeFour;
  let blockFour = findThreatMove('black', WIN_LENGTH - 1);
  if (blockFour) return blockFour;

  let makeThree = findThreatMove('white', WIN_LENGTH - 2);
  if (makeThree) return makeThree;
  let blockThree = findThreatMove('black', WIN_LENGTH - 2);
  if (blockThree) return blockThree;

  let bestScore = -Infinity;
  let bestMove = null;
  const candidates = getCandidateMoves(); // 半径1
  for (let [i, j] of candidates) {
    board[i][j] = 'white';
    let score = minimax(2, -Infinity, Infinity, false); // 轻量搜索
    board[i][j] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [i, j];
    }
  }
  return bestMove || pickCenterBiasedMove(candidates) || getRandomMove();
}

// ============== 适中模式 ==============

function aiMedium() {
  let winMove = findWinningMove('white');
  if (winMove) return winMove;

  let blockMove = findWinningMove('black');
  if (blockMove) return blockMove;

  let attackFour = findThreatMove('white', WIN_LENGTH - 1);
  if (attackFour) return attackFour;

  let blockFour = findThreatMove('black', WIN_LENGTH - 1);
  if (blockFour) return blockFour;

  let bestScore = -Infinity;
  let bestMove = null;
  const candidates = getCandidateMoves(); // 半径1
  for (let [i, j] of candidates) {
    board[i][j] = 'white';
    let score = minimax(2, -Infinity, Infinity, false);
    board[i][j] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [i, j];
    }
  }
  return bestMove || getRandomMove();
}

// ============== 困难模式（升级版） ==============

function aiHard() {
  // 快速战术：立即赢 / 堵赢 / 造活四 / 堵活四
  let m;
  if ((m = findWinningMove('white'))) return m;
  if ((m = findWinningMove('black'))) return m;

  let makeFour = findThreatMove('white', WIN_LENGTH - 1);
  if (makeFour) return makeFour;
  let blockFour = findThreatMove('black', WIN_LENGTH - 1);
  if (blockFour) return blockFour;

  const startTime = performance.now();
  let bestMove = null;
  let bestVal = -Infinity;

  // 迭代加深：3 -> 4 -> 5 -> 6 -> 7（时间够就更深）
  for (let depth = HARD_BASE_DEPTH; depth <= HARD_BASE_DEPTH + 4; depth++) {
    const timeLeft = () => performance.now() - startTime < HARD_TIME_BUDGET_MS;
    const moves = orderMoves(getCandidateMoves(CANDIDATE_RADIUS), 'white');

    let currentBest = null;
    let currentVal = -Infinity;

    for (const [r, c] of moves) {
      if (!timeLeft()) break;

      board[r][c] = 'white';
      const val = -negamax(depth - 1, -Infinity, Infinity, 'black', startTime, HARD_TIME_BUDGET_MS);
      board[r][c] = null;

      if (val > currentVal) {
        currentVal = val;
        currentBest = [r, c];
      }
    }

    if (currentBest) {
      bestMove = currentBest;
      bestVal = currentVal;
    }
    if (!timeLeft()) break;
    if (bestVal > 5e7) break; // 已接近必胜，提前终止
  }

  // 兜底
  return bestMove || orderMoves(getCandidateMoves(CANDIDATE_RADIUS), 'white')[0] || getRandomMove();
}

// Negamax + Alpha-Beta + 置换表 + 时间控制（困难模式用）
function negamax(depth, alpha, beta, toMove, startTime, budgetMs) {
  if (performance.now() - startTime >= budgetMs) {
    return staticEval();
  }

  const valNow = staticEval();
  if (depth <= 0) {
    // 简易安静延伸：若双方存在强威胁，则延伸1层
    if (hasAnyStrongThreat(toMove) || hasAnyStrongThreat(opponent(toMove))) {
      depth = 1;
    } else {
      return valNow;
    }
  }

  const key = ttKey(toMove, depth);
  const ttHit = TT.get(key);
  if (ttHit && ttHit.depth >= depth) {
    if (ttHit.flag === 'EXACT') return ttHit.value;
    if (ttHit.flag === 'LOWER' && ttHit.value > alpha) alpha = ttHit.value;
    else if (ttHit.flag === 'UPPER' && ttHit.value < beta) beta = ttHit.value;
    if (alpha >= beta) return ttHit.value;
  }

  const color = toMove;
  const moves = orderMoves(getCandidateMoves(CANDIDATE_RADIUS), color);
  let bestVal = -Infinity;
  let bestFlag = 'UPPER';

  for (const [r, c] of moves) {
    if (performance.now() - startTime >= budgetMs) break;

    board[r][c] = color;
    let leafVal;
    if (checkWin(r, c, color)) {
      leafVal = 1e9 - (HARD_BASE_DEPTH - depth); // 即刻胜利：超高分
    } else {
      leafVal = -negamax(depth - 1, -beta, -alpha, opponent(color), startTime, budgetMs);
    }
    board[r][c] = null;

    if (leafVal > bestVal) bestVal = leafVal;
    if (bestVal > alpha) {
      alpha = bestVal;
      bestFlag = 'EXACT';
    }
    if (alpha >= beta) {
      bestFlag = 'LOWER'; // fail-high
      break;
    }
  }

  TT.set(key, { depth, value: bestVal, flag: bestFlag });
  return bestVal;
}

function opponent(color) {
  return color === 'white' ? 'black' : 'white';
}

function hasAnyStrongThreat(color) {
  // 强威胁：能形成四（>= WIN_LENGTH-1）
  const moves = getCandidateMoves(1);
  for (const [r, c] of moves) {
    board[r][c] = color;
    const strong = hasLineOfLength(r, c, color, WIN_LENGTH - 1);
    board[r][c] = null;
    if (strong) return true;
  }
  return false;
}

// —— 困难模式：着法排序支持 —— //
function centerBiasScore(r, c) {
  const mid = (boardSize - 1) / 2;
  return -(Math.abs(r - mid) + Math.abs(c - mid)); // 离中心越近越大
}

function heuristicMoveScore(r, c, color) {
  let score = 0;

  // 进攻分
  board[r][c] = color;
  if (checkWin(r, c, color)) score += 1e8; // 立即赢
  else if (hasLineOfLength(r, c, color, WIN_LENGTH - 1)) score += 5e6; // 做出四
  else if (hasLineOfLength(r, c, color, WIN_LENGTH - 2)) score += 1e5; // 做出三
  board[r][c] = null;

  // 防守分
  const opp = opponent(color);
  board[r][c] = opp;
  if (checkWin(r, c, opp)) score += 9e7; // 挡对手立赢（接近同等重要）
  else if (hasLineOfLength(r, c, opp, WIN_LENGTH - 1)) score += 4e6; // 挡四
  else if (hasLineOfLength(r, c, opp, WIN_LENGTH - 2)) score += 8e4; // 挡三
  board[r][c] = null;

  // 中心偏好（弱）
  score += 1000 * centerBiasScore(r, c);
  return score;
}

function orderMoves(moves, color) {
  return moves
    .map(([r, c]) => ({ r, c, s: heuristicMoveScore(r, c, color) }))
    .sort((a, b) => b.s - a.s)
    .map(m => [m.r, m.c]);
}

// 置换表键（简易串；可替换为Zobrist哈希）
function ttKey(toMove, depth) {
  let s = toMove + '|' + depth + '|';
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      const v = board[i][j];
      s += (v === null ? '.' : v === 'white' ? 'W' : 'B');
    }
  }
  return s;
}

// 静态评估：白分-黑分
function staticEval() {
  return evaluateBoard('white', true) - evaluateBoard('black', true);
}

// ============== 公用搜索/评估工具 ==============

function getRandomMove() {
  const emptyCells = [];
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (!board[i][j]) emptyCells.push([i, j]);
    }
  }
  return emptyCells.length ? emptyCells[Math.floor(Math.random() * emptyCells.length)] : null;
}

function minimax(depth, alpha, beta, maximizingPlayer) {
  if (depth === 0) {
    return evaluateBoard('white', difficulty === 'easy' || difficulty === 'hard') -
           evaluateBoard('black', difficulty === 'easy' || difficulty === 'hard');
  }
  let bestScore = maximizingPlayer ? -Infinity : Infinity;
  const candidates = getCandidateMoves(); // 默认半径1
  for (let [i, j] of candidates) {
    const color = maximizingPlayer ? 'white' : 'black';
    board[i][j] = color;
    const score = minimax(depth - 1, alpha, beta, !maximizingPlayer);
    board[i][j] = null;
    if (maximizingPlayer) {
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, score);
    } else {
      bestScore = Math.min(bestScore, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return bestScore;
}

// 可传半径；默认1（easy/medium）；hard 用 2
function getCandidateMoves(radius = 1) {
  const candidates = new Set();
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (!board[i][j]) continue;
      for (let di = -radius; di <= radius; di++) {
        for (let dj = -radius; dj <= radius; dj++) {
          if (di === 0 && dj === 0) continue;
          const ni = i + di, nj = j + dj;
          if (ni >= 0 && ni < boardSize && nj >= 0 && nj < boardSize && !board[ni][nj]) {
            candidates.add(`${ni},${nj}`);
          }
        }
      }
    }
  }
  if (candidates.size === 0) {
    const mid = Math.floor(boardSize / 2);
    return [[mid, mid]];
  }
  return Array.from(candidates).map(k => k.split(',').map(Number));
}

function findWinningMove(color) {
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (!board[i][j]) {
        board[i][j] = color;
        if (checkWin(i, j, color)) {
          board[i][j] = null;
          return [i, j];
        }
        board[i][j] = null;
      }
    }
  }
  return null;
}

function findThreatMove(color, length) {
  const threatLength = length; // 直接按传入长度
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (!board[i][j]) {
        board[i][j] = color;
        if (hasLineOfLength(i, j, color, threatLength)) {
          board[i][j] = null;
          return [i, j];
        }
        board[i][j] = null;
      }
    }
  }
  return null;
}

function hasLineOfLength(row, col, color, length) {
  const directions = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  for (let [dr, dc] of directions) {
    let count = 1;
    for (let i = 1; i < length; i++) {
      let r = row + i * dr, c = col + i * dc;
      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize || board[r][c] !== color) break;
      count++;
    }
    for (let i = 1; i < length; i++) {
      let r = row - i * dr, c = col - i * dc;
      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize || board[r][c] !== color) break;
      count++;
    }
    if (count >= length) return true;
  }
  return false;
}

function evaluateBoard(color, isHard = false) {
  let score = 0;
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      if (board[i][j] === color) {
        score += evaluatePosition(i, j, color, isHard);
      }
    }
  }
  return score;
}

function evaluatePosition(row, col, color, isHard) {
  let score = 0;
  const directions = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  for (let [dr, dc] of directions) {
    let count = 1;
    let openEnds = 0;
    let gaps = 0;
    let blockedPositive = false;
    let blockedNegative = false;

    // 正向
    for (let i = 1; i < WIN_LENGTH; i++) {
      let r = row + i * dr, c = col + i * dc;
      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) {
        blockedPositive = true;
        break;
      }
      if (board[r][c] === color) {
        count++;
      } else if (board[r][c] === null) {
        if (isHard) gaps++;
        break; // 遇空位视为一端潜在开放
      } else {
        blockedPositive = true;
        break;
      }
    }
    if (!blockedPositive) {
      let r = row + WIN_LENGTH * dr, c = col + WIN_LENGTH * dc;
      if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === null) openEnds++;
      else if (board[row + (count) * dr]?.[col + (count) * dc] === null) openEnds++;
    }

    // 反向
    for (let i = 1; i < WIN_LENGTH; i++) {
      let r = row - i * dr, c = col - i * dc;
      if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) {
        blockedNegative = true;
        break;
      }
      if (board[r][c] === color) {
        count++;
      } else if (board[r][c] === null) {
        if (isHard) gaps++;
        break;
      } else {
        blockedNegative = true;
        break;
      }
    }
    if (!blockedNegative) {
      let r = row - WIN_LENGTH * dr, c = col - WIN_LENGTH * dc;
      if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === null) openEnds++;
      else if (board[row - (count) * dr]?.[col - (count) * dc] === null) openEnds++;
    }

    // 评分（简化启发式）
    if (count >= WIN_LENGTH) {
      score += 1000000; // 已成五连，必胜
    } else if (count === WIN_LENGTH - 1 && openEnds >= 1) {
      score += 20000;    // 冲四/活四
    } else if (count === WIN_LENGTH - 1 && openEnds === 0) {
      score += 10000;    // 死四
    } else if (count === WIN_LENGTH - 2 && openEnds >= 2) {
      score += 5000;     // 活三
    } else if (count === WIN_LENGTH - 2 && openEnds >= 1) {
      score += 2500;     // 眠三
    } else if (difficulty === 'easy' && count === WIN_LENGTH - 3 && openEnds >= 2) {
      score += 1000;     // （仅简单）连二两端活
    } else if (difficulty === 'easy' && count === WIN_LENGTH - 3 && openEnds >= 1) {
      score += 500;      // （仅简单）连二一端活
    }

    if (isHard && gaps > 0 && count >= WIN_LENGTH - 2) {
      score += 300 * (WIN_LENGTH - gaps); // 高难度：带空位长形加一点分
    }
  }
  return score;
}

// ============== 重置 & 初始化 ==============

function clearBoard() {
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      board[i][j] = null;
    }
  }
  const cells = document.querySelectorAll('.cell');
  cells.forEach(cell => cell.classList.remove('black', 'white', 'ai-last-move'));
  currentPlayer = 'black';
  gameOver = false;
}

function resetGame() {
  clearBoard();
  document.getElementById('message').textContent = '轮到玩家 (黑棋)';
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('game-container').classList.add('blurred');
  document.getElementById('message').style.display = 'none';
  document.getElementById('reset-button').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  setups();
});
