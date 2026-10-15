import { request } from '../../lib/Request.js'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

export default {
   command: ['text2mp4', 't2mp4', 'txt2mp4'],
   category: 'maker',
   async run(m, {
      sock,
      isPrefix,
      command,
      text
   }) {
      try {
         const q = m.quoted ? m.quoted : m
         let rawInput = (text || '').trim()

         if (!rawInput && m.quoted) {
            rawInput = (q.body || q.text || '').trim()
         }

         if (!rawInput) {
            return m.reply(
               `🎬 *Text to MP4 Animation Maker*\n\n` +
               `Cipta video animasi teks bergerak.\n\n` +
               `*Cara Penggunaan:*\n` +
               `> \`${isPrefix + command} <teks>\`\n` +
               `> \`${isPrefix + command} <teks> | <background> | <color>\`\n\n` +
               `*Contoh:*\n` +
               `> \`${isPrefix + command} Hello World\`\n` +
               `> \`${isPrefix + command} Denia AI Cantik | black | white\`\n` +
               `> \`${isPrefix + command} Kaizas & Denia | darkblue | yellow\``
            )
         }

         if (rawInput.length > 200) {
            return m.reply('❌ Panjang teks maksimum ialah 200 aksara.')
         }

         await m.react('🕒')

         let promptText = rawInput
         let background = 'black'
         let color = 'white'

         if (rawInput.includes('|')) {
            const parts = rawInput.split('|').map(p => p.trim())
            promptText = parts[0] || 'Hello'
            if (parts[1]) background = parts[1]
            if (parts[2]) color = parts[2]
         }

         const payload = {
            text: promptText,
            background,
            color
         }

         const resBuffer = await request('https://prexzyapis.com/imagecreator/mp4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
         })

         if (!Buffer.isBuffer(resBuffer) || resBuffer.length === 0) {
            await m.react('❌')
            return m.reply('❌ Gagal menghasilkan video teks dari server. Sila cuba lagi sebentar nanti.')
         }

         const tempDir = path.resolve('temp')
         if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

         const timestamp = Date.now() + '_' + Math.floor(Math.random() * 10000)
         const inputPath = path.join(tempDir, `t2mp4_in_${timestamp}.webp`)
         const outputPath = path.join(tempDir, `t2mp4_out_${timestamp}.mp4`)

         fs.writeFileSync(inputPath, resBuffer)

         let videoBuffer = null
         try {
            await execAsync(`ffmpeg -y -i "${inputPath}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${outputPath}"`)
            if (fs.existsSync(outputPath)) {
               videoBuffer = fs.readFileSync(outputPath)
            }
         } catch (ffmpegErr) {
            console.warn('[Text2MP4] FFmpeg conversion failed, falling back to direct buffer:', ffmpegErr?.message)
         } finally {
            try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath) } catch (_) {}
            try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch (_) {}
         }

         const caption = `🎬 *Text to MP4 Animation*\n\n📝 *Teks*: ${promptText}\n🎨 *Warna*: ${color} | *Latar*: ${background}`

         if (videoBuffer && videoBuffer.length > 0) {
            await sock.sendMedia(m.chat, videoBuffer, caption, m)
         } else {
            await sock.sendMedia(m.chat, resBuffer, caption, m)
         }

         await m.react('✅')
      } catch (error) {
         console.error('[Text2MP4 Error]:', error)
         await m.react('❌')
         m.reply('❌ Gagal memproses: ' + (error.message || 'Ralat server'))
      }
   },
   limit: 1
}
