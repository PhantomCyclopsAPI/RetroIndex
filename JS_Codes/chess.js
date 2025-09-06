// =========================
// Gomoku (Connect Five) - FAST-Hard AI + Clean UI
// 全页主题由 #theme-toggle 切换 body.dark-theme 控制（与首页一致）
// =========================

const boardSize = 15;
const WIN_LENGTH = 5;

// —— FAST-Hard preset（性能友好） ——
const HARD_TIME_BUDGET_MS = 600;
const HARD_BASE_DEPTH      = 3;
const HARD_MAX_DEPTH_BOOST = 4;
const CANDIDATE_RADIUS     = 1;
const TT_MAX_ENTRIES       = 3000;

const TT = new Map();
const KILLER_MOVES = Array.from({ length: 64 }, () => []);
const HISTORY = new Map();

let board = [];
let currentPlayer = 'black';
let gameOver = false;
let difficulty = 'medium';

const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>Array.from(document.querySelectorAll(s));

function setMessage(t){ const m=qs('#message'); if(m) m.textContent=t; }
function setTurnClass(color){
  const root=qs('#gomoku'); if(!root) return;
  root.classList.toggle('black-turn', color==='black');
  root.classList.toggle('white-turn', color==='white');
}
function clearEffects(){
  const svg=qs('#win-svg'); if(svg) svg.innerHTML='';
  qsa('.cell.last-move,.cell.ai-last-move').forEach(el=>el.classList.remove('last-move','ai-last-move'));
}

function setups() {
  // 初始化棋盘
  board = Array(boardSize).fill().map(() => Array(boardSize).fill(null));
  initBoard();

  // 顶部交互
  const selDiff = qs('#difficulty-select');
  const btnNew  = qs('#new-game');

  if (selDiff) {
    difficulty = selDiff.value || 'medium';
    selDiff.addEventListener('change', () => { difficulty = selDiff.value; startGame(difficulty); });
  }
  if (btnNew) btnNew.addEventListener('click', () => startGame(difficulty));

  // 开局
  startGame(difficulty);
}

function startGame(selectedDifficulty) {
  difficulty = selectedDifficulty;
  clearBoard();
  setMessage('Your turn (Black)');
  setTurnClass('black');
}

function initBoard() {
  const boardDiv = qs('#board');
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
  // 无星位点，无悬停预下影（CSS 已禁用）
}

function handleClick(row, col) {
  if (gameOver || board[row][col]) return;
  qsa('.cell.last-move').forEach(el=>el.classList.remove('last-move'));
  placeStone(row, col, 'black');
  markCellClass(row,col,'last-move');

  const winCells = findWinLine(row, col, 'black');
  if (winCells) {
    setMessage('Player (Black) wins!');
    drawWinLine(winCells);
    gameOver = true;
    setTurnClass('black');
    return;
  }
  if (isBoardFull()) { setMessage('Draw!'); gameOver = true; return; }

  currentPlayer = 'white';
  setTurnClass('white');
  setMessage('AI (White) to move');
  setTimeout(() => aiMove(), difficulty === 'easy' ? 900 : 450);
}

function markCellClass(r,c,cls){
  const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
  if (cell) cell.classList.add(cls);
}

function placeStone(row, col, color) {
  board[row][col] = color;
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (cell) cell.classList.add(color);
}

function isBoardFull() {
  for (let i = 0; i < boardSize; i++)
    for (let j = 0; j < boardSize; j++)
      if (!board[i][j]) return false;
  return true;
}

function checkWinOnly(row, col, color) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (let [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i < WIN_LENGTH; i++) {
      let r = row + i * dr, c = col + i * dc;
      if (r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==color) break; count++;
    }
    for (let i = 1; i < WIN_LENGTH; i++) {
      let r = row - i * dr, c = col - i * dc;
      if (r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==color) break; count++;
    }
    if (count >= WIN_LENGTH) return true;
  }
  return false;
}

