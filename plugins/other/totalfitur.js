import { CATEGORY_EMOJIS, FAKE_QUOTE } from '../../lib/Constants.js'
import { fetchThumbnail, frame, greeting, toArray, toTitleCase } from '../../lib/Utilities.js'
import { CommandIndex, EventIndex, ModuleCache } from '../../lib/Watcher.js'

export default {
   command: 'totalfitur',
   hidden: ['totalfeature', 'fitur', 'totalcmd', 'statfitur'],
   category: 'other',
   async run(m, { sock, isPrefix }) {
      await m.react('📊')

      const grouped = Object.create(null)
      const uniqueCommands = new Set()
      const allAliases = new Set()

      for (const mod of ModuleCache.values()) {
         const { command, hidden, category } = mod
         const cat = category || 'other'

         if (command) {
            for (const cmd of toArray(command)) {
               uniqueCommands.add(cmd)
               ;(grouped[cat] ??= []).push(cmd)
            }
         }

         if (hidden) {
            for (const h of toArray(hidden)) {
               allAliases.add(h)
            }
         }
      }

      const totalPlugins = ModuleCache.size
      const totalMainCmds = uniqueCommands.size
      const totalIndexed = CommandIndex.size
      const totalEvents = EventIndex.size
      const categories = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length)

      let categoryList = ''
      for (const cat of categories) {
         const emoji = CATEGORY_EMOJIS[cat] ?? '📁'
         const count = grouped[cat].length
         categoryList += `  │ ${emoji} *${toTitleCase(cat)}* : ${count} fitur\n`
      }

      const senderTag = '@' + m.sender.split('@')[0]
      const text =
         `📊 *STATISTIK TOTAL FITUR BOT*\n\n` +
         `Hai ${senderTag}, berikut adalah ringkasan keseluruhan fitur yang aktif pada bot:\n\n` +
         `📁 *Statistik Mengikut Kategori:*\n` +
         `  ╭──────────────────────────\n` +
         categoryList +
         `  ╰──────────────────────────\n\n` +
         `📈 *Ringkasan Sistem:*\n` +
         `  • 📂 Jumlah Kategori : *${categories.length}* kategori\n` +
         `  • 📄 Jumlah Fail Plugin : *${totalPlugins}* fail\n` +
         `  • 🏷️ Arahan Utama : *${totalMainCmds}* command\n` +
         `  • 🔗 Jumlah Semua Arahan : *${totalIndexed}* (termasuk alias)\n` +
         `  • ⚡ Event Listener : *${totalEvents}* aktif\n\n` +
         `💡 *Info:* Gunakan \`${isPrefix}menu\` atau \`${isPrefix}allmenu\` untuk melihat senarai penuh arahan.`

      try {
         await sock.sendText(m.chat, text, m, {
            description: 'Statistik Fitur Bot',
            thumbnail: await fetchThumbnail(),
            largeThumbnail: true
         })
      } catch (_) {
         await m.reply(text)
      }
   }
}

