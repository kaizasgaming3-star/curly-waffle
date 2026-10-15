/*
 * Module "Rich HTML" — pengirim pesan HTML interaktif ke WhatsApp.
 *
 * WhatsApp punya tipe pesan `richResponseMessage` (dipakai AI bot resmi) yang
 * isinya bisa berupa HTML+CSS+JS dan dirender sebagai kartu interaktif di dalam
 * chat. Pesan ini TIDAK bisa dikirim lewat sock.sendMessage biasa, harus lewat
 * sock.relayMessage dengan struktur di bawah.
 *
 * Catatan penting soal batasan:
 *  - HTML-nya jalan di sandbox aplikasi WhatsApp. Tidak ada jalan buat kirim
 *    data balik ke bot (tidak ada fetch ke server bot, tidak ada callback).
 *    Jadi kalau butuh integrasi skor/leaderboard, pola yang dipakai adalah:
 *    data leaderboard DISUNTIK saat HTML dibuat, dan hasil permainan diklaim
 *    user dengan mengirim kode klaim yang muncul di dalam kartu.
 *  - Tidak semua versi WhatsApp mendukung. Di klien yang tidak mendukung,
 *    pesannya bisa tidak tampil sama sekali - makanya pemanggil sebaiknya
 *    mengirim juga pesan teks pendamping berisi instruksi.
 *
 * Dipakai oleh: plugins/games/tictactoe.js dan plugins/games/pou.js.
 */

// ID bot AI bawaan WhatsApp. Dipakai supaya klien mau merender kartu HTML-nya.
const DEFAULT_BOT_JID = '867051314767696@bot';

/*
 * Kapabilitas yang dideklarasikan pengirim (BotCapabilityMetadata.capabilities).
 * Nilainya dari enum BotCapabilityType di WAProto.
 *
 * Kenapa ini ada: payload lama mengirim `botMetadata: {}` KOSONG - tidak satu pun
 * kemampuan dinyatakan. Klien WhatsApp tampaknya mengunci fitur lanjutan kecuali
 * pengirimnya bilang mendukung, jadi selama ini kita mengetuk pintu yang memang
 * terkunci karena tidak pernah menyebut punya kuncinya.
 *
 *   34 RICH_RESPONSE_UNIFIED_RESPONSE  - kartu memang dikirim lewat unifiedResponse
 *   58 JSON_PATCH_STREAMING            - isi unifiedResponse boleh ditambal bertahap;
 *                                        ini kandidat terkuat mesin di balik "streamText"
 *   29 STREAMING_DISAGGREGATION        - pengiriman bertahap yang dipecah
 *    1 PROGRESS_INDICATOR              - penanda "sedang mengetik" ala Meta AI
 *   67 AI_RICH_RESPONSE_ARTIFACTS_ENABLED - konten interaktif yang dirender terpisah
 *   60 UNIFIED_RESPONSE_EMBEDDED_SCREENS  - layar tertanam di dalam respons
 *   55 RICH_RESPONSE_UR_BLOKS_ENABLED     - UI Bloks di dalam respons
 *    8 RICH_RESPONSE_STRUCTURED_RESPONSE
 *
 * BELUM TERBUKTI berpengaruh. Sangat mungkin klien hanya menghormatinya untuk bot
 * AI resmi Meta yang tanda tangannya sah, sementara botJid di atas cuma dipinjam.
 */
const KAPABILITAS_DEFAULT = [34, 58, 29, 1, 67, 60, 55, 8];

function buildRichHtmlPayload(html, options = {}) {
    const {
        title = 'Interactive',
        responseId = randomResponseId(),
        botJid = DEFAULT_BOT_JID,
        capabilities = KAPABILITAS_DEFAULT,
        // Daftar origin yang boleh dihubungi kartu. Selama ini SELALU dikirim
        // kosong, dan pengujian sandbox membuktikan kartunya memang tidak bisa
        // menghubungi apa pun - termasuk lewat <img>, yang biasanya paling
        // longgar. Blokir setotal itu berbau CSP, dan field inilah satu-satunya
        // tempat di payload yang bentuknya seperti daftar putih CSP. Belum
        // terbukti berpengaruh; disediakan supaya bisa diuji.
        trustedSources = [],
    } = options;

    return {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                // Dulu objek kosong. Sekarang kapabilitasnya dinyatakan - lihat
                // catatan di KAPABILITAS_DEFAULT.
                capabilityMetadata: {
                    capabilities: Array.isArray(capabilities) ? capabilities : KAPABILITAS_DEFAULT
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [
                        { messageType: 2, messageText: title }
                    ],
                    unifiedResponse: {
                        data: Buffer.from(JSON.stringify({
                            response_id: responseId,
                            sections: [
                                {
                                    view_model: {
                                        primitive: {
                                            __typename: 'GenAIaeacdsnwHtmlPrimitive',
                                            payload: html,
                                            trusted_sources: Array.isArray(trustedSources) ? trustedSources : []
                                        },
                                        __typename: 'GenAISingleLayoutViewModel'
                                    }
                                }
                            ]
                        })).toString('base64')
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: { botJid },
                        forwardOrigin: 4
                    }
                }
            }
        }
    };
}