function findWinLine(row, col, color) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (let [dr, dc] of dirs) {
    let cells = [[row,col]];
    for (let i = 1; i < WIN_LENGTH; i++) {
      const r = row + i*dr, c = col + i*dc;
      if (r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==color) break;
      cells.push([r,c]);
    }
    for (let i = 1; i < WIN_LENGTH; i++) {
      const r = row - i*dr, c = col - i*dc;
      if (r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==color) break;
      cells.unshift([r,c]);
    }
    if (cells.length >= WIN_LENGTH) return cells.slice(0, WIN_LENGTH);
  }
  return null;
}

function drawWinLine(cells){
  const svg = qs('#win-svg'); if(!svg || !cells?.length) return;
  svg.innerHTML = '';
  const boardEl = qs('#board');
  const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad')) || 14;
  const cellEl = boardEl.querySelector('.cell');
  const size = cellEl ? cellEl.getBoundingClientRect().width : 34;
  const rect = boardEl.getBoundingClientRect();
  const toXY = ([r,c]) => {
    const x = pad + c*size + size/2;
    const y = pad + r*size + size/2;
    return {x,y};
  };
  const p1 = toXY(cells[0]);
  const p2 = toXY(cells[cells.length-1]);
  const line = document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
  line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  svg.appendChild(line);
}

function aiMove() {
  let move = null;
  if (difficulty === 'easy')      move = aiEasy();
  else if (difficulty === 'medium') move = aiMedium();
  else                              move = aiHard();

  if (move) {
    const [row, col] = move;
    qsa('.cell.ai-last-move').forEach(el=>el.classList.remove('ai-last-move'));
    placeStone(row, col, 'white');
    markCellClass(row,col,'ai-last-move');

    const winCells = findWinLine(row, col, 'white');
    if (winCells) {
      setMessage('AI (White) wins!');
      drawWinLine(winCells);
      gameOver = true;
      setTurnClass('white');
      return;
    }
    if (isBoardFull()) { setMessage('Draw!'); gameOver = true; return; }
  }
  currentPlayer = 'black';
  setTurnClass('black');
  setMessage('Your turn (Black)');
}

// ---------- Easy / Medium ----------
function isBoardEmpty() {
  for (let i = 0; i < boardSize; i++)
    for (let j = 0; j < boardSize; j++)
      if (board[i][j]) return false;
  return true;
}
function pickCenterBiasedMove(cands){
  const mid=(boardSize-1)/2;
  cands.sort((a,b)=>(Math.abs(a[0]-mid)+Math.abs(a[1]-mid))-(Math.abs(b[0]-mid)+Math.abs(b[1]-mid)));
  return cands[0]||null;
}
function aiEasy() {
  if (isBoardEmpty()) { const mid=Math.floor(boardSize/2); return [mid,mid]; }
  let m;
  if ((m=findWinningMove('white'))) return m;
  if ((m=findWinningMove('black'))) return m;
  if ((m=findThreatMove('white', WIN_LENGTH-1))) return m;
  if ((m=findThreatMove('black', WIN_LENGTH-1))) return m;
  if ((m=findThreatMove('white', WIN_LENGTH-2))) return m;
  if ((m=findThreatMove('black', WIN_LENGTH-2))) return m;

  let best=-Infinity,bestMove=null;
  const cands=getCandidateMoves();
  for (let [i,j] of cands){
    board[i][j]='white';
    const s=minimax(2,-Infinity,Infinity,false);
    board[i][j]=null;
    if (s>best){best=s;bestMove=[i,j];}
  }
  return bestMove||pickCenterBiasedMove(cands)||getRandomMove();
}
function aiMedium() {
  let m;
  if ((m=findWinningMove('white'))) return m;
  if ((m=findWinningMove('black'))) return m;
  if ((m=findThreatMove('white', WIN_LENGTH-1))) return m;
  if ((m=findThreatMove('black', WIN_LENGTH-1))) return m;

  let best=-Infinity,bestMove=null;
  const cands=getCandidateMoves();
  for (let [i,j] of cands){
    board[i][j]='white';
    const s=minimax(2,-Infinity,Infinity,false);
    board[i][j]=null;
    if (s>best){best=s;bestMove=[i,j];}
  }
  return bestMove||getRandomMove();
}
function getRandomMove(){
  const empty=[];
  for(let i=0;i<boardSize;i++)for(let j=0;j<boardSize;j++) if(!board[i][j]) empty.push([i,j]);
  return empty.length?empty[Math.floor(Math.random()*empty.length)]:null;
}
function minimax(depth,alpha,beta,maximizing){
  if (depth===0) return evaluateBoard('white', true) - evaluateBoard('black', true);
  let best=maximizing?-Infinity:Infinity;
  const cands=getCandidateMoves();
  for (let [i,j] of cands){
    const color=maximizing?'white':'black';
    board[i][j]=color;
    const s=minimax(depth-1,alpha,beta,!maximizing);
    board[i][j]=null;
    if (maximizing){best=Math.max(best,s);alpha=Math.max(alpha,s);} else {best=Math.min(best,s);beta=Math.min(beta,s);}
    if (beta<=alpha) break;
  }
  return best;
}

