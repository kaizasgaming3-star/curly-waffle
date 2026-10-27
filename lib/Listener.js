/**
 * This file is part of the SairiDev Bot WhatsApp project, solely developed and maintained by SairiDev.
 * https://github.com/sairidev
 *
 * All rights reserved.
 *
 * - You are NOT allowed to copy, rewrite, modify, redistribute, or reuse this file in any form.
 * - You are NOT allowed to claim this file or any part of this project as your own.
 * - This credit notice must NOT be removed or altered.
 * - This file may ONLY be used within the SairiDev project.
 */

import fs from 'fs'
import path from 'path'
import { FAKE_QUOTE, G_US, LID, SECOND, SCHEMA, STATUS_REACTIONS } from './Constants.js'
import { Serialize, shouldUpdatePresence, StickerCommand } from './Serialize.js'
import { fetchAsBuffer, findTopSuggestions, formatTime, frame, greeting, isEmptyObject, messageLogger, randomValue, ExtendSocket, toTime } from './Utilities.js'
import { CommandIndex, EventIndex } from './Watcher.js'

import Scheduler from './Components/Scheduler.js'
import { broadcastUpdateToGroups } from './Components/AutoUpdateNotifier.js'
import { handleAutoReply } from '../plugins/ai/denia.js'
import { getSession as getAmpremSession, startSession as startAmpremSession, updateSession as updateAmpremSession, clearSession as clearAmpremSession, hasSession as hasAmpremSession } from './Components/AlightMotionSession.js'
import { amprem as ampremAPI } from './Scraper.js'

const IgnoreProtocolTypes = new Set([5, 6, 9, 17])

