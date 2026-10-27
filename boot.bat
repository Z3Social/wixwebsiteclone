@echo off
title Z3 Social
cd /d "%~dp0"
echo ==============================================
echo   Starting Z3 Social...
echo   Open your browser at: http://localhost:3000
echo ==============================================
echo.
start "" "http://localhost:3000"
node server/server.js
pause
