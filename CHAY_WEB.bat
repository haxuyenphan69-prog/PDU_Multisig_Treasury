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

REM Do not silently fall back to localhost:3001. That almost always means an
REM older copy of the project is still running on port 3000.
powershell -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>nul
if errorlevel 1 (
  echo.
  echo [DUNG LAI] Cong 3000 dang duoc mot chuong trinh khac su dung.
  echo Khong mo localhost:3001, vi do co the la giao dien cua ban cu.
  echo.
  echo Hay dong Terminal dang chay web cu, sau do chay lai file nay.
  echo Neu ban dang chay dung project moi o cong 3000, mo: http://localhost:3000
  pause
  exit /b 1
)

echo.
echo PDU Treasury dang khoi dong tai http://localhost:3000
echo Trinh duyet se mo sau vai giay. Khong dong cua so nay khi dang dung web.
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3000"
call npm run dev -- --port 3000 --strictPort
exit /b %errorlevel%

:fail
echo.
echo Khong the cai thu vien. Kiem tra Internet roi chay lai file nay.
pause
exit /b 1
