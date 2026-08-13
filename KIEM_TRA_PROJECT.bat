@echo off
setlocal
cd /d "%~dp0"
title Kiem tra PDU Multisig Treasury
echo [1/3] Kiem tra smart contract...
cargo test -p pdu-multisig-treasury || goto :fail
echo [2/3] Build WASM...
cargo build --target wasm32v1-none --release -p pdu-multisig-treasury || goto :fail
echo [3/3] Build frontend...
call npm run build || goto :fail
echo.
echo TAT CA KIEM TRA DA PASS.
pause
exit /b 0
:fail
echo.
echo CO BUOC KIEM TRA THAT BAI. Xem thong bao phia tren.
pause
exit /b 1
