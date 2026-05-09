@echo off
chcp 65001 >nul
echo ============================================
echo   GitHub Push - findyoumed/bbs
echo ============================================

:: [LOG: 20260506_1840]

:: 1. Check Init
if not exist ".git" (
    echo [1/5] Initializing Git...
    git init
    git remote add origin https://github.com/findyoumed/bbs.git
)

:: 2. Input Message
echo.
set /p MSG="Commit Message (Enter=auto): "
if "%MSG%"=="" set MSG=update %date% %time:~0,5%

:: 3. Add & Commit
echo.
echo [2/5] Adding files...
git add .
echo [3/5] Committing... (%MSG%)
git commit -m "%MSG%"

:: 4. Pull (자동 동기화로 에러 예방)
echo.
echo [4/5] Syncing with remote (Pull)...
git pull origin main --rebase
if errorlevel 1 (
    echo.
    echo [!] Pull 실패! (충돌 발생)
    echo     로컬 코드를 최우선으로 간주하여 강제로 GitHub에 덮어씌웁니다.
    git rebase --abort
    git push -u origin main --force
    echo.
    echo ============================================
    echo   Success! Force pushed to GitHub.
    echo ============================================
    pause
    exit /b 0
)

:: 5. Push
echo.
echo [5/5] Pushing to GitHub...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo [!] Push 실패!
) else (
    echo.
    echo ============================================
    echo   Success! Pushed to GitHub.
    echo ============================================
)
pause
