import {
   getBank,
   getWallet,
   hasShield,
   netWorth,
   rankOf,
   shieldRemaining,
   totalItems
} from '../../lib/Components/Economy.js'
import {
   getLevel,
   getXp,
   progressBar,
   rankTitle,
   xpToNext
} from '../../lib/Components/Leveling.js'
import { formatNumber, frame, toTime } from '../../lib/Utilities.js'

export default {
   command: ['balance', 'bal'],
   hidden: ['wallet', 'dompet', 'networth', 'saldo'],
   category: 'economy',
   async run(m, {
      db,
      user,
      isPartner
   }) {
      const wallet = getWallet(user)
      const bank = getBank(user)

      const { position, total } = rankOf(db.users, m.sender)

      const level = getLevel(user)
      const xp = getXp(user)
      const xpNeeded = xpToNext(level)

      const printWallet = frame('WALLET', [
         `Name      : ${user.name}`,
         `Wallet    : ${formatNumber(wallet)} coin`,
         `Bank      : ${formatNumber(bank)} coin`,
         `Net Worth : ${formatNumber(netWorth(user))} coin`
      ])

      const printProgress = frame('PROGRESS', [
         `Level  : ${level} (${rankTitle(level)})`,
         `XP     : ${formatNumber(xp)} / ${formatNumber(xpNeeded)}`,
         `        ${progressBar(xp, xpNeeded)}`,
         `Items  : ${totalItems(user)}`,
         `Rank   : ${position || '-'} of ${total}`,
         `Shield : ${hasShield(user) ? 'active ' + toTime(shieldRemaining(user)) : 'inactive'}`,
         `Limit  : ${isPartner ? 'Unlimited' : user.limit ?? 0}`,
         `Energy : ${isPartner ? 'Unlimited' : user.energy ?? 0}`
      ])

      m.reply(printWallet + '\n\n' + printProgress)
   }
}
