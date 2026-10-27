import { isMimeImage } from '../../lib/Utilities.js'
import { Transformer } from '@napi-rs/image'

const MAX_IMAGE_SIZE = 15 * 1024 * 1024 // Had saiz maksimum 15MB
const API_TIMEOUT_MS = 300000 // 300 saat (5 minit) - tunggu sehingga imej siap diproses sepenuhnya tanpa timeout pramatang

/**
 * Mengoptimumkan imej jika terlalu besar supaya pemprosesan AI lebih lancar & pantas
 */
async function optimizeImage(buffer, mimetype) {
   try {
      if (buffer.length <= 1024 * 1024) {
         // Gambar sudah kecil (< 1MB), gunakan terus
         return { buffer, mimetype }
      }

      const transformer = new Transformer(buffer)
      const meta = await transformer.metadata()

      // Jika resolusi melebihi 1280px, kecilkan secara berkadaran
      const maxDim = 1280
      let newWidth = meta.width
      let newHeight = meta.height

      if (meta.width > maxDim || meta.height > maxDim) {
         if (meta.width > meta.height) {
            newWidth = maxDim
            newHeight = null
         } else {
            newWidth = null
            newHeight = maxDim
         }
         transformer.resize(newWidth, newHeight)
      }

      const optimized = await transformer.jpeg(85)
      return { buffer: optimized, mimetype: 'image/jpeg' }
   } catch (e) {
      // Jika sebarang isu semasa memampatkan imej, kembali kepada buffer asal
      return { buffer, mimetype }
   }
}

export default {
   command: ['imgedit', 'imageedit', 'editimg', 'editimage'],
   category: 'ai',
   limit: 1,

   async run(m, { sock, args, text, isPrefix, command }) {
      // 1. Ekstrak mesej sasaran: sama ada mesej semasa atau mesej yang dibalas (quoted)
      const q = m.quoted ? m.quoted : m
      const mimetype = q.msg?.mimetype || ''
      const prompt = (text ? text.trim() : args.join(' ').trim())

      // 2. Pengesahan gambar dan teks arahan
      if (!isMimeImage(mimetype) || !prompt) {
         return m.reply(
            `🎨 *AI IMAGE EDIT (DENIA AI)*\n\n` +
            `Sila hantar gambar dengan kapsyen atau reply gambar dengan arahan:\n` +
            `\`${isPrefix + command} <arahan suntingan>\`\n\n` +
            `*Contoh Penggunaan:*\n` +
            `• \`${isPrefix + command} jadikan gambar ini gaya anime\`\n` +
            `• \`${isPrefix + command} tukar latar belakang kepada suasana malam cyberpunk\`\n` +
            `• \`${isPrefix + command} tingkatkan pencahayaan dan gaya sinematik\`\n` +
            `• \`${isPrefix + command} tambah salji dan suasana musim sejuk\``
         )
      }

      await m.react('🎨')

      try {
         // 3. Muat turun media daripada mesej WhatsApp
         const rawBuffer = await q.download?.()
         if (!rawBuffer || !Buffer.isBuffer(rawBuffer) || rawBuffer.length === 0) {
            await m.react('❌')
            return m.reply('❌ Gagal memuat turun gambar. Sila pastikan media masih boleh diakses dan cuba lagi.')
         }

         // 4. Semakan had saiz fail
         if (rawBuffer.length > MAX_IMAGE_SIZE) {
            await m.react('❌')
            return m.reply('❌ Saiz gambar terlalu besar. Had maksimum ialah 15MB.')
         }

         // Beritahu pengguna bahawa proses sedang berjalan
         await m.reply('⏳ Sedang menyunting gambar dengan AI... Permintaan anda sedang diproses. Sila tunggu sebentar, imej akan dihantar sebaik sahaja selesai dijana.')

         // 5. Optimumkan imej untuk muat naik yang pantas
         const { buffer, mimetype: finalMime } = await optimizeImage(rawBuffer, mimetype)
         const imageInput = `data:${finalMime};base64,${buffer.toString('base64')}`

         // 6. Panggilan ke API rasmi Prexzy AI Image Edit
         const res = await fetch('https://prexzyapis.com/ai/imageedit', {
            method: 'POST',
            signal: AbortSignal.timeout(API_TIMEOUT_MS),
            headers: {
               'Content-Type': 'application/json',
               'Accept': 'application/json',
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeniaBot/2.0'
            },
            body: JSON.stringify({
               prompt: prompt,
               image: imageInput
            })
         })

         if (!res.ok) {
            throw new Error(`Pelayan API memulangkan ralat HTTP ${res.status}`)
         }

         const data = await res.json()

         if (!data.status || !data.image_url) {
            throw new Error(data.message || data.error || 'API gagal memproses gambar atau tiada URL imej dipulangkan')
         }

         // 7. Hantar gambar hasil suntingan kembali ke chat asal
         const caption = `✅ *AI Image Edit Selesai*\n\n📝 *Arahan*: ${prompt}\n✨ _Dikuasakan oleh Denia AI_`
         await sock.sendMedia(m.chat, data.image_url, caption, m)
         await m.react('✅')

      } catch (error) {
         console.error('[IMAGE EDIT ERROR]:', error?.message || error)
         await m.react('❌')

         if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
            return m.reply('❌ Masa tamat (Timeout). Pelayan AI mengambil masa terlalu lama. Sila cuba sebentar lagi.')
         }

         return m.reply(`❌ Gagal menyunting gambar: ${error.message || 'Ralat tidak diketahui'}`)
      }
   }
}

