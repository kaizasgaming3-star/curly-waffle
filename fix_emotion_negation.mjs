import fs from 'fs';

const filePath = 'plugins/ai/denia.js';
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Fix prompt tokens
content = content.replace('Panggil Kaizas: "denia", "sayanggg", "cinta", "abang", atau "suamiku". DILARANG guna panggilan "denia"!', 'Panggil Kaizas: "sayang", "sayanggg", "cinta", "abang", atau "suamiku". DILARANG guna panggilan "hubby"!');
content = content.replace('🥰/💕 untuk denia', '🥰/💕 untuk sayang');
content = content.replace('DILARANG memanggil pengguna ini sebagai "denia"', 'DILARANG memanggil pengguna ini sebagai "sayang"');
content = content.replace('downloadkan video TikTok ni untuk denia~', 'downloadkan video TikTok ni untuk sayang~');

// 2. Refactor pickEmotion so that negation of sadness (e.g. "tak sedih", "mana ada sedih", "bukan sedih", "jangan sedih")
// is NOT detected as sad!
const oldPickEmotion = `function pickEmotion(userText = '', botAnswer = '', isKaizas = false) {
   const combined = (userText + ' ' + botAnswer).toLowerCase()

   // 1. Marah / Merajuk / Geram / Menyampah (Untuk Kaizas mahupun orang lain)
   if (
      combined.includes('marah') ||
      combined.includes('merajuk') ||
      combined.includes('geram') ||
      combined.includes('benci') ||
      combined.includes('bodoh') ||
      combined.includes('gila') ||
      combined.includes('babi') ||
      combined.includes('anjing') ||
      combined.includes('jahat') ||
      combined.includes('menyampah') ||
      combined.includes('degil') ||
      combined.includes('jangan mengada') ||
      combined.includes('tak malu ke') ||
      (combined.includes('isteri kaizas') && !isKaizas)
   ) {
      return 'angry'
   }

   // 2. Sedih / Menangis / Meratap / Kecewa / Minta maaf / Broken / Emoticon Sedih
   if (
      combined.includes('sedih') ||
      combined.includes('nangis') ||
      combined.includes('menangis') ||
      combined.includes('kecewa') ||
      combined.includes('maaf') ||
      combined.includes('sorry') ||
      combined.includes('sampai hati') ||
      combined.includes('luka') ||
      combined.includes('sakit hati') ||
      combined.includes('broken') ||
      combined.includes('down') ||
      combined.includes('sunyi') ||
      combined.includes('kesepian') ||
      combined.includes('sayu') ||
      combined.includes('pilu') ||
      combined.includes('penat') ||
      combined.includes('lelah') ||
      combined.includes('tinggalkan') ||
      combined.includes('putus') ||
      combined.includes('🥺') ||
      combined.includes('😭') ||
      combined.includes('😢') ||
      combined.includes('😿') ||
      combined.includes('💔') ||
      combined.includes('😔') ||
      combined.includes('😞')
   ) {
      return 'sad'
   }

   // 3. Malu / Blushing / Comel / Cantik / Menggoda / Dipuji
   if (
      combined.includes('malu') ||
      combined.includes('blush') ||
      combined.includes('comel') ||
      combined.includes('cantik') ||
      combined.includes('lawa') ||
      combined.includes('seksi') ||
      combined.includes('manis') ||
      combined.includes('sweet') ||
      combined.includes('muah') ||
      combined.includes('cium') ||
      combined.includes('peluk')
   ) {
      return 'shy'
   }

   // 4. Gembira / Ketawa / Ceria / Lucu
   if (
      combined.includes('gembira') ||
      combined.includes('happy') ||
      combined.includes('seronok') ||
      combined.includes('kelakar') ||
      combined.includes('haha') ||
      combined.includes('hehe') ||
      combined.includes('lawak') ||
      combined.includes('senang') ||
      combined.includes('yeay')
   ) {
      return 'happy'
   }

   // 5. Cool / TikTok / Berjaya / Mantap
   if (
      combined.includes('tiktok') ||
      combined.includes('berjaya') ||
      combined.includes('mantap') ||
      combined.includes('hebat') ||
      combined.includes('pro') ||
      combined.includes('padu')
   ) {
      return 'cool'
   }

   // 6. Sayang / Cinta / Romantik khas (lalai untuk Kaizas jika mesra biasa)
   if (
      combined.includes('sayang') ||
      combined.includes('cinta') ||
      combined.includes('love') ||
      combined.includes('rindu')
   ) {
      return 'love'
   }

   // Jika Kaizas sedang bersembang biasa -> love, jika pengguna biasa -> happy
   return isKaizas ? 'love' : 'happy'
}`;

