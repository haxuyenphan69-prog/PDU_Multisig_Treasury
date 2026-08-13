@echo off
setlocal
cd /d "%~dp0"
title PDU Multisig Treasury

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] May chua co Node.js.
  echo Tai Node.js LTS tai: https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Dang cai thu vien lan dau. Vui long doi...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
)

echo.
echo PDU Treasury dang khoi dong tai http://localhost:3000
echo Trinh duyet se mo sau vai giay. Khong dong cua so nay khi dang dung web.
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3000"
call npm run dev
exit /b %errorlevel%

:fail
echo.
echo Khong the cai thu vien. Kiem tra Internet roi chay lai file nay.
pause
exit /b 1
