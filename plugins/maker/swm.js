export default {
   command: 'swm',
   hidden: ['wm', 'stickerwm', 'stickermark', 'colong'],
   category: 'maker',
   async run(m, { sock, text, isPrefix }) {
      const q = m.quoted ? m.quoted : m
      const isSticker = q.type === 'stickerMessage' || q.msg?.mimetype?.includes('webp')

      if (!isSticker) {
         return m.reply(
            `🖼️ *sᴛɪᴄᴋᴇʀ ᴡᴀᴛᴇʀᴍᴀʀᴋ*\n\n` +
            `> Reply stiker dengan caption:\n` +
            `> \`${isPrefix}swm packname\`\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${isPrefix}swm MyPack\`\n` +
            `> \`${isPrefix}swm MyPack|MyAuthor\` _(packname + author)_`
         )
      }

      const input = (text || '').trim()
      if (!input) {
         return m.reply(
            `❌ *ɢᴀɢᴀʟ*\n\n` +
            `> Sila masukkan packname.\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${isPrefix}swm MyPack\`\n` +
            `> \`${isPrefix}swm MyPack|MyAuthor\` _(+ author)_`
         )
      }

      let packname = ''
      let author = ''

      if (input.includes('|')) {
         const parts = input.split('|')
         packname = parts[0]?.trim() || ''
         author = parts[1]?.trim() || ''
      } else {
         packname = input
         author = ''
      }

      await m.react('🕕')

      try {
         const buffer = await q.download()
         if (!buffer || buffer.length === 0) {
            await m.react('❌')
            return m.reply('❌ Gagal muat turun stiker. Sila reply semula stiker tersebut.')
         }

         await sock.sendMedia(m.chat, buffer, '', m, {
            sticker: true,
            stickerPackName: packname,
            stickerPackPublisher: author
         })

         await m.react('✅')
      } catch (error) {
         console.error('[SWM Error]', error)
         await m.react('❌')
         m.reply('❌ Gagal tukar watermark stiker: ' + (error.message || 'Ralat sistem'))
      }
   },
   limit: 1
}

