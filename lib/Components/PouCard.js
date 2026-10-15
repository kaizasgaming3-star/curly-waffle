/*
 * Module "Pou Naik Awan" — game lompat awan buat WhatsApp.
 *
 * Karakternya terinspirasi pen "Pou Animation" karya rerofya
 * (https://codepen.io/Rerofya/pen/LYoQpdG), berlisensi MIT:
 *
 *   The MIT License (MIT)
 *   Copyright (c) 2026 rerofya (https://codepen.io/Rerofya/pen/LYoQpdG)
 *
 * Pen aslinya cuma animasi memberi makan dengan gambar dari internet. Kartu ini
 * TIDAK memakai gambar itu: sandbox WhatsApp tidak bisa mengambil berkas dari
 * luar (lihat lib/Components/RichHtml.js), jadi Pou-nya digambar ulang dengan CSS/SVG.
 * Mekanik lompat awannya juga ditulis dari nol.
 *
 * DUA KODE, DUA GUNA (lihat pola kode klaim di kartu game lain):
 *   - kode LEADERBOARD: muncul kalau skor tembus target, ditukar jadi score.
 *   - kode KOIN: koin dikumpulkan buat dipakai di fitur lain nanti.
 *
 * Kode koin dibuat BERTINGKAT: server menyiapkan beberapa kode dengan nilai
 * berbeda, dan kartu cuma menampilkan kode tertinggi yang tercapai. Cara ini
 * dipakai karena kartu tidak bisa melapor ke server berapa koin yang benar-benar
 * diambil - kalau nilainya ditentukan kartu, angkanya gampang dipalsukan.
 *
 * Dipakai plugins/games/pou.js.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

import { generateClaimCode, maskNumber } from './TicTacToeCard.js'

// Gambar Pou ditanam sebagai data URI, bukan dimuat lewat URL. Kartu HTML jalan
// di sandbox WhatsApp yang tidak bisa mengambil berkas dari internet - pen aslinya
// memakai <img src="https://rerofya.github.io/..."> dan itu pasti kosong di sini.
//
// Dibaca sekali saat modul dimuat, bukan tiap kartu dibuat, supaya tidak membaca
// disk berulang kali untuk berkas yang isinya sama.
// pou-body.png = Pou dengan bagian matanya ditutup warna badan, supaya matanya
// bisa digambar ulang lewat CSS dan BISA BERGERAK (melirik & berkedip). Kalau
// memakai gambar utuh, matanya ikut tercetak diam di dalam gambar.
let POU_IMG = '';
try {
    const berkas = join(process.cwd(), 'media', 'Image', 'pou-body.png');
    POU_IMG = 'data:image/png;base64,' + readFileSync(berkas).toString('base64');
} catch (e) {
    try {
        // Cadangan: gambar utuh (matanya diam, tapi lebih baik daripada tanpa gambar).
        const utuh = join(process.cwd(), 'media', 'Image', 'pou.png');
        POU_IMG = 'data:image/png;base64,' + readFileSync(utuh).toString('base64');
        console.error('[POU] pou-body.png tidak ada, pakai pou.png (mata tidak bergerak).');
    } catch (e2) {
        console.error('[POU] Gambar Pou tidak ditemukan, pakai gambar CSS:', e2.message);
    }
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderLeaderboardRows(leaderboard) {
    if (!Array.isArray(leaderboard) || !leaderboard.length) {
        return '<div class="lb__empty">Belum ada skor. Tembus target buat masuk sini.</div>';
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
 * @param {object} opts
 * @param {string} opts.botName
 * @param {string} opts.playerName
 * @param {string} opts.prefix
 * @param {Array} opts.leaderboard
 * @param {string} opts.claimCode        kode leaderboard
 * @param {number} opts.claimReward      nilai score-nya
 * @param {number} opts.claimTarget      skor minimal
 * @param {Array<{koin:number, kode:string, minKoin:number}>} opts.tierKoin
 */
