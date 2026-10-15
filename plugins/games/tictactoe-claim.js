import { deleteClaim, getClaim } from '../../lib/Components/GameClaim.js'
import { frame } from '../../lib/Utilities.js'

export default {
   command: 'klaimttt',
   hidden: ['claimttt', 'claimtictactoe'],
   category: 'games',
   async run(m, {
      user,
      isPrefix,
      command,
      text
   }) {
      const inputCode = (text || '').trim().split(/\s+/)[0].toUpperCase()
      if (!inputCode)
         return m.reply(`👉🏻 *Example*: ${isPrefix + command} ABC123\n\nThe code shows up inside the game card after you beat the Master level AI.`)

      const pending = getClaim('ttt', m.sender)
      if (!pending || pending.code !== inputCode)
         return m.reply(`❌ Invalid or expired code.\n\nPlay \`${isPrefix}tictactoe\` again and beat the Master level to get a new one.`)

      // Kode dibuang duluan: satu kemenangan = satu klaim, dan kalau user
      // mengirim dua pesan sekaligus yang kedua tidak kebagian.
      deleteClaim('ttt', m.sender)
      user.limit += pending.reward

      m.reply(frame('CLAIM SUCCESS', [
         `*Game*: Tic-Tac-Toe`,
         `*Reward*: +${pending.reward} limit`,
         `*Your Limit*: ${user.limit}`
      ], '🎮'))
   }
}
