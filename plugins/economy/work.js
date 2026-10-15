import {
   addCoin,
   hasItem,
   WORK
} from '../../lib/Components/Economy.js'
import {
   formatNumber,
   frame,
   randomInteger,
   randomValue,
   toTime
} from '../../lib/Utilities.js'

/** Daftar kerjaan. Cuma bumbu cerita - upahnya tetap dihitung dari aturan WORK. */
const JOBS = Object.freeze([
   { emoji: '🚚', name: 'delivering parcels' },
   { emoji: '🍜', name: 'running a noodle stall' },
   { emoji: '🧹', name: 'cleaning offices' },
   { emoji: '📦', name: 'sorting warehouse boxes' },
   { emoji: '🛵', name: 'riding for food delivery' },
   { emoji: '💻', name: 'fixing a broken laptop' },
   { emoji: '🌾', name: 'helping at the rice field' },
   { emoji: '🎣', name: 'selling the morning catch' },
   { emoji: '🧺', name: 'doing the laundry' },
   { emoji: '🔧', name: 'repairing a motorbike' }
])

export default {
   command: ['work', 'job'],
   hidden: ['kerja', 'nguli', 'cariuang'],
   category: 'economy',
   async run(m, {
      user
   }) {
      const now = Date.now()
      const lastWork = user.lastWork ?? 0

      if (lastWork && now - lastWork < WORK.cooldown)
         return m.reply(`You are still tired.\nRest for ${toTime(WORK.cooldown - (now - lastWork))} before working again.`)

      const job = randomValue(JOBS)

      const basePay = randomInteger(WORK.min, WORK.max)
      const hasPickaxe = hasItem(user, WORK.bonusItem)
      const pay = hasPickaxe ? Math.floor(basePay * (1 + WORK.pickaxeBonus)) : basePay

      addCoin(user, pay)
      user.lastWork = now

      const print = frame('WORK REPORT', [
         `${job.emoji} You spent the day ${job.name}.`,
         `Earned  : +${formatNumber(pay)} coin`,
         hasPickaxe ? `Bonus   : +${formatNumber(pay - basePay)} coin from Pickaxe` : 'Bonus   : none (buy a Pickaxe to earn more)',
         `Wallet  : ${formatNumber(user.coin)} coin`,
         `Next    : ${toTime(WORK.cooldown)}`
      ])

      m.reply(print)
   }
}
