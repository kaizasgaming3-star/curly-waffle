import { buildMusicPlayerHtml } from '../../lib/Components/MusicPlayerCard.js'
import { sendRichHtml } from '../../lib/Components/RichHtml.js'
import { zenzxz } from '../../lib/Request.js'
import { cleanUpFolder, ffmpeg, frame, persistToFile, resizeImage } from '../../lib/Utilities.js'

import { readFile } from 'fs/promises'
import { resolve, sep } from 'path'

/*
 * Batas ukuran KARTU UTUH (HTML + audio + sampul, semuanya sudah base64).
 *
 * Angka ini hasil percobaan langsung di bot asalnya, bukan tebakan:
 *   ~634KB  -> kartu tampil normal
 *   ~782KB  -> terkirim tanpa error, TAPI tidak pernah muncul di chat
 *   ~1,8MB  -> sama, hilang diam-diam
 * WhatsApp membuangnya tanpa memberi tahu, jadi batasnya dipasang di bawah
 * ukuran yang sudah terbukti berhasil.
 *
 * PENTING: yang dihitung harus kartu utuh. Percobaan 782KB gagal justru karena
 * yang diukur cuma audionya - sampul dan HTML-nya belum dihitung, padahal ikut
 * terkirim.
 */
const MAX_CARD_KB = 560

// Sampul dikecilkan dulu sebelum ditanam. Sampul asli Spotify 640x640 bisa
// 80-150KB, dan itu jatah yang lebih baik dipakai buat audio.
const COVER_SIZE = 300
const COVER_QUALITY = 72

// Maksimal lagu dalam satu kartu. Lebih dari ini, kartunya pasti kebesaran.
const MAX_TRACKS = 4

/*
 * Urutan percobaan, dari yang paling utuh & paling bagus ke yang paling hemat.
 * Yang dipakai adalah pilihan PERTAMA yang ukurannya masuk batas.
 *
 * detik null = lagu utuh.
 * hz = sample rate. MP3 pada 44100 Hz TIDAK BISA di bawah 32kbps - ffmpeg diam-diam
 * menaikkannya, jadi "24k" yang diminta tetap keluar 32k dan ukurannya tidak turun.
 * Untuk bitrate rendah, sample rate harus ikut diturunkan ke 22050 Hz.
 */
const LADDER = [
   { bitrate: '48k', detik: null, hz: 44100 },
   { bitrate: '32k', detik: null, hz: 44100 },
   { bitrate: '32k', detik: 120, hz: 44100 },
   { bitrate: '24k', detik: 120, hz: 22050 },
   { bitrate: '24k', detik: 90, hz: 22050 },
   { bitrate: '16k', detik: 90, hz: 22050 },
   { bitrate: '16k', detik: 60, hz: 22050 }
]

// Tangga khusus mode banyak lagu: durasinya dipatok pendek sejak awal (bawaan 40
// detik), yang diturunkan cuma mutunya. Kalau lagu utuh ikut dicoba seperti mode
// satu lagu, percobaan pertama pasti gagal dan cuma buang waktu encode.
const LADDER_MULTI = [
   { bitrate: '32k', detik: 40, hz: 44100 },
   { bitrate: '24k', detik: 40, hz: 22050 },
   { bitrate: '16k', detik: 40, hz: 22050 },
   { bitrate: '16k', detik: 30, hz: 22050 }
]

const encode = (inputPath, option) =>
   ffmpeg(inputPath, [], [
      '-vn',
      '-ac', '1',
      '-b:a', option.bitrate,
      '-ar', String(option.hz || 44100),
      ...(option.detik ? ['-t', String(option.detik)] : [])
   ], 'mp3')

const toDataURI = async (filePath) =>
   'data:audio/mpeg;base64,' + (await readFile(filePath)).toString('base64')

