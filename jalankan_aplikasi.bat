@echo off
title Aplikasi Deteksi Kontaminasi Sarang Walet
echo =================================================================
echo   APLIKASI DETEKSI KONTAMINASI KOTORAN SARANG WALET
echo   Made Surya Winata - NIM: 2215354088
echo =================================================================
echo.

set PYTHON_CMD=
where python >nul 2>&1 && set PYTHON_CMD=python
if not defined PYTHON_CMD (
    where python3 >nul 2>&1 && set PYTHON_CMD=python3
)
if not defined PYTHON_CMD (
    echo [ERROR] Python tidak ditemukan di PATH.
    echo Pastikan Python atau Anaconda sudah terinstal.
    pause
    exit /b
)

echo Menggunakan: %PYTHON_CMD%
%PYTHON_CMD% --version
echo.

%PYTHON_CMD% -m pip install -r requirements.txt --quiet
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Gagal menginstal dependensi.
    pause
    exit /b
)
echo Dependensi siap.
echo.

echo [2/2] Memulai server di port 8000...
start "Server Walet" cmd /k "cd /d "%~dp0" && %PYTHON_CMD% -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
timeout /t 5 /nobreak > nul

echo =================================================================
echo   Alamat: http://127.0.0.1:8000
echo =================================================================
start http://127.0.0.1:8000
echo.
echo Jendela ini dapat ditutup.
pause > nul
