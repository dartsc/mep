@echo off
title Memory Scanner Proxy
color 0A

echo ========================================
echo   Memory Scanner Proxy Server
echo ========================================
echo.

REM Check if virtual environment exists
if not exist ".venv\" (
    echo Creating virtual environment...
    python -m venv .venv
    echo.
)

REM Activate virtual environment and install dependencies
echo Installing/updating dependencies...
.venv\Scripts\python.exe -m pip install --upgrade pip -q
.venv\Scripts\python.exe -m pip install -r requirements.txt -q
echo.

REM Start the proxy server
echo Starting proxy server...
echo.
.venv\Scripts\python.exe memory-proxy.py

echo.
pause
