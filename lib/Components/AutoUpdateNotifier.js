import { delay } from '@sairidev/baileys-new'
import { fetchThumbnail } from '../Utilities.js'
import { getUpdateMessage } from '../../plugins/other/info-update.js'

let hasBroadcastedOnThisBoot = false

export const broadcastUpdateToGroups = async (sock, db) => {
   if (hasBroadcastedOnThisBoot) return
   hasBroadcastedOnThisBoot = true

   const setting = db?.getSetting ? db.getSetting() : {}
   if (setting.autoUpdateBroadcast === false) {
      return
   }

   // Tunggu 10 saat selepas bot online agar sambungan WhatsApp stabil sepenuhnya
   await delay(10000)

   try {
      // 1. Ambil senarai semua group dari WhatsApp & database
      const participating = await sock.groupFetchAllParticipating().catch(() => ({}))
      const groupJids = new Set([
         ...Object.keys(participating || {}),
         ...(db?.groups ? Array.from(db.groups.keys()) : [])
      ])

      const validGroups = Array.from(groupJids).filter(
         jid => typeof jid === 'string' && jid.endsWith('@g.us')
      )

      if (validGroups.length === 0) return

      const updateText = getUpdateMessage()
      let thumbnail = null
      try {
         thumbnail = await fetchThumbnail()
      } catch (_) {}

      for (const groupJid of validGroups) {
         try {
            // Kaedah 1: Hantar teks bersama rich thumbnail preview
            if (thumbnail) {
               await sock.sendText(groupJid, updateText, null, {
                  thumbnail,
                  description: 'Info Update Terbaharu Bot',
                  largeThumbnail: true
               })
            } else {
               // Kaedah 2: Hantar teks biasa jika tiada thumbnail
               await sock.sendMessage(groupJid, { text: updateText })
            }
         } catch (err) {
            // Fallback: Jika gagal dengan thumbnail preview, cuba hantar teks biasa
            try {
               await sock.sendMessage(groupJid, { text: updateText })
            } catch (_) {}
         }

         // Jeda 2 minit (120 saat) antara setiap group untuk mengelakkan bot dikesan spam
         await delay(120000)
      }
   } catch (_) {}
}
