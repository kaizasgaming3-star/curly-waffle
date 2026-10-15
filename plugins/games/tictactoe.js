import { buildCardLeaderboard, setClaim } from '../../lib/Components/GameClaim.js'
import { sendRichHtml } from '../../lib/Components/RichHtml.js'
import { buildTicTacToeHtml, generateClaimCode, maskNumber } from '../../lib/Components/TicTacToeCard.js'

// Hadiah kalau pemain menang lawan AI level Master. Angkanya disamakan dengan
// ekonomi game kuis di bot ini (hadiah 1-5 limit), bukan angka ratusan seperti
// bot asalnya yang memakai field score terpisah.
export const TICTACTOE_REWARD = 5

export const ENERGY_COST = 15

export default {
   command: 'tictactoe',
   hidden: 'ttt',
   category: 'games',
   energy: ENERGY_COST,
   async run(m, {
      sock,
      db,
      user,
      isPartner,
      isPrefix
   }) {
      const claimCode = generateClaimCode()
      const html = buildTicTacToeHtml({
         botName,
         playerName: m.pushName || maskNumber(m.sender.split('@')[0]),
         prefix: isPrefix,
         leaderboard: buildCardLeaderboard(db, m.sender),
         claimCode,
         claimReward: TICTACTOE_REWARD
      })

      try {
         await sendRichHtml(sock, m.chat, html, { title: `Tic-Tac-Toe - ${botName}` })
      }
      catch (error) {
         // Tidak semua versi WhatsApp bisa merender kartu HTML. Kalau relay gagal,
         // jangan diamkan - kasih tahu user daripada dia mengira botnya mati.
         console.error('❌ Failed to send Tic-Tac-Toe card:', error)
         // Energy sudah dipotong Listener SEBELUM run(). Kartunya tidak sampai,
         // jadi dikembalikan - user tidak boleh bayar untuk yang tidak dia terima.
         if (!isPartner) user.energy += ENERGY_COST
         return m.reply('❌ Failed to render the game card. This feature needs the latest WhatsApp version.')
      }

      // Kode baru didaftarkan SETELAH kartunya benar-benar terkirim, supaya kode
      // lama yang masih berlaku tidak hangus gara-gara relay yang gagal.
      setClaim('ttt', m.sender, {
         code: claimCode,
         reward: TICTACTOE_REWARD
      })

      m.react('🎮')
   }
}