// ---------- Hard (FAST) ----------
function aiHard(){
  let m;
  if ((m=findWinningMove('white'))) return m;
  if ((m=findWinningMove('black'))) return m;
  if ((m=findThreatMove('white', WIN_LENGTH-1))) return m;
  if ((m=findThreatMove('black', WIN_LENGTH-1))) return m;

  const start=performance.now();
  let bestMove=null,bestVal=-Infinity;

  for (let depth=HARD_BASE_DEPTH; depth<=HARD_BASE_DEPTH+HARD_MAX_DEPTH_BOOST; depth++){
    const timeLeft=()=>performance.now()-start<HARD_TIME_BUDGET_MS;
    const moves=orderMoves(getCandidateMoves(CANDIDATE_RADIUS),'white',0,null);
    let curBest=null,curVal=-Infinity;
    for (const [r,c] of moves){
      if (!timeLeft()) break;
      board[r][c]='white';
      const val=-negamax(depth-1,-Infinity,Infinity,'black',start,HARD_TIME_BUDGET_MS,1);
      board[r][c]=null;
      if (val>curVal){curVal=val;curBest=[r,c];}
    }
    if (curBest){bestMove=curBest;bestVal=curVal;}
    if (!timeLeft()) break;
    if (bestVal>5e7) break;
  }
  return bestMove || orderMoves(getCandidateMoves(CANDIDATE_RADIUS),'white',0,null)[0] || getRandomMove();
}
function negamax(depth,alpha,beta,toMove,start,budgetMs,ply=0){
  if (performance.now()-start>=budgetMs) return staticEval();

  const valNow = staticEval();
  if (depth<=0){
    if (hasAnyStrongThreat(toMove)||hasAnyStrongThreat(opponent(toMove))) depth=1;
    else return valNow;
  }

  const key=ttKey(toMove,depth);
  const hit=TT.get(key);
  if (hit && hit.depth>=depth){
    if (hit.flag==='EXACT') return hit.value;
    if (hit.flag==='LOWER'&&hit.value>alpha) alpha=hit.value;
    else if (hit.flag==='UPPER'&&hit.value<beta) beta=hit.value;
    if (alpha>=beta) return hit.value;
  }

  const color=toMove, ttBest=hit?.best||null;
  const moves=orderMoves(getCandidateMoves(CANDIDATE_RADIUS),color,ply,ttBest);

  let best=-Infinity, flag='UPPER', bestMove=null;
  for (const [r,c] of moves){
    if (performance.now()-start>=budgetMs) break;
    board[r][c]=color;
    let v;
    if (checkWinOnly(r,c,color)) v=1e9 - ply;
    else v=-negamax(depth-1,-beta,-alpha,opponent(color),start,budgetMs,ply+1);
    board[r][c]=null;

    if (v>best){best=v;bestMove=[r,c];}
    if (best>alpha){alpha=best;flag='EXACT';}
    if (alpha>=beta){
      flag='LOWER';
      const arr=KILLER_MOVES[ply]||[];
      if (!arr.some(m=>m.r===r&&m.c===c)){ arr.unshift({r,c}); if (arr.length>2) arr.pop(); KILLER_MOVES[ply]=arr; }
      const hk=r+','+c; HISTORY.set(hk,(HISTORY.get(hk)||0)+depth*depth);
      break;
    }
  }
  TT.set(key,{depth,value:best,flag,best:bestMove});
  if (TT.size>TT_MAX_ENTRIES) TT.clear();
  return best;
}
function opponent(c){ return c==='white'?'black':'white'; }
function hasAnyStrongThreat(color){
  const moves=getCandidateMoves(1);
  for (const [r,c] of moves){
    board[r][c]=color;
    const strong=hasLineOfLength(r,c,color,WIN_LENGTH-1);
    board[r][c]=null;
    if (strong) return true;
  }
  return false;
}

