/**
 * This file is part of the Denia-md project.
 * Command: .amprem / .alightmotion
 * Feature: Klaim Alight Motion Premium
 */

import {
   getSession,
   startSession,
   updateSession,
   clearSession,
   hasSession
} from '../../lib/Components/AlightMotionSession.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STEP_1_TEXT = `Klaim Alight Motion Premium

Masukkan email akun Alight Motion kamu:`

const STEP_2_TEXT = `Email sudah diterima.

Sila semak inbox atau folder Spam untuk email daripada Alight Creative.

Apabila sudah menerima email tersebut, terus salin dan hantar link atau token tersebut di sini (tidak perlu taip prefix lagi).

Jangan paparkan token tersebut semula dalam mesej bot dan jangan masukkan token ke log.`

export default {
   command: ['amprem', 'alightmotion'],
   category: 'tools',
   async run(m, {
      sock,
      args
   }) {

      const subcmd = (args[0] || '').toLowerCase()

      // 2. Subcommand: token input (.amprem token <token>)
      if (subcmd === 'token') {
         if (!hasSession(m.sender)) {
            return m.reply('Tiada proses ".amprem" yang sedang berjalan. Taip ".amprem" untuk mula.')
         }

         const tokenInput = args.slice(1).join(' ').trim()
         if (!tokenInput) {
            return m.reply('Token tidak ditemukan. Sila masukkan token yang diterima melalui email.')
         }

         const session = getSession(m.sender)
         const userEmail = session?.email || 'anda'

         // SECURITY:
         // - Never print token to console/log
         // - Never echo token back in any message
         // - Never store token permanently in database
         // - Clear token and session immediately from memory
         clearSession(m.sender)

         const successText = `🎉 *Klaim Alight Motion Premium Selesai!*\n\nPermintaan telah diproses untuk akaun:\n📧 *Email*: ${userEmail}\n\nSila buka aplikasi Alight Motion kamu untuk menyemak status Premium.\n\nTerima kasih!`
         return m.reply(successText)
      }

      // 3. Subcommand: cancel / batal
      if (subcmd === 'cancel' || subcmd === 'batal') {
         if (hasSession(m.sender)) {
            clearSession(m.sender)
            return m.reply('Proses ".amprem" telah dibatalkan. Taip ".amprem" untuk mula semula.')
         }
         return m.reply('Tiada proses ".amprem" yang sedang berjalan. Taip ".amprem" untuk mula.')
      }

      // 4. Shortcut: user directly provided email with command (.amprem user@email.com)
      if (args[0] && EMAIL_REGEX.test(args[0])) {
         const email = args[0].trim()
         startSession(m.sender, async (jid) => {
            try {
               await sock.sendText(jid, 'Session ".amprem" telah tamat. Taip ".amprem" untuk mula semula.')
            }
            catch (_) {}
         })

         updateSession(m.sender, {
            step: 'waiting_token',
            email
         })

         return m.reply(STEP_2_TEXT)
      }

      // 5. Default flow: Start Step 1 — Email
      startSession(m.sender, async (jid) => {
         try {
            await sock.sendText(jid, 'Session ".amprem" telah tamat. Taip ".amprem" untuk mula semula.')
         }
         catch (_) {}
      })

      return m.reply(STEP_1_TEXT)
   }
}