// Bentuk awan diambil dari pen "Paper Plane Animation CSS" karya Jon Q
// (https://codepen.io/_ItsJonQ/pen/jOVwoJ), berlisensi MIT:
//
//   The MIT License (MIT)
//   Copyright (c) 2026 Jon Q (https://codepen.io/_ItsJonQ/pen/jOVwoJ)
//
// Yang dipakai cuma jalur SVG awannya; animasi dan warnanya ditulis ulang.
const AWAN_SVG = `<svg viewBox="0 0 762 331" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <path fill="currentColor" d="M715.394,228h-16.595c0.79-5.219,1.201-10.562,1.201-16c0-58.542-47.458-106-106-106
  c-8.198,0-16.178,0.932-23.841,2.693C548.279,45.434,488.199,0,417.5,0c-84.827,0-154.374,65.401-160.98,148.529
  C245.15,143.684,232.639,141,219.5,141c-49.667,0-90.381,38.315-94.204,87H46.607C20.866,228,0,251.058,0,279.5
  S20.866,331,46.607,331h668.787C741.133,331,762,307.942,762,279.5S741.133,228,715.394,228z"/>
</svg>`;

function buildPouHtml(opts = {}) {
    const botName = escapeHtml(opts.botName || 'Bot');
    const playerName = escapeHtml(opts.playerName || 'Kamu');
    const prefix = escapeHtml(opts.prefix || '.');
    const claimCode = escapeHtml(opts.claimCode || '');
    const claimReward = parseInt(opts.claimReward) || 30;
    const claimTarget = parseInt(opts.claimTarget) || 1500;
    const lbRows = renderLeaderboardRows(opts.leaderboard);

    // Diurutkan dari syarat terberat, supaya kartu tinggal mengambil yang pertama
    // cocok saat permainan selesai.
    const tier = (Array.isArray(opts.tierKoin) ? opts.tierKoin : [])
        .slice()
        .sort((a, b) => (b.minKoin || 0) - (a.minKoin || 0));
    const tierJson = JSON.stringify(tier.map(t => ({
        koin: Number(t.koin) || 0,
        kode: String(t.kode || ''),
        minKoin: Number(t.minKoin) || 0,
    }))).replace(/</g, '\\u003c');

    return `
<style>
:root{
  --ink:#e9edef; --ink-soft:#aebac1; --muted:#8696a0; --accent:#00a884; --coin:#ffc531;
  --line:#2a3942; --line-strong:#374248; --cell-bg:#111b21; --card-2:#2a3942;
  --langit-1:#1d3557; --langit-2:#457b9d;
  --sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;}
.card{width:100%;max-width:360px;}
.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);gap:8px;}
.header__title{font-size:17px;font-weight:600;}
.header__sub{font-size:12px;color:var(--muted);}

.stats{display:flex;gap:8px;margin-bottom:12px;}
.stat{flex:1;background:var(--cell-bg);border:1px solid var(--line);border-radius:10px;padding:8px 10px;}
.stat__label{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:2px;}
.stat__value{font-size:15px;font-weight:600;}
.stat__value.is-accent{color:var(--accent);}
.stat__value.is-coin{color:var(--coin);}

.arena{position:relative;width:100%;aspect-ratio:3 / 4;border-radius:14px;overflow:hidden;
  background:linear-gradient(180deg,#ff9500 0%,#ff6b35 45%,#f7355e 100%);
  border:1px solid var(--line-strong);touch-action:none;user-select:none;}

.matahari{position:absolute;left:32%;bottom:14%;width:34%;aspect-ratio:1;border-radius:50%;
  background:radial-gradient(circle at 40% 40%,#ffd166,#ffa62b);opacity:.85;}

.awan-latar{position:absolute;color:rgba(255,255,255,.34);pointer-events:none;}
.awan-latar svg{width:100%;height:100%;display:block;}
.awan-latar--1{width:52%;height:12%;top:22%;animation:awan-jalan 26s linear infinite;}
.awan-latar--2{width:70%;height:15%;top:52%;opacity:.8;animation:awan-jalan 38s linear infinite reverse;}
.awan-latar--3{width:40%;height:10%;top:74%;opacity:.6;animation:awan-jalan 31s linear infinite;}
@keyframes awan-jalan{
  from{transform:translateX(-70%);}
  to{transform:translateX(160%);}
}

/* Landasan bergaya seperti contoh: batang membulat dengan bayangan bawah.
   Warnanya menandakan jenisnya - lihat catatan di JENIS_LANDASAN. */
.landas{position:absolute;height:12px;border-radius:8px;box-shadow:0 3px 0 rgba(0,0,0,.18);}
.landas--biasa{background:linear-gradient(180deg,#4ade80,#22a75a);}
.landas--rapuh{background:linear-gradient(180deg,#c084fc,#8b5cf6);}
.landas--pegas{background:linear-gradient(180deg,#60a5fa,#2563eb);}
.landas.is-hancur{animation:landas-hancur .28s ease-out forwards;}
@keyframes landas-hancur{
  from{opacity:1;transform:translate(var(--x),var(--y)) scaleY(1);}
  to{opacity:0;transform:translate(var(--x),calc(var(--y) + 14px)) scaleY(.3);}
}

.koin{position:absolute;width:14px;height:14px;border-radius:50%;background:var(--coin);
  box-shadow:0 0 0 2px rgba(255,197,49,.3);}

.pou{position:absolute;width:34px;height:38px;}
.pou__img{width:100%;height:100%;object-fit:contain;display:block;
  /* Dimatikan penghalusannya supaya tepi gambarnya tetap tajam saat dikecilkan. */
  image-rendering:auto;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));}
.pou__body{width:100%;height:100%;border-radius:50% 50% 46% 46%;background:#8d6e4f;position:relative;
  box-shadow:inset -4px -5px 0 rgba(0,0,0,.12);}
.pou__mata{position:absolute;top:9px;width:10px;height:12px;border-radius:50%;background:#fff;
  border:1.5px solid #2b1a0d;overflow:hidden;animation:kedip 4.2s infinite;}
.pou__mata--ki{left:5px;} .pou__mata--ka{right:5px;animation-delay:.12s;}
.pou__mata i{position:absolute;top:3px;left:2.5px;width:5px;height:5px;border-radius:50%;background:#1b1b1b;
  transition:transform .12s ease-out;}

/* Berkedip: kelopaknya ditiru dengan memipihkan bola matanya sebentar. */
@keyframes kedip{
  0%,92%,100%{transform:scaleY(1);}
  95%{transform:scaleY(.12);}
}

.hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;
  gap:6px;background:rgba(17,27,33,.72);font-size:13px;color:var(--ink);text-align:center;padding:20px;}
.hint b{color:var(--accent);}
.hint small{font-size:11px;color:var(--ink-soft);line-height:1.6;}

.pad{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 16px;}
.pad button{background:transparent;border:1px solid var(--line-strong);border-radius:12px;padding:14px 0;
  font-size:16px;color:var(--ink-soft);cursor:pointer;font-family:inherit;}
.pad button:active{background:var(--accent);border-color:var(--accent);color:#0b141a;}

.lb{border-top:1px solid var(--line);padding-top:12px;}
.lb__head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;}
.lb__title{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);}
.lb__me{font-size:11px;color:var(--muted);}
.lb__row{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;color:var(--ink-soft);}
.lb__row.is-me{color:var(--accent);}
.lb__rank{width:22px;flex-shrink:0;}
.lb__name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lb__score{font-variant-numeric:tabular-nums;}
.lb__empty{font-size:12px;color:var(--muted);padding:6px 0;}

.modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:24px;z-index:20;}
.modal.is-open{display:flex;}
.modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.6);}
.modal__box{position:relative;width:100%;max-width:310px;background:var(--card-2);border:1px solid var(--line-strong);
  border-radius:14px;padding:20px;text-align:center;max-height:85vh;overflow:auto;}
.modal__title{font-size:16px;font-weight:600;margin-bottom:6px;}
.modal__text{font-size:12px;color:var(--ink-soft);line-height:1.5;margin-bottom:14px;}
.claim{background:var(--cell-bg);border:1px dashed var(--accent);border-radius:10px;padding:12px;margin-bottom:10px;}
.claim--coin{border-color:var(--coin);}
.claim__label{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.claim__code{font-size:20px;font-weight:700;letter-spacing:.14em;color:var(--accent);font-variant-numeric:tabular-nums;}
.claim--coin .claim__code{color:var(--coin);}
.claim__how{font-size:11px;color:var(--ink-soft);margin-top:8px;line-height:1.5;}
.modal__note{font-size:11px;color:var(--muted);line-height:1.6;margin-top:6px;}
</style>

<div class="stage">
  <div class="card">
    <div class="header">
      <span class="header__title">Pou Naik Awan</span>
      <span class="header__sub">${botName}</span>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat__label">Skor</div><div class="stat__value is-accent" id="skor">0</div></div>
      <div class="stat"><div class="stat__label">Koin</div><div class="stat__value is-coin" id="koin">0</div></div>
      <div class="stat"><div class="stat__label">Target</div><div class="stat__value">${claimTarget}</div></div>
    </div>

    <div class="arena" id="arena">
      <!-- Matahari & awan latar. Awannya memakai bentuk dari pen "Paper Plane
           Animation" karya Jon Q (MIT) - lihat catatan lisensi di kepala berkas. -->
      <div class="matahari"></div>
      <div class="awan-latar awan-latar--1">${AWAN_SVG}</div>
      <div class="awan-latar awan-latar--2">${AWAN_SVG}</div>
      <div class="awan-latar awan-latar--3">${AWAN_SVG}</div>

      <div class="pou" id="pou">
        ${POU_IMG ? `<img class="pou__img" src="${POU_IMG}" alt="Pou">` : '<div class="pou__body"></div>'}
        <!-- Mata digambar di ATAS badan, jadi bisa melirik ke arah gerak dan
             berkedip sendiri. -->
        <div class="pou__mata pou__mata--ki"><i id="bola-ki"></i></div>
        <div class="pou__mata pou__mata--ka"><i id="bola-ka"></i></div>
      </div>
      <div class="hint" id="hint">
        <b>Tekan untuk mulai</b>
        <small>Tahan sisi kiri/kanan layar atau pakai tombol di bawah.<br>Tiap awan +10 skor. Jangan jatuh!</small>
      </div>
    </div>

    <div class="pad">
      <button id="btn-ki">&#8592; Kiri</button>
      <button id="btn-ka">Kanan &#8594;</button>
    </div>

    <div class="lb">
      <div class="lb__head">
        <span class="lb__title">Papan Peringkat</span>
        <span class="lb__me">${playerName}</span>
      </div>
      ${lbRows}
    </div>
  </div>
</div>

<div class="modal" id="modal">
  <div class="modal__backdrop"></div>
  <div class="modal__box">
    <div class="modal__title" id="modal-title">Permainan selesai</div>
    <div class="modal__text" id="modal-text"></div>

    <div class="claim" id="claim-lb" style="display:none">
      <div class="claim__label">Kode leaderboard</div>
      <div class="claim__code">${claimCode}</div>
      <div class="claim__how">Kirim <b>${prefix}klaimpou ${claimCode}</b> buat menukar +${claimReward} score.</div>
    </div>

    <div class="claim claim--coin" id="claim-coin" style="display:none">
      <div class="claim__label">Kode koin</div>
      <div class="claim__code" id="coin-code"></div>
      <div class="claim__how" id="coin-how"></div>
    </div>

    <div class="modal__note">Permainan ini sekali jalan. Ketik <b>${prefix}pou</b> lagi buat main ulang.</div>
  </div>
</div>

<script>
(function(){
  var TARGET = ${claimTarget};
  var TIER = ${tierJson};

  var arena = document.getElementById('arena');
  var pouEl = document.getElementById('pou');
  var hint = document.getElementById('hint');
  var skorEl = document.getElementById('skor');
  var bolaKi = document.getElementById('bola-ki');
  var bolaKa = document.getElementById('bola-ka');
  var koinEl = document.getElementById('koin');

  var L = 0, T = 0;              // ukuran arena
  var pouX = 0, pouY = 0;        // posisi Pou
  var vy = 0, vx = 0;
  // Tinggi lompatan (v^2 / 2g) harus tetap JAUH di atas JARAK_MAKS, bukan cuma
  // sedikit di atasnya - lihat penjelasan di JARAK_MIN/JARAK_MAKS.
  var GRAV = 0.42, LOMPAT = -12.6, GESER = 3.6;

  // Jarak antar landasan.
  //
  // Tinggi lompatan maksimal = LOMPAT^2 / (2 * GRAV) = 12.6^2 / 0.84 ~ 189px...
  // TAPI itu tinggi teoretis di puncak, saat kecepatan naiknya sudah nol. Landasan
  // di ketinggian itu praktis mustahil disentuh, apalagi sambil bergeser ke kiri
  // atau kanan mencari posisinya.
  //
  // Nilai lama (maks 165) terlalu mepet ke batas itu, jadi sering muncul lompatan
  // yang kelihatan bisa tapi tidak pernah sampai - persis keluhan "lompatnya tidak
  // terlalu jauh". Sekarang dirapatkan ke 88-125px, sekitar dua pertiga tinggi
  // lompatan, sehingga Pou masih punya sisa kecepatan naik saat menyentuh landasan
  // berikutnya dan sempat menggeser badannya di udara.
  var JARAK_MIN = 88, JARAK_MAKS = 125;

  // Dua landasan yang bedanya kurang dari ini dianggap "sebaris", jadi posisi
  // mendatarnya tidak boleh bertabrakan - itu yang bikin tampak mepet.
  var BEDA_SEBARIS = 55;
  var POU_W = 34, POU_H = 38;

  var awan = [], koinList = [];
  var skor = 0, koin = 0, tertinggi = 0;
  var jalan = false, selesai = false, arah = 0, raf = null;

  function acak(a, b){ return a + Math.random() * (b - a); }

  // Jenis landasan:
  //   biasa - lompatan normal
  //   rapuh - HANCUR setelah diinjak sekali, jadi tidak bisa dipakai lagi
  //   pegas - melontarkan lebih tinggi
  function pilihJenis(){
    var r = Math.random();
    if (r < 0.16) return 'rapuh';
    if (r < 0.24) return 'pegas';
    return 'biasa';
  }

  function buatAwan(y, paksaBiasa){
    var el = document.createElement('div');
    var jenis = paksaBiasa ? 'biasa' : pilihJenis();
    el.className = 'landas landas--' + jenis;
    var w = acak(58, 86);
    el.style.width = w + 'px';
    var x = cariXKosong(y, w);
    arena.appendChild(el);

    var obj = { el: el, x: x, y: y, w: w, diinjak: false, jenis: jenis, mati: false };
    posisi(el, x, y);
    awan.push(obj);

    // Koin muncul di sebagian awan saja - kalau semua awan berkoin, angkanya jadi
    // tidak berarti apa-apa.
    if (Math.random() < 0.35){
      var k = document.createElement('div');
      k.className = 'koin';
      arena.appendChild(k);
      var kx = x + w / 2 - 7, ky = y - 24;
      posisi(k, kx, ky);
      koinList.push({ el: k, x: kx, y: ky, diambil: false });
    }
    return obj;
  }

  // Cari posisi mendatar yang tidak menempel dengan landasan lain yang tingginya
  // berdekatan. Dicoba beberapa kali; kalau tetap tidak ketemu, pakai yang terakhir -
  // lebih baik sedikit berdekatan daripada permainannya menggantung mencari terus.
  function cariXKosong(y, w){
    for (var coba = 0; coba < 12; coba++){
      var x = acak(4, Math.max(6, L - w - 4));
      var bentrok = false;

      for (var i = 0; i < awan.length; i++){
        var a = awan[i];
        if (Math.abs(a.y - y) > BEDA_SEBARIS) continue;   // beda tinggi, tidak masalah
        if (x < a.x + a.w + 14 && x + w + 14 > a.x){ bentrok = true; break; }
      }

      if (!bentrok) return x;
    }
    return acak(4, Math.max(6, L - w - 4));
  }

  function posisi(el, x, y){
    // Koordinatnya juga ditulis ke variabel CSS - animasi hancur memakai transform
    // juga, dan tanpa ini landasannya akan meloncat ke pojok saat mulai hancur.
    el.style.setProperty('--x', x + 'px');
    el.style.setProperty('--y', y + 'px');
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  function siap(){
    L = arena.clientWidth; T = arena.clientHeight;

    awan.forEach(function(a){ a.el.remove(); });
    koinList.forEach(function(k){ k.el.remove(); });
    awan = []; koinList = [];

    // Awan pertama tepat di bawah Pou, biar tidak langsung jatuh saat mulai.
    var dasar = buatAwan(T - 40, true);
    pouX = dasar.x + dasar.w / 2 - POU_W / 2;
    pouY = T - 40 - POU_H;
    vy = LOMPAT; vx = 0;

    var y = (T - 40) - acak(JARAK_MIN, JARAK_MAKS);
    while (y > -T){ buatAwan(y); y -= acak(JARAK_MIN, JARAK_MAKS); }

    skor = 0; koin = 0; tertinggi = 0;
    skorEl.textContent = '0'; koinEl.textContent = '0';
    posisi(pouEl, pouX, pouY);
  }

  function loop(){
    if (!jalan) return;

    vx = arah * GESER;
    pouX += vx;

    // Tembus tepi kiri muncul di kanan, dan sebaliknya - biar tidak mentok.
    if (pouX < -POU_W) pouX = L;
    if (pouX > L) pouX = -POU_W;

    vy += GRAV;
    pouY += vy;

    // Layar ikut naik kalau Pou melewati sepertiga atas, bukan Pou yang naik terus.
    if (pouY < T * 0.34){
      var geser = T * 0.34 - pouY;
      pouY = T * 0.34;

      awan.forEach(function(a){ a.y += geser; posisi(a.el, a.x, a.y); });
      koinList.forEach(function(k){ k.y += geser; posisi(k.el, k.x, k.y); });

      tertinggi += geser;

      // Awan yang sudah lewat bawah didaur ulang ke atas - jumlah elemen tetap,
      // jadi permainan tidak makin berat makin lama dimainkan.
      // Cari landasan tertinggi supaya yang didaur ulang ditaruh DI ATASNYA dengan
      // jarak yang sama. Dulu posisinya diacak dekat batas atas layar, jadi
      // kadang muncul menempel dengan landasan yang sudah ada.
      var palingAtas = T;
      awan.forEach(function(a){ if (a.y < palingAtas) palingAtas = a.y; });

      awan.forEach(function(a){
        if (a.y > T){
          palingAtas -= acak(JARAK_MIN, JARAK_MAKS);
          a.y = palingAtas;
          a.x = cariXKosong(palingAtas, a.w);
          a.diinjak = false;

          // Dipakai ulang di atas: jenisnya diundi lagi dan kondisinya dipulihkan,
          // supaya landasan rapuh yang sudah hancur tidak kembali sebagai hantu.
          a.mati = false;
          a.jenis = pilihJenis();
          a.el.classList.remove('is-hancur');
          a.el.className = 'landas landas--' + a.jenis;

          posisi(a.el, a.x, a.y);
        }
      });
      koinList.forEach(function(k){
        if (k.y > T && k.diambil){
          k.y = -acak(30, 120);
          k.x = acak(10, Math.max(12, L - 24));
          k.diambil = false;
          k.el.style.display = '';
          posisi(k.el, k.x, k.y);
        }
      });
    }

    // Mendarat: hanya dihitung saat sedang TURUN, biar tidak menempel waktu naik.
    if (vy > 0){
      for (var i = 0; i < awan.length; i++){
        var a = awan[i];
        var kakiSebelum = pouY - vy + POU_H;
        var kakiSekarang = pouY + POU_H;
        var mendarat = kakiSebelum <= a.y && kakiSekarang >= a.y
          && pouX + POU_W > a.x && pouX < a.x + a.w;

        if (mendarat){
          if (a.mati) continue;   // landasan rapuh yang sudah hancur ditembus saja

          vy = (a.jenis === 'pegas') ? LOMPAT * 1.5 : LOMPAT;

          if (!a.diinjak){
            a.diinjak = true;
            skor += 10;
            skorEl.textContent = skor;
          }

          if (a.jenis === 'rapuh'){
            // Ditandai mati DULU, baru dianimasikan - kalau menunggu animasinya
            // selesai, pemain sempat menginjaknya dua kali.
            a.mati = true;
            a.el.classList.add('is-hancur');
          }
          break;
        }
      }
    }

    // Koin
    koinList.forEach(function(k){
      if (k.diambil) return;
      if (pouX + POU_W > k.x && pouX < k.x + 14 && pouY + POU_H > k.y && pouY < k.y + 14){
        k.diambil = true;
        k.el.style.display = 'none';
        koin++;
        koinEl.textContent = koin;
      }
    });

    posisi(pouEl, pouX, pouY);

    // Bola mata mengikuti arah gerak, dan melihat ke bawah saat sedang jatuh -
    // membuat Pou terasa hidup tanpa menambah beban perhitungan berarti.
    var geserX = arah * 2.2;
    var geserY = vy > 3 ? 1.6 : (vy < -4 ? -1.2 : 0);
    var t = 'translate(' + geserX + 'px,' + geserY + 'px)';
    bolaKi.style.transform = t;
    bolaKa.style.transform = t;

    if (pouY > T){ akhiri(); return; }
    raf = requestAnimationFrame(loop);
  }

  function akhiri(){
    jalan = false; selesai = true;
    cancelAnimationFrame(raf);

    var lolos = skor >= TARGET;
    document.getElementById('modal-title').textContent = lolos ? 'Target tercapai!' : 'Pou jatuh';
    document.getElementById('modal-text').textContent =
      'Skor ' + skor + (lolos ? '' : ' - butuh ' + TARGET + ' buat kode leaderboard') + '. Koin terkumpul: ' + koin + '.';

    document.getElementById('claim-lb').style.display = lolos ? 'block' : 'none';

    // Ambil tingkat koin tertinggi yang syaratnya terpenuhi. TIER sudah diurutkan
    // dari yang terberat, jadi yang pertama cocok itu yang terbaik.
    var dapat = null;
    for (var i = 0; i < TIER.length; i++){
      if (koin >= TIER[i].minKoin){ dapat = TIER[i]; break; }
    }

    if (dapat){
      document.getElementById('claim-coin').style.display = 'block';
      document.getElementById('coin-code').textContent = dapat.kode;
      document.getElementById('coin-how').innerHTML =
        'Kirim <b>${prefix}klaimcoin ' + dapat.kode + '</b> buat menyimpan <b>' + dapat.koin + ' koin</b>.';
    } else {
      document.getElementById('claim-coin').style.display = 'none';
    }

    document.getElementById('modal').classList.add('is-open');
  }

  function mulai(){
    if (jalan || selesai) return;
    hint.style.display = 'none';
    siap();
    jalan = true;
    raf = requestAnimationFrame(loop);
  }

  // Kendali: tahan sisi kiri/kanan arena, atau pakai tombol di bawah.
  function pasangTahan(el, nilai){
    el.addEventListener('touchstart', function(e){ e.preventDefault(); arah = nilai; }, { passive: false });
    el.addEventListener('touchend', function(){ arah = 0; });
    el.addEventListener('mousedown', function(){ arah = nilai; });
    el.addEventListener('mouseup', function(){ arah = 0; });
    el.addEventListener('mouseleave', function(){ arah = 0; });
  }
  pasangTahan(document.getElementById('btn-ki'), -1);
  pasangTahan(document.getElementById('btn-ka'), 1);

  arena.addEventListener('touchstart', function(e){
    if (!jalan){ mulai(); return; }
    var r = arena.getBoundingClientRect();
    arah = (e.touches[0].clientX - r.left) < r.width / 2 ? -1 : 1;
  }, { passive: true });
  arena.addEventListener('touchend', function(){ arah = 0; });
  arena.addEventListener('click', function(){ if (!jalan) mulai(); });

  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft') arah = -1;
    if (e.key === 'ArrowRight') arah = 1;
    if (e.key === ' ' && !jalan) mulai();
  });
  document.addEventListener('keyup', function(){ arah = 0; });
})();
</script>
`;
}

export { buildPouHtml, generateClaimCode, maskNumber }
