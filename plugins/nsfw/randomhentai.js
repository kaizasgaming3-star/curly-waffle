/**
 * Random Hentai Plugin (Memory-Safe Streaming)
 * Mengambil random hentai (gambar atau video) dari https://prexzyapis.com/random/anhhentai
 * Fallback ke waifu.im jika API prexzy lambat / gagal.
 * Menggunakan disk streaming & had durasi (full duration) agar:
 *  - RAM tidak meletup (selamat pada RAM 256MB)
 *  - WhatsApp connection tidak terputus (tiada ralat 'Connection Closed')
 *  - Sentiasa dihantar sebagai mesej video/gambar biasa (boleh terus pos ke Status WhatsApp)
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, createWriteStream, statSync } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileTypeFromBuffer } from 'file-type'
import { request } from '../../lib/Request.js'
import { probeVideo, optimizeFullDurationVideo } from '../../lib/Components/TikTokOptimizer.js'

const execAsync = promisify(exec)

/**
 * Muat turun URL ke fail sementara (streaming disk).
 * Memulangkan { tmpPath, cleanup }
 */
async function streamUrlToTmp(url, prefix = 'raw') {
   const tmpDir = join(process.cwd(), global.temporaryFolder || 'temp')
   if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

   const id = `${Date.now()}_${Math.random().toString(36).substring(7)}`
   const tmpPath = join(tmpDir, `${prefix}_${id}.tmp`)

   const cleanup = () => {
      try { if (existsSync(tmpPath)) unlinkSync(tmpPath) } catch {}
   }

   const controller = new AbortController()
   const timeoutId = setTimeout(() => controller.abort(), 30000)

   const res = await fetch(url, {
      signal: controller.signal,
      headers: {
         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
   })

   clearTimeout(timeoutId)

   if (!res.ok) throw new Error(`HTTP ${res.status} dari ${url}`)

   await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpPath))

   if (!existsSync(tmpPath) || statSync(tmpPath).size === 0) {
      cleanup()
      throw new Error('Fail yang dimuat turun kosong')
   }

   return { tmpPath, cleanup }
}

/**
 * Cuba dapatkan URL media dari prexzyapis.com/random/anhhentai.
 * API mungkin memulangkan:
 *  1. JSON { url: "..." } atau { data: { url: "..." } }
 *  2. Binary terus (gambar/video)
 */
async function fetchPrexzyRandomHentai() {
   const controller = new AbortController()
   const timeoutId = setTimeout(() => controller.abort(), 15000)

   const res = await fetch('https://prexzyapis.com/random/anhhentai', {
      signal: controller.signal,
      headers: {
         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
         'Accept': 'application/json, */*'
      }
   })

   clearTimeout(timeoutId)

   if (!res.ok) throw new Error(`Prexzy API status: ${res.status}`)

   const contentType = res.headers.get('content-type') || ''

   // Jika JSON — extract URL media
   if (contentType.includes('application/json') || contentType.includes('text/')) {
      const text = await res.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { throw new Error('Respons bukan JSON dan bukan binary') }

      const mediaUrl = parsed?.url || parsed?.data?.url || parsed?.result?.url || parsed?.image || parsed?.video
      if (!mediaUrl) throw new Error('Tiada URL media dalam respons JSON Prexzy')
      return { type: 'url', url: mediaUrl }
   }

   // Jika binary terus
   const buf = Buffer.from(await res.arrayBuffer())
   if (buf.length === 0) throw new Error('Buffer prexzy kosong')
   return { type: 'buffer', buffer: buf, mime: contentType }
}

/**
 * Dapatkan URL gambar NSFW rawak dari waifu.im (fallback).
 */
async function fetchWaifuImRandom() {
   const json = await request('https://api.waifu.im/search?isNsfw=true&manyFiles=false')
   const url = json?.images?.[0]?.url
   if (!url) throw new Error('Tiada URL dari waifu.im')
   return url
}

