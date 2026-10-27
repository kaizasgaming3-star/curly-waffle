import { hostname, cpus, totalmem, freemem, platform, arch, release, uptime } from 'os'

import { SECOND } from '../../lib/Constants.js'
import { fetchThumbnail, formatNumber, formatSize, formatTime, frame, getDiskStats, greeting, toTime } from '../../lib/Utilities.js'

const getPingEmojis = (ms) => {
   if (ms < 30) return '🚀'
   if (ms < 150) return '🚗'
   if (ms < 1000) return '🚚'
   return '🐌'
}

export default {
   command: ['disk', 'ping', 'ram', 'run', 'statistic'],
   category: 'other',
   async run (m, {
      sock,
      setting,
      command
   }) {
      if (command === 'disk') {
         const diskUsage = await getDiskStats()
         m.reply('🗂️ *Disk Used*: ' + formatSize(diskUsage.used) + ' / ' + formatSize(diskUsage.total))
      }
      else if (command === 'ping') {
         const [rtt, presence] = await Promise.all([
            (async () => {
               const start = performance.now()
               await m.react('🚀')
               return (performance.now() - start).toFixed(2)
            })(),
            (async () => {
               const start = performance.now()
               await sock.sendPresenceUpdate('available', m.chat)
               return (performance.now() - start).toFixed(2)
            })()
         ])
         const latencyVal = parseFloat(rtt)
         const latencyVisual = latencyVal < 60 ? '🟢 Cemerlang' : latencyVal < 200 ? '🟡 Stabil' : '🔴 Perlahan'
         const print = frame('STATUS & PING', [
            '*Status*: 🟢 ONLINE (Operasional)',
            '*RTT*: ' + rtt + ' ms (' + latencyVisual + ')',
            '*Presence*: ' + presence + ' ms'
         ], getPingEmojis(rtt))
         m.reply(print)
      }
      else if (command === 'ram')
         m.reply('💾 *RAM Usage*: ' + formatSize(process.memoryUsage().rss) + ' / ' + formatSize(totalmem()))
      else if (command === 'run')
         m.reply('🕒 *Runtime*: ' + toTime(process.uptime() * SECOND))
      else if (command === 'statistic') {
         const printStatistic = frame('STATISTIC', [
            `*Message Sent*: ${formatNumber(setting.messageEgress)}`,
            `*Message Received*: ${formatNumber(setting.messageIngress)}`,
            `*Media Sent*: ${formatSize(setting.byteEgress)}`,
            `*Media Received*: ${formatSize(setting.byteIngress)}`
         ], '📊')
         const printSettings = frame('SETTINGS', [
            `*Mode*: ${setting.self ? '🔒 Self' : '🌐 Public'}`,
            `*AFK Notifier*: ${setting.afkNotifier ? '✅' : '❌'}`,
            `*Auto Download*: ${setting.autoDownload ? '✅' : '❌'}`,
            `*Chat Bot*: ${setting.chatBot ? '✅' : '❌'}`,
            `*Command Suggestions*: ${setting.commandSuggestions ? '✅' : '❌'}`,
            `*Group Only*: ${setting.groupOnly ? '✅' : '❌'}`,
            `*Menu Music*: ${setting.menuMusic ? '✅' : '❌'}`,
            `*No Prefix*: ${setting.noPrefix ? '✅' : '❌'}`,
            `*Notifier*: ${setting.notifier ? '✅' : '❌'}`,
            `*React Status*: ${setting.reactStatus ? '✅' : '❌'}`,
            `*Read Message*: ${setting.readMessage ? '✅' : '❌'}`,
            `*Reject Call*: ${setting.rejectCall ? '✅' : '❌'}`,
            `*Secure Label*: ${setting.secureLabel ? '✅' : '❌'}`,
            `*Slow Mode*: ${setting.slowMode ? '✅' : '❌'}`,
            `*Typing Presence*: ${setting.typingPresence ? '✅' : '❌'}`,
            `*Prefixes*: [${setting.prefixes}]`,
            `*Last Reset*: ${formatTime('YYYY/MM/DD HH:mm:ss', setting.lastReset)}`
         ], '⚙️')
         m.reply(
            printStatistic +
            '\n\n' + printSettings
         , {
            title: botName,
            description: greeting(),
            thumbnail: await fetchThumbnail(),
            largeThumbnail: true
         })
      }
   }
}