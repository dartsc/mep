@echo off
echo ========================================
echo Memory Scanner Server - Quick Start
echo ========================================
echo.

echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and run the installer.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js is installed
echo.

echo Installing dependencies...
call npm install

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Starting server on http://localhost:3333
echo.
echo Keep this window open while using the memory editor.
echo Press Ctrl+C to stop the server.
echo.
echo ========================================
echo.

node scan-server.js

pause