export default {
   command: ['randomhentai', 'hentairandom', 'rhentai'],
   category: 'nsfw',
   async run(m, { sock, group, isPrefix }) {
      // Cek izin grup
      if (m.isGroup && !group?.nsfw) {
         return m.reply(
            `🔒 *FITUR NSFW BELUM AKTIF*\n\n` +
            `Fitur NSFW belum diaktifkan di grup ini.\n` +
            `Minta admin untuk mengetik *${isPrefix}nsfwon* terlebih dahulu.\n\n` +
            `Atau gunakan di *chat pribadi* bot.`
         )
      }

      await m.react('🕒').catch(() => {})

      const tmpDir = join(process.cwd(), global.temporaryFolder || 'temp')
      if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

      const id = `${Date.now()}_${Math.random().toString(36).substring(7)}`
      const tmpOut = join(tmpDir, `opt_rhentai_${id}.mp4`)
      let extraCleanup = () => {}

      try {
         let buffer = null
         let mime = 'image/jpeg'
         let isVideo = false

         // ── Cuba Prexzy API dulu ──────────────────────────────────────────────
         let prexzyOk = false
         try {
            const result = await fetchPrexzyRandomHentai()

            if (result.type === 'url') {
               // Muat turun URL ke fail sementara
               const { tmpPath, cleanup } = await streamUrlToTmp(result.url, 'prexzy_rhentai')
               extraCleanup = cleanup

               const sampleBuf = readFileSync(tmpPath).subarray(0, 4100)
               const typeInfo = await fileTypeFromBuffer(sampleBuf)
               mime = typeInfo?.mime || 'image/jpeg'
               isVideo = mime.startsWith('video') || ['mp4', 'mkv', 'webm'].includes(typeInfo?.ext)

               if (isVideo) {
                  const opt = await optimizeFullDurationVideo(tmpPath, tmpOut)
                  buffer = opt?.buffer || readFileSync(tmpPath)
               } else {
                  buffer = readFileSync(tmpPath)
               }
               prexzyOk = true

            } else if (result.type === 'buffer') {
               const typeInfo = await fileTypeFromBuffer(result.buffer.subarray(0, 4100))
               mime = typeInfo?.mime || result.mime || 'image/jpeg'
               isVideo = mime.startsWith('video') || ['mp4', 'mkv', 'webm'].includes(typeInfo?.ext)

               if (isVideo) {
                  // Tulis ke fail sementara untuk optimize
                  const tmpRaw = join(tmpDir, `raw_prexzy_${id}.tmp`)
                  const fs = await import('fs')
                  fs.writeFileSync(tmpRaw, result.buffer)
                  extraCleanup = () => { try { unlinkSync(tmpRaw) } catch {} }
                  const opt = await optimizeFullDurationVideo(tmpRaw, tmpOut)
                  buffer = opt?.buffer || result.buffer
               } else {
                  buffer = result.buffer
               }
               prexzyOk = true
            }
         } catch (prexzyErr) {
            console.warn('[RandomHentai] Prexzy gagal, fallback ke waifu.im:', prexzyErr.message)
         }

         // ── Fallback: waifu.im ────────────────────────────────────────────────
         if (!prexzyOk || !buffer) {
            const waifuUrl = await fetchWaifuImRandom()
            const response = await request(waifuUrl)
            if (!Buffer.isBuffer(response)) throw new Error('Gambar waifu.im tidak valid')
            buffer = response
            const typeInfo = await fileTypeFromBuffer(buffer.subarray(0, 4100))
            mime = typeInfo?.mime || 'image/jpeg'
            isVideo = false
         }

         // ── Hantar media ──────────────────────────────────────────────────────
         if (isVideo) {
            await sock.sendMessage(m.chat, {
               video: buffer,
               mimetype: 'video/mp4',
               caption: `🔞 *RANDOM HENTAI (VIDEO)*\n\nKonten 18+ (Full Duration) — Boleh terus pos ke Status WhatsApp.`
            }, { quoted: m })
         } else {
            await sock.sendMessage(m.chat, {
               image: buffer,
               mimetype: mime || 'image/jpeg',
               caption: `🔞 *RANDOM HENTAI (IMAGE)*\n\nKonten 18+ — Gunakan dengan bijak.`
            }, { quoted: m })
         }

         await m.react('✅').catch(() => {})
      }
      catch (error) {
         console.error('[RandomHentai Error]:', error.message || error)
         await m.react('❌').catch(() => {})
         await m.reply(`❌ Gagal mengambil media random hentai: ${error.message || 'Coba lagi sebentar.'}`).catch(() => {})
      }
      finally {
         extraCleanup()
         try { if (existsSync(tmpOut)) unlinkSync(tmpOut) } catch {}
      }
   },
   limit: 1
}
