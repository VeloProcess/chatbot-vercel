@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo   Iniciando Servidor na Porta 3000
echo ========================================
echo.
echo Diretório: %CD%
echo.
node server-local.js
pause

