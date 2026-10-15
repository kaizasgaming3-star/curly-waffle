/**
 * MyWaifu Plugin — Mengambil 10 gambar anime Waifu (SFW / NSFW) dari API Waifu.im
 * Diadaptasi untuk DENIA-MD oleh Antigravity.
 */

import { request } from '../../lib/Request.js'
import { frame } from '../../lib/Utilities.js'

export default {
   command: ['mywaifu', 'waifuim'],
   category: 'anime',
   async run(m, { sock, group, isPrefix, command, args }) {
      const mode = (args[0] || '').toLowerCase()

      // Tampilkan panduan jika mode bukan sfw atau nsfw
      if (mode !== 'sfw' && mode !== 'nsfw') {
         return m.reply(
            `🌸 *PENCARI WAIFU (Waifu.im)* 🌸\n\n` +
            `Fitur ini akan mengirimkan *20 gambar waifu acak* langsung dari Waifu.im ke dalam satu album!\n\n` +
            `*Cara Penggunaan:*\n` +
            `• \`${isPrefix + command} sfw\` — 20 gambar waifu yang aman (semua umur)\n` +
            `• \`${isPrefix + command} nsfw\` — 20 gambar waifu versi dewasa (18+)\n\n` +
            `👉🏻 *Contoh*: \`${isPrefix + command} sfw\``
         )
      }

      const isNsfw = mode === 'nsfw'

      // Proteksi untuk mode NSFW di dalam grup
      if (isNsfw && m.isGroup && !group?.nsfw) {
         return m.reply(
            `🔒 *FITUR NSFW BELUM AKTIF DI GRUP INI*\n\n` +
            `Minta admin grup untuk mengaktifkannya terlebih dahulu dengan mengetik:\n` +
            `*${isPrefix}nsfwon*\n\n` +
            `Atau kamu bisa menggunakan perintah ini di *chat pribadi* bot.`
         )
      }

      m.react('🕒')

      try {
         const pageSize = 20
         const apiUrl = `https://api.waifu.im/images?isNsfw=${isNsfw}&orderBy=Random&page=1&pageSize=${pageSize}`
         const json = await request(apiUrl)

         if (!json?.items || json.items.length === 0) {
            m.react('❌')
            return m.reply(`❌ Tidak ditemukan gambar untuk mode *${mode.toUpperCase()}*. Silakan coba lagi.`)
         }

         const imageUrls = json.items.map(item => item.url)

         const caption = frame(isNsfw ? '🔞 KOLEKSI WAIFU NSFW' : '🌸 KOLEKSI WAIFU SFW', [
            `*Jumlah*: ${imageUrls.length} gambar`,
            `*Kategori*: ${mode.toUpperCase()}`,
            isNsfw ? `⚠️ *Perhatian*: Konten ini hanya untuk 18+` : `✨ Menampilkan ${imageUrls.length} waifu spesial untukmu!`
         ], isNsfw ? '🔞' : '🌸')

         await m.reply(caption.trim())

         await sock.sendMessage(m.chat, {
            album: imageUrls.map(url => ({
               image: { url }
            }))
         }, {
            quoted: m
         })

         m.react('✅')
      }
      catch (error) {
         console.error('[MyWaifu Error]', error)
         m.react('❌')
         m.reply(`❌ Gagal mengambil gambar dari Waifu.im: ${error.message}`)
      }
   }
}
