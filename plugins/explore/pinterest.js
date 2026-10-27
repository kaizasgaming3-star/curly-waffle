import { nexray, nekolabs } from '../../lib/Request.js'
import { shuffleArray } from '../../lib/Utilities.js'

/**
 * Mencari imej Pinterest daripada API Rasmi Prexzy
 */
async function searchPinterestPrexzy(query) {
   const url = `https://prexzyapis.com/search/pinterest?q=${encodeURIComponent(query)}`
   const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeniaBot/2.0',
         'Accept': 'application/json'
      }
   })

   if (!res.ok) {
      throw new Error(`Prexzy API memulangkan status ${res.status}`)
   }

   const json = await res.json()
   if (!json.status || !Array.isArray(json.data) || json.data.length === 0) {
      return []
   }

   return json.data.filter(item => typeof item === 'string' && item.startsWith('http'))
}

/**
 * Sandaran mencari imej Pinterest menggunakan Nexray
 */
async function searchPinterestNexray(query) {
   const data = await nexray('search/pinterest', { q: query })
   if (!data?.status || !Array.isArray(data.result)) return []
   return data.result
      .map(item => item.images_url || item.videos_url)
      .filter(url => typeof url === 'string' && url.startsWith('http'))
}

export default {
   command: ['pin', 'pinterest', 'pinimg', 'pinsearch'],
   category: 'explore',
   limit: 1,

   async run(m, { sock, isPrefix, command, text, args }) {
      try {
         const input = (text || args?.join(' ') || '').trim()

         if (!input) {
            return m.reply(
               `📌 *PINTEREST SEARCH & DOWNLOADER*\n\n` +
               `Cari gambar berkualiti tinggi dari Pinterest terus ke dalam album WhatsApp, atau muat turun pautan Pin!\n\n` +
               `👉🏻 *Cara Penggunaan*:\n` +
               `• \`${isPrefix + command} <kata kunci>\`\n` +
               `• \`${isPrefix + command} <kata kunci> <jumlah 1-15>\`\n` +
               `• \`${isPrefix + command} <pautan pin.it>\`\n\n` +
               `*Contoh*:\n` +
               `• \`${isPrefix + command} Furina\`\n` +
               `• \`${isPrefix + command} Anime Aesthetic 10\`\n` +
               `• \`${isPrefix + command} Cyberpunk Wallpaper 5\``
            )
         }

         // A. Jika input ialah pautan Pinterest (URL downloader)
         if (input.includes('pin.it') || input.includes('pinterest.com/pin/')) {
            await m.react('🕒')
            const data = await nekolabs('downloader/pinterest', { url: input })
            if (!data?.success || !data?.result?.medias?.length) {
               await m.react('❌')
               return m.reply('❌ Gagal memuat turun media dari pautan Pinterest tersebut.')
            }
            const mediaUrl = data.result.medias.at(-1).url
            await sock.sendMedia(m.chat, mediaUrl, '📌 *Pinterest Downloader*', m)
            return await m.react('✅')
         }

         // B. Carian Imej Pinterest (Prexzy API)
         let requestedCount = 5
         const queryWords = [...(args || input.split(/\s+/))]
         const lastWord = queryWords[queryWords.length - 1]

         if (/^\d+$/.test(lastWord)) {
            const num = parseInt(lastWord, 10)
            if (num >= 1 && num <= 15) {
               requestedCount = num
               queryWords.pop()
            }
         }

         const query = queryWords.join(' ').trim() || input
         if (!query) {
            return m.reply(`❌ Sila masukkan kata kunci carian. Contoh: \`${isPrefix + command} Furina\``)
         }

         await m.react('📌')

         // 1. Dapatkan hasil daripada Prexzy API
         let results = []
         try {
            results = await searchPinterestPrexzy(query)
         } catch (err) {
            console.warn('[Pinterest Prexzy Warn]:', err.message)
         }

         // 2. Sandaran Nexray jika Prexzy tiada hasil
         if (!results || results.length === 0) {
            try {
               results = await searchPinterestNexray(query)
            } catch (err) {
               console.warn('[Pinterest Nexray Warn]:', err.message)
            }
         }

         if (!results || results.length === 0) {
            await m.react('❌')
            return m.reply(`❌ Tiada gambar dijumpai di Pinterest untuk: *${query}*`)
         }

         // Rawakkan dan pilih jumlah yang diminta
         const selectedImages = shuffleArray([...results]).slice(0, requestedCount)

         // Jika hanya 1 gambar
         if (selectedImages.length === 1) {
            const caption = `📌 *Pinterest*: ${query}\n✨ _Dikuasakan oleh Prexzy & Denia-MD_`
            await sock.sendMedia(m.chat, selectedImages[0], caption, m)
            return await m.react('✅')
         }

         // Jika album (> 1 gambar)
         await m.reply(
            `📌 *PINTEREST SEARCH*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🔎 *Carian*: ${query}\n` +
            `🖼️ *Jumlah*: ${selectedImages.length} imej\n` +
            `⏳ _Menghantar album gambar..._`
         )

         await sock.sendMessage(m.chat, {
            album: selectedImages.map(url => ({
               image: { url }
            }))
         }, {
            quoted: m
         })

         await m.react('✅')

      } catch (error) {
         console.error('[Pinterest Error]:', error)
         await m.react('❌')
         m.reply(`❌ Ralat mendapatkan imej Pinterest: ${error.message || 'Sila cuba lagi.'}`)
      }
   }
}
