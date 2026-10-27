import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { isMimeVideo } from '../../lib/Utilities.js'

const execAsync = promisify(exec)

export default {
   command: 'hdvid',
   hidden: ['enhancevid', 'hdvideo', 'videohd'],
   category: 'tools',
   async run(m, { sock, isPrefix }) {
      const q = m.quoted ? m.quoted : m
      const mimetype = q.msg?.mimetype || ''

      if (!isMimeVideo(mimetype)) {
         return m.reply(
            `🎬 *HD VIDEO ENHANCER*\n\n` +
            `Sila hantar atau reply video yang ingin dinaikkan kualitinya ke HD dengan caption:\n` +
            `\`${isPrefix}hdvid\`\n\n` +
            `_Maksimum durasi video: 60 saat._`
         )
      }

      await m.react('⏳')
      await m.reply('⏳ Sedang memproses dan meningkatkan kualiti video ke HD... Sila tunggu sebentar.')

      const tempDir = path.join(process.cwd(), 'temp')
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

      const inputPath = path.join(tempDir, `hdvid_in_${Date.now()}.mp4`)
      const outputPath = path.join(tempDir, `hdvid_out_${Date.now()}.mp4`)

      try {
         const buffer = await q.download()
         if (!buffer || buffer.length === 0) {
            await m.react('❌')
            return m.reply('❌ Gagal memuat turun video. Sila cuba lagi.')
         }

         fs.writeFileSync(inputPath, buffer)

         // Check video duration with ffprobe
         try {
            const { stdout } = await execAsync(
               `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
            )
            const duration = parseFloat(stdout.trim())
            if (duration > 60) {
               await m.react('⚠️')
               return m.reply(`⚠️ Video terlalu panjang (${duration.toFixed(1)}s). Had maksimum ialah 60 saat untuk pemprosesan pantas.`)
            }
         } catch (_) {}

         // FFmpeg HD enhancement pipeline:
         // 1. Denoise with hqdn3d
         // 2. High-quality upscale with Lanczos filter
         // 3. Unsharp mask for crisp sharpness
         // 4. Color & contrast optimization
         const filter = 'hqdn3d=1.5:1.5:4:4,scale=trunc(iw*1.5/2)*2:trunc(ih*1.5/2)*2:flags=lanczos,unsharp=5:5:1.2:5:5:0.0,eq=contrast=1.06:brightness=0.01:saturation=1.10'

         await execAsync(
            `ffmpeg -y -i "${inputPath}" -vf "${filter}" -c:v libx264 -pix_fmt yuv420p -preset faster -crf 20 -c:a copy "${outputPath}"`
         )

         if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new Error('Gagal menghasilkan fail video HD.')
         }

         const caption =
            `✨ *HD VIDEO BERJAYA DIPROSES* ✨\n\n` +
            `> 🎬 *Format*: MP4 (High Definition)\n` +
            `> 🔍 *Peningkatan*: Penajaman Kontras, Pengurangan Noise & Skala Resolusi Lanczos\n\n` +
            `_Kualiti video telah dipertingkatkan._ 🌸`

         await sock.sendMedia(m.chat, outputPath, caption, m)
         await m.react('✅')
      } catch (error) {
         console.error('[HDVID Error]:', error)
         await m.react('❌')
         m.reply(`❌ Ralat semasa meningkatkan kualiti video: ${error?.message || 'Ralat tidak diketahui'}`)
      } finally {
         try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
         } catch (_) {}
      }
   },
   limit: 1
}