export default (db, store) => {
   let sock = null,
      scheduler = null,
      setting = db.getSetting()

   return {
      bind: (socket) => {
         if (!socket) return

         sock = socket

         scheduler = Scheduler({
            db,
            notify: async (type, data, remaining) => {
               if (
                  !sock?.sendText ||
                  !setting.notifier
               ) return

               if (type === 'user')
                  sock.sendText(data.jid, `📣 Your premium access will expire in *${toTime(remaining)}*`, FAKE_QUOTE)
               else if (type === 'group')
                  sock.sendText(data.id, `📣 Bot's active period for this group will expire in ${toTime(remaining)}`, FAKE_QUOTE, { mentionAll: true })

               await store.writeToFile()
               await db.writeToFile()
            },
            expire: async (type, data) => {
               if (
                  !sock?.sendText ||
                  !setting.notifier
               ) return

               if (type === 'user')
                  sock.sendText(data.jid, '📣 Your premium access has expired.', FAKE_QUOTE)
               else if (type === 'group') {
                  await sock.sendText(data.id, '📣 Bot\'s active period for this group has expired.', FAKE_QUOTE, { mentionAll: true })
                  await sock.groupLeave(data.id)
                  store.deleteGroup(data.id)
                  db.deleteGroup(data.id)
               }

               await store.writeToFile()
               await db.writeToFile()
            }
         })

         sock.ev.on('connection.update', async ({ connection }) => {
            if (connection === 'open') {
               broadcastUpdateToGroups(sock, db).catch(() => {})
            }
         })

         return ExtendSocket(sock, {
            updatePresence: setting.typingPresence,
            delayWithPresence: setting.slowMode,
            secureMetaServiceLabel: setting.secureLabel
         })
      },
      call: async ({ callerPn, from, id, status }) => {
         setting = db.getSetting()

         if (!setting.rejectCall) return

         if (status === 'offer') {
            let callFrom = callerPn || from
            if (callFrom?.endsWith(LID)) {
               const result = await sock.findUserId(callFrom)
               if (!callFrom.phoneNumber.startsWith('id'))
                  callFrom = result.phoneNumber
            }

            const userData = db.getUser(callFrom)

            await sock.rejectCall(id, from)

            if (
               !userData ||
               callFrom.startsWith(ownerNumber)
            ) return

            if (userData.callAttempt >= 3) {
               await sock.sendText(callFrom, '⚠️ You have called multiple times. Your account will now be blocked.')
               return sock.updateBlockStatus(callFrom, 'block')
            }

            ++userData.callAttempt

            sock.sendText(callFrom, '⚠️ Do not call again, or you will be blocked.')
         }
      },
      group: async (id) => {
         const groupMetadata = await sock.groupMetadata(id)
         if (store.hasGroup(id))
            store.setGroup(
               id,
               Object.assign(
                  store.getGroup(id) || {},
                  groupMetadata
               )
            )
         else
            store.setGroup(id, groupMetadata)
      },
      message: async (message) => {
         setting = db.getSetting()

         const timestampMs = Date.now()
         const timestampSec = timestampMs / SECOND

         if (!message.message || timestampSec - message.messageTimestamp > ignoreOldMessageTS) return

         const m = Serialize(sock, store, setting, message)

         const ownerLidStr = '4600564285600'
         const ownerPhoneJid = (global.ownerNumber || '601118837488') + '@s.whatsapp.net'
         if (m.sender && (m.sender.includes(ownerLidStr) || (m.senderLid && m.senderLid.includes(ownerLidStr)))) {
            m.sender = ownerPhoneJid
         }
         if (m.chat && !m.isGroup && m.chat.includes(ownerLidStr)) {
            m.chat = ownerPhoneJid
         }
         m.isPrivate = !m.isGroup && !m.isStatus

         const protocolType = m.msg?.type
         if (
            !m.type ||
            IgnoreProtocolTypes.has(protocolType) ||
            store.hasMessage(m)
         ) return

         store.setMessage(m)

         StickerCommand(m, setting.stickerCommand)

         const body = m.body,
            isPrefix = m.prefix,
            command = m.command,
            text = m.text,
            args = m.args,
            isHasPrefix = m.isHasPrefix

         if (!m.body?.includes('INFO UPDATE TERBARU BOT DENIA')) {
            messageLogger(m)
         }

         let groupMetadata = store.getGroup(m.chat)

         let user = db.getUser(m.sender)
         let group = db.getGroup(m.chat)

         if (!user) {
            user = {
               ...SCHEMA.User,
               jid: m.sender,
               lid: m.senderLid,
               name: m.pushName
            }

            db.updateUser(m.sender, user)
         }

         if (!user.jid)
            user.jid = m.sender

         if (!user.lid)
            user.lid = m.senderLid

         user.name = m.pushName
         user.lastSeen = timestampMs

         const cleanSenderNumber = (m.sender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
         const cleanOwnerNumber = String(global.ownerNumber || '601118837488').replace(/[^0-9]/g, '')
         const cleanSenderLid = (m.senderLid || (m.sender?.endsWith('@lid') ? m.sender : '')).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
         const cleanOwnerLid = String(global.ownerLid || '4600564285600').replace(/[^0-9]/g, '')

         const isOwner = Boolean(
            m.fromMe ||
            (cleanSenderNumber && cleanOwnerNumber && cleanSenderNumber === cleanOwnerNumber) ||
            (cleanSenderLid && cleanOwnerLid && cleanSenderLid === cleanOwnerLid)
         )
         const isPartner = isOwner || setting.partner.includes(m.sender)
         const isPremium = isPartner || user.premiumExpiry > 0
         const isBanned = user.banned

         const isSelf = setting.self
         const isGroupOnly = setting.groupOnly
         const isNoPrefix = setting.noPrefix

         const shouldFindTopSuggestions = setting.commandSuggestions
         const shouldReadMessage = setting.readMessage
         const shouldReactStatus = setting.reactStatus

         let isAdmin = false,
            isBotAdmin = false

         if (m.isGroup) {
            if (!groupMetadata || !groupMetadata.participants) {
               groupMetadata = await sock.groupMetadata(m.chat)
               store.setGroup(m.chat, groupMetadata)
            }

            if (!group) {
               group = {
                  ...SCHEMA.Group,
                  id: m.chat,
                  name: groupMetadata.subject
               }

               db.updateGroup(m.chat, group)
            }

            group.name = groupMetadata.subject
            group.lastActivity = timestampMs

            let memberData = group.participants[m.sender]
            let botMemberData = group.participants[sock.user.decodedId]

            if (botMemberData) {
               botMemberData.messages++
               botMemberData.lastSeen = timestampMs

               isBotAdmin = botMemberData.isAdmin
            }
            else {
               const participants = groupMetadata.participants

               for (let i = 0, participantsLength = participants.length; i < participantsLength; i++) {
                  const participant = participants[i]

                  if (participant.admin) {
                     if (!isBotAdmin && participant.id === sock.user.decodedLid)
                        isBotAdmin = true

                     if (isBotAdmin) break
                  }
               }

               group.participants[sock.user.decodedId] = {
                  ...SCHEMA.Participant,
                  isAdmin: isBotAdmin,
                  messages: 1,
                  lastSeen: timestampMs
               }
            }

            if (memberData) {
               memberData.messages++
               memberData.lastSeen = timestampMs

               isAdmin = memberData.isAdmin
            }
            else {
               const participants = groupMetadata.participants

               for (let i = 0, participantsLength = participants.length; i < participantsLength; i++) {
                  const participant = participants[i]

                  if (participant.admin) {
                     if (
                        !isAdmin &&
                        (
                           participant.phoneNumber === m.sender ||
                           participant.id === m.senderLid
                        )
                     )
                        isAdmin = true

                     if (isAdmin) break
                  }
               }

               group.participants[m.sender] = {
                  ...SCHEMA.Participant,
                  isAdmin,
                  messages: 1,
                  lastSeen: timestampMs
               }
            }

            if (!isEmptyObject(user.afkContext)) {
               const print = frame('HELLO', [
                  `💭 System detects activity from @${user.jid.split('@')[0]} after being offline for: ${toTime(timestampMs - user.afkTimestamp)}`,
                  `🏷️ *Reason*: ${user.afkReason || '-'}`
               ], '👀')
               await sock.sendText(m.chat, print, user.afkContext)
               user.afkReason = ''
               user.afkContext = {}
               user.afkTimestamp = -1
            }

            if (protocolType == 3)
               groupMetadata.ephemeralDuration = m.msg.ephemeralExpiration
         }

         let fileSize = 0

         const fileLength = m.msg?.fileLength
         if (fileLength && fileLength.low)
            fileSize = fileLength.low

         if (m.isMe) {
            setting.messageEgress++
            setting.byteEgress += fileSize
            return
         }

         setting.messageIngress++
         setting.byteIngress += fileSize

         if (!isOwner && isSelf) return

         const isAmprem = command === 'amprem' || command === 'alightmotion' || (typeof hasAmpremSession === 'function' && hasAmpremSession(m.sender))
         if (m.isPrivate && !isPartner && isGroupOnly && !isAmprem) return

         if (
            !m.fromMe &&
            shouldReadMessage &&
            shouldUpdatePresence(m.message)
         )
            await sock.readMessages([m.key])

         if (
            m.isStatus &&
            m.type !== 'protocolMessage' &&
            !m.fromMe &&
            shouldReactStatus
         )
            return m.react(randomValue(STATUS_REACTIONS), {
               statusJidList: [m.sender]
            })

         if (m.isGroup && !isAdmin && group.adminOnly) return

         if (m.isGroup && group.mute && command !== 'unmute') return

         // ──────────────────────────────────────────────────
         // AMPREM INTERCEPTOR — handle in private chat & group
         // ──────────────────────────────────────────────────
         const isAmpremCmd = command === 'amprem' || command === 'alightmotion'

         if (isAmpremCmd || hasAmpremSession(m.sender)) {
            const sendAmpremImage = async (imageFile, caption) => {
               const localPath = path.join(process.cwd(), 'media', 'Image', 'amprem', imageFile)
               const fallbackUrl = `https://am.zervida.my.id/runtime/amprem-${imageFile}`
               try {
                  if (fs.existsSync(localPath)) {
                     return await sock.sendMedia(m.chat, localPath, caption, m)
                  }
                  return await sock.sendMedia(m.chat, fallbackUrl, caption, m)
               } catch (err) {
                  return await m.reply(caption)
               }
            }

            // Subcommand: cancel / batal
            if (isAmpremCmd && (text === 'cancel' || text === 'batal')) {
               if (hasAmpremSession(m.sender)) {
                  clearAmpremSession(m.sender)
                  return m.reply('✅ Sesi Alight Motion Premium telah dibatalkan.')
               }
               return m.reply('Tiada sesi Alight Motion Premium yang sedang berjalan.')
            }

            // Subcommand: step tutorial view (.amprem step <1-5> or .amprem panduan)
            if (isAmpremCmd && (text.startsWith('step') || text === 'panduan' || text === 'tutorial' || text === 'help')) {
               const stepNum = text.replace(/[^1-5]/g, '')
               if (stepNum === '1') {
                  return await sendAmpremImage('step1.jpg',
                     `📌 *Langkah 1: Log Masuk Alight Motion*\n\n` +
                     `1. Buka aplikasi Alight Motion di telefon anda.\n` +
                     `2. Log masuk menggunakan akaun Google anda.\n\n` +
                     `Seterusnya, hantar: \`.amprem email@anda.com\` untuk mula klaim.`
                  )
               } else if (stepNum === '2') {
                  return await sendAmpremImage('step2.jpg',
                     `📌 *Langkah 2: Semak Emel*\n\n` +
                     `Cari emel bertajuk *"Sign in to Alight Creative"* daripada Alight Motion.\n` +
                     `⚠️ *Nota:* Semak folder *Inbox* atau *Spam*.`
                  )
               } else if (stepNum === '3') {
                  return await sendAmpremImage('step3.jpg',
                     `📌 *Langkah 3: Buka Emel & Tekan Tahan*\n\n` +
                     `Buka emel tersebut, cari butang/tulisan *"Sign in to Alight Creative"* dan *tekan & tahan (tekan lama)*.`
                  )
               } else if (stepNum === '4') {
                  return await sendAmpremImage('step4.jpg',
                     `📌 *Langkah 4: Salin URL*\n\n` +
                     `Selepas tekan tahan, menu pop-up akan muncul. Pilih *"Salin URL"* (Copy link address).\n\n` +
                     `Tampal link tersebut ke dalam bot (bermula dengan https://alight-creative.firebaseapp.com/...).`
                  )
               } else if (stepNum === '5') {
                  return await sendAmpremImage('step5.jpg',
                     `📌 *Langkah 5: Semak Status Premium*\n\n` +
                     `Buka aplikasi Alight Motion dan semak profil. Akaun anda akan aktif berstatus Premium sehingga *3 Julai 2027*!`
                  )
               } else {
                  return await sendAmpremImage('step1.jpg',
                     `📖 *Panduan Penuh Klaim Alight Motion Premium*\n\n` +
                     `1️⃣ *Langkah 1*: Buka Alight Motion & log masuk akaun Google.\n` +
                     `2️⃣ *Langkah 2*: Taip \`.amprem emel@anda.com\` di sini.\n` +
                     `3️⃣ *Langkah 3*: Buka inbox/spam emel dari Alight Creative.\n` +
                     `4️⃣ *Langkah 4*: Tekan tahan tulisan "Sign in to Alight Creative" & klik *Salin URL*.\n` +
                     `5️⃣ *Langkah 5*: Tampal URL tersebut ke sini untuk aktifkan Premium!\n\n` +
                     `💡 *Tip:* Untuk melihat gambar setiap langkah, taip \`.amprem step 1\` hingga \`.amprem step 5\`.`
                  )
               }
            }

            // Subcommand: token input (.amprem token <link> or .amprem <link>)
            if (isAmpremCmd && (text.startsWith('token ') || text.startsWith('https://alight-creative.firebaseapp.com/'))) {
               const link = text.startsWith('token ') ? text.slice(6).trim() : text.trim()
               const session = getAmpremSession(m.sender)
               if (!session || session.step !== 'waiting_token') {
                  return m.reply('Tiada sesi Alight Motion Premium yang sedang menunggu link. Taip `.amprem <email>` untuk mula.')
               }
               if (!link.startsWith('https://alight-creative.firebaseapp.com/')) {
                  return m.reply(
                     '⚠️ Link tidak sah. Pastikan link bermula dengan:\n`https://alight-creative.firebaseapp.com/__/auth/action?...`\n\nCuba hantar semula.'
                  )
               }

               updateAmpremSession(m.sender, { step: 'claiming' })
               await m.reply('⏳ Sedang mengesahkan link... Sila tunggu.')

               try {
                  await ampremAPI.claim(session.email, link)
                  clearAmpremSession(m.sender)

                  return await sendAmpremImage('step5.jpg',
                     `🎉 *Alight Motion Premium berjaya diaktifkan!*\n\n` +
                     `📧 Email: *${session.email}*\n` +
                     `📅 Tempoh: Sehingga *3 Julai 2027*\n\n` +
                     `✨ Akaun anda kini telah rasmi berstatus Premium! Buka aplikasi Alight Motion untuk mula menggunakannya.`
                  )
               } catch (err) {
                  clearAmpremSession(m.sender)
                  console.error('[AMPREM] claim error:', err?.message || err)
                  return m.reply(`❌ Pengesahan gagal.\n\nSebab: ${err?.message || 'Ralat tidak diketahui'}\n\nCuba mula semula dengan \`.amprem <email>\``)
               }
            }

            // Step 1: user sends .amprem without arguments
            if (isAmpremCmd && !text) {
               return await sendAmpremImage('step1.jpg',
                  `✨ *Klaim Alight Motion Premium*\n\n` +
                  `Sila sertakan alamat email akaun Alight Motion anda untuk memulakan proses klaim.\n` +
                  `Contoh:\n` +
                  `\`.amprem nama@gmail.com\`\n\n` +
                  `📌 *Panduan Ringkas (Rujuk Gambar di Atas):*\n` +
                  `1. Log masuk akaun Google di aplikasi Alight Motion.\n` +
                  `2. Hantar \`.amprem email@anda.com\` ke sini.\n` +
                  `3. Salin pautan dari emel pengesahan dan hantar ke sini.\n\n` +
                  `Untuk batalkan: \`.amprem cancel\`\n` +
                  `Untuk panduan langkah: \`.amprem step 1\` hingga \`.amprem step 5\``
               )
            }

            // Step 1: user sends .amprem <email>
            if (isAmpremCmd && text) {
               const email = text.trim()
               if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                  return m.reply('❌ Format email tidak sah. Contoh: `.amprem nama@gmail.com`')

               await m.reply(`⏳ Sedang menghantar link ke *${email}*... Sila tunggu.`)

               try {
                  await ampremAPI.requestLink(email)
                  // If no error thrown = email sent successfully

                  startAmpremSession(m.sender, async () => {
                     try { await sock.sendText(m.chat, '⏰ Sesi Alight Motion tamat. Hantar `.amprem <email>` semula untuk cuba lagi.') } catch (_) {}
                  })
                  updateAmpremSession(m.sender, { step: 'waiting_token', email })

                  return await sendAmpremImage('step4.jpg',
                     `✅ *Link telah dihantar ke ${email}!*\n\n` +
                     `📧 Semak inbox atau folder *Spam* untuk emel daripada *Alight Creative*.\n\n` +
                     `📸 *CARA SALIN LINK (Rujuk Gambar di Atas):*\n` +
                     `1. Buka emel daripada *Alight Creative*.\n` +
                     `2. *Tekan dan tahan (tekan lama)* pada tulisan *"Sign in to Alight Creative"*.\n` +
                     `3. Klik menu *"Salin URL"* (Copy link address).\n` +
                     `4. Hantar link tersebut di sini (atau taip \`.amprem token <link>\`).\n\n` +
                     `⚠️ *Penting:* Jangan klik buka link terus di browser. Mesti salin URL dan hantar di sini.\n` +
                     `_(Link bermula dengan: https://alight-creative.firebaseapp.com/...)_`
                  )
               } catch (err) {
                  console.error('[AMPREM] requestLink error:', err?.message || err)
                  return m.reply(`❌ Gagal menghantar email.\n\nSebab: ${err?.message || 'Ralat tidak diketahui'}`)
               }
            }

            // Step 2: user sends Firebase link directly (token step without command prefix)
            if (!isAmpremCmd && hasAmpremSession(m.sender)) {
               const session = getAmpremSession(m.sender)
               if (session && session.step === 'waiting_token') {
                  const link = (m.body || '').trim()
                  if (link.startsWith('https://alight-creative.firebaseapp.com/')) {
                     updateAmpremSession(m.sender, { step: 'claiming' })
                     await m.reply('⏳ Sedang mengesahkan link... Sila tunggu.')

                     try {
                        await ampremAPI.claim(session.email, link)
                        clearAmpremSession(m.sender)

                        return await sendAmpremImage('step5.jpg',
                           `🎉 *Alight Motion Premium berjaya diaktifkan!*\n\n` +
                           `📧 Email: *${session.email}*\n` +
                           `📅 Tempoh: Sehingga *3 Julai 2027*\n\n` +
                           `Selamat menggunakan Alight Motion Premium! ✨`
                        )
                     } catch (err) {
                        clearAmpremSession(m.sender)
                        console.error('[AMPREM] claim error:', err?.message || err)
                        return m.reply(`❌ Pengesahan gagal.\n\nSebab: ${err?.message || 'Ralat tidak diketahui'}\n\nCuba mula semula dengan \`.amprem <email>\``)
                     }
                  } else if (m.isPrivate && !isHasPrefix) {
                     return m.reply(
                        '⚠️ Link tidak sah. Pastikan link bermula dengan:\n`https://alight-creative.firebaseapp.com/__/auth/action?...`\n\nCuba hantar semula.'
                     )
                  }
               }
            }
         }
         // ──────────────────────────────────────────────────

         let plugin = null
         if (isHasPrefix || isNoPrefix)
            plugin = CommandIndex.get(command)

         if (plugin) {
            if (isBanned && command !== 'profile')
               return m.reply('🚫 You are being banned by BOT staff.')

            const isCommandDisabled = setting.disabledCommand.includes(command)
            if (isCommandDisabled)
               return m.reply('❌ This feature is currently disabled.')

            if (plugin.owner && !isOwner)
               return m.reply('⚠️ This command only for owner.')

            if (plugin.partner && !isPartner)
               return m.reply('⚠️ This command only for partner.')

            if (plugin.premium && !isPremium)
               return m.reply('⚠️ This command only for premium.')

            if (plugin.group && !m.isGroup)
               return m.reply('⚠️ This command will only work in group.')

            if (plugin.private && !m.isPrivate)
               return m.reply('⚠️ This command will only work in private chat.')

            if (plugin.admin && !isAdmin)
               return m.reply('⚠️ This command only for group admin.')

            if (plugin.botAdmin && !isBotAdmin)
               return m.reply('⚠️ This command will work when bot become an admin.')

            if (plugin.limit && !isPartner) {
               if (user.limit < 1)
                  return m.reply(`⚠️ You reached the limit and will be reset at 00.00 or try \`${isPrefix}claim\` command to claim limit.`)

               const limitCost =
                  plugin.limit === true ?
                     1 :
                     typeof plugin.limit === 'number' ?
                        plugin.limit :
                        0

               if (user.limit >= limitCost)
                  user.limit -= limitCost
               else
                  return m.reply(`⚠️ Your limit is not enough to use this feature, try \`${isPrefix}claim\` command to claim limit.`)
            }

            if (plugin.energy && !isPartner) {
               if (user.energy < 1)
                  return m.reply(`⚠️ You're running out of energy and will be filled at 00.00 or try \`${isPrefix}chargeenergy\` command to fill up your energy.`)

               const energyCost =
                  plugin.energy === true ?
                     1 :
                     typeof plugin.energy === 'number' ?
                        plugin.energy :
                        0

               if (user.energy >= energyCost)
                  user.energy -= energyCost
               else
                  return m.reply(`⚠️ Your energy is not enough to play the game, try \`${isPrefix}chargeenergy\` command to fill up your energy.`)
            }

            user.commandUsage++

            plugin.run(m, {
               sock,
               db,
               store,
               user,
               group,
               setting,
               body,
               groupMetadata,
               isOwner,
               isPartner,
               isPremium,
               isBanned,
               isAdmin,
               isBotAdmin,
               isPrefix,
               command,
               text,
               args
            })
         }
         else {
            let suggestions = null
            if (shouldFindTopSuggestions && isHasPrefix)
               suggestions = findTopSuggestions(command)

            if (suggestions && suggestions.length) {
               const printSuggestions = frame('DID YOU MEAN', suggestions.map(suggestion =>
                  `${isPrefix + suggestion.command} (${suggestion.similarity.toFixed(0)}%)`
               ), '🔍')
               return m.reply(printSuggestions)
            }

            if (!isHasPrefix && (body || m.isMedia) && typeof handleAutoReply === 'function') {
               const replied = await handleAutoReply(m, sock, body || '', {
                  db,
                  store,
                  user,
                  group,
                  setting,
                  groupMetadata,
                  isOwner,
                  isPartner,
                  isPremium,
                  isBanned,
                  isAdmin,
                  isBotAdmin,
                  isPrefix: isPrefix || '.'
               })
               if (replied) return
            }

            for (const event of EventIndex) {
               if (!event?.run) continue

               if (isBanned) continue

               if (event.owner && !isOwner) continue

               if (event.partner && !isPartner) continue

               if (event.premium && !isPremium) continue

               if (event.group && !m.isGroup) continue

               if (event.private && !m.isPrivate) continue

               if (event.admin && !isAdmin) continue

               if (event.botAdmin && !isBotAdmin) continue

               event.run(m, {
                  sock,
                  db,
                  store,
                  user,
                  group,
                  setting,
                  body,
                  groupMetadata,
                  isOwner,
                  isPartner,
                  isPremium,
                  isBanned,
                  isAdmin,
                  isBotAdmin,
                  isPrefix,
                  command,
                  text,
                  args
               })
            }
         }
      },
      participant: async ({ id, author, participant, action }) => {
         const timestampMs = Date.now()

         let group = db.getGroup(id)
         let groupMetadata = store.getGroup(id)

         if (!groupMetadata || !groupMetadata.participants) {
            groupMetadata = await sock.groupMetadata(id)
            store.setGroup(id, groupMetadata)
         }

         if (!group) {
            group = {
               ...SCHEMA.Group,
               id,
               name: groupMetadata.subject
            }

            db.updateGroup(id, group)
         }

         group.name = groupMetadata.subject
         group.lastActivity = timestampMs

         if (author?.endsWith(LID)) {
            const result = await sock.findUserId(author)
            if (!result.phoneNumber.startsWith('id'))
               author = result.phoneNumber
         }

         let userId = participant.phoneNumber
         if (!userId) {
            const result = await sock.findUserId(participant.id)
            if (!result.phoneNumber.startsWith('id'))
               userId = result.phoneNumber
         }

         let memberData = group.participants[userId]
         if (!memberData)
            memberData = group.participants[userId] = {
               ...SCHEMA.Participant
            }

         const isMuted = group.mute
         let isBotAdmin = memberData.isAdmin

         if (action === 'add') {
            groupMetadata.participants.push(participant)

            if (
               group.antiRejoin &&
               memberData.leftGroup &&
               isBotAdmin
            ) {
               await sock.sendText(id, `❌ You @${userId.split('@')[0]} already left this group before. Rejoining is not allowed.`)
               return sock.groupParticipantsUpdate(id, [userId], 'remove')
            }

            if (group.welcome && !isMuted) {
               const profilePicture = await sock.profilePicture(userId)

               const printWelcome = (group.welcomeMessage || `👋🏻 Welcome +tag`)
                  .replace('+group', groupMetadata.subject)
                  .replace('+tag', '@' + userId.split('@')[0])
                  .replace('+date', formatTime(undefined, timestampMs))

               sock.sendText(id, printWelcome, null, {
                  title: botName,
                  description: greeting(),
                  thumbnail: await fetchAsBuffer(profilePicture),
                  largeThumbnail: true
               })
            }
         }
         else if (action === 'promote') {
            groupMetadata.participants.find(x => x.id === participant.id).admin = 'admin'
            memberData.isAdmin = true

            if (!isMuted)
               sock.sendText(id, `🎉 @${userId.split('@')[0]} promoted to admin by @${author.split('@')[0]}.`)
         }
         else if (action === 'demote') {
            groupMetadata.participants.find(x => x.id === participant.id).admin = null
            memberData.isAdmin = false

            if (!isMuted)
               sock.sendText(id, `⬇️ @${userId.split('@')[0]} was demoted from admin by @${author.split('@')[0]}.`)
         }
         else if (action === 'remove') {
            if (sock.user.decodedId === userId) {
               store.deleteGroup(id)
               db.deleteGroup(id)
            }
            else {
               groupMetadata.participants = groupMetadata.participants.filter(x => x.id !== participant.id)
               memberData.leftGroup = author === userId
            }

            if (group.left && !isMuted) {
               const profilePicture = await sock.profilePicture(userId)

               const printLeft = (group.leftMessage || `👋🏻 Good bye! +tag`)
                  .replace('+group', groupMetadata.subject)
                  .replace('+tag', '@' + userId.split('@')[0])
                  .replace('+date', formatTime(undefined, timestampMs))

               sock.sendText(id, printLeft, null, {
                  title: botName,
                  description: greeting(),
                  thumbnail: await fetchAsBuffer(profilePicture),
                  largeThumbnail: true
               })
            }
         }

         await db.writeToFile()
         await store.writeToFile()
      },
      presence: async ({ id, presence, presences }) => {
         if (presence.endsWith(G_US)) return

         const userId = await sock.findUserId(presence)
         if (
            !userId.phoneNumber ||
            sock.user.decodedId === userId.phoneNumber
         ) return

         const userData = db.getUser(userId.phoneNumber)
         if (!userData) return

         const condition = presences[presence]
         if (
            (
               condition.lastKnownPresence === 'composing' ||
               condition.lastKnownPresence === 'recording'
            ) &&
            !isEmptyObject(userData.afkContext)
         ) {
            const print = frame('HELLO', [
               `💭 System detects activity from @${userData.jid.split('@')[0]} after being offline for: ${toTime(Date.now() - userData.afkTimestamp)}`,
               `🏷️ *Reason*: ${userData.afkReason || '-'}`
            ], '👀')
            await sock.sendText(id, print, userData.afkContext)
            userData.afkReason = ''
            userData.afkContext = {}
            userData.afkTimestamp = -1
         }
      },
      unbind: () => {
         clearInterval(scheduler)

         if (!sock) return

         sock.ev.flush()
         sock.ev.removeAllListeners()
         sock.ws.close()

         sock = null
      }
   }
}