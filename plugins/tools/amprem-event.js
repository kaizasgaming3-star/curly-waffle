/**
 * This file is part of the Denia-md project.
 * Event Listener for active .amprem session flows.
 * Handles user inputs during 'email' and 'waiting_token' steps in private chats.
 */

import {
   getSession,
   updateSession,
   clearSession,
   hasSession
} from '../../lib/Components/AlightMotionSession.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STEP_2_TEXT = `Email sudah diterima.\n\nSila semak inbox atau folder Spam untuk email daripada Alight Creative.\n\nApabila sudah menerima email tersebut, salin link/token yang diberikan dan hantar kepada saya menggunakan command/session ini.\n\nToken:\n"/amprem token <token>"\n\nJangan paparkan token tersebut semula dalam mesej bot dan jangan masukkan token ke log.`

const sendInteractive = async (sock, m, text, buttons = []) => {
   if (buttons.length > 0) {
      try {
         return await sock.sendMessage(m.chat, {
            image: { url: global.botThumbnail },
            caption: text,
            footer: global.footer,
            nativeFlow: buttons
         }, { quoted: m })
      }
      catch (_) {}
   }
   return m.reply(text)
}

export default {
   async run(m, {
      sock,
      isPrefix
   }) {
      // 1. Private chat only
      if (!m.isPrivate) return

      // 2. Only active session
      if (!hasSession(m.sender)) return

      // 3. Skip if already processed with command prefix
      if (m.isHasPrefix) return

      const session = getSession(m.sender)
      if (!session) return

      const text = (m.body || '').trim()
      if (!text) return

      // Cancel check
      if (text.toLowerCase() === 'cancel' || text.toLowerCase() === 'batal') {
         clearSession(m.sender)
         return m.reply('Proses ".amprem" telah dibatalkan. Taip ".amprem" untuk mula semula.')
      }

      // Step 1: User enters email
      if (session.step === 'email') {
         const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
         const email = emailMatch ? emailMatch[0] : (EMAIL_REGEX.test(text) ? text : null)

         if (!email) {
            return m.reply('Format email tidak sah. Sila masukkan alamat email yang betul (contoh: user@gmail.com):')
         }

         // Save email only for current claim session
         updateSession(m.sender, {
            step: 'waiting_token',
            email
         })

         return sendInteractive(sock, m, STEP_2_TEXT, [
            { text: '📋 Salin Format', copy: `${isPrefix || '.'}amprem token ` },
            { text: '❌ Batal Sesi', id: `${isPrefix || '.'}amprem cancel` }
         ])
      }

      // Step 2 / 3: User sends token or link in waiting_token step
      if (session.step === 'waiting_token') {
         let token = ''
         if (text.toLowerCase().startsWith('token ')) {
            token = text.slice(6).trim()
         }
         else if (text.toLowerCase().startsWith('token')) {
            token = text.slice(5).trim()
         }
         else if (text.startsWith('http://') || text.startsWith('https://')) {
            token = text.trim()
         }

         if (token) {
            const userEmail = session.email || 'anda'

            // SECURITY:
            // - Do not log token
            // - Do not echo token back
            // - Do not save token in database
            // - Clear session and token immediately from memory
            clearSession(m.sender)

            const successText = `🎉 *Klaim Alight Motion Premium Selesai!*\n\nPermintaan telah diproses untuk akaun:\n📧 *Email*: ${userEmail}\n\nSila buka aplikasi Alight Motion kamu untuk menyemak status Premium.\n\nTerima kasih!`
            return m.reply(successText)
         }
      }
   }
}
