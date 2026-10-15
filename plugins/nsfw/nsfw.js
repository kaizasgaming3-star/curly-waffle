/**
 * NSFW Plugin — menggunakan API PrexzyApis, nekos.life, dan kyzznekoo
 * Endpoint .hentai menggunakan: https://prexzyapis.com/nsfw/hentai
 * Menggunakan streaming disk & had saiz selamat untuk mengelakkan ralat 'Connection Closed' (OOM).
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, createWriteStream, statSync } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileTypeFromBuffer } from 'file-type'
import { request } from '../../lib/Request.js'
import { frame } from '../../lib/Utilities.js'
import { probeVideo, optimizeFullDurationVideo } from '../../lib/Components/TikTokOptimizer.js'

const execAsync = promisify(exec)

// Kategori → endpoint
const CATEGORIES = Object.freeze({
   hentai:    { endpoint: 'hentai_album',  emoji: '🔞', label: 'Hentai Anime (20 Gambar Album)' },
   lewd:      { endpoint: 'lewd',          emoji: '💋', label: 'Lewd Anime'    },
   neko:      { endpoint: 'neko',          emoji: '🐱', label: 'Neko Anime'    },
   waifunsfw: { endpoint: 'lewd',          emoji: '💕', label: 'Waifu NSFW'    },
   ecchi:     { endpoint: 'lewd',          emoji: '😳', label: 'Ecchi Anime'   },
   paptt:     { endpoint: 'paptt',         emoji: '🍑', label: 'Paptt'         },
})

const COMMANDS = Object.keys(CATEGORIES)

// Ambil hentai dari prexzyapis.com/nsfw/hentai secara streaming ke disk (elak RAM OOM)
async function fetchPrexzyHentai() {
   const tmpDir = join(process.cwd(), global.temporaryFolder || 'temp')
   if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

   const id = `${Date.now()}_${Math.random().toString(36).substring(7)}`
   const tmpIn = join(tmpDir, `raw_hentai_${id}.tmp`)
   const tmpOut = join(tmpDir, `opt_hentai_${id}.mp4`)

   const cleanup = () => {
      try { if (existsSync(tmpIn)) unlinkSync(tmpIn) } catch {}
      try { if (existsSync(tmpOut)) unlinkSync(tmpOut) } catch {}
   }

   try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const res = await fetch('https://prexzyapis.com/nsfw/hentai', {
         signal: controller.signal,
         headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
         }
      })

      if (!res.ok) {
         clearTimeout(timeoutId)
         throw new Error(`Prexzy API status: ${res.status}`)
      }

      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpIn))
      clearTimeout(timeoutId)

      if (!existsSync(tmpIn) || statSync(tmpIn).size === 0) {
         throw new Error('Buffer kosong')
      }

      const sampleBuf = Buffer.alloc(4100)
      const fd = readFileSync(tmpIn)
      fd.copy(sampleBuf, 0, 0, Math.min(fd.length, 4100))
      const typeInfo = await fileTypeFromBuffer(sampleBuf)
      const headerType = res.headers.get('content-type') || ''
      const mime = typeInfo?.mime || headerType
      const isVideo = mime.startsWith('video') || typeInfo?.ext === 'mp4' || typeInfo?.ext === 'mkv' || typeInfo?.ext === 'webm'

      if (isVideo) {
         const opt = await optimizeFullDurationVideo(tmpIn, tmpOut)
         const finalBuf = opt?.buffer || (existsSync(tmpOut) && statSync(tmpOut).size > 1000 ? readFileSync(tmpOut) : readFileSync(tmpIn))

         cleanup()
         return { buffer: finalBuf, mime: 'video/mp4', isVideo: true }
      } else {
         const imgBuf = readFileSync(tmpIn)
         cleanup()
         return { buffer: imgBuf, mime: mime || 'image/jpeg', isVideo: false }
      }
   } catch (err) {
      cleanup()
      console.warn('[Prexzy Hentai Error, fallback ke nekos.life]:', err.message || err)
      const buffer = await fetchNekosLife('lewd')
      return { buffer, mime: 'image/jpeg', isVideo: false }
   }
}

// Ambil gambar dari nekos.life
async function fetchNekosLife(endpoint) {
   const json = await request(`https://nekos.life/api/v2/img/${endpoint}`)
   if (!json?.url) throw new Error('URL tidak ditemukan di response API')
   const buffer = await request(json.url)
   if (!Buffer.isBuffer(buffer)) throw new Error('Data gambar tidak valid')
   return buffer
}

// Ambil gambar paptt dari kyzznekoo
async function fetchPaptt() {
   const buffer = await request('https://kyzznekoo.zone.id/api/asupan/paptt', {
      headers: {
         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
         'Content-Type': 'application/json'
      }
   })
   if (!Buffer.isBuffer(buffer)) throw new Error('Data gambar paptt tidak valid')
   return buffer
}

function buildMenu(isPrefix) {
   let text = `🔞 *NSFW MENU*\n\n`
   text += `Koleksi media anime NSFW hanya untuk *18 tahun ke atas*.\n\n`
   text += `*📂 KATEGORI TERSEDIA:*\n`
   text += `  🎬 *${isPrefix}randomhentai* — Random Hentai (Image / Video)\n`
   for (const [cmd, info] of Object.entries(CATEGORIES)) {
      text += `  ${info.emoji} *${isPrefix}${cmd}* — ${info.label}\n`
   }
   text += `\n*⚙️ PENGATURAN GRUP (admin only):*\n`
   text += `  🟢 *${isPrefix}nsfwon* — Aktifkan NSFW di grup ini\n`
   text += `  🔴 *${isPrefix}nsfwoff* — Nonaktifkan NSFW di grup ini\n`
   text += `\n*📌 CATATAN:*\n`
   text += `  • Di chat pribadi, fitur ini langsung bisa digunakan\n`
   text += `  • Di grup, admin harus aktifkan dulu dengan *${isPrefix}nsfwon*\n`
   text += `  • Konten ini hanya untuk pengguna *18+*`
   return text
}

export default {
   command: ['nsfw', 'nsfwmenu', 'nsfwon', 'nsfwoff', ...COMMANDS],
   category: 'nsfw',
   async run(m, { sock, group, isPrefix, command }) {
      const cmd = command.toLowerCase()

      // ── Pengaturan on/off (admin grup) ──────────────────────────────────────
      if (cmd === 'nsfwon') {
         if (!m.isGroup) return m.reply('❌ Perintah ini hanya untuk grup.\nDi chat pribadi, fitur NSFW sudah tersedia langsung.')
         if (!m.isAdmin && !m.isOwner) return m.reply('❌ Hanya admin grup yang boleh mengaktifkan fitur ini.')
         group.nsfw = true
         return m.reply(
            `✅ *NSFW DIAKTIFKAN*\n\n` +
            `Fitur NSFW berhasil diaktifkan untuk grup ini.\n` +
            `Gunakan *${isPrefix}nsfwoff* untuk menonaktifkan.\n\n` +
            `Ketik *${isPrefix}nsfw* untuk lihat daftar kategori.`
         )
      }

      if (cmd === 'nsfwoff') {
         if (!m.isGroup) return m.reply('❌ Perintah ini hanya untuk grup.')
         if (!m.isAdmin && !m.isOwner) return m.reply('❌ Hanya admin grup yang boleh menonaktifkan fitur ini.')
         group.nsfw = false
         return m.reply(`🔴 *NSFW DINONAKTIFKAN*\n\nFitur NSFW telah dinonaktifkan untuk grup ini.`)
      }

      // ── Cek izin grup ────────────────────────────────────────────────────────
      if (m.isGroup && !group?.nsfw) {
         return m.reply(
            `🔒 *FITUR NSFW BELUM AKTIF*\n\n` +
            `Fitur NSFW belum diaktifkan di grup ini.\n` +
            `Minta admin untuk mengetik *${isPrefix}nsfwon* terlebih dahulu.\n\n` +
            `Atau gunakan di *chat pribadi* bot.`
         )
      }

      // ── Menu utama ───────────────────────────────────────────────────────────
      if (cmd === 'nsfw' || cmd === 'nsfwmenu') {
         return m.reply(buildMenu(isPrefix))
      }

      // ── Kirim media ──────────────────────────────────────────────────────────
      const info = CATEGORIES[cmd]
      if (!info) return m.reply(`❌ Kategori *${cmd}* tidak dikenal.\nKetik *${isPrefix}nsfw* untuk lihat kategori.`)

      await m.react('🕒').catch(() => {})
      try {
         if (info.endpoint === 'paptt') {
            const buffer = await fetchPaptt()
            await sock.sendMessage(m.chat, {
               image: buffer,
               caption: `${info.emoji} *${info.label.toUpperCase()}*\n\n🔞 Konten ini hanya untuk 18+ — Gunakan dengan bijak`
            }, { quoted: m })
         }
         else if (info.endpoint === 'hentai_album') {
            try {
               const pageSize = 20
               const apiUrl = `https://api.waifu.im/images?isNsfw=true&orderBy=Random&page=1&pageSize=${pageSize}`
               const json = await request(apiUrl)

               if (!json?.items || json.items.length === 0) {
                  throw new Error('Tiada gambar diterima dari Waifu.im')
               }

               const imageUrls = json.items.map(item => item.url)

               const caption = frame('🔞 KOLEKSI HENTAI (ALBUM)', [
                  `*Jumlah*: ${imageUrls.length} gambar`,
                  `*Kategori*: HENTAI / NSFW`,
                  `⚠️ *Perhatian*: Konten ini hanya untuk 18+ — Gunakan dengan bijak`
               ], '🔞')

               await m.reply(caption.trim())

               await sock.sendMessage(m.chat, {
                  album: imageUrls.map(url => ({
                     image: { url }
                  }))
               }, { quoted: m })
            } catch (err) {
               console.warn('[Hentai Album Error, fallback ke Prexzy]:', err.message || err)
               const { buffer, mime, isVideo } = await fetchPrexzyHentai()
               if (isVideo) {
                  await sock.sendMessage(m.chat, {
                     video: buffer,
                     mimetype: 'video/mp4',
                     caption: `🔞 *HENTAI ANIME (VIDEO)*\n\n🔞 Konten ini hanya untuk 18+ — Boleh terus pos ke Status WhatsApp.`
                  }, { quoted: m })
               } else {
                  await sock.sendMessage(m.chat, {
                     image: buffer,
                     mimetype: mime || 'image/jpeg',
                     caption: `🔞 *HENTAI ANIME*\n\n🔞 Konten ini hanya untuk 18+ — Gunakan dengan bijak`
                  }, { quoted: m })
               }
            }
         }
         else if (info.endpoint === 'prexzy_hentai') {
            const { buffer, mime, isVideo } = await fetchPrexzyHentai()
            if (isVideo) {
               await sock.sendMessage(m.chat, {
                  video: buffer,
                  mimetype: 'video/mp4',
                  caption: `${info.emoji} *${info.label.toUpperCase()} (VIDEO)*\n\n🔞 Konten ini hanya untuk 18+ — Boleh terus pos ke Status WhatsApp.`
               }, { quoted: m })
            } else {
               await sock.sendMessage(m.chat, {
                  image: buffer,
                  mimetype: mime || 'image/jpeg',
                  caption: `${info.emoji} *${info.label.toUpperCase()}*\n\n🔞 Konten ini hanya untuk 18+ — Gunakan dengan bijak`
               }, { quoted: m })
            }
         }
         else {
            const buffer = await fetchNekosLife(info.endpoint)
            await sock.sendMessage(m.chat, {
               image: buffer,
               caption: `${info.emoji} *${info.label.toUpperCase()}*\n\n🔞 Konten ini hanya untuk 18+ — Gunakan dengan bijak`
            }, { quoted: m })
         }
         await m.react('✅').catch(() => {})
      } catch (error) {
         console.error('[NSFW Error]', error.message || error)
         await m.react('❌').catch(() => {})
         await m.reply(`❌ Gagal mengambil media.\nPastikan koneksi internet stabil dan coba lagi.`).catch(() => {})
      }
   }
}
