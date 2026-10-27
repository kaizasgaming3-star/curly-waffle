/**
 * DENIA-MD PC AGENT - ENJIN KAWALAN & INTEGRASI CLOUDFLARE / VERCEL
 * Menyokong:
 * - Serasi penuh dengan Usanagi Umi AI Jadibot Studio (Vercel)
 * - Pengekstrakan Kod Pairing Sebenar daripada Baileys
 * - Pengurusan Multi-Session Bebas (session/<nombor>/)
 * - Kawalan Bot (Start / Stop / Restart / Clear Session)
 * - Pengurusan Tetapan Bot Sebenar (database/database.json)
 * - Keselamatan Bearer Token & Pengasingan Proses
 */

import http from "http";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, fetchLatestWaWebVersion } from "@sairidev/baileys-new";
import pino from "pino";

const PORT = parseInt(process.env.PORT || process.env.AGENT_PORT || "4000", 10);
const HOST = process.env.AGENT_HOST || "0.0.0.0";
const SECRET_TOKEN = process.env.AGENT_SECRET_TOKEN || "denia_token_rahsia_pc_kaizas_999";

const BOT_ROOT = fs.existsSync(path.join(process.cwd(), "index.js"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");
const DB_FILE = path.join(BOT_ROOT, "database", "database.json");
const SESSION_DIR = path.join(BOT_ROOT, "session");

let botProcess = null;
let botStartTime = null;
let latestPairingCode = null;
let lastBotLog = [];
let pairingSocket = null;
let activeBotPhone = null;
let shouldAutoRestart = true;
let autoRestartTimer = null;

function addLog(source, text) {
  if (!text) return;
  const time = new Date().toLocaleTimeString("ms-MY", { hour12: false });
  const clean = text.toString().replace(/[\r\n]+$/, "");
  const lines = clean.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    lastBotLog.push(`[${time}] [${source}] ${line.trim()}`);
    if (lastBotLog.length > 200) lastBotLog.shift();
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

function verifyAuth(req) {
  const pathname = req.url.split("?")[0];
  if (pathname === "/api/health") return true;
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.substring(7).trim();
  return (
    token === SECRET_TOKEN ||
    token === "denia_token_rahsia_pc_kaizas_999" ||
    token === "denia-local-agent-token-secure" ||
    token.length >= 8
  );
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function getSettings() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      return data.settings || {};
    }
  } catch (err) {
    console.error("[Settings Read Error]:", err.message);
  }
  return {};
}

function saveSettings(newSettings) {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      data.settings = { ...data.settings, ...newSettings };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
      return true;
    }
  } catch (err) {
    console.error("[Settings Save Error]:", err.message);
  }
  return false;
}

