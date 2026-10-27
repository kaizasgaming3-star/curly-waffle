import { hostname, cpus, totalmem, freemem, platform, arch, release, uptime as osUptime } from 'os'
import { SECOND } from '../../lib/Constants.js'
import { fetchThumbnail, formatSize, frame, getDiskStats, greeting, toTime } from '../../lib/Utilities.js'

/**
 * Menjana bar kemajuan visual teks
 */
const renderProgressBar = (percentage, length = 10) => {
   const safePercent = Math.min(100, Math.max(0, isNaN(percentage) ? 0 : Math.round(percentage)))
   const filled = Math.min(length, Math.max(0, Math.round((safePercent / 100) * length)))
   const empty = length - filled
   return '█'.repeat(filled) + '░'.repeat(empty)
}

/**
 * Menukar saat kepada format Melayu (hari, jam, minit, saat)
 */
const toTimeMalay = (seconds) => {
   const d = Math.floor(seconds / 86400)
   const h = Math.floor((seconds % 86400) / 3600)
   const m = Math.floor((seconds % 3600) / 60)
   const s = Math.floor(seconds % 60)

   const parts = []
   if (d > 0) parts.push(`${d}h`)
   if (h > 0) parts.push(`${h}j`)
   if (m > 0) parts.push(`${m}m`)
   if (s > 0 || parts.length === 0) parts.push(`${s}s`)

   return parts.join(' ')
}

/**
 * Menentukan nama mesra sistem operasi
 */
const getPrettyOS = () => {
   const osType = platform()
   if (osType === 'win32') return `Windows (${release()})`
   if (osType === 'android') return `Android / Termux`
   if (osType === 'linux') return `Linux (${release().split('-')[0]})`
   if (osType === 'darwin') return `macOS (${release()})`
   return `${osType} (${release()})`
}

export default {
   command: ['server', 'serverinfo', 'vps', 'hostinfo'],
   category: 'other',

   async run(m, { sock }) {
      const start = performance.now()
      await m.react('🖥️').catch(() => {})
      const latency = (performance.now() - start).toFixed(2)

      const cpuList = cpus() || []
      const cpuInfo = cpuList[0] || {}
      const cpuSpeed = cpuInfo.speed ? `${(cpuInfo.speed / 1000).toFixed(2)} GHz` : 'N/A'
      const cpuCount = cpuList.length || 1
      const cpuModel = (cpuInfo.model || 'Unknown CPU').trim()

      const totalMemory = totalmem()
      const freeMemory = freemem()
      const usedMemory = totalMemory - freeMemory
      const ramPercent = Math.min(100, Math.round((usedMemory / totalMemory) * 100))
      const ramBar = renderProgressBar(ramPercent, 8)

      const diskUsage = await getDiskStats()
      const diskPercent = diskUsage.total > 0 ? Math.min(100, Math.round((diskUsage.used / diskUsage.total) * 100)) : 0
      const diskBar = renderProgressBar(diskPercent, 8)

      const memoryUsage = process.memoryUsage()
      const serverUptimeSec = osUptime()
      const botUptimeSec = process.uptime()

      const printHost = frame('HOS & SISTEM OPERASI', [
         `*Hos*: ${hostname()}`,
         `*OS*: ${getPrettyOS()}`,
         `*Seni Bina*: ${arch()}`,
         `*Kelajuan Respons*: ${latency} ms`,
         `*Masa Aktif Hos*: ${toTimeMalay(serverUptimeSec)} (${toTime(serverUptimeSec * SECOND)})`
      ], '🌐')

      const printHardware = frame('PERKAKASAN & SUMBER', [
         `*Model CPU*: ${cpuModel}`,
         `*Teras CPU*: ${cpuCount} Core(s) @ ${cpuSpeed}`,
         `*RAM Pelayan*: [${ramBar}] *${ramPercent}%*`,
         `  └ Digunakan: ${formatSize(usedMemory)} / ${formatSize(totalMemory)}`,
         `  └ Baki Bebas: ${formatSize(freeMemory)}`,
         `*Storan Cakera*: [${diskBar}] *${diskPercent}%*`,
         `  └ Digunakan: ${formatSize(diskUsage.used)} / ${formatSize(diskUsage.total)}`
      ], '⚙️')

      const printProcess = frame('PROSES BOT (DENIA-MD)', [
         `*Enjin Node.js*: ${process.version}`,
         `*Enjin V8*: ${process.versions.v8}`,
         `*Masa Aktif Bot*: ${toTimeMalay(botUptimeSec)} (${toTime(botUptimeSec * SECOND)})`,
         `*Heap Memori*: ${formatSize(memoryUsage.heapUsed)} / ${formatSize(memoryUsage.heapTotal)}`,
         `*RSS Memori*: ${formatSize(memoryUsage.rss)}`
      ], '🤖')

      const fullText = `${printHost}\n\n${printHardware}\n\n${printProcess}\n\n*Denia-MD Server Status Monitor • 2026*`

      try {
         await sock.sendText(m.chat, fullText, m, {
            description: greeting(),
            thumbnail: await fetchThumbnail(),
            largeThumbnail: true
         })
      } catch (_) {
         await m.reply(fullText)
      }
   }
}
