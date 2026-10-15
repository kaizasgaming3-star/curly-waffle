/**
 * PAPTT Plugin — menggunakan kyzznekoo.zone.id
 * Dikonversi ke format DENIA-MD oleh Antigravity.
 */

import { request } from '../../lib/Request.js'

export default {
   command: ['paptt'],
   category: 'nsfw',
   async run(m, { sock, group, isPrefix }) {
      // Cek izin grup
      if (m.isGroup && !group?.nsfw) {
         return m.reply(
            `🔒 *FITUR NSFW BELUM AKTIF*\n\n` +
            `Minta admin untuk mengetik *${isPrefix}nsfwon* terlebih dahulu.\n` +
            `Atau gunakan di *chat pribadi* bot.`
         )
      }

      m.react('🕒')
      try {
         const buffer = await request('https://kyzznekoo.zone.id/api/asupan/paptt', {
            headers: {
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
               'Content-Type': 'application/json'
            }
         })
         if (!Buffer.isBuffer(buffer)) throw new Error('Data bukan gambar')
         await sock.sendMessage(m.chat, {
            image: buffer,
            caption: `🍑 *PAPTT*\n\n🔞 Konten ini hanya untuk 18+ — Gunakan dengan bijak`
         }, { quoted: m })
         m.react('✅')
      } catch (error) {
         console.error('[PAPTT Error]', error)
         m.react('❌')
         m.reply(`❌ Gagal mengambil gambar. Coba lagi.`)
      }
   }
}