// ---- move ordering ----
function centerBiasScore(r,c){ const mid=(boardSize-1)/2; return -(Math.abs(r-mid)+Math.abs(c-mid)); }
function heuristicMoveScore(r,c,color){
  let s=0;
  board[r][c]=color;
  if (checkWinOnly(r,c,color)) s+=1e9;
  else if (hasLineOfLength(r,c,color,WIN_LENGTH-1)) s+=6e6;
  board[r][c]=null;

  const opp=opponent(color);
  board[r][c]=opp;
  if (checkWinOnly(r,c,opp)) s+=8e8;
  else if (hasLineOfLength(r,c,opp,WIN_LENGTH-1)) s+=4e6;
  board[r][c]=null;

  s+=600*centerBiasScore(r,c);
  s+=(HISTORY.get(r+','+c)||0);
  return s;
}
function orderMoves(moves,color,ply=0,ttBest=null){
  const killers=new Set((KILLER_MOVES[ply]||[]).map(m=>m.r+'_'+m.c));
  return moves.map(([r,c])=>{
    let s=heuristicMoveScore(r,c,color);
    if (ttBest&&r===ttBest[0]&&c===ttBest[1]) s+=1e9;
    if (killers.has(r+'_'+c)) s+=5e7;
    return { r, c, s };
  }).sort((a,b)=>b.s-a.s).map(m=>[m.r,m.c]);
}

// ---- TT Key & Eval ----
function ttKey(toMove,depth){
  let s=toMove+'|'+depth+'|';
  for (let i=0;i<boardSize;i++)
    for (let j=0;j<boardSize;j++){
      const v=board[i][j]; s+=(v===null?'.':(v==='white'?'W':'B'));
    }
  return s;
}
function staticEval(){ return evaluateBoard('white', true) - evaluateBoard('black', true); }

