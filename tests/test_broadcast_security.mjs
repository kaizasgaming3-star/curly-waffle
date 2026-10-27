/**
 * ══════════════════════════════════════════════════════════════════════
 *          SUITE UJIAN KESELAMATAN BROADCAST & PENGESAHAN OWNER
 * ══════════════════════════════════════════════════════════════════════
 * Ujian unit automatik untuk 10 senario keselamatan:
 * 1. Owner yang sah (JID asal & Device JID)
 * 2. Pengguna biasa (Non-owner rejection)
 * 3. ID yang hampir sama (Prefix collision attack / 60111883748899)
 * 4. Mesej kosong atau ruang putih sahaja
 * 5. Arahan hampir sama (Strict command match / !broadcastspam)
 * 6. JID peribadi vs Kumpulan (Target separation)
 * 7. Kegagalan penghantaran terasing (Per-recipient failure handling)
 * 8. Had panjang mesej (Max length payload guard)
 * 9. Permintaan serentak (Concurrency mutex lock)
 * 10. Input yang rosak & malformed JIDs
 */

import '../settings.js'
import broadcastPlugin from '../plugins/owner/broadcast.js'

// Helper function untuk logik pengesahan Owner mengikut kemas kini Listener.js
function verifyIsOwner(m, ownerNumber = '601118837488', ownerLid = '4600564285600') {
   if (!m) return false
   if (m.fromMe) return true

   const cleanSenderNumber = (m.sender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
   const cleanOwnerNumber = String(ownerNumber).replace(/[^0-9]/g, '')
   const cleanSenderLid = (m.senderLid || (m.sender?.endsWith('@lid') ? m.sender : '')).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
   const cleanOwnerLid = String(ownerLid).replace(/[^0-9]/g, '')

   return Boolean(
      (cleanSenderNumber && cleanOwnerNumber && cleanSenderNumber === cleanOwnerNumber) ||
      (cleanSenderLid && cleanOwnerLid && cleanSenderLid === cleanOwnerLid)
   )
}

function createMockSocket(options = {}) {
   const sentMessages = []
   return {
      user: { decodedId: '601115388813@s.whatsapp.net' },
      sentMessages,
      sendText: async (id, text) => {
         if (options.failOnId && options.failOnId === id) {
            throw new Error(`Simulated connection failure for ${id}`)
         }
         sentMessages.push({ type: 'text', id, text })
      },
      sendMedia: async (id, buffer, caption) => {
         if (options.failOnId && options.failOnId === id) {
            throw new Error(`Simulated connection failure for ${id}`)
         }
         sentMessages.push({ type: 'media', id, caption })
      }
   }
}

function createMockMessage(overrides = {}) {
   const replies = []
   const reactions = []
   return {
      sender: overrides.sender || '601118837488@s.whatsapp.net',
      senderLid: overrides.senderLid || null,
      fromMe: overrides.fromMe || false,
      chat: overrides.chat || '601118837488@s.whatsapp.net',
      isGroup: overrides.isGroup || false,
      replies,
      reactions,
      reply: async (text) => {
         replies.push(text)
         return text
      },
      react: async (emoji) => {
         reactions.push(emoji)
      },
      ...overrides
   }
}

async function runAllSecurityTests() {
   console.log('╔══════════════════════════════════════════════════════════════════╗')
   console.log('║        SUITE UJIAN AUDIT KESELAMATAN BOT WHATSAPP DENIA          ║')
   console.log('║               10 PENANDA ARAS KESELAMATAN (MOCK)                 ║')
   console.log('╚══════════════════════════════════════════════════════════════════╝\n')

   let passed = 0
   const total = 10

   // ─── Ujian 1: Owner yang sah (Normal & Device JID) ───────────────
   console.log('▶ [Ujian 1: Owner Yang Sah]')
   const m1a = createMockMessage({ sender: '601118837488@s.whatsapp.net' })
   const m1b = createMockMessage({ sender: '601118837488:2@s.whatsapp.net' }) // multi-device suffix
   const m1c = createMockMessage({ sender: '4600564285600@lid' }) // owner LID
   const isOwner1a = verifyIsOwner(m1a)
   const isOwner1b = verifyIsOwner(m1b)
   const isOwner1c = verifyIsOwner(m1c)
   if (isOwner1a && isOwner1b && isOwner1c) {
      passed++
      console.log('   ✅ LULUS — Owner disahkan sama ada melalui nombor telefon, device suffix, atau owner LID.')
   } else {
      console.log('   ❌ GAGAL — Pengesahan owner sah gagal.', { isOwner1a, isOwner1b, isOwner1c })
   }

   // ─── Ujian 2: Pengguna biasa (Non-owner) ─────────────────────────
   console.log('\n▶ [Ujian 2: Pengguna Biasa]')
   const m2 = createMockMessage({ sender: '60199999999@s.whatsapp.net' })
   const isOwner2 = verifyIsOwner(m2)
   if (!isOwner2) {
      passed++
      console.log('   ✅ LULUS — Pengguna biasa ditolak daripada status Owner.')
   } else {
      console.log('   ❌ GAGAL — Pengguna biasa tersalah anggap sebagai Owner!')
   }

   // ─── Ujian 3: ID yang hampir sama (Prefix Collision / 60111883748899) ──
   console.log('\n▶ [Ujian 3: ID Hampir Sama (Prefix Attack)]')
   const m3a = createMockMessage({ sender: '60111883748899@s.whatsapp.net' })
   const m3b = createMockMessage({ sender: '6011188374880@s.whatsapp.net' })
   const m3c = createMockMessage({ sender: '999999999@lid' }) // sebarang LID bukan owner
   const isOwner3a = verifyIsOwner(m3a)
   const isOwner3b = verifyIsOwner(m3b)
   const isOwner3c = verifyIsOwner(m3c)
   if (!isOwner3a && !isOwner3b && !isOwner3c) {
      passed++
      console.log('   ✅ LULUS — Nombor bermula dengan nombor owner atau random LID ditolak 100%.')
   } else {
      console.log('   ❌ GAGAL — Penyerang dengan nombor awalan serupa berjaya memintas pengesahan!', { isOwner3a, isOwner3b, isOwner3c })
   }

   // ─── Ujian 4: Mesej kosong atau ruang putih sahaja ───────────────
   console.log('\n▶ [Ujian 4: Mesej Kosong atau Ruang Putih Sahaja]')
   const m4 = createMockMessage()
   const sock4 = createMockSocket()
   await broadcastPlugin.run(m4, {
      db: { users: new Map() },
      store: { groupMetadata: new Map() },
      setting: { broadcastCooldown: 0 },
      sock: sock4,
      command: 'broadcast',
      text: '    ', // whitespace only
      isPrefix: '!'
   })
   if (m4.replies.length > 0 && m4.replies[0].includes('Contoh')) {
      passed++
      console.log('   ✅ LULUS — Mesej ruang putih ditolak dan memulangkan panduan format contoh.')
   } else {
      console.log('   ❌ GAGAL — Mesej kosong tidak ditolak dengan betul:', m4.replies)
   }

   // ─── Ujian 5: Arahan mempunyai nama hampir sama (!broadcastspam) ───
   console.log('\n▶ [Ujian 5: Arahan Hampir Sama (!broadcastspam)]')
   const m5 = createMockMessage()
   const sock5 = createMockSocket()
   await broadcastPlugin.run(m5, {
      db: { users: new Map([['60123456789@s.whatsapp.net', {}]]) },
      store: { groupMetadata: new Map() },
      setting: { broadcastCooldown: 0 },
      sock: sock5,
      command: 'broadcastspam', // bukan dalam whitelist
      text: 'Hello world',
      isPrefix: '!'
   })
   if (sock5.sentMessages.length === 0 && m5.replies.length === 0) {
      passed++
      console.log('   ✅ LULUS — Arahan luar whitelist diabaikan tanpa sebarang siaran mesej.')
   } else {
      console.log('   ❌ GAGAL — Arahan broadcastspam terlaksana secara salah!')
   }

   // ─── Ujian 6: JID peribadi vs Kumpulan (Target Separation) ─────────
   console.log('\n▶ [Ujian 6: Pengasingan JID Peribadi vs Kumpulan]')
   const db6 = {
      users: new Map([
         ['60121111111@s.whatsapp.net', {}],
         ['60122222222@s.whatsapp.net', {}]
      ])
   }
   const store6 = {
      groupMetadata: new Map([
         ['120363000000000001@g.us', { participants: [{ id: '60123333333@s.whatsapp.net' }] }],
         ['120363000000000002@g.us', { participants: [] }]
      ])
   }

   // 6a. Uji command 'broadcast' (Private chats only)
   const sock6a = createMockSocket()
   const m6a = createMockMessage()
   await broadcastPlugin.run(m6a, {
      db: db6,
      store: store6,
      setting: { broadcastCooldown: 0 },
      sock: sock6a,
      command: 'broadcast',
      text: 'Mesej Peribadi',
      isPrefix: '!'
   })
   const allPrivate = sock6a.sentMessages.every(msg => msg.id.endsWith('@s.whatsapp.net'))

   // 6b. Uji command 'broadcastgc' (Groups only)
   const sock6b = createMockSocket()
   const m6b = createMockMessage()
   await broadcastPlugin.run(m6b, {
      db: db6,
      store: store6,
      setting: { broadcastCooldown: 0 },
      sock: sock6b,
      command: 'broadcastgc',
      text: 'Mesej Group',
      isPrefix: '!'
   })
   const allGroups = sock6b.sentMessages.every(msg => msg.id.endsWith('@g.us'))

   if (allPrivate && allGroups && sock6a.sentMessages.length > 0 && sock6b.sentMessages.length > 0) {
      passed++
      console.log(`   ✅ LULUS — broadcast menyasarkan ${sock6a.sentMessages.length} private JID, broadcastgc menyasarkan ${sock6b.sentMessages.length} group JID.`)
   } else {
      console.log('   ❌ GAGAL — Sasaran bercampur aduk antara private dan group!')
   }

   // ─── Ujian 7: Kegagalan penghantaran terasing (Per-recipient failure) ───
   console.log('\n▶ [Ujian 7: Kegagalan Penghantaran Terasing]')
   const sock7 = createMockSocket({ failOnId: '60122222222@s.whatsapp.net' }) // simulasi fail pada user ke-2
   const m7 = createMockMessage()
   await broadcastPlugin.run(m7, {
      db: db6,
      store: { groupMetadata: new Map() },
      setting: { broadcastCooldown: 0 },
      sock: sock7,
      command: 'broadcast',
      text: 'Ujian ketahanan',
      isPrefix: '!'
   })
   // Penerima pertama (60121111111) mesti berjaya, penerima kedua gagal, keseluruhan tidak crash
   const successCount = sock7.sentMessages.length
   const replyText7 = m7.replies[0] || ''
   if (successCount === 1 && replyText7.includes('Gagal: 1')) {
      passed++
      console.log(`   ✅ LULUS — 1 penghantaran berjaya dan 1 gagal dilaporkan dengan terasing tanpa crash gelung.`)
   } else {
      console.log('   ❌ GAGAL — Ralat penghantaran tidak diasingkan:', { successCount, replyText7 })
   }

   // ─── Ujian 8: Had panjang mesej (Payload Size Guard) ──────────────
   console.log('\n▶ [Ujian 8: Had Panjang Mesej]')
   const m8 = createMockMessage()
   const sock8 = createMockSocket()
   const hugePayload = 'A'.repeat(5000) // melebihi had 4096 aksara
   await broadcastPlugin.run(m8, {
      db: db6,
      store: store6,
      setting: { broadcastCooldown: 0 },
      sock: sock8,
      command: 'broadcast',
      text: hugePayload,
      isPrefix: '!'
   })
   if (sock8.sentMessages.length === 0 && m8.replies[0]?.includes('terlalu panjang')) {
      passed++
      console.log('   ✅ LULUS — Payload berlebihan (5000 aksara) disekat serta-merta.')
   } else {
      console.log('   ❌ GAGAL — Payload berlebihan tidak disekat!')
   }

   // ─── Ujian 9: Permintaan serentak (Concurrency Mutex Lock) ─────────
   console.log('\n▶ [Ujian 9: Permintaan Serentak / Mutex Lock]')
   const m9a = createMockMessage()
   const m9b = createMockMessage()
   const sock9 = createMockSocket()

   // Jalankan dua broadcast serentak secara selari
   const p1 = broadcastPlugin.run(m9a, {
      db: db6,
      store: store6,
      setting: { broadcastCooldown: 50 }, // ada jeda supaya kekal running
      sock: sock9,
      command: 'broadcast',
      text: 'Broadcast 1',
      isPrefix: '!'
   })

   // Panggilan kedua dihantar serta-merta semasa p1 masih berjalan
   const p2 = broadcastPlugin.run(m9b, {
      db: db6,
      store: store6,
      setting: { broadcastCooldown: 50 },
      sock: sock9,
      command: 'broadcast',
      text: 'Broadcast 2 (Serentak)',
      isPrefix: '!'
   })

   await Promise.all([p1, p2])

   if (m9b.replies[0]?.includes('sedang berjalan')) {
      passed++
      console.log('   ✅ LULUS — Panggilan serentak kedua ditolak serta-merta oleh kunci Mutex.')
   } else {
      console.log('   ❌ GAGAL — Kunci Mutex gagal menyekat permintaan serentak:', m9b.replies)
   }

   // ─── Ujian 10: Input rosak & Malformed JIDs ───────────────────────
   console.log('\n▶ [Ujian 10: Input Rosak & Malformed JIDs]')
   const db10 = {
      users: new Map([
         ['', {}],                      // kosong
         ['not_a_jid', {}],             // tiada @
         ['60111111111@s.whatsapp.net', {}], // sah
         ['invalid@@domain.com', {}]     // format salah
      ])
   }
   const m10 = createMockMessage()
   const sock10 = createMockSocket()
   await broadcastPlugin.run(m10, {
      db: db10,
      store: { groupMetadata: new Map() },
      setting: { broadcastCooldown: 0 },
      sock: sock10,
      command: 'broadcast',
      text: 'Ujian data rosak',
      isPrefix: '!'
   })
   if (sock10.sentMessages.length === 1 && sock10.sentMessages[0].id === '60111111111@s.whatsapp.net') {
      passed++
      console.log('   ✅ LULUS — Hanya 1 JID yang sah diproses, semua JID rosak ditapis keluar.')
   } else {
      console.log('   ❌ GAGAL — JID rosak gagal ditapis:', sock10.sentMessages)
   }

   console.log('\n──────────────────────────────────────────────────────────────────')
   console.log(`KEPUTUSAN KESELURUHAN: ${passed} / ${total} UJIAN KESELAMATAN LULUS (${((passed / total) * 100).toFixed(0)}%)`)
   console.log('──────────────────────────────────────────────────────────────────\n')
}

runAllSecurityTests().catch(console.error)
