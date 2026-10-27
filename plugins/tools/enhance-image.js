import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileTypeFromBuffer } from 'file-type'
import { nexray } from '../../lib/Request.js'
import { uguu, catbox, quax } from '../../lib/Scraper.js'
import { isMimeImage } from '../../lib/Utilities.js'

const execAsync = promisify(exec)
const FFMPEG_BIN = fs.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe') ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg'

/**
 * Enhances image locally using FFmpeg with Lanczos upscale, unsharp mask, and color enhancement.
 */
async function enhanceImageLocal(inputBuffer, ext = 'jpg') {
   const tempDir = path.join(process.cwd(), 'temp')
   if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

   const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
   const inputPath = path.join(tempDir, `hd_img_in_${id}.${ext}`)
   const outputPath = path.join(tempDir, `hd_img_out_${id}.jpg`)

   try {
      fs.writeFileSync(inputPath, inputBuffer)

      // FFmpeg filterchain:
      // 1. scale 2x resolution using high-quality lanczos filter
      // 2. unsharp mask to crisp edges and fine details
      // 3. gentle contrast and saturation touch for vibrant look
      const vf = 'scale=trunc(iw*2/2)*2:trunc(ih*2/2)*2:flags=lanczos,unsharp=5:5:1.2:5:5:0.0,eq=contrast=1.05:brightness=0.01:saturation=1.08'
      const cmd = `"${FFMPEG_BIN}" -y -i "${inputPath}" -vf "${vf}" -q:v 2 "${outputPath}"`

      await execAsync(cmd, { timeout: 30000 })

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
         return fs.readFileSync(outputPath)
      }
      return null
   } catch (err) {
      console.error('[HD Local FFmpeg Error]:', err?.message || err)
      return null
   } finally {
      try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath) } catch (_) {}
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch (_) {}
   }
}

/**
 * Tries cloud AI remini enhancement with fallback uploaders (uguu, catbox, quax).
 */
async function enhanceImageCloud(inputBuffer) {
   const uploaders = [uguu, catbox, quax]
   for (const uploader of uploaders) {
      try {
         const url = await uploader(inputBuffer)
         if (!url) continue

         const data = await nexray('tools/remini', { url })
         if (Buffer.isBuffer(data) && data.length > 500) {
            return data
         }
      } catch (_) {}
   }
   return null
}

export default {
   command: 'hd',
   hidden: ['enhance', 'remini', 'jernih', 'jernihkan', 'hdimage', 'imagehd'],
   category: 'tools',
   async run(m, { sock, isPrefix }) {
      const q = m.quoted ? m.quoted : m
      const mimetype = q.msg?.mimetype || ''

      if (!isMimeImage(mimetype)) {
         return m.reply(
            `🖼️ *HD IMAGE ENHANCER*\n\n` +
            `Sila hantar atau reply gambar dengan kapsyen:\n` +
            `\`${isPrefix}hd\`\n\n` +
            `_Meningkatkan kualiti gambar ke resolusi tinggi & lebih tajam._`
         )
      }

      await m.react('🕒')

      try {
         const buffer = await q.download()
         if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
            await m.react('❌')
            return m.reply('❌ Gagal memuat turun gambar. Sila cuba lagi.')
         }

         const type = await fileTypeFromBuffer(buffer).catch(() => null)
         const ext = type?.ext || 'jpg'

         // Priority 1: Cloud AI Remini (Deep AI restoration)
         let resultBuffer = await enhanceImageCloud(buffer)

         // Priority 2: Fallback to high-performance local FFmpeg Lanczos engine
         if (!resultBuffer) {
            resultBuffer = await enhanceImageLocal(buffer, ext)
         }

         if (!resultBuffer || !Buffer.isBuffer(resultBuffer)) {
            await m.react('❌')
            return m.reply('❌ Gagal memproses gambar. Sila cuba seketika lagi.')
         }

         await sock.sendMedia(m.chat, resultBuffer, '', m)
         await m.react('✅')
      } catch (error) {
         console.error('[HD Error]:', error)
         await m.react('❌')
         m.reply('❌ ' + (error?.message || 'Ralat semasa memproses gambar.'))
      }
   },
   limit: 1
}