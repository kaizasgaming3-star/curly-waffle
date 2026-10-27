import { delay, isPnUser } from '@sairidev/baileys-new'

import { FAKE_QUOTE } from '../../lib/Constants.js'
import { fetchAsBuffer, frame, greeting, isMimeWebP, randomHex } from '../../lib/Utilities.js'

const DEFAULT_BROADCAST_COOLDOWN = 10000
const MAX_BROADCAST_LENGTH = 4096

// Concurrency Mutex Lock: menghalang panggilan serentak bagi mengelakkan mesej berganda
let isBroadcasting = false

// Senarai arahan yang sah untuk mengelakkan kekeliruan (cth: !broadcastspam)
const VALID_COMMANDS = new Set([
   'broadcast',
   'broadcastgc',
   'broadcastgcsw',
   'bc',
   'bcgc',
   'bcgcsw',
   'jpm'
])

/**
 * Normalisasi JID untuk memastikan format domain dan ketiadaan device suffix
 */
function sanitizeJid(jid) {
   if (!jid || typeof jid !== 'string') return null
   const trimmed = jid.trim()
   if (!trimmed.includes('@')) return null
   const [userAndDev, domain] = trimmed.split('@')
   const user = userAndDev.split(':')[0].replace(/[^0-9a-zA-Z._-]/g, '')
   const server = domain.toLowerCase()
   if (!user || !server) return null
   return `${user}@${server}`
}

export default {
   command: ['broadcast', 'broadcastgc', 'broadcastgcsw'],
   hidden: ['bc', 'bcgc', 'bcgcsw', 'jpm'],
   category: 'owner',
   owner: true,

   async run(m, {
      db,
      store,
      setting,
      sock,
      command,
      text,
      isPrefix
   }) {
      // 1. Pengesahan Arahan Ketat (Strict Command Match)
      if (!VALID_COMMANDS.has(command)) return

      // 2. Kunci Keselamatan Serentak (Concurrency Mutex)
      if (isBroadcasting) {
         return m.reply('⚠️ Satu proses broadcast sedang berjalan. Sila tunggu sehingga selesai sebelum memulakan sesi baharu untuk mengelakkan mesej berganda dan sekatan WhatsApp.')
      }

      isBroadcasting = true

      try {
         const q = m.quoted ? m.quoted : m
         const mimetype = q.msg?.mimetype
         const rawBody = text ?? q?.body
         const body = (typeof rawBody === 'string' ? rawBody : '').trim()

         // 3. Pengesahan Mesej Kosong atau Ruang Putih Sahaja
         if (!body || body.length === 0) {
            return m.reply(`👉🏻 *Contoh*: \`${(isPrefix || '.') + command} Makluman terkini bot!\``)
         }

         // 4. Had Panjang Mesej Maksimum
         if (body.length > MAX_BROADCAST_LENGTH) {
            return m.reply(`⚠️ Mesej broadcast terlalu panjang (Maksimum ${MAX_BROADCAST_LENGTH} aksara). Jumlah semasa: ${body.length} aksara.`)
         }

         await m.react('🕒')

         const isPrivate = command === 'broadcast' || command === 'bc' || command === 'jpm'
         const isGroup = command === 'broadcastgc' || command === 'bcgc'
         const isGroupStatus = command === 'broadcastgcsw' || command === 'bcgcsw'

         const bufferMedia = await q.download?.().catch(() => null)
         const printBody = isGroupStatus ? body : frame('BROADCAST', body.split(/\r?\n/), '📣')

         // 5. Penapisan & Pengesahan Senarai Penerima Yang Sah
         const rawIds = new Set()
         const botJidClean = sanitizeJid(sock.user?.decodedId || sock.user?.id)

         if (isPrivate) {
            // Penerima Chat Peribadi (@s.whatsapp.net sahaja)
            if (db?.users?.keys) {
               for (const userId of db.users.keys()) {
                  const clean = sanitizeJid(userId)
                  if (clean && clean.endsWith('@s.whatsapp.net') && clean !== botJidClean) {
                     rawIds.add(clean)
                  }
               }
            }

            if (store?.groupMetadata?.values) {
               for (const group of store.groupMetadata.values()) {
                  const participants = group?.participants || []
                  for (let i = 0; i < participants.length; i++) {
                     const p = participants[i]
                     const candidateJid = p.id || p.jid || (p.phoneNumber ? `${p.phoneNumber}@s.whatsapp.net` : null)
                     const clean = sanitizeJid(candidateJid)
                     if (clean && clean.endsWith('@s.whatsapp.net') && clean !== botJidClean) {
                        rawIds.add(clean)
                     }
                  }
               }
            }
         } else if (isGroup || isGroupStatus) {
            // Penerima Kumpulan (@g.us sahaja)
            if (store?.groupMetadata?.keys) {
               for (const id of store.groupMetadata.keys()) {
                  const clean = sanitizeJid(id)
                  if (clean && clean.endsWith('@g.us')) {
                     rawIds.add(clean)
                  }
               }
            }
         } else {
            if (botJidClean) rawIds.add(botJidClean)
         }

         const ids = Array.from(rawIds)

         if (ids.length === 0) {
            return m.reply('⚠️ Tiada penerima yang sah ditemui untuk disiarkan.')
         }

         const broadcastCooldown =
            typeof setting?.broadcastCooldown === 'number'
               ? setting.broadcastCooldown
               : DEFAULT_BROADCAST_COOLDOWN

         let thumbnailBuffer = null
         try {
            thumbnailBuffer = await fetchAsBuffer('./media/Image/broadcast.jpg')
         } catch (_) {}

         const displayName = global.botName || 'Denia'
         let successCount = 0
         let failCount = 0

         // 6. Penghantaran Berjeda Dengan Pengendalian Ralat Terasing
         for (const id of ids) {
            try {
               if (bufferMedia) {
                  await sock.sendMedia(id, bufferMedia, printBody, FAKE_QUOTE, {
                     sticker: isMimeWebP(mimetype),
                     groupStatus: isGroupStatus,
                     mentionAll: true,
                     contextInfo: {
                        isForwarded: true,
                        forwardingScore: 999
                     }
                  })
               } else {
                  await sock.sendText(id, printBody, FAKE_QUOTE, {
                     groupStatus: isGroupStatus,
                     mentionAll: true,
                     contextInfo: {
                        isForwarded: true,
                        forwardingScore: 999
                     },
                     title: displayName,
                     description: greeting(),
                     ...(thumbnailBuffer ? { thumbnail: thumbnailBuffer, height: 340, largeThumbnail: true } : {})
                  }, {
                     backgroundColor: randomHex()
                  })
               }
               successCount++
            } catch (sendErr) {
               failCount++
               // Ralat penghantaran terasing, proses diteruskan untuk penerima seterusnya
            }

            if (broadcastCooldown > 0) {
               await delay(broadcastCooldown)
            }
         }

         // 7. Laporan Metrik Akhir
         return m.reply(`✅ Berjaya menghantar broadcast kepada ${successCount}/${ids.length} chat.${failCount > 0 ? ` (Gagal: ${failCount})` : ''}`)
      } catch (error) {
         console.error('[BROADCAST RUNTIME ERROR]:', error?.message || error)
         return m.reply(`❌ Ralat semasa broadcast: ${error?.message || 'Ralat tidak diketahui'}`)
      } finally {
         // Lepaskan Kunci Concurrency
         isBroadcasting = false
      }
   }
}
