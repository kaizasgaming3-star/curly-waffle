# Game Kartu HTML — Tic-Tac-Toe & Pou (port dari Sairipedia)

Mesin kartu interaktif (`richResponseMessage` lewat `relayMessage`) dari Sairipedia,
di-port ke ESM dan dipasang sebagai plugin kategori `games` di DENIA-MD.

## Cara pasang

Timpa isi zip ini ke root DENIA-MD (struktur foldernya sudah sama):

```
lib/Components/RichHtml.js          (baru)
lib/Components/MusicPlayerCard.js   (baru)
lib/Components/TicTacToeCard.js     (baru)
lib/Components/PouCard.js           (baru)
lib/Components/GameClaim.js         (baru)
lib/Constants.js                    (DIUBAH — lihat di bawah)
media/Image/pou-body.png            (baru)
media/Image/pou.png                 (baru)
plugins/games/tictactoe.js          (baru)
plugins/games/tictactoe-claim.js    (baru)
plugins/games/pou.js                (baru)
plugins/games/pou-claim.js          (baru)
plugins/games/coin.js               (baru)
plugins/explore/play2.js            (baru)
```

Tidak ada dependensi baru. Watcher memuat `plugins/games/` sendiri, jadi tidak perlu
restart — kecuali untuk `lib/Constants.js`, yang cuma dimuat sekali saat start.

### Satu-satunya berkas lama yang diubah

`lib/Constants.js` — menambah `coin: 0` di `SCHEMA.User`, tepat di bawah `energy: 100`.
Kalau kamu sudah pernah mengubah berkas ini, jangan timpa; cukup tambahkan barisnya
sendiri. `applySchema()` cuma mengisi kunci yang belum ada, jadi user lama aman.

## Perintah

| Perintah | Biaya | Keterangan |
|---|---|---|
| `.tictactoe` / `.ttt` | 15 energy | Kirim kartu Tic-Tac-Toe (AI minimax 4 level) |
| `.klaimttt <kode>` | — | Tukar kode jadi +5 limit (menang lawan level Master) |
| `.pou` | 15 energy | Kirim kartu Pou Naik Awan |
| `.klaimpou <kode>` | — | Tukar kode jadi +3 limit (skor tembus 1500) |
| `.klaimcoin <kode>` | — | Tukar kode koin (5–15 / 20–40 / 50–90 koin) |
| `.coin` / `.koin` | — | Saldo koin + papan peringkat koin |
| `.play2 <judul>` | 1 limit | Kartu pemutar musik. Beberapa lagu sekaligus dipisah `#` (maks 4) |

## Kenapa pakai kode klaim

Kartu HTML jalan di sandbox aplikasi WhatsApp: **tidak bisa menghubungi bot sama
sekali** — tidak lewat `fetch`, tidak lewat `<img>`. Jadi hasil main tidak mungkin
dilaporkan sendiri oleh kartu. Polanya: server menyiapkan kode acak, kartu cuma
*memperlihatkan* kode itu kalau syaratnya tercapai, lalu pemain mengetik ulang kodenya
ke bot. Kode berlaku 30 menit dan sekali pakai.

Nilai koin juga ditentukan server (bertingkat), bukan kartu — kalau kartu yang
menentukan, angkanya gampang dipalsukan.

## Soal ukuran kartu (`.play2`)

Audio ditanam sebagai data URI, jadi ukuran lagu langsung jadi ukuran pesan, dan
base64 membengkakkannya ~33%. Kalau kartunya kebesaran, **WhatsApp membuangnya tanpa
memberi tahu** — terkirim tanpa error, tapi tidak pernah muncul di chat.

Karena itu plugin mencoba beberapa tingkat mutu berurutan (48k utuh → 16k/60 detik)
dan memakai yang PERTAMA muat di bawah 560KB. Yang diukur adalah HTML utuh, bukan
audionya saja. Ukuran final dicetak ke konsol tiap pemakaian.

Butuh `ffmpeg` di PATH (sama seperti fitur sticker dan `.toaudio` yang sudah ada).

## Catatan

- Kode klaim disimpan di memori (`lib/Components/GameClaim.js`), hangus kalau bot
  restart. Sengaja ditaruh di `lib/`, bukan di dalam plugin: Watcher memuat ulang
  plugin dengan cache-buster tiap berkasnya berubah, jadi state di dalam plugin akan
  ikut hilang tiap kali kamu mengedit file itu.
- Leaderboard di dalam kartu memakai `limit`, seirama dengan game kuis.
- Energy dipotong Listener *sebelum* `run()`. Kalau relay gagal (WhatsApp versi lama
  tidak bisa merender kartu), energy dikembalikan di blok `catch`.
- Teks di dalam kartu masih Bahasa Indonesia; pesan plugin Bahasa Inggris mengikuti
  gaya DENIA.
- `.play2` memakai `zenzxz('search/spotify')` + `zenzxz('download/spotify')`, lapisan
  request yang sama dengan `.spotplay` bawaan — bukan scraper terpisah.
- Kalau sebuah encode ffmpeg gagal di tengah jalan, berkas keluarannya bisa tertinggal
  di `temp/`. Ini perilaku `ffmpeg()` di `lib/Utilities.js` yang sudah ada dan berlaku
  untuk semua plugin yang memakainya, bukan khusus plugin ini.
