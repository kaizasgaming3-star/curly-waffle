import {
   addCoin,
   BANK,
   DAILY,
   getBank,
   hasItem,
   MAX_ENERGY
} from '../../lib/Components/Economy.js'
import { formatNumber, frame, toTime } from '../../lib/Utilities.js'

/** Batas jeda sebelum streak dianggap putus (dua kali cooldown harian). */
const STREAK_GRACE = DAILY.cooldown * 2

export default {
   command: 'daily',
   hidden: ['harian', 'hadiah'],
   category: 'economy',
   async run(m, {
      user
   }) {
      const now = Date.now()
      const lastDaily = user.lastDaily ?? 0

      if (lastDaily && now - lastDaily < DAILY.cooldown)
         return m.reply(`You already claimed today's reward.\nCome back in ${toTime(DAILY.cooldown - (now - lastDaily))}.`)

      // Streak lanjut kalau masih di dalam masa tenggang; kalau bolong, mulai dari 1.
      const isContinued = lastDaily > 0 && now - lastDaily <= STREAK_GRACE
      const streak = isContinued ? Math.min((user.dailyStreak ?? 0) + 1, DAILY.maxStreak) : 1

      const hasVault = hasItem(user, DAILY.bonusItem)
      const vaultMultiplier = hasVault ? 1 + DAILY.vaultBonus : 1

      const baseCoin = DAILY.baseCoin + (streak - 1) * DAILY.streakCoin
      const coin = Math.floor(baseCoin * vaultMultiplier)

      // Bunga bank dihitung dari saldo SEBELUM setoran hari ini, supaya
      // menabung lalu langsung klaim tidak menghasilkan bunga instan.
      const interest = Math.min(
         BANK.interestCap,
         Math.floor(getBank(user) * BANK.interestRate * vaultMultiplier)
      )

      addCoin(user, coin)

      if (interest > 0)
         user.bank = getBank(user) + interest

      user.limit = (user.limit ?? 0) + DAILY.baseLimit

      const energyBefore = user.energy ?? 0
      user.energy = Math.min(MAX_ENERGY, energyBefore + DAILY.baseEnergy)
      const energyRestored = user.energy - energyBefore

      user.dailyStreak = streak
      user.lastDaily = now

      const print = frame('DAILY REWARD', [
         `Streak    : ${streak} day${streak > 1 ? 's' : ''} of ${DAILY.maxStreak}`,
         `Coin      : +${formatNumber(coin)}${hasVault ? ' (Vault bonus)' : ''}`,
         `Limit     : +${DAILY.baseLimit}`,
         `Energy    : +${energyRestored}`,
         `Interest  : ${interest > 0 ? '+' + formatNumber(interest) + ' coin to bank' : 'no bank balance yet'}`,
         `Wallet    : ${formatNumber(user.coin)} coin`,
         `Bank      : ${formatNumber(getBank(user))} coin`
      ])

      m.reply(print)
   }
}