export default {
   command: 'play2',
   category: 'explore',
   async run(m, {
      sock,
      isPrefix,
      command,
      text
   }) {
      if (!text)
         return m.reply(`👉🏻 *Example*: ${isPrefix + command} raindance\n\nSeveral songs at once, separated by \`#\`:\n${isPrefix + command} raindance # about you # sialan`)

      // Bagian kosong dibuang supaya "a # # b" atau tanda pagar nyasar di ujung
      // tidak bikin lagu kosong.
      const allQuery = text.split('#').map(q => q.trim()).filter(Boolean)
      const queries = allQuery.slice(0, MAX_TRACKS)
      const isMulti = queries.length > 1

      // Dicek pada daftar SEBELUM dipotong - kalau dicek setelahnya, panjangnya
      // tidak akan pernah melebihi batas dan peringatannya mustahil muncul.
      if (allQuery.length > MAX_TRACKS)
         await m.reply(`⚠️ Max ${MAX_TRACKS} songs per card, so the last ${allQuery.length - MAX_TRACKS} were skipped.`)

      m.react('🕒')

      const temporaryFile = []

      try {
         // ── Tahap 1: kumpulkan semua lagunya dulu ──────────────────────────
         const tracks = []
         const failed = []

         for (const query of queries) {
            try {
               const search = await zenzxz('search/spotify', { q: query })
               const firstTrack = search?.result?.results?.[0]
               if (!search.status || !firstTrack) {
                  failed.push(query)
                  continue
               }

               const detail = await zenzxz('download/spotify', {
                  url: 'https://open.spotify.com/track/' + firstTrack.id
               })
               if (!detail.status || !detail.result?.download_url) {
                  failed.push(query)
                  continue
               }

               const rawPath = await persistToFile(detail.result.download_url)
               temporaryFile.push(rawPath)

               let cover = ''
               if (detail.result.thumbnail) {
                  try {
                     const resized = await resizeImage(detail.result.thumbnail, COVER_SIZE, COVER_SIZE, COVER_QUALITY, 'jpeg')
                     cover = 'data:image/jpeg;base64,' + resized.toString('base64')
                  }
                  catch (error) {
                     console.error('❌ Failed to prepare cover:', error.message)
                  }
               }

               tracks.push({
                  title: detail.result.title || firstTrack.name || query,
                  artist: detail.result.artist || '-',
                  album: detail.result.album || 'Songs',
                  cover,
                  rawPath
               })
            }
            catch (error) {
               console.error(`❌ "${query}" failed:`, error.message)
               failed.push(query)
            }
         }

         if (!tracks.length) {
            m.react('❌')
            return m.reply(`❌ No song found for "${text}".`)
         }

         // ── Tahap 2: encode semuanya, turunkan mutu sampai kartunya muat ───
         const ladder = isMulti ? LADDER_MULTI : LADDER

         let used = ladder[ladder.length - 1]
         let html = ''
         let sizeKb = 0

         for (const option of ladder) {
            const audio = []
            for (const track of tracks) {
               const clipPath = await encode(track.rawPath, option)
               temporaryFile.push(clipPath)
               audio.push(await toDataURI(clipPath))
            }
            used = option

            html = buildMusicPlayerHtml({
               tracks: tracks.map((track, index) => ({
                  title: track.title,
                  artist: track.artist,
                  album: track.album,
                  cover: track.cover,
                  audio: audio[index]
               }))
            })

            sizeKb = Math.round(Buffer.byteLength(html, 'utf8') / 1024)
            if (sizeKb <= MAX_CARD_KB) break
         }

         console.log(`🎵 play2: ${tracks.length} song(s) -> ${used.bitrate}${used.detik ? ' / ' + used.detik + 's' : ' / full'} = card ${sizeKb}KB (limit ${MAX_CARD_KB}KB)`)

         const cardTitle = isMulti ?
            `${tracks.length} Songs - ${tracks[0].title}` :
            `${tracks[0].title} - ${tracks[0].artist}`

         await sendRichHtml(sock, m.chat, html, { title: cardTitle })
         m.react('🎵')

         // Yang tidak ketemu disebutkan, jangan hilang diam-diam.
         if (failed.length)
            await m.reply(`⚠️ Not found: ${failed.join(', ')}`)

         await m.reply(frame('PLAY2', [
            `*Track*: ${tracks.length}`,
            `*Quality*: ${used.bitrate}${used.detik ? ' / ' + used.detik + 's' : ' / full'}`,
            `*Card Size*: ${sizeKb} KB`
         ], '🎵'))
      }
      catch (error) {
         console.error('❌ play2 failed:', error)
         m.react('❌')
         m.reply('❌ Failed to render the player card. This feature needs the latest WhatsApp version.')
      }
      finally {
         // Audio mentah dan semua percobaan encode bisa beberapa MB. Kalau tidak
         // dibuang, folder temp membengkak tiap pemakaian.
         //
         // Cuma berkas DI DALAM folder temp yang dihapus. persistToFile()
         // mengembalikan argumennya apa adanya kalau yang diberikan sudah berupa
         // jalur berkas lokal, bukan URL - tanpa penjagaan ini, berkas sumber di
         // luar temp ikut terhapus kalau API pernah mengembalikan jalur lokal.
         const temporaryPath = resolve(process.cwd(), temporaryFolder)
         for (const file of temporaryFile)
            if (resolve(file).startsWith(temporaryPath + sep))
               await cleanUpFolder(file)
      }
   },
   limit: 1
}
