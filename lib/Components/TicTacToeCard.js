/*
 * Module "Tic-Tac-Toe" — kartu HTML interaktif buat WhatsApp.
 * Sumber tampilan & AI minimax: script standalone tictactoe.js
 * (https://whatsapp.com/channel/0029VbCV1ck8fewpdNb2TY2k/698),
 * di-port jadi module ESM supaya konsisten sama module lain di /lib/Components.
 *
 * Tambahan dari versi aslinya:
 *  1. Panel LEADERBOARD di dalam kartu, datanya disuntik dari database bot
 *     (db.users) waktu HTML dibuat.
 *  2. KODE KLAIM: kalau pemain menang lawan AI level Master, modal kemenangan
 *     memunculkan kode. Kode itu dikirim balik ke bot ({prefix}klaimttt <kode>)
 *     buat menambah score, jadi hasil main di kartu HTML bisa masuk leaderboard.
 *     Ini perlu karena HTML-nya jalan di sandbox WhatsApp dan sama sekali tidak
 *     bisa menghubungi server bot (lihat catatan di scrape/richhtml.js).
 *
 * Dipakai plugins/games/tictactoe.js.
 */

import { randomBytes } from 'crypto'

// Kode klaim sengaja tanpa huruf/angka yang gampang ketuker (0/O, 1/I) karena
// user harus mengetik ulang kodenya di chat.
const CLAIM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateClaimCode(length = 6) {
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) out += CLAIM_ALPHABET[bytes[i] % CLAIM_ALPHABET.length];
    return out;
}

// Semua teks dari luar (nama bot, nama pemain, leaderboard) harus di-escape
// sebelum ditempel ke HTML, biar tidak bisa dipakai menyuntik tag/script.
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Nomor WhatsApp di leaderboard disamarkan; kartu ini bisa dilihat satu grup.
function maskNumber(num) {
    const n = String(num || '').replace(/[^0-9]/g, '');
    if (n.length <= 6) return n || '-';
    return n.slice(0, 4) + '***' + n.slice(-3);
}

function renderLeaderboardRows(leaderboard) {
    if (!Array.isArray(leaderboard) || !leaderboard.length) {
        return '<div class="lb__empty">Belum ada skor. Menang lawan Master buat masuk sini.</div>';
    }
    const medals = ['🥇', '🥈', '🥉'];
    return leaderboard.slice(0, 5).map((row, i) => `
      <div class="lb__row${row.isMe ? ' is-me' : ''}">
        <span class="lb__rank">${medals[i] || (i + 1) + '.'}</span>
        <span class="lb__name">${escapeHtml(row.name || maskNumber(row.number))}</span>
        <span class="lb__score">${escapeHtml(String(row.score || 0))}</span>
      </div>`).join('');
}

/**
 * Bangun HTML kartu Tic-Tac-Toe.
 * @param {object} opts
 * @param {string} opts.botName      nama bot, ditampilkan di header
 * @param {string} opts.playerName   nama pemain yang memanggil
 * @param {string} opts.prefix       prefix bot, buat instruksi klaim
 * @param {Array}  opts.leaderboard  [{name, number, score, isMe}]
 * @param {string} opts.claimCode    kode klaim kemenangan level Master
 * @param {number} opts.claimReward  jumlah score yang didapat
 */
function buildTicTacToeHtml(opts = {}) {
    const botName = escapeHtml(opts.botName || 'Bot');
    const playerName = escapeHtml(opts.playerName || 'Kamu');
    const prefix = escapeHtml(opts.prefix || '.');
    const claimCode = escapeHtml(opts.claimCode || '');
    const claimReward = parseInt(opts.claimReward) || 100;
    const lbRows = renderLeaderboardRows(opts.leaderboard);

    return `
<style>
:root{
  --ink:#e9edef; --ink-soft:#aebac1; --muted:#8696a0; --accent:#00a884;
  --line:#2a3942; --line-strong:#374248; --cell-bg:#111b21;
  --o:#00a884; --x:#e9edef; --card-2:#2a3942;
  --sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;}
.card{width:100%;max-width:360px;}
.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);gap:8px;}
.header__title{font-size:17px;font-weight:600;color:var(--ink);}
.header__sub{font-size:12px;color:var(--muted);}
.mode-title,.levels__label{font-size:11px;color:var(--muted);margin-bottom:8px;}
.mode{display:flex;gap:8px;margin-bottom:14px;}
.mode button{flex:1;background:transparent;border:1px solid var(--line-strong);border-radius:20px;padding:10px 8px;font-size:12px;font-weight:500;color:var(--ink-soft);cursor:pointer;font-family:inherit;}
.mode button.is-active{background:var(--accent);border-color:var(--accent);color:#0b141a;}
.status{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:13px;gap:8px;}
.status__turn{display:flex;align-items:center;gap:8px;color:var(--ink-soft);}
.status__indicator{width:9px;height:9px;border-radius:50%;background:var(--x);flex-shrink:0;}
.status__indicator.is-o{background:var(--o);}
.status__indicator.is-thinking{position:relative;}
.status__indicator.is-thinking::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:1.5px solid var(--o);animation:ring 1.1s ease-out infinite;}
@keyframes ring{0%{transform:scale(.7);opacity:1;}100%{transform:scale(2.2);opacity:0;}}
.status__score{display:flex;gap:10px;color:var(--muted);font-size:11px;}
.status__score b{color:var(--ink);margin-left:3px;}
.board{width:100%;aspect-ratio:1;position:relative;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);background:var(--cell-bg);border-radius:8px;overflow:hidden;border:1px solid var(--line);}
.cell{position:relative;background:transparent;border:none;cursor:pointer;padding:0;color:inherit;}
.cell:disabled{cursor:default;}
.cell:focus-visible{outline:2px solid var(--accent);outline-offset:-3px;}
.cell::before{content:'';position:absolute;right:0;top:6%;bottom:6%;width:1px;background:var(--line-strong);}
.cell:nth-child(3n)::before{display:none;}
.cell::after{content:'';position:absolute;bottom:0;left:6%;right:6%;height:1px;background:var(--line-strong);}
.cell:nth-last-child(-n+3)::after{display:none;}
.cell.is-winning{background:rgba(0,168,132,.14);}
.cell.is-winning-x{background:rgba(233,237,239,.07);}
.mark{position:absolute;inset:22%;pointer-events:none;}
.mark__svg{width:100%;height:100%;overflow:visible;}
.mark__svg path,.mark__svg circle{fill:none;stroke:var(--x);stroke-width:9;stroke-linecap:round;}
.mark--o .mark__svg path,.mark--o .mark__svg circle{stroke:var(--o);}
.mark__svg path{stroke-dasharray:120;stroke-dashoffset:120;animation:draw .3s ease-out forwards;}
.mark__svg path:nth-child(2){animation-delay:.12s;}
.mark__svg circle{stroke-dasharray:220;stroke-dashoffset:220;animation:draw .4s ease-out forwards;}
@keyframes draw{to{stroke-dashoffset:0;}}
.winning-line{position:absolute;height:4px;background:var(--o);transform-origin:left center;z-index:5;pointer-events:none;border-radius:2px;}
.winning-line.is-x{background:var(--x);}
.levels{margin-top:14px;}
.levels__list{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 2px 6px;}
.levels__list::-webkit-scrollbar{display:none;}
.level{background:transparent;border:1px solid var(--line-strong);border-radius:20px;padding:10px 18px;font-size:13px;color:var(--ink-soft);cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;}
.level.is-active{background:var(--accent);border-color:var(--accent);color:#0b141a;}
.footer{margin-top:12px;display:flex;justify-content:center;}
.footer__reset{background:none;border:none;color:var(--accent);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;padding:8px 16px;}
.lb{margin-top:16px;padding-top:14px;border-top:1px solid var(--line);}
.lb__head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;}
.lb__title{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}
.lb__hint{font-size:10px;color:var(--muted);}
.lb__row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;font-size:12px;background:rgba(255,255,255,.03);margin-bottom:5px;}
.lb__row.is-me{background:rgba(0,168,132,.14);}
.lb__rank{width:20px;flex-shrink:0;color:var(--muted);}
.lb__name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-soft);}
.lb__score{font-weight:600;color:var(--accent);}
.lb__empty{font-size:11px;color:var(--muted);padding:10px 0;}
.claim{margin-top:12px;padding:12px;border:1px dashed var(--accent);border-radius:10px;text-align:center;display:none;}
.claim.is-open{display:block;}
.claim__label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}
.claim__code{font-size:22px;font-weight:700;letter-spacing:.22em;color:var(--accent);margin:6px 0;font-family:ui-monospace,Menlo,Consolas,monospace;}
.claim__how{font-size:11px;color:var(--ink-soft);line-height:1.5;}
.claim__how b{color:var(--ink);}
.modal{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .3s ease;}
.modal.is-open{opacity:1;pointer-events:auto;}
.modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45);}
.modal__card{position:relative;background:var(--card-2);border-radius:12px;padding:24px 24px 0;text-align:center;max-width:320px;width:100%;box-shadow:0 24px 50px -12px rgba(0,0,0,.6);transform:translateY(8px) scale(.96);transition:transform .35s cubic-bezier(.34,1.56,.64,1);overflow:hidden;}
.modal.is-open .modal__card{transform:translateY(0) scale(1);}
.modal__title{font-size:20px;font-weight:700;color:var(--ink);margin-bottom:8px;}
.modal__title.is-o{color:var(--o);}
.modal__sub{font-size:14px;color:var(--muted);margin-bottom:20px;}
.modal__code{display:none;margin:-6px 0 18px;font-size:20px;font-weight:700;letter-spacing:.2em;color:var(--accent);font-family:ui-monospace,Menlo,Consolas,monospace;}
.modal__code.is-open{display:block;}
.modal__retry{background:transparent;border:none;color:var(--accent);font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;padding:14px 24px;width:100%;border-top:1px solid var(--line-strong);}
@media(max-width:380px){.stage{padding:16px 12px;}.level{padding:9px 16px;font-size:12px;}}
</style>

<main class="stage">
  <div class="card">
    <div class="header">
      <div class="header__title">Tic-Tac-Toe</div>
      <div class="header__sub">${botName}</div>
    </div>

    <div class="mode-title">Mode permainan</div>
    <div class="mode">
      <button id="modeAI" class="is-active">🤖 Lawan AI</button>
      <button id="modePvP">👥 2 Player</button>
    </div>

    <div class="status">
      <div class="status__turn">
        <span class="status__indicator" id="indicator"></span>
        <span id="status-text">Giliranmu</span>
      </div>
      <div class="status__score">
        <span>X<b id="score-x">0</b></span>
        <span>Seri<b id="score-d">0</b></span>
        <span>O<b id="score-o">0</b></span>
      </div>
    </div>

    <div class="board" id="board"></div>

    <div class="levels" id="levels">
      <div class="levels__label">Tingkat lawan</div>
      <div class="levels__list" id="levels-list"></div>
    </div>

    <div class="footer">
      <button class="footer__reset" id="reset">Ulang papan</button>
    </div>

    <div class="claim" id="claim">
      <div class="claim__label">Kode klaim kemenangan</div>
      <div class="claim__code" id="claim-code">${claimCode}</div>
      <div class="claim__how">Kirim <b>${prefix}klaimttt ${claimCode}</b> ke chat ini untuk mendapat <b>${claimReward} score</b>. Berlaku sekali pakai.</div>
    </div>

    <div class="lb">
      <div class="lb__head">
        <span class="lb__title">Papan Peringkat</span>
        <span class="lb__hint">${playerName}</span>
      </div>
      ${lbRows}
    </div>
  </div>
</main>

<div class="modal" id="modal" hidden>
  <div class="modal__backdrop" id="modal-backdrop"></div>
  <div class="modal__card">
    <h2 class="modal__title" id="modal-title">Kamu menang</h2>
    <p class="modal__sub" id="modal-sub">Bagus sekali. Mau coba lagi?</p>
    <div class="modal__code" id="modal-code"></div>
    <button class="modal__retry" id="modal-retry">Coba lagi</button>
  </div>
</div>

<script>
const CLAIM_CODE = ${JSON.stringify(opts.claimCode || '')};
const CLAIM_PREFIX = ${JSON.stringify(opts.prefix || '.')};

const state = {
  board: Array(9).fill(null),
  human: 'X', ai: 'O', turn: 'X',
  mode: 'ai', over: false, winner: null, line: null,
  thinking: false, level: 2,
  scores: { X: 0, O: 0, D: 0 }
};

const LEVELS = [{ name: 'Pemula' }, { name: 'Terlatih' }, { name: 'Taktisi' }, { name: 'Master' }];
const MASTER_LEVEL = 3;

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

const $ = id => document.getElementById(id);
const boardEl = $('board');
const statusText = $('status-text');
const indicator = $('indicator');
const levelsList = $('levels-list');
const levelsEl = $('levels');
const scoreX = $('score-x');
const scoreO = $('score-o');
const scoreD = $('score-d');
const modal = $('modal');

function buildBoard(){
  boardEl.innerHTML = '';
  for(let i=0;i<9;i++){
    const c = document.createElement('button');
    c.className = 'cell';
    c.dataset.idx = i;
    c.setAttribute('aria-label','Kotak ' + (i+1));
    c.addEventListener('click', () => onCell(i));
    boardEl.appendChild(c);
  }
}

function buildLevels(){
  levelsList.innerHTML = '';
  LEVELS.forEach((lvl,i)=>{
    const b = document.createElement('button');
    b.className = 'level' + (i === state.level ? ' is-active' : '');
    b.textContent = lvl.name;
    b.addEventListener('click', ()=>setLevel(i));
    levelsList.appendChild(b);
  });
}

function setLevel(i){
  state.level = i;
  document.querySelectorAll('.level').forEach((el,idx)=>{
    el.classList.toggle('is-active', idx === i);
  });
  resetBoard();
}

function setMode(mode){
  state.mode = mode;
  $('modeAI').classList.toggle('is-active', mode === 'ai');
  $('modePvP').classList.toggle('is-active', mode === 'pvp');
  levelsEl.style.display = mode === 'ai' ? '' : 'none';
  resetBoard();
}

function markSVG(v){
  if(v === 'X'){
    return '<svg class="mark__svg" viewBox="0 0 100 100"><path d="M 22 22 L 78 78"/><path d="M 78 22 L 22 78"/></svg>';
  }
  return '<svg class="mark__svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30"/></svg>';
}

function renderCell(i){
  const cell = boardEl.children[i];
  const v = state.board[i];
  const existing = cell.querySelector('.mark');

  if(v){
    if(!existing){
      const m = document.createElement('div');
      m.className = 'mark mark--' + v.toLowerCase();
      m.innerHTML = markSVG(v);
      cell.appendChild(m);
    }
    cell.disabled = true;
  }else{
    if(existing) existing.remove();
    cell.disabled = state.over || state.thinking || (state.turn !== 'X' && state.mode === 'ai');
  }

  const isWin = !!(state.line && state.line.includes(i));
  cell.classList.toggle('is-winning', isWin);
  cell.classList.toggle('is-winning-x', isWin && state.winner === 'X');
}

function render(){
  for(let i=0;i<9;i++) renderCell(i);

  if(state.over){
    if(state.winner === 'X'){
      statusText.textContent = state.mode === 'pvp' ? 'Player 1 menang' : 'Kamu menang';
      indicator.className = 'status__indicator';
    } else if(state.winner === 'O'){
      statusText.textContent = state.mode === 'pvp' ? 'Player 2 menang' : 'AI menang';
      indicator.className = 'status__indicator is-o';
    } else {
      statusText.textContent = 'Seri';
      indicator.className = 'status__indicator';
    }
  } else if(state.thinking){
    statusText.textContent = 'AI berpikir…';
    indicator.className = 'status__indicator is-o is-thinking';
  } else if(state.mode === 'pvp'){
    statusText.textContent = state.turn === 'X' ? 'Giliran Player 1' : 'Giliran Player 2';
    indicator.className = 'status__indicator' + (state.turn === 'O' ? ' is-o' : '');
  } else {
    statusText.textContent = state.turn === 'X' ? 'Giliranmu' : 'Giliran AI';
    indicator.className = 'status__indicator' + (state.turn === 'O' ? ' is-o' : '');
  }

  scoreX.textContent = state.scores.X;
  scoreO.textContent = state.scores.O;
  scoreD.textContent = state.scores.D;
}

function onCell(i){
  if(state.over || state.thinking) return;
  if(state.board[i] !== null) return;
  if(state.mode === 'ai' && state.turn !== state.human) return;

  state.board[i] = state.turn;
  renderCell(i);

  const result = checkWinner(state.board);
  if(result){ endGame(result); return; }

  state.turn = state.turn === 'X' ? 'O' : 'X';

  if(state.mode === 'ai' && state.turn === state.ai){
    state.thinking = true;
    render();
    setTimeout(aiMove, 380 + Math.random() * 340);
  } else {
    render();
  }
}

function aiMove(){
  if(!state.thinking) return;
  const move = chooseAIMove();
  if(move === null){ state.thinking = false; render(); return; }

  state.board[move] = state.ai;
  renderCell(move);
  state.thinking = false;

  const result = checkWinner(state.board);
  if(result){ endGame(result); }
  else { state.turn = state.human; render(); }
}

function chooseAIMove(){
  const empty = state.board.map((v,i)=> v === null ? i : -1).filter(i => i >= 0);
  if(!empty.length) return null;

  const L = state.level;
  if(L === 0) return empty[Math.floor(Math.random() * empty.length)];

  if(L === 1){
    const win = findImmediate(state.board, state.ai);
    if(win !== null) return win;
    if(Math.random() > 0.15){
      const block = findImmediate(state.board, state.human);
      if(block !== null) return block;
    }
    if(state.board[4] === null) return 4;
    if(Math.random() > 0.2){
      const corners = [0,2,6,8].filter(i => state.board[i] === null);
      if(corners.length) return corners[Math.floor(Math.random() * corners.length)];
    }
    return empty[Math.floor(Math.random() * empty.length)];
  }

  if(L === 2){
    if(Math.random() < 0.10) return empty[Math.floor(Math.random() * empty.length)];
    return minimaxMove(state.board, state.ai, 4);
  }

  return minimaxMove(state.board, state.ai, 9);
}

function findImmediate(board, player){
  for(const line of WIN_LINES){
    const cells = [board[line[0]], board[line[1]], board[line[2]]];
    const count = cells.filter(v => v === player).length;
    const empty = cells.filter(v => v === null).length;
    if(count === 2 && empty === 1) return line[cells.indexOf(null)];
  }
  return null;
}

function minimaxMove(board, player, maxDepth){
  let best = -Infinity;
  let moves = [];

  for(let i=0;i<9;i++){
    if(board[i] !== null) continue;
    board[i] = player;
    const score = minimax(board, player === 'O' ? 'X' : 'O', 0, maxDepth, -Infinity, Infinity);
    board[i] = null;
    if(score > best){ best = score; moves = [i]; }
    else if(score === best){ moves.push(i); }
  }

  return moves[Math.floor(Math.random() * moves.length)];
}

function minimax(board, current, depth, maxDepth, alpha, beta){
  const result = checkWinner(board);
  if(result){
    if(result.winner === 'O') return 10 - depth;
    if(result.winner === 'X') return depth - 10;
    return 0;
  }
  if(depth >= maxDepth) return 0;

  const isMax = current === 'O';
  let best = isMax ? -Infinity : Infinity;

  for(let i=0;i<9;i++){
    if(board[i] !== null) continue;
    board[i] = current;
    const score = minimax(board, current === 'O' ? 'X' : 'O', depth + 1, maxDepth, alpha, beta);
    board[i] = null;

    if(isMax){ best = Math.max(best, score); alpha = Math.max(alpha, score); }
    else { best = Math.min(best, score); beta = Math.min(beta, score); }

    if(beta <= alpha) break;
  }

  return best;
}

function checkWinner(board){
  for(const line of WIN_LINES){
    const [a,b,c] = line;
    if(board[a] && board[a] === board[b] && board[a] === board[c]){
      return { winner: board[a], line };
    }
  }
  if(board.every(v => v !== null)) return { winner: 'D', line: null };
  return null;
}

function drawWinningLine(line, winner){
  const old = boardEl.querySelector('.winning-line');
  if(old) old.remove();

  const first = boardEl.children[line[0]].getBoundingClientRect();
  const last = boardEl.children[line[2]].getBoundingClientRect();
  const box = boardEl.getBoundingClientRect();

  const x1 = first.left + first.width / 2 - box.left;
  const y1 = first.top + first.height / 2 - box.top;
  const x2 = last.left + last.width / 2 - box.left;
  const y2 = last.top + last.height / 2 - box.top;

  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

  const el = document.createElement('div');
  el.className = 'winning-line' + (winner === 'X' ? ' is-x' : '');
  el.style.left = x1 + 'px';
  el.style.top = (y1 - 2) + 'px';
  el.style.width = '0px';
  el.style.transform = 'rotate(' + angle + 'deg)';
  boardEl.appendChild(el);

  requestAnimationFrame(()=>{
    el.style.transition = 'width .35s ease-out';
    el.style.width = length + 'px';
  });
}

// Kode klaim cuma muncul kalau pemain benar-benar mengalahkan AI level Master.
function deservesClaim(winner){
  return !!CLAIM_CODE && winner === 'X' && state.mode === 'ai' && state.level === MASTER_LEVEL;
}

function endGame(result){
  state.over = true;
  state.winner = result.winner;
  state.line = result.line;

  if(result.winner === 'X') state.scores.X++;
  else if(result.winner === 'O') state.scores.O++;
  else state.scores.D++;

  render();

  if(deservesClaim(result.winner)) $('claim').classList.add('is-open');

  if(result.line){
    setTimeout(()=> drawWinningLine(result.line, result.winner), 220);
    setTimeout(()=> showModal(result.winner), 950);
  } else {
    setTimeout(()=> showModal(result.winner), 400);
  }
}

function showModal(winner){
  const title = $('modal-title');
  const sub = $('modal-sub');
  const code = $('modal-code');

  code.classList.remove('is-open');
  code.textContent = '';

  if(winner === 'X'){
    title.textContent = state.mode === 'pvp' ? 'Player 1 menang' : 'Kamu menang';
    title.className = 'modal__title';
    if(deservesClaim(winner)){
      sub.textContent = 'Kalahkan Master! Kirim kode ini ke chat buat klaim score:';
      code.textContent = CLAIM_PREFIX + 'klaimttt ' + CLAIM_CODE;
      code.classList.add('is-open');
    } else {
      sub.textContent = 'Mantap! Mau coba lagi?';
    }
  } else if(winner === 'O'){
    title.textContent = state.mode === 'pvp' ? 'Player 2 menang' : 'AI menang';
    title.className = 'modal__title is-o';
    sub.textContent = 'Permainan selesai. Coba lagi?';
  } else {
    title.textContent = 'Seri';
    title.className = 'modal__title';
    sub.textContent = 'Imbang. Main sekali lagi?';
  }

  modal.hidden = false;
  void modal.offsetWidth;
  modal.classList.add('is-open');
}

function hideModal(){
  modal.classList.remove('is-open');
  setTimeout(()=>{ modal.hidden = true; }, 300);
}

function resetBoard(){
  state.board = Array(9).fill(null);
  state.turn = 'X';
  state.over = false;
  state.winner = null;
  state.line = null;
  state.thinking = false;

  const line = boardEl.querySelector('.winning-line');
  if(line) line.remove();

  hideModal();
  render();
}

$('modeAI').addEventListener('click', ()=> setMode('ai'));
$('modePvP').addEventListener('click', ()=> setMode('pvp'));
$('reset').addEventListener('click', resetBoard);
$('modal-retry').addEventListener('click', ()=>{ hideModal(); resetBoard(); });
$('modal-backdrop').addEventListener('click', hideModal);

buildBoard();
buildLevels();
render();
</script>
`;
}

export { buildTicTacToeHtml, generateClaimCode, maskNumber }
