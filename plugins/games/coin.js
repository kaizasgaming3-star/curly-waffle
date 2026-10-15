import { frame, medal } from '../../lib/Utilities.js'

export default {
   command: 'coin',
   hidden: ['koin', 'coinboard'],
   category: 'games',
   async run(m, {
      db,
      user,
      isPrefix
   }) {
      const holders = [...new Set(db.users.values())]
         .filter(data => (data?.coin ?? 0) > 0)
         .sort((a, b) => (b.coin ?? 0) - (a.coin ?? 0))

      const printBalance = frame('COIN BALANCE', [
         `*Name*: ${user.name}`,
         `*Coin*: ${user.coin ?? 0}`,
         `*Ranked At*: ${holders.findIndex(data => data.jid === user.jid) + 1 || '-'} of ${holders.length} holders`
      ], '🪙')

      if (!holders.length)
         return m.reply(printBalance + `\n\n💭 Nobody has collected any coin yet. Play \`${isPrefix}pou\` to start.`)

      const printBoard = frame('COIN BOARD', holders.slice(0, 10).flatMap((data, index, array) => {
         const lines = [
            `${medal(index)} ${data.name}`,
            `*Coin*: ${data.coin}`
         ]
         if (index !== array.length - 1)
            lines.push('')
         return lines
      }), '📊')

      m.reply(printBalance + '\n\n' + printBoard)
   }
}