const newPickEmotion = `function pickEmotion(userText = '', botAnswer = '', isKaizas = false) {
   const lowerBot = (botAnswer || '').toLowerCase()
   const lowerUser = (userText || '').toLowerCase()
   const combined = (lowerUser + ' ' + lowerBot)

   // 1. Semak penafian emosi sedih (Contoh: "mana ada sedih", "tak sedih", "jangan sedih", "bukan sedih")
   const isNegatingSad = /\\b(tak|x|bukan|mana ada|jangan|dah tak|tiada)\\s+(?:rasa\\s+)?sedih\\b/i.test(combined) ||
                         /mana ada.*sedih/i.test(combined) ||
                         /jangan sedih/i.test(combined) ||
                         /dah senyum/i.test(combined)

   // 2. Gembira / Ketawa / Senyum / Peluk / Mesra
   if (
      lowerBot.includes('senyum') ||
      lowerBot.includes('gembira') ||
      lowerBot.includes('ketawa') ||
      lowerBot.includes('😆') ||
      lowerBot.includes('😄') ||
      lowerBot.includes('🥰') ||
      lowerBot.includes('✨') ||
      combined.includes('gembira') ||
      combined.includes('happy') ||
      combined.includes('seronok') ||
      combined.includes('kelakar') ||
      combined.includes('haha') ||
      combined.includes('hehe') ||
      combined.includes('yeay')
   ) {
      if (isKaizas) {
         // Kaizas yang berpelukan / mesra / senyum -> love atau happy
         if (combined.includes('peluk') || combined.includes('sayang') || combined.includes('cinta') || combined.includes('rindu')) {
            return 'love'
         }
         return 'happy'
      }
      return 'happy'
   }

   // 3. Malu / Blushing / Menggoda / Dipuji
   if (
      lowerBot.includes('😳') ||
      lowerBot.includes('🙈') ||
      combined.includes('malu') ||
      combined.includes('blush') ||
      combined.includes('comel') ||
      combined.includes('cantik') ||
      combined.includes('lawa') ||
      combined.includes('manis') ||
      combined.includes('sweet')
   ) {
      return 'shy'
   }

   // 4. Marah / Merajuk / Geram (termasuk merajuk comel dengan Kaizas)
   if (
      lowerBot.includes('😾') ||
      lowerBot.includes('😤') ||
      combined.includes('marah') ||
      combined.includes('merajuk') ||
      combined.includes('geram') ||
      combined.includes('benci') ||
      combined.includes('degil') ||
      (combined.includes('isteri kaizas') && !isKaizas)
   ) {
      return 'angry'
   }

   // 5. Sedih / Menangis HANYA jika bukan penafian!
   if (!isNegatingSad) {
      if (
         lowerBot.includes('😭') ||
         lowerBot.includes('😢') ||
         lowerBot.includes('💔') ||
         combined.includes('sedih') ||
         combined.includes('nangis') ||
         combined.includes('menangis') ||
         combined.includes('kecewa') ||
         combined.includes('broken') ||
         combined.includes('sampai hati') ||
         combined.includes('luka') ||
         combined.includes('sakit hati')
      ) {
         return 'sad'
      }
   }

   // 6. Cool / TikTok / Berjaya
   if (combined.includes('tiktok') || combined.includes('berjaya') || combined.includes('mantap')) {
      return 'cool'
   }

   // 7. Kasih Sayang / Mesra
   if (combined.includes('sayang') || combined.includes('cinta') || combined.includes('rindu') || combined.includes('peluk')) {
      return 'love'
   }

   return isKaizas ? 'love' : 'happy'
}`;

if (content.includes(oldPickEmotion)) {
   content = content.replace(oldPickEmotion, newPickEmotion);
   console.log('✅ Replaced pickEmotion with smart negation handling!');
} else {
   console.log('❌ Old pickEmotion not matched');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done updating denia.js');

