import {
   addCoin,
   BANK,
   getBank,
   getWallet,
   parseAmount,
   removeCoin
} from '../../lib/Components/Economy.js'
import { formatNumber, frame } from '../../lib/Utilities.js'

const DEPOSIT_ALIASES = Object.freeze(['deposit', 'nabung', 'depo'])

export default {
   command: ['deposit', 'withdraw'],
   hidden: ['nabung', 'depo', 'tarik', 'wd'],
   category: 'economy',
   async run(m, {
      user,
      isPrefix,
      command,
      text
   }) {
      const isDeposit = DEPOSIT_ALIASES.includes(command)
      const source = isDeposit ? getWallet(user) : getBank(user)

      const amount = parseAmount(text, source)

      if (amount === null)
         return m.reply(frame('HOW TO USE', [
            `Wallet : ${formatNumber(getWallet(user))} coin`,
            `Bank   : ${formatNumber(getBank(user))} coin`,
            '',
            `Example: ${isPrefix + command} 250`,
            `Example: ${isPrefix + command} all`
         ]))

      if (amount < 1)
         return m.reply(`Enter an amount of at least 1 coin.`)

      if (amount < BANK.minAmount && amount !== source)
         return m.reply(`Minimum ${isDeposit ? 'deposit' : 'withdrawal'} is ${formatNumber(BANK.minAmount)} coin.`)

      if (amount > source)
         return m.reply(`Not enough coin. You only have ${formatNumber(source)} in your ${isDeposit ? 'wallet' : 'bank'}.`)

      if (isDeposit) {
         removeCoin(user, amount)
         user.bank = getBank(user) + amount
      }
      else {
         user.bank = getBank(user) - amount
         addCoin(user, amount)
      }

      const print = frame(isDeposit ? 'DEPOSIT' : 'WITHDRAWAL', [
         `Amount : ${isDeposit ? '+' : '-'}${formatNumber(amount)} coin`,
         `Wallet : ${formatNumber(getWallet(user))} coin`,
         `Bank   : ${formatNumber(getBank(user))} coin`,
         isDeposit ? 'Coin in the bank is safe from rob attempts.' : 'Coin in your wallet can be stolen by robbers.'
      ])

      m.reply(print)
   }
}
