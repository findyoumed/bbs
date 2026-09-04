@echo off
:: [LOG: 20260605_0938]
echo ==========================================
echo   Git Pull Helper Script
echo ==========================================
echo.
:: [LOG: 20260904_1747]
echo [안내] Git 가져오기를 시작합니다. 잘못 누르셨다면 창을 닫거나 Ctrl+C를 누르세요.
pause
echo.

:: Check if .git folder exists to decide clone or pull
if not exist ".git" (
    echo [Info] Repository not initialized here. Cloning from GitHub...
    git clone https://github.com/findyoumed/bbs.git .
) else (
    echo [Step 1] Fetching updates from remote...
    git fetch origin
    
    echo.
    echo [Step 2] Pulling latest changes from main branch...
    git pull origin main
)

echo.
echo ==========================================
echo   Git Pull Process Completed!
echo ==========================================
echo.
pause
