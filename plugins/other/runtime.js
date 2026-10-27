import { cpus, freemem, platform, arch, totalmem, uptime as osUptime } from 'os'
import { SECOND } from '../../lib/Constants.js'
import { fetchThumbnail, formatSize, formatTime, greeting, toTime } from '../../lib/Utilities.js'
import { CommandIndex } from '../../lib/Watcher.js'

const toTimeMalay = (seconds) => {
   const d = Math.floor(seconds / 86400)
   const h = Math.floor((seconds % 86400) / 3600)
   const m = Math.floor((seconds % 3600) / 60)
   const s = Math.floor(seconds % 60)

   const parts = []
   if (d > 0) parts.push(`${d} hari`)
   if (h > 0) parts.push(`${h} jam`)
   if (m > 0) parts.push(`${m} minit`)
   if (s > 0 || parts.length === 0) parts.push(`${s} saat`)

   return parts.join(', ')
}

const renderProgressBar = (percentage, length = 10) => {
   const filled = Math.min(length, Math.max(0, Math.round((percentage / 100) * length)))
   const empty = length - filled
   return '█'.repeat(filled) + '░'.repeat(empty)
}

const getPingVisual = (ms) => {
   const val = parseFloat(ms)
   if (val < 60) return { icon: '🟢', text: 'Cemerlang' }
   if (val < 200) return { icon: '🟡', text: 'Stabil' }
   return { icon: '🔴', text: 'Perlahan' }
}

export default {
   command: ['runtime', 'status'],
   hidden: ['uptime', 'botruntime', 'runtimebot'],
   category: 'other',
   async run(m, { sock, setting }) {
      const start = performance.now()
      await m.react('🕒')
      const latency = (performance.now() - start).toFixed(2)

      const botUptimeSeconds = process.uptime()
      const serverUptimeSeconds = osUptime()
      const botStartTime = formatTime('YYYY/MM/DD HH:mm:ss', Date.now() - botUptimeSeconds * 1000)

      const memoryUsage = process.memoryUsage()
      const totalRam = totalmem()
      const freeRam = freemem()
      const usedRam = totalRam - freeRam
      const ramPercent = Math.min(100, Math.round((usedRam / totalRam) * 100))
      const ramBar = renderProgressBar(ramPercent, 10)

      const botRamPercent = Math.min(100, Math.round((memoryUsage.rss / totalRam) * 100))
      const botRamBar = renderProgressBar(botRamPercent, 8)

      const pingInfo = getPingVisual(latency)
      const osPlatform = platform() === 'win32' ? 'Windows' : platform() === 'linux' ? 'Linux' : platform()
      const totalCommands = CommandIndex.size
      const mode = setting?.self ? '🔒 Self' : '🌐 Public'

      const text =
         `📊 *STATUS & RUNTIME BOT* 📊\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `🟢 *Status*: *ONLINE & OPERASIONAL* [ 100% Sihat ]\n` +
         `🤖 *Nama Bot*: ${global.botName || 'Denia-MD'}\n` +
         `👑 *Owner*: ${global.ownerName || 'Kaizas'}\n\n` +
         `📈 *PENGGUNAAN SUMBER (VISUAL):*\n` +
         `  • 🧠 *RAM Pelayan*: [${ramBar}] *${ramPercent}%*\n` +
         `     └ ${formatSize(usedRam)} / ${formatSize(totalRam)}\n` +
         `  • 💾 *RAM Bot (RSS)*: [${botRamBar}] *${formatSize(memoryUsage.rss)}*\n` +
         `  • ⚡ *Respons*: ${pingInfo.icon} *${latency} ms* (${pingInfo.text})\n\n` +
         `⏱️ *TEMPOH AKTIF (UPTIME):*\n` +
         `  • ⏳ *Uptime Bot*: *${toTime(botUptimeSeconds * SECOND)}*\n` +
         `  • 📝 *Tempoh*: ${toTimeMalay(botUptimeSeconds)}\n` +
         `  • 🖥️ *Uptime Pelayan*: ${toTime(serverUptimeSeconds * SECOND)}\n` +
         `  • 📅 *Mula Aktif*: ${botStartTime}\n\n` +
         `⚙️ *SISTEM & ENJIN:*\n` +
         `  • 💻 *Sistem*: ${osPlatform} (${arch()})\n` +
         `  • 🟢 *Node.js*: ${process.version}\n` +
         `  • 📦 *Total Perintah*: ${totalCommands} arahan\n` +
         `  • 🛡️ *Mod Bot*: ${mode}\n` +
         `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
         `_Sistem beroperasi dengan lancar dan stabil._ ✨`

      try {
         await sock.sendText(m.chat, text, m, {
            description: greeting(),
            thumbnail: await fetchThumbnail(),
            largeThumbnail: true
         })
      } catch (_) {
         await m.reply(text)
      }
   }
}

