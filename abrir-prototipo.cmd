@echo off
cd /d "%~dp0"
start "FraldaCycle Preview" /min node preview-server.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/#/site/home"