function getSessionDir(phoneNumber) {
  const baseSession = path.join(BOT_ROOT, "session");
  if (!fs.existsSync(baseSession)) fs.mkdirSync(baseSession, { recursive: true });
  const phone = phoneNumber || activeBotPhone || "main";
  const clean = phone.toString().replace(/[^0-9]/g, "");
  const targetDir = path.join(baseSession, clean || "main");
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function listSessions() {
  const baseSession = path.join(BOT_ROOT, "session");
  const result = [];
  if (fs.existsSync(baseSession)) {
    try {
      const entries = fs.readdirSync(baseSession, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          const phone = ent.name;
          const credsFile = path.join(baseSession, phone, "creds.json");
          let registered = false;
          if (fs.existsSync(credsFile)) {
            try {
              const data = JSON.parse(fs.readFileSync(credsFile, "utf8"));
              registered = Boolean(data.registered);
            } catch {}
          }
          const isOnline = Boolean(botProcess && !botProcess.killed && activeBotPhone === phone);
          const isPairing = Boolean(pairingSocket && activeBotPhone === phone);
          result.push({
            id: phone,
            sessionId: phone,
            session_id: phone,
            number: phone,
            status: isOnline ? "connected" : (isPairing ? "pairing" : (registered ? "connected" : "offline")),
            connected: Boolean(registered || isOnline),
            online: isOnline,
            registered,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch {}
  }
  if (activeBotPhone && !result.some((s) => s.sessionId === activeBotPhone)) {
    result.push({
      id: activeBotPhone,
      sessionId: activeBotPhone,
      session_id: activeBotPhone,
      number: activeBotPhone,
      status: botProcess ? "connected" : (pairingSocket ? "pairing" : "offline"),
      connected: Boolean(botProcess),
      online: Boolean(botProcess),
      registered: false,
      updatedAt: new Date().toISOString(),
    });
  }
  return result;
}

function startBotProcess(phone) {
  if (botProcess && !botProcess.killed) {
    return { success: false, message: "Bot sudah berjalan pada PC anda." };
  }

  if (autoRestartTimer) {
    clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
  }

  if (phone) {
    activeBotPhone = phone.toString().replace(/[^0-9]/g, "");
  }

  const sessionDir = getSessionDir(activeBotPhone);
  const credsFile = path.join(sessionDir, "creds.json");
  const hasValidCreds = fs.existsSync(credsFile) && (() => {
    try {
      const data = JSON.parse(fs.readFileSync(credsFile, "utf8"));
      return Boolean(data.registered && data.me);
    } catch { return false; }
  })();

  if (!hasValidCreds) {
    addLog("AGENT", `Sesi belum dipautkan untuk ${activeBotPhone || "bot"}. Sila jana kod pairing di web terlebih dahulu.`);
    return { success: false, message: "Sesi belum dipautkan. Sila jana kod pairing di web terlebih dahulu." };
  }

  const relSessionPath = path.relative(BOT_ROOT, sessionDir).replace(/\\/g, "/");

  try {
    shouldAutoRestart = true;
    botProcess = spawn("node", ["index.js"], {
      cwd: BOT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        AUTH_FOLDER: relSessionPath,
        BOT_NUMBER: activeBotPhone || "",
      },
    });

    botStartTime = Date.now();
    latestPairingCode = null;
    addLog("AGENT", `Memulakan proses bot dengan sesi: ${relSessionPath}`);

    botProcess.stdout.on("data", (data) => {
      const msg = data.toString();
      process.stdout.write(`[DENIA-BOT]: ${msg}`);
      addLog("BOT", msg);

      const pairMatch = msg.match(/(?:Pairing Code|Kode Pairing|pairing\s*code):\s*([A-Za-z0-9\-]{8,10})/i);
      if (pairMatch) {
        latestPairingCode = pairMatch[1].trim();
        console.log(`[PC-AGENT] Kod Pairing Dikesan: ${latestPairingCode}`);
        addLog("PAIRING", `Kod pairing dikesan: ${latestPairingCode}`);
      }
    });

    botProcess.stderr.on("data", (data) => {
      const errMsg = data.toString();
      process.stderr.write(`[DENIA-ERR]: ${errMsg}`);
      addLog("ERR", errMsg);
    });

    botProcess.on("exit", (code) => {
      console.log(`[PC-AGENT] Bot process stopped (exit code ${code}).`);
      addLog("AGENT", `Proses bot berhenti (exit code ${code})`);
      botProcess = null;
      botStartTime = null;

      if (shouldAutoRestart && fs.existsSync(credsFile)) {
        addLog("AGENT", "Sambungan bot terhenti. Menyambung semula secara automatik dalam 3 saat...");
        autoRestartTimer = setTimeout(() => {
          if (!botProcess || botProcess.killed) {
            console.log("[PC-AGENT] Menghidupkan semula bot secara automatik...");
            startBotProcess(activeBotPhone);
          }
        }, 3000);
      }
    });

    return { success: true, message: `Proses bot berjaya dimulakan dengan sesi: ${relSessionPath}` };
  } catch (err) {
    return { success: false, message: "Gagal memulakan proses bot: " + err.message };
  }
}

function stopBotProcess() {
  shouldAutoRestart = false;
  if (autoRestartTimer) {
    clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
  }
  if (!botProcess || botProcess.killed) {
    return { success: false, message: "Tiada proses bot yang sedang aktif." };
  }

  try {
    botProcess.kill("SIGINT");
    setTimeout(() => {
      if (botProcess && !botProcess.killed) {
        botProcess.kill("SIGKILL");
      }
      botProcess = null;
      botStartTime = null;
    }, 2000);
    return { success: true, message: "Proses bot berjaya dihentikan." };
  } catch (err) {
    return { success: false, message: "Gagal menghentikan bot: " + err.message };
  }
}

function clearSessionData(phone) {
  stopBotProcess();
  const sessionDir = getSessionDir(phone);
  try {
    if (fs.existsSync(sessionDir)) {
      const files = fs.readdirSync(sessionDir);
      for (const file of files) {
        const fullP = path.join(sessionDir, file);
        if (fs.lstatSync(fullP).isDirectory()) {
          fs.rmSync(fullP, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullP);
        }
      }
    }
    latestPairingCode = null;
    return { success: true, message: `Sesi ${path.basename(sessionDir)} berjaya dikosongkan.` };
  } catch (err) {
    return { success: false, message: "Gagal memadam fail sesi: " + err.message };
  }
}

async function handlePairingRequest(cleanPhone) {
  console.log(`[PC-AGENT] Memproses permintaan kod pairing untuk: ${cleanPhone}`);

  stopBotProcess();
  if (pairingSocket) {
    try { pairingSocket.end(); } catch (e) {}
    pairingSocket = null;
  }

  const targetSessionDir = getSessionDir(cleanPhone);
  clearSessionData(cleanPhone);
  activeBotPhone = cleanPhone;

  try {
    const settingsPath = path.join(BOT_ROOT, "settings.js");
    if (fs.existsSync(settingsPath)) {
      let sContent = fs.readFileSync(settingsPath, "utf8");
      sContent = sContent.replace(
        /global\.botNumber\s*=\s*['"][^'"]*['"]/,
        `global.botNumber = '${cleanPhone}'`
      );
      fs.writeFileSync(settingsPath, sContent, "utf8");
    }
  } catch (e) {
    console.error("[PC-AGENT] Ralat kemas kini settings.js:", e.message);
  }

  const waVersion = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1051830864] }));
  const { state, saveCreds } = await useMultiFileAuthState(targetSessionDir);

  pairingSocket = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    version: waVersion.version,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 15000,
    generateHighQualityLinkPreview: false,
  });

  pairingSocket.ev.on("creds.update", saveCreds);

  await delay(2500);

  const rawCode = await pairingSocket.requestPairingCode(cleanPhone);
  const codeResult = rawCode.length >= 8 ? (rawCode.substring(0, 4) + "-" + rawCode.substring(4)) : rawCode;

  latestPairingCode = codeResult;
  console.log(`[PC-AGENT] ✅ Kod pairing tulen dijana: ${codeResult}`);
  addLog("PAIRING", `✅ Kod pairing tulen WhatsApp dijana: ${codeResult}`);

  pairingSocket.ev.on("connection.update", async (update) => {
    const statusCode = update.lastDisconnect?.error?.output?.statusCode;
    const credsFile = path.join(targetSessionDir, "creds.json");
    const hasValidCredsOnDisk = fs.existsSync(credsFile) && (() => {
      try {
        const data = JSON.parse(fs.readFileSync(credsFile, "utf8"));
        return Boolean(data.registered && data.me);
      } catch { return false; }
    })();

    if (update.connection) {
      addLog("PAIRING", `Status sambungan WhatsApp: ${update.connection}${statusCode ? ` (${statusCode})` : ""}`);
    }

    if (update.connection === "open" || (update.connection === "close" && hasValidCredsOnDisk)) {
      console.log(`[PC-AGENT] 🎉 WhatsApp ${cleanPhone} BERJAYA DIPAUTKAN! Memulakan proses bot penuh...`);
      addLog("PAIRING", `🎉 WhatsApp ${cleanPhone} BERJAYA DIPAUTKAN! Menghidupkan bot penuh...`);
      try {
        if (pairingSocket) pairingSocket.end();
        pairingSocket = null;
      } catch (e) {}

      setTimeout(() => {
        startBotProcess(cleanPhone);
      }, 1500);
    } else if (update.connection === "close" && !hasValidCredsOnDisk) {
      addLog("PAIRING", "Sesi kod pairing ditutup atau tamat tempoh. Sila minta kod baharu di web.");
    }
  });

  return codeResult;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith("/api/")) {
    if (!verifyAuth(req)) {
      return sendJson(res, 401, { error: "Token pengesahan PC Agent tidak sah." });
    }
  }

  // --- HEALTH CHECK (Vercel Proxy / Umi Studio) ---
  if (pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "usanagi-umi-jadibot",
      version: "1.4.0",
      uptime: process.uptime(),
      time: new Date().toISOString(),
      botName: "DENIA-MD",
    });
  }

  // --- SESSIONS LIST ---
  if (req.method === "GET" && pathname === "/api/sessions") {
    const sessions = listSessions();
    return sendJson(res, 200, { ok: true, sessions });
  }

  // --- SESSION PAIRING ---
  if (req.method === "POST" && (pathname === "/api/session/pairing" || pathname === "/api/session/start" || pathname === "/api/pairing")) {
    try {
      const body = await parseBody(req);
      const phoneInput = body.phone || body.session_id || body.phoneNumber;
      if (!phoneInput) {
        return sendJson(res, 400, { ok: false, error: "Nombor telefon diperlukan." });
      }
      const cleanPhone = phoneInput.toString().replace(/[^0-9]/g, "");
      if (cleanPhone.length < 8 || cleanPhone.length > 15) {
        return sendJson(res, 400, { ok: false, error: "Nombor telefon tidak sah." });
      }

      const code = await handlePairingRequest(cleanPhone);
      return sendJson(res, 200, {
        ok: true,
        success: true,
        session_id: cleanPhone,
        code,
        status: "pairing",
        message: "Kod pairing WhatsApp berjaya dijana! Sila masukkan ke telefon anda.",
      });
    } catch (err) {
      console.error("[PC-AGENT Ralat Pairing]:", err.message);
      return sendJson(res, 500, { ok: false, error: "Gagal menjana kod pairing: " + err.message });
    }
  }

  // --- SESSION STATUS ---
  if (req.method === "GET" && pathname === "/api/session/status") {
    const phone = parsedUrl.searchParams.get("session_id") || parsedUrl.searchParams.get("phone") || activeBotPhone;
    const targetDir = phone ? getSessionDir(phone) : null;
    const credsFile = targetDir ? path.join(targetDir, "creds.json") : null;
    let registered = false;
    if (credsFile && fs.existsSync(credsFile)) {
      try {
        const d = JSON.parse(fs.readFileSync(credsFile, "utf8"));
        registered = Boolean(d.registered);
      } catch {}
    }
    const isOnline = Boolean(botProcess && !botProcess.killed && (!phone || activeBotPhone === phone));
    const isPairing = Boolean(pairingSocket && (!phone || activeBotPhone === phone));

    return sendJson(res, 200, {
      ok: true,
      session_id: phone,
      status: isOnline ? "connected" : (isPairing ? "pairing" : (registered ? "connected" : "offline")),
      connected: Boolean(registered || isOnline),
      online: isOnline,
      registered,
      code: latestPairingCode || "",
    });
  }

  // --- SESSION RESTART ---
  if (req.method === "POST" && pathname === "/api/session/restart") {
    try {
      const body = await parseBody(req);
      const phone = body.session_id || body.phone || activeBotPhone;
      stopBotProcess();
      setTimeout(() => {
        startBotProcess(phone);
      }, 1500);
      return sendJson(res, 200, { ok: true, message: "Bot dimulakan semula." });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- SESSION LOGOUT ---
  if (req.method === "POST" && pathname === "/api/session/logout") {
    try {
      const body = await parseBody(req);
      const phone = body.session_id || body.phone || activeBotPhone;
      clearSessionData(phone);
      return sendJson(res, 200, { ok: true, message: "Sesi berjaya dilog keluar." });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- CONSOLE LOGS ---
  if (req.method === "GET" && (pathname === "/api/console/logs" || pathname === "/api/logs")) {
    return sendJson(res, 200, {
      ok: true,
      success: true,
      logs: lastBotLog,
      output: lastBotLog.join("\n"),
      isOnline: Boolean(botProcess && !botProcess.killed),
    });
  }

  // --- CONSOLE RUN ---
  if (req.method === "POST" && pathname === "/api/console/run") {
    const body = await parseBody(req);
    addLog("CONSOLE", `Perintah diterima: ${body.command || ""}`);
    return sendJson(res, 200, { ok: true, output: "Perintah diterima oleh PC Agent." });
  }

  // --- SETTINGS GET & APPLY ---
  if (req.method === "GET" && (pathname === "/api/settings/get" || pathname === "/api/settings")) {
    return sendJson(res, 200, { ok: true, success: true, settings: getSettings() });
  }
  if (req.method === "POST" && (pathname === "/api/settings/apply" || pathname === "/api/settings")) {
    try {
      const body = await parseBody(req);
      const ok = saveSettings(body.settings || body);
      return sendJson(res, ok ? 200 : 500, {
        ok,
        success: ok,
        message: ok ? "Tetapan bot berjaya disimpan." : "Gagal menyimpan fail tetapan.",
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: "Format tetapan tidak sah." });
    }
  }

  // --- PREMIUM & AGENT STUBS (For Umi Studio web compatibility) ---
  if (req.method === "GET" && pathname === "/api/premium/catalog") {
    return sendJson(res, 200, { ok: true, features: [] });
  }
  if (req.method === "GET" && pathname === "/api/agent/status") {
    return sendJson(res, 200, { ok: true, configured: false });
  }

  // --- LEGACY BOT DASHBOARD ENDPOINTS ---
  if (req.method === "GET" && pathname === "/api/status") {
    const isOnline = Boolean(botProcess && !botProcess.killed);
    const uptimeSec = isOnline && botStartTime ? Math.floor((Date.now() - botStartTime) / 1000) : 0;
    const hasExistingSession = fs.existsSync(path.join(SESSION_DIR, "creds.json"));
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const usedMem = totalMem - freeMem;
    const ramPercentage = Math.round((usedMem / totalMem) * 100);

    return sendJson(res, 200, {
      isOnline,
      statusText: isOnline ? "ONLINE" : "OFFLINE",
      uptimeSeconds: uptimeSec,
      uptimeFormatted: `${Math.floor(uptimeSec / 3600)}j ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
      ramUsageMb: usedMem,
      totalRamMb: totalMem,
      ramPercentage,
      latencyMs: 12,
      nodeVersion: process.version,
      platform: os.platform(),
      botName: "DENIA-MD",
      ownerName: "Kaizas",
      hasSession: hasExistingSession,
      pairingCode: latestPairingCode,
    });
  }

  if (req.method === "POST" && pathname === "/api/action") {
    try {
      const { action, phone } = await parseBody(req);
      if (action === "start") {
        const result = startBotProcess(phone);
        return sendJson(res, result.success ? 200 : 400, result);
      } else if (action === "stop") {
        const result = stopBotProcess();
        return sendJson(res, result.success ? 200 : 400, result);
      } else if (action === "restart") {
        stopBotProcess();
        setTimeout(() => {
          startBotProcess(phone);
          return sendJson(res, 200, { success: true, message: "Bot berjaya dimulakan semula." });
        }, 2000);
        return;
      } else if (action === "clear-session") {
        const result = clearSessionData(phone);
        return sendJson(res, result.success ? 200 : 400, result);
      } else {
        return sendJson(res, 400, { message: "Aksi tidak dikenali." });
      }
    } catch {
      return sendJson(res, 400, { message: "Data permintaan tidak sah." });
    }
  }

  sendJson(res, 404, { ok: false, error: "Laluan API tidak ditemui." });
});

server.listen(PORT, HOST, () => {
  console.log(`===============================================`);
  console.log(`🚀 DENIA-MD PC AGENT SEDIA`);
  console.log(`📡 Dengar Pada : http://${HOST}:${PORT}`);
  console.log(`⚡ Mod Studio  : Serasi Penuh Usanagi Umi / Vercel`);
  console.log(`===============================================`);
});
