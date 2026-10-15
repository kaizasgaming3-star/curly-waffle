import { buildCardLeaderboard, setClaim } from '../../lib/Components/GameClaim.js'
import { buildPouHtml, generateClaimCode, maskNumber } from '../../lib/Components/PouCard.js'
import { sendRichHtml } from '../../lib/Components/RichHtml.js'

export const POU_REWARD = 3        // limit kalau target skor tercapai
export const POU_TARGET = 1500     // skor minimal (10 poin per awan)

export const ENERGY_COST = 15

// Tingkat hadiah koin. Nilai koinnya diacak tiap permainan supaya tidak selalu
// sama, tapi RENTANGNYA ditentukan server - kartu cuma memilih tingkat mana yang
// syarat koinnya sudah terpenuhi, bukan menentukan sendiri nilainya. Kalau nilainya
// ditentukan kartu, angkanya gampang dipalsukan.
const COIN_TIERS = [
   { minKoin: 3, min: 5, max: 15 },
   { minKoin: 10, min: 20, max: 40 },
   { minKoin: 20, min: 50, max: 90 }
]

const randomBetween = (min, max) =>
   Math.floor(Math.random() * (max - min + 1)) + min

export default {
   command: 'pou',
   category: 'games',
   energy: ENERGY_COST,
   async run(m, {
      sock,
      db,
      user,
      isPartner,
      isPrefix
   }) {
      const leaderboardCode = generateClaimCode()

      // Tiap permainan dapat kode & nilai baru, jadi kode dari permainan
      // sebelumnya otomatis mati.
      const coinTier = COIN_TIERS.map(tier => ({
         kode: generateClaimCode(),
         koin: randomBetween(tier.min, tier.max),
         minKoin: tier.minKoin
      }))

      const html = buildPouHtml({
         botName,
         playerName: m.pushName || maskNumber(m.sender.split('@')[0]),
         prefix: isPrefix,
         leaderboard: buildCardLeaderboard(db, m.sender),
         claimCode: leaderboardCode,
         claimReward: POU_REWARD,
         claimTarget: POU_TARGET,
         tierKoin: coinTier
      })

      try {
         await sendRichHtml(sock, m.chat, html, { title: `Pou Naik Awan - ${botName}` })
      }
      catch (error) {
         console.error('❌ Failed to send Pou card:', error)
         if (!isPartner) user.energy += ENERGY_COST
         return m.reply('❌ Failed to render the game card. This feature needs the latest WhatsApp version.')
      }

      setClaim('pou', m.sender, {
         code: leaderboardCode,
         reward: POU_REWARD
      })

      // Disimpan sebagai peta kode -> jumlah koin, supaya pemain cuma bisa
      // mengklaim tingkat yang kodenya benar-benar dia lihat di kartu.
      setClaim('pouCoin', m.sender, {
         kode: Object.fromEntries(coinTier.map(tier => [tier.kode, tier.koin]))
      })

      m.react('☁️')
   }
}
