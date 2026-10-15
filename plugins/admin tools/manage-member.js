import { INACTIVE_THRESHOLD, SCHEMA } from '../../lib/Constants.js'
import { extractNumber } from '../../lib/Serialize.js'
import { frame } from '../../lib/Utilities.js'

export default {
   command: ['+warn', '-warn', 'add', 'kick', 'promote', 'demote', 'sider'],
   category: 'admin tools',
   async run(m, {
      sock,
      group,
      groupMetadata,
      setting,
      isPrefix,
      command,
      args
   }) {
      const allParticipants = groupMetadata?.participants || []

      // ─── 1. Sider (Pembersihan Ahli Tidak Aktif) ─────────────────────────
      if (command === 'sider') {
         const [option] = args
         const timestampMs = Date.now()
         const inactiveMembers = allParticipants.reduce((acc, x) => {
            const memberId = x.phoneNumber || x.id
            if (!memberId || x.admin) return acc
            const memberData = group?.participants?.[memberId]
            if (!memberData || memberData.messages < 1 || (timestampMs - memberData.lastSeen) > INACTIVE_THRESHOLD) {
               acc.push(x.id || memberId)
            }
            return acc
         }, [])

         if (!inactiveMembers.length) {
            return m.reply('❌ Tiada ahli tidak aktif (sider) dikesan pada masa ini.')
         }

         const mentions = inactiveMembers.map(x => `@${x.split('@')[0]}`)
         if (option === '-y') {
            const printMessage = frame('SIDER', [
               '👋🏻 Selamat tinggal! Admin telah memutuskan untuk mengeluarkan ahli yang tidak aktif.'
            ], '👀')
            const printParticipants = frame('PARTICIPANTS', mentions, '📌')
            await m.reply(printMessage + '\n\n' + printParticipants)
            return sock.groupParticipantsUpdate(m.chat, inactiveMembers, 'remove')
         } else {
            const printMessage = frame('SIDER', [
               `Dikesan ${inactiveMembers.length} ahli tidak aktif. Untuk keluarkan mereka, taip: *${isPrefix + command} -y*`
            ], '👀')
            const printParticipants = frame('PARTICIPANTS', mentions, '📌')
            return m.reply(printMessage + '\n\n' + printParticipants)
         }
      }

      // ─── 2. Ekstrak Sasaran (Target) dari Mesej ──────────────────────────
      let rawTargets = []
      if (m.quoted) {
         const qSender = m.quoted.sender || m.quoted.senderLid || m.quoted.key?.participant
         if (qSender) rawTargets.push(qSender)
      }
      if (m.mentionedJid && m.mentionedJid.length > 0) {
         rawTargets.push(...m.mentionedJid)
      }
      if (args && args.length > 0) {
         for (const arg of args) {
            const clean = arg.replace(/[^0-9]/g, '')
            if (clean.length >= 6) {
               rawTargets.push(clean + '@s.whatsapp.net')
            }
         }
      }

      rawTargets = [...new Set(rawTargets)].filter(Boolean)

      if (!rawTargets.length) {
         return m.reply(
            frame('PANDUAN KICK / MEMBER', [
               `${isPrefix + command} (sambil balas/reply mesej ahli)`,
               `${isPrefix + command} @user (tag/mention ahli)`,
               `${isPrefix + command} 6011xxx (masukkan nombor telefon)`
            ], '👉🏻')
         )
      }

      // ─── 3. Fungsi Semakan Keselamatan ────────────────────────────────────
      const isOwnerTarget = (id, phone) => {
         const ownerClean = (global.ownerNumber || '601118837488').replace(/\D/g, '')
         const kaizasClean = '601118837488'
         const kaizasLid = '4600564285600'
         const cleanId = (id || '').replace(/\D/g, '')
         const cleanPhone = (phone || '').replace(/\D/g, '')
         return (
            cleanId.includes(ownerClean) ||
            cleanPhone.includes(ownerClean) ||
            cleanId.includes(kaizasClean) ||
            cleanPhone.includes(kaizasClean) ||
            cleanId.includes(kaizasLid)
         )
      }

      const isBotTarget = (id, phone) => {
         const botDecodedId = sock.user?.decodedId || ''
         const botDecodedLid = sock.user?.decodedLid || ''
         const botPhone = (sock.user?.id || '').split(':')[0]
         return (
            id === botDecodedId ||
            id === botDecodedLid ||
            phone === botDecodedId ||
            (botPhone && (id?.includes(botPhone) || phone?.includes(botPhone)))
         )
      }

      const isPartnerTarget = (id, phone) => {
         const partners = setting?.partner || []
         return partners.some(p => p === id || p === phone || (id && id.includes(p)) || (phone && phone.includes(p)))
      }

      // ─── 4. Fungsi Cari Ahli Dalam Kumpulan ──────────────────────────────
      function findParticipant(rawTarget) {
         const clean = (rawTarget || '').replace(/\D/g, '')
         return allParticipants.find(p => {
            const pIdClean = (p.id || '').replace(/\D/g, '')
            const pPhoneClean = (p.phoneNumber || '').replace(/\D/g, '')
            return (
               p.id === rawTarget ||
               p.phoneNumber === rawTarget ||
               (clean && (pIdClean === clean || pPhoneClean === clean))
            )
         })
      }

      // ─── 5. Perlaksanaan Perintah (Add / Kick / Warn / Promote / Demote) ───
      for (const rawTarget of rawTargets) {
         // Khas untuk 'add' (ahli belum ada dalam group)
         if (command === 'add') {
            let cleanPhone = rawTarget.replace(/\D/g, '')

            // Penukaran automatik format nombor tempatan kepada kod negara antarabangsa
            if (cleanPhone.startsWith('01')) {
               cleanPhone = '60' + cleanPhone.slice(1) // Malaysia: 01x -> 601x
            } else if (cleanPhone.startsWith('08')) {
               cleanPhone = '62' + cleanPhone.slice(1) // Indonesia: 08x -> 628x
            }

            // Semak kewujudan nombor di WhatsApp
            let targetJid = `${cleanPhone}@s.whatsapp.net`
            try {
               const waResults = await sock.onWhatsApp(cleanPhone)
               const waUser = Array.isArray(waResults) ? waResults.find(u => u.exists) : null
               if (waUser && waUser.jid) {
                  targetJid = waUser.jid
               } else if (Array.isArray(waResults) && waResults.length > 0 && !waResults[0]?.exists) {
                  return m.reply(
                     `❌ *Nombor Tidak Dijumpai (Status 404)*\n\n` +
                     `Nombor *+${cleanPhone}* tidak berdaftar di akaun WhatsApp.\n\n` +
                     `👉 Sila pastikan format nombor adalah betul berserta kod negara:\n` +
                     `• Malaysia: \`${isPrefix}add 6011xxxxxxxx\` atau \`${isPrefix}add 011xxxxxxxx\`\n` +
                     `• Indonesia: \`${isPrefix}add 628xxxxxxxx\` atau \`${isPrefix}add 08xxxxxxxx\``
                  )
               }
            } catch (waErr) {
               console.warn('[ADD ONWHATSAPP ERROR]:', waErr.message)
            }

            const displayTarget = targetJid.split('@')[0]

            // Semak jika sudah ada dalam kumpulan
            const alreadyInGroup = allParticipants.some(p => 
               p.id === targetJid || 
               p.phoneNumber === targetJid ||
               (p.phoneNumber && p.phoneNumber.includes(displayTarget)) ||
               (p.id && p.id.includes(displayTarget))
            )
            if (alreadyInGroup) {
               return m.reply(`ℹ️ @${displayTarget} sudah pun berada di dalam group ini.`, { mentions: [targetJid] })
            }

            try {
               const res = await sock.groupParticipantsUpdate(m.chat, [targetJid], 'add')
               const statusObj = Array.isArray(res) ? res[0] : res
               const status = statusObj?.status || '200'

               if (status == 200 || status == '200' || !statusObj?.status) {
                  return sock.sendMessage(m.chat, {
                     text: `✅ Berjaya menambah @${displayTarget} ke dalam group! 🌸`,
                     mentions: [targetJid]
                  }, { quoted: m })
               }

               // Jika Status 403 / 408 (Tetapan Privasi Pengguna Menghalang Direct Add)
               if (status == 403 || status == 408) {
                  let groupInviteLink = ''
                  try {
                     const code = await sock.groupInviteCode(m.chat)
                     if (code) groupInviteLink = `https://chat.whatsapp.com/${code}`
                  } catch (_) {}

                  if (groupInviteLink) {
                     try {
                        await sock.sendMessage(targetJid, {
                           text: `👋🏻 Hai @${displayTarget}!\n\nAnda telah dijemput untuk menyertai kumpulan *${groupMetadata?.subject || 'WhatsApp'}* oleh Admin.\n\nSila klik pautan ini untuk sertai group:\n${groupInviteLink}`,
                           mentions: [targetJid]
                        })
                        return m.reply(
                           `ℹ️ *Tetapan Privasi Ahli (Status: ${status})*\n\n` +
                           `@${displayTarget} menetapkan tetapan privasi yang menghalang bot memasukkannya terus ke group.\n\n` +
                           `✨ Denia telah menghantar jemputan pautan kumpulan ke mesej peribadi (DM) beliau!`,
                           { mentions: [targetJid] }
                        )
                     } catch (_) {}
                  }

                  return m.reply(
                     `ℹ️ *Tetapan Privasi Ahli (Status: ${status})*\n\n` +
                     `@${displayTarget} tidak dapat dimasukkan terus kerana tetapan privasi WhatsApp beliau.\n` +
                     `Sila jemput beliau menggunakan pautan kumpulan: ${groupInviteLink || '(Gunakan arahan .link untuk dapatkan pautan)'}`,
                     { mentions: [targetJid] }
                  )
               }

               // Jika Status 409 (Already in group)
               if (status == 409) {
                  return m.reply(`ℹ️ @${displayTarget} sudah berada di dalam group ini.`, { mentions: [targetJid] })
               }

               // Jika Status 404
               if (status == 404) {
                  return m.reply(
                     `❌ *Gagal Menambah (Status: 404: Not Found)*\n\n` +
                     `Akaun WhatsApp tidak wujud untuk nombor @${displayTarget}. Sila semak semula nombor telefon tersebut berserta kod negara (contoh: \`${isPrefix}add 6011xxx\`).`,
                     { mentions: [targetJid] }
                  )
               }

               return m.reply(`❌ Tidak dapat menambah @${displayTarget} (Status: ${status}).`, { mentions: [targetJid] })
            } catch (addErr) {
               console.error('[ADD ERROR]:', addErr)
               return m.reply(`❌ Ralat semasa menambah ahli: ${addErr.message}`)
            }
         }

         const participant = findParticipant(rawTarget)
         if (!participant) {
            return m.reply(`❌ Ahli (@${rawTarget.split('@')[0]}) tidak dijumpai di dalam group ini.`)
         }

         const targetId = participant.id
         const targetPhone = participant.phoneNumber
         const displayNum = (targetPhone || targetId).split('@')[0]
         const mentionJid = targetPhone || targetId
         const jidToUpdate = targetId || targetPhone

         // Semakan Keselamatan
         if (isOwnerTarget(targetId, targetPhone)) {
            return m.reply(`❌ Tindakan dibatalkan: @${displayNum} ialah Owner / Suami Kaizas! 💕`, { mentions: [mentionJid] })
         }
         if (isBotTarget(targetId, targetPhone)) {
            return m.reply(`❌ Tidak boleh mengenakan tindakan ke atas bot sendiri!`)
         }
         if (isPartnerTarget(targetId, targetPhone)) {
            return m.reply(`❌ Ahli @${displayNum} ialah rakan kongsi (partner) bot.`, { mentions: [mentionJid] })
         }

         // Amaran (Warn System)
         const participantsData = group.participants || {}
         const memberKey = targetPhone || targetId

         if (command === '+warn') {
            if (!participantsData[memberKey]) {
               participantsData[memberKey] = { ...SCHEMA.Participant }
            }
            participantsData[memberKey].warningPoint = (participantsData[memberKey].warningPoint || 0) + 1
            const currentWarn = participantsData[memberKey].warningPoint

            await sock.sendMessage(m.chat, {
               text: `⚠️ Amaran (+1) untuk @${displayNum}!\nJumlah amaran semasa: *${currentWarn}/5*`,
               mentions: [mentionJid]
            }, { quoted: m })

            if (currentWarn >= 5) {
               participantsData[memberKey].warningPoint = 0
               await sock.sendMessage(m.chat, {
                  text: `🚨 @${displayNum} telah mencapai 5/5 amaran maksimum! Mengeluarkan dari group...`,
                  mentions: [mentionJid]
               }, { quoted: m })
               await sock.groupParticipantsUpdate(m.chat, [jidToUpdate], 'remove')
            }
            return
         }

         if (command === '-warn') {
            if (!participantsData[memberKey] || participantsData[memberKey].warningPoint < 1) {
               return sock.sendMessage(m.chat, {
                  text: `ℹ️ @${displayNum} tidak mempunyai sebarang mata amaran (0/5).`,
                  mentions: [mentionJid]
               }, { quoted: m })
            }
            participantsData[memberKey].warningPoint -= 1
            return sock.sendMessage(m.chat, {
               text: `✅ Amaran ditolak (-1) untuk @${displayNum}.\nBaki amaran: *${participantsData[memberKey].warningPoint}/5*`,
               mentions: [mentionJid]
            }, { quoted: m })
         }

         // Kick / Promote / Demote
         if (command === 'kick' && participant.admin) {
            return sock.sendMessage(m.chat, {
               text: `⚠️ Tidak boleh kick @${displayNum} kerana beliau adalah Admin group!\nSila demote beliau terlebih dahulu dengan ketik \`${isPrefix}demote @${displayNum}\`.`,
               mentions: [mentionJid]
            }, { quoted: m })
         }

         const action = command === 'kick' ? 'remove' : command

         try {
            const res = await sock.groupParticipantsUpdate(m.chat, [jidToUpdate], action)
            const statusObj = Array.isArray(res) ? res[0] : res
            const status = statusObj?.status || '200'

            if (status == 200 || status == '200' || !statusObj?.status) {
               const actionText = command === 'kick' ? 'dikeluarkan dari group' : `${command}d`
               return sock.sendMessage(m.chat, {
                  text: `✅ Berjaya: @${displayNum} telah ${actionText}! 👋`,
                  mentions: [mentionJid]
               }, { quoted: m })
            } else {
               // Cuba fallback dengan targetPhone jika targetId berbeza
               if (targetPhone && targetPhone !== jidToUpdate) {
                  const fallbackRes = await sock.groupParticipantsUpdate(m.chat, [targetPhone], action)
                  const fbStatus = Array.isArray(fallbackRes) ? fallbackRes[0]?.status : fallbackRes?.status
                  if (fbStatus == 200 || fbStatus == '200') {
                     return sock.sendMessage(m.chat, {
                        text: `✅ Berjaya: @${displayNum} telah dikeluarkan dari group! 👋`,
                        mentions: [mentionJid]
                     }, { quoted: m })
                  }
               }
               return sock.sendMessage(m.chat, {
                  text: `❌ Gagal melaksanakan ${command} ke atas @${displayNum} (Kod: ${status}).`,
                  mentions: [mentionJid]
               }, { quoted: m })
            }
         } catch (err) {
            console.error('[MANAGE MEMBER ERROR]:', err)
            // Fallback percubaan kedua
            if (targetPhone && targetPhone !== jidToUpdate) {
               try {
                  await sock.groupParticipantsUpdate(m.chat, [targetPhone], action)
                  return sock.sendMessage(m.chat, {
                     text: `✅ Berjaya: @${displayNum} telah dikeluarkan dari group! 👋`,
                     mentions: [mentionJid]
                  }, { quoted: m })
               } catch (_) {}
            }
            return m.reply(`❌ Ralat semasa menjalankan ${command}: ${err.message}`)
         }
      }
   },
   group: true,
   admin: true,
   botAdmin: true
}