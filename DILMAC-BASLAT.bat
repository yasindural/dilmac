@echo off
chcp 65001 >nul
title DILMAC
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo [DILMAC] Node.js veya npm bulunamadi.
  echo Lutfen Node.js kurulumunu kontrol edin.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [DILMAC] Ilk kurulum yapiliyor...
  call npm install
  if errorlevel 1 (
    echo [DILMAC] Kurulum basarisiz oldu.
    pause
    exit /b 1
  )
)

echo [DILMAC] Uygulama baslatiliyor: http://localhost:5173
start "" "http://localhost:5173"
call npm run dev

echo [DILMAC] Uygulama kapandi.
pause
