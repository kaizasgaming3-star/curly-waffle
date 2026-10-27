@echo off
title DENIA-MD JadiBot Studio Agent
cls
echo ===================================================
echo     MEMULAKAN DENIA-MD JADIBOT STUDIO AGENT
echo ===================================================
cd /d "%~dp0"

echo [1/2] Memulakan PC Agent (Port 4000)...
start "DENIA-MD Agent" cmd /c "cd pc-agent && node agent.js"

timeout /t 2 >nul

echo [2/2] Memulakan Cloudflare Tunnel Public HTTPS...
echo Sila salin pautan "https://xxx.trycloudflare.com" yang dipaparkan
echo dan masukkan sebagai UMI_API_ORIGIN di Vercel jika perlu.
echo.
cloudflared tunnel --url http://127.0.0.1:4000
pause