// UUID v4 sederhana; WhatsApp cuma memakainya sebagai penanda respons.
function randomResponseId() {
    const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

/**
 * Kirim kartu HTML interaktif ke sebuah chat.
 * @param {object} [options.messageId] id pesan yang mau dipakai. Diisi kalau
 *        kartunya nanti mau DIEDIT - mengedit butuh kunci pesannya, dan kunci
 *        itu harus sudah dipegang sebelum pesannya dikirim.
 * @returns {Promise<string>} id pesan yang terkirim.
 */
async function sendRichHtml(sock, jid, html, options = {}) {
    if (!sock || typeof sock.relayMessage !== 'function') throw new Error('Socket tidak mendukung relayMessage.');
    if (!html || typeof html !== 'string') throw new Error('HTML kosong.');

    const opsiRelay = options.messageId ? { messageId: options.messageId } : {};
    const id = await sock.relayMessage(jid, buildRichHtmlPayload(html, options), opsiRelay);

    // relayMessage mengembalikan id yang dipakainya (dibuat sendiri kalau tidak
    // disodori). Dikembalikan apa adanya supaya pemanggil bisa menyimpannya.
    return id || options.messageId || null;
}

/**
 * Ganti isi kartu HTML yang SUDAH terkirim, di tempat.
 *
 * Ini satu-satunya jalan mendorong keadaan baru ke dalam kartu: sandbox-nya tidak
 * punya akses jaringan sama sekali (sudah dibuktikan lewat pengujian sandbox),
 * jadi kartu tidak mungkin menarik data sendiri. Yang bisa cuma bot mengirim ulang
 * seluruh HTML-nya sebagai suntingan.
 *
 * Dibungkus protocolMessage tipe MESSAGE_EDIT (14) - bentuk yang sama dipakai
 * baileys di lib/Utils/messages.js untuk menyunting pesan biasa. Bedanya di sini
 * harus dirakit tangan, karena kartu rich HTML tidak bisa lewat sock.sendMessage.
 *
 * @param {string} messageId id pesan kartu yang mau diganti isinya.
 */
async function editRichHtml(sock, jid, messageId, html, options = {}) {
    if (!sock || typeof sock.relayMessage !== 'function') throw new Error('Socket tidak mendukung relayMessage.');
    if (!messageId) throw new Error('messageId kosong; kartu tidak bisa diedit tanpa kuncinya.');
    if (!html || typeof html !== 'string') throw new Error('HTML kosong.');

    await sock.relayMessage(jid, {
        protocolMessage: {
            key: { remoteJid: jid, fromMe: true, id: messageId },
            editedMessage: buildRichHtmlPayload(html, options),
            timestampMs: Date.now(),
            type: 14
        }
    }, {});
    return true;
}

/**
 * Dorong isi baru ke kartu yang sudah terkirim, dengan MENGULANG relay memakai
 * responseId dan messageId yang SAMA.
 *
 * Bedanya dengan editRichHtml: yang ini bukan protocolMessage/MESSAGE_EDIT (sudah
 * diuji, kartu rich HTML tidak terpengaruh), melainkan meniru cara respons Meta AI
 * tumbuh bertahap - potongan berikutnya dikirim sebagai pesan bot dengan penanda
 * respons yang sama, lalu klien menggabungkannya. Itu yang disiratkan kapabilitas
 * JSON_PATCH_STREAMING dan STREAMING_DISAGGREGATION.
 *
 * MASIH DUGAAN. Kalau klien tidak menggabungkan, yang muncul adalah kartu baru
 * bertumpuk - dan itu sendiri sudah jawaban yang berguna.
 *
 * @param {string} responseId penanda respons; HARUS sama di tiap potongan.
 * @param {string} messageId  id pesan; HARUS sama di tiap potongan.
 */
async function streamRichHtml(sock, jid, html, options = {}) {
    if (!sock || typeof sock.relayMessage !== 'function') throw new Error('Socket tidak mendukung relayMessage.');
    if (!options.responseId) throw new Error('responseId wajib diisi dan harus sama tiap potongan.');
    if (!html || typeof html !== 'string') throw new Error('HTML kosong.');

    const opsi = options.messageId ? { messageId: options.messageId } : {};
    await sock.relayMessage(jid, buildRichHtmlPayload(html, options), opsi);
    return true;
}

export {
    sendRichHtml, editRichHtml, streamRichHtml, buildRichHtmlPayload,
    KAPABILITAS_DEFAULT
};