// ---- Common helpers ----
function getCandidateMoves(radius=1){
  const set=new Set();
  for (let i=0;i<boardSize;i++)for(let j=0;j<boardSize;j++){
    if (!board[i][j]) continue;
    for (let di=-radius;di<=radius;di++)for(let dj=-radius;dj<=radius;dj++){
      if (di===0&&dj===0) continue;
      const ni=i+di,nj=j+dj;
      if (ni>=0&&ni<boardSize&&nj>=0&&nj<boardSize&&!board[ni][nj]) set.add(`${ni},${nj}`);
    }
  }
  if (set.size===0){ const mid=Math.floor(boardSize/2); return [[mid,mid]]; }
  let moves=Array.from(set).map(k=>k.split(',').map(Number));
  const mid=(boardSize-1)/2;
  moves.sort((a,b)=>(Math.abs(a[0]-mid)+Math.abs(a[1]-mid))-(Math.abs(b[0]-mid)+Math.abs(b[1]-mid)));
  const MAX_BRANCH=22; if (moves.length>MAX_BRANCH) moves=moves.slice(0,MAX_BRANCH);
  return moves;
}
function findWinningMove(color){
  for (let i=0;i<boardSize;i++)for(let j=0;j<boardSize;j++) if(!board[i][j]){
    board[i][j]=color; const win=checkWinOnly(i,j,color); board[i][j]=null; if (win) return [i,j];
  }
  return null;
}
function findThreatMove(color,length){
  for (let i=0;i<boardSize;i++)for(let j=0;j<boardSize;j++) if(!board[i][j]){
    board[i][j]=color; const ok=hasLineOfLength(i,j,color,length); board[i][j]=null; if (ok) return [i,j];
  }
  return null;
}
function hasLineOfLength(row,col,color,length){
  const dirs=[[1,0],[0,1],[1,1],[1,-1]];
  for (let [dr,dc] of dirs){
    let count=1;
    for (let i=1;i<length;i++){ const r=row+i*dr,c=col+i*dc; if(r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==color) break; count++; }
    for (let i=1;i<length;i++){ const r=row-i*dr,c=col-i*dc; if(r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==color) break; count++; }
    if (count>=length) return true;
  }
  return false;
}
function evaluateBoard(color,isHard=false){
  let score=0;
  for (let i=0;i<boardSize;i++)for(let j=0;j<boardSize;j++) if(board[i][j]===color) score+=evaluatePosition(i,j,color,isHard);
  return score;
}
function evaluatePosition(row,col,color,isHard){
  let score=0, openThrees=0;
  const dirs=[[1,0],[0,1],[1,1],[1,-1]];
  for (let [dr,dc] of dirs){
    let count=1, openEnds=0, gaps=0; let bp=false,bn=false;
    for(let i=1;i<WIN_LENGTH;i++){const r=row+i*dr,c=col+i*dc;
      if(r<0||r>=boardSize||c<0||c>=boardSize){bp=true;break;}
      if(board[r][c]===color) count++;
      else if(board[r][c]===null){ if(isHard) gaps++; break; }
      else { bp=true; break; }
    }
    if(!bp){
      const r2=row+WIN_LENGTH*dr,c2=col+WIN_LENGTH*dc;
      if(r2>=0&&r2<boardSize&&c2>=0&&c2<boardSize&&board[r2][c2]===null) openEnds++;
      else if (board[row+count*dr]?.[col+count*dc]===null) openEnds++;
    }
    for(let i=1;i<WIN_LENGTH;i++){const r=row-i*dr,c=col-i*dc;
      if(r<0||r>=boardSize||c<0||c>=boardSize){bn=true;break;}
      if(board[r][c]===color) count++;
      else if(board[r][c]===null){ if(isHard) gaps++; break; }
      else { bn=true; break; }
    }
    if(!bn){
      const r2=row-WIN_LENGTH*dr,c2=col-WIN_LENGTH*dc;
      if(r2>=0&&r2<boardSize&&c2>=0&&c2<boardSize&&board[r2][c2]===null) openEnds++;
      else if (board[row-count*dr]?.[col-count*dc]===null) openEnds++;
    }

    if (count>=WIN_LENGTH){ score+=1_000_000; continue; }
    if (count===WIN_LENGTH-1){
      if (openEnds>=2) score+=10_000_000; else if (openEnds===1) score+=6_000_000; else score+=150_000;
    } else if (count===WIN_LENGTH-2){
      if (openEnds>=2){ score+=1_200_000; openThrees++; } else if (openEnds===1) score+=200_000;
    } else if (count===WIN_LENGTH-3){
      if (openEnds>=2) score+=10_000; else if (openEnds===1) score+=2_000;
    }
    if (isHard && gaps>0 && count>=WIN_LENGTH-2) score += 400*(WIN_LENGTH-gaps);
  }
  if (openThrees>=2) score+=5_000_000;
  return score;
}

// ---------- Reset / init ----------
function clearBoard() {
  for (let i=0;i<boardSize;i++) for (let j=0;j<boardSize;j++) board[i][j]=null;
  qsa('.cell').forEach(c=>c.classList.remove('black','white','ai-last-move','last-move'));
  clearEffects();
  currentPlayer='black';
  gameOver=false;
}

document.addEventListener('DOMContentLoaded', setups);
