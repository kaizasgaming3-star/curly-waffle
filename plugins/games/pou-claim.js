import { deleteClaim, getClaim } from '../../lib/Components/GameClaim.js'
import { frame } from '../../lib/Utilities.js'
import { POU_TARGET } from './pou.js'

export default {
   command: ['klaimpou', 'klaimcoin'],
   hidden: ['claimpou', 'claimcoin', 'klaimkoin'],
   category: 'games',
   async run(m, {
      user,
      isPrefix,
      command,
      text
   }) {
      const isCoin = command.includes('coin') || command.includes('koin')
      const inputCode = (text || '').trim().split(/\s+/)[0].toUpperCase()

      if (!inputCode)
         return m.reply(`👉🏻 *Example*: ${isPrefix + command} ABC123\n\n` + (isCoin ?
            `The coin code shows up inside the \`${isPrefix}pou\` card once you collect enough coins.` :
            `The code shows up inside the game card when your score passes ${POU_TARGET}.`))

      if (isCoin) {
         const pending = getClaim('pouCoin', m.sender)
         if (!pending?.kode?.[inputCode])
            return m.reply(`❌ Invalid or expired coin code.\n\nPlay \`${isPrefix}pou\` again to get a new one.`)

         const amount = pending.kode[inputCode]

         // Seluruh set kode dibuang, bukan cuma yang dipakai - kalau tidak, pemain
         // bisa mengklaim tingkat rendah lalu tingkat tinggi dari satu permainan.
         deleteClaim('pouCoin', m.sender)
         user.coin = (user.coin ?? 0) + amount

         return m.reply(frame('COIN ADDED', [
            `*Game*: Pou Naik Awan`,
            `*Reward*: +${amount} coin`,
            `*Your Coin*: ${user.coin}`
         ], '🪙'))
      }

      const pending = getClaim('pou', m.sender)
      if (!pending || pending.code !== inputCode)
         return m.reply(`❌ Invalid or expired code.\n\nPlay \`${isPrefix}pou\` again to get a new one.`)

      deleteClaim('pou', m.sender)
      user.limit += pending.reward

      m.reply(frame('CLAIM SUCCESS', [
         `*Game*: Pou Naik Awan`,
         `*Score*: passed ${POU_TARGET}`,
         `*Reward*: +${pending.reward} limit`,
         `*Your Limit*: ${user.limit}`
      ], '☁️'))
   }
}
