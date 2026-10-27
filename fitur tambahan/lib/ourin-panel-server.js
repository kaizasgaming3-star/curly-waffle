/**
 * Kaizas Panel Server - REST API untuk Panel Kawalan Bot
 * Diakses dari panel web (PWA) melalui browser/app
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDatabase } from "./ourin-database.js";
import { logger } from "./ourin-logger.js";
import { pluginStore } from "./ourin-plugins.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = path.join(process.cwd(), "panel");

let _sock = null;
let _config = null;
let _startTime = Date.now();
const sessions = new Map(); // token -> { expiry }
const recentLogs = [];
const MAX_LOGS = 100;

export function setPanelSocket(sock) { _sock = sock; }
export function setPanelConfig(cfg) { _config = cfg; }

export function pushPanelLog(entry) {
  recentLogs.unshift({ ...entry, time: Date.now() });
  if (recentLogs.length > MAX_LOGS) recentLogs.pop();
}

function genToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function isAuth(req) {
  const auth = req.headers["x-panel-token"] || "";
  const session = sessions.get(auth);
  if (!session) return false;
  if (Date.now() > session.expiry) { sessions.delete(auth); return false; }
  return true;
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,x-panel-token" });
  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { resolve({}); } });
  });
}

function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end("Not Found"); return; }
  const ext = path.extname(filePath);
  const mimeMap = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp" };
  const mime = mimeMap[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  fs.createReadStream(filePath).pipe(res);
}

async function handleRoute(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (req.method === "OPTIONS") { json(res, 200, {}); return; }

  // ─── Static Files ───
  if (!pathname.startsWith("/api/")) {
    const p = pathname === "/" ? "/index.html" : pathname;
    serveStatic(res, path.join(PANEL_DIR, p));
    return;
  }

  // ─── API Routes ───
  // Login — tidak perlu token
  if (pathname === "/api/login" && req.method === "POST") {
    const body = await getBody(req);
    const correctPin = _config?.panel?.pin || "123456";
    if (String(body.pin) !== String(correctPin)) {
      json(res, 401, { ok: false, message: "PIN salah!" });
      return;
    }
    const token = genToken();
    const expiry = Date.now() + (_config?.panel?.sessionExpiry || 86400000);
    sessions.set(token, { expiry });
    json(res, 200, { ok: true, token });
    return;
  }

  if (!isAuth(req)) { json(res, 401, { ok: false, message: "Tidak dibenarkan. Sila login semula." }); return; }

  // GET /api/stats
  if (pathname === "/api/stats" && req.method === "GET") {
    const db = getDatabase();
    const mem = process.memoryUsage();
    const uptime = Date.now() - _startTime;
    const allGroups = Object.keys(db.db.data.groups || {});
    const allUsers = Object.keys(db.db.data.users || {});
    const premCount = (_config?.premiumUsers || []).length;
    const bannedCount = (_config?.bannedUsers || []).length;
    json(res, 200, {
      ok: true,
      botName: _config?.bot?.name || "Bot",
      botVersion: _config?.bot?.version || "1.0",
      mode: _config?.mode || "public",
      uptime,
      ramUsed: Math.round(mem.rss / 1024 / 1024),
      ramTotal: Math.round(mem.heapTotal / 1024 / 1024),
      groups: allGroups.length,
      users: allUsers.length,
      premium: premCount,
      banned: bannedCount,
      plugins: pluginStore?.size || 0,
      isConnected: !!_sock?.user,
      ownerName: _config?.owner?.name || "Owner",
      ownerNumber: (_config?.owner?.number || []).join(", "),
    });
    return;
  }

  // GET /api/logs
  if (pathname === "/api/logs" && req.method === "GET") {
    json(res, 200, { ok: true, logs: recentLogs.slice(0, 50) });
    return;
  }

  // GET /api/groups
  if (pathname === "/api/groups" && req.method === "GET") {
    const db = getDatabase();
    const groups = Object.entries(db.db.data.groups || {}).map(([id, data]) => ({
      id, name: data.name || id.split("@")[0], antispam: !!data.antispam, autodl: !!data.autodl, members: data.memberCount || 0
    }));
    json(res, 200, { ok: true, groups });
    return;
  }

  // GET /api/users
  if (pathname === "/api/users" && req.method === "GET") {
    const premium = (_config?.premiumUsers || []).map(n => ({ number: n, type: "premium" }));
    const banned = (_config?.bannedUsers || []).map(n => ({ number: n, type: "banned" }));
    json(res, 200, { ok: true, premium, banned });
    return;
  }

  // GET /api/plugins
  if (pathname === "/api/plugins" && req.method === "GET") {
    const plugins = [];
    if (pluginStore) {
      for (const [name, plugin] of pluginStore.entries()) {
        plugins.push({ name, category: plugin.config?.category || "misc", enabled: plugin.config?.isEnabled !== false, description: plugin.config?.description || "" });
      }
    }
    json(res, 200, { ok: true, plugins });
    return;
  }

  // POST /api/broadcast
  if (pathname === "/api/broadcast" && req.method === "POST") {
    const body = await getBody(req);
    if (!body.message) { json(res, 400, { ok: false, message: "Tiada mesej" }); return; }
    if (!_sock) { json(res, 503, { ok: false, message: "Bot tidak bersambung" }); return; }
    const db = getDatabase();
    const groups = Object.keys(db.db.data.groups || {});
    let sent = 0, failed = 0;
    for (const gid of groups) {
      try {
        await _sock.sendMessage(gid, { text: body.message });
        sent++;
        await new Promise(r => setTimeout(r, 700));
      } catch { failed++; }
    }
    json(res, 200, { ok: true, sent, failed });
    return;
  }

  // POST /api/send — hantar ke kumpulan/nombor tertentu
  if (pathname === "/api/send" && req.method === "POST") {
    const body = await getBody(req);
    if (!body.to || !body.message) { json(res, 400, { ok: false, message: "Tiada penerima atau mesej" }); return; }
    if (!_sock) { json(res, 503, { ok: false, message: "Bot tidak bersambung" }); return; }
    try {
      const jid = body.to.includes("@") ? body.to : body.to + "@s.whatsapp.net";
      await _sock.sendMessage(jid, { text: body.message });
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { ok: false, message: e.message }); }
    return;
  }

  // POST /api/leave — keluar dari kumpulan
  if (pathname === "/api/leave" && req.method === "POST") {
    const body = await getBody(req);
    if (!body.groupId) { json(res, 400, { ok: false, message: "Tiada ID kumpulan" }); return; }
    if (!_sock) { json(res, 503, { ok: false, message: "Bot tidak bersambung" }); return; }
    try {
      await _sock.groupLeave(body.groupId);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { ok: false, message: e.message }); }
    return;
  }

  // POST /api/premium/add
  if (pathname === "/api/premium/add" && req.method === "POST") {
    const body = await getBody(req);
    const num = String(body.number || "").replace(/[^0-9]/g, "");
    if (!num) { json(res, 400, { ok: false, message: "Nombor tidak sah" }); return; }
    if (!_config.premiumUsers) _config.premiumUsers = [];
    if (!_config.premiumUsers.includes(num)) {
      _config.premiumUsers.push(num);
      const db = getDatabase(); db.setSetting("premiumUsers", _config.premiumUsers);
    }
    json(res, 200, { ok: true });
    return;
  }

  // POST /api/premium/remove
  if (pathname === "/api/premium/remove" && req.method === "POST") {
    const body = await getBody(req);
    const num = String(body.number || "").replace(/[^0-9]/g, "");
    if (_config.premiumUsers) _config.premiumUsers = _config.premiumUsers.filter(n => n !== num);
    const db = getDatabase(); db.setSetting("premiumUsers", _config.premiumUsers || []);
    json(res, 200, { ok: true });
    return;
  }

  // POST /api/ban/add
  if (pathname === "/api/ban/add" && req.method === "POST") {
    const body = await getBody(req);
    const num = String(body.number || "").replace(/[^0-9]/g, "");
    if (!num) { json(res, 400, { ok: false, message: "Nombor tidak sah" }); return; }
    if (!_config.bannedUsers) _config.bannedUsers = [];
    if (!_config.bannedUsers.includes(num)) {
      _config.bannedUsers.push(num);
      const db = getDatabase(); db.setSetting("bannedUsers", _config.bannedUsers);
    }
    json(res, 200, { ok: true });
    return;
  }

  // POST /api/ban/remove
  if (pathname === "/api/ban/remove" && req.method === "POST") {
    const body = await getBody(req);
    const num = String(body.number || "").replace(/[^0-9]/g, "");
    if (_config.bannedUsers) _config.bannedUsers = _config.bannedUsers.filter(n => n !== num);
    const db = getDatabase(); db.setSetting("bannedUsers", _config.bannedUsers || []);
    json(res, 200, { ok: true });
    return;
  }

  // POST /api/mode — tukar self/public
  if (pathname === "/api/mode" && req.method === "POST") {
    const body = await getBody(req);
    const mode = body.mode === "self" ? "self" : "public";
    _config.mode = mode;
    const db = getDatabase(); db.setSetting("botMode", mode);
    json(res, 200, { ok: true, mode });
    return;
  }

  // POST /api/restart
  if (pathname === "/api/restart" && req.method === "POST") {
    json(res, 200, { ok: true, message: "Bot akan restart dalam 2 saat..." });
    setTimeout(() => { process.exit(0); }, 2000);
    return;
  }

  json(res, 404, { ok: false, message: "Route tidak dijumpai" });
}

export async function startPanelServer(config, sock) {
  _config = config;
  _sock = sock;
  _startTime = Date.now();

  if (!fs.existsSync(PANEL_DIR)) fs.mkdirSync(PANEL_DIR, { recursive: true });
  const assetsDir = path.join(PANEL_DIR, "assets");
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const server = http.createServer(async (req, res) => {
    try { await handleRoute(req, res); }
    catch (e) { json(res, 500, { ok: false, message: "Ralat server: " + e.message }); }
  });

  const port = config?.panel?.port || 8080;
  server.listen(port, () => {
    logger.success("PANEL", `🌐 Kaizas Panel berjalan di http://localhost:${port}`);
  });

  return server;
}
