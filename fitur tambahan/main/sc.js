import { getAssetBuffer } from "../../src/lib/ourin-asset-manager.js";
import config from "../../config.js"

const pluginConfig = {
    name: "sc",
    alias: ["script"],
    category: "main",
    description: "Script bot wa yang sudah di optimalkan",
    usage: ".sc",
    example: ".sc",
    isPremium: false,
    isOwner: false,
    isBanned: false,
    isAdmin: false,
    cooldown: 10,
    energi: 0,
    isBotAdmin: false,
    isEnabled: true
}

async function handler(m, { sock }) {
    return await sock.sendMessage(m.chat, {
        image: getAssetBuffer("ourin"),
        caption: `😄 Halo kak *${m.pushName}*
        
Untuk Script dari bot ini, kamu bisa dapatkan melalui link, nanti kamu tinggal search kata *OURIN MD* di Channel Senz`,
        footer: "🎯 Link ini nanti akan mengarahkan kamu ke Youtube *SenzOkkotsu*",
        interactiveButtons: [
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "😎 Kunjungi Youtube SenzOkkotsu",
                    url: "https://youtube.com/@SenzOkkotsu",
                    merchant_url: "https://youtube.com/@SenzOkkotsu"
                })
            }
        ]

    }, { quoted: m })
}

export { pluginConfig as config, handler }