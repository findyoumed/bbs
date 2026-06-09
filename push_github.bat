@echo off
chcp 65001 >nul
echo ============================================
echo   GitHub Push - findyoumed/bbs
echo ============================================

if not exist ".git" (
    echo [1/5] Initializing Git...
    git init
    git remote add origin https://github.com/findyoumed/bbs.git
)

echo.
set /p MSG="Commit Message (Enter=auto): "
if "%MSG%"=="" set MSG=update

echo.
echo [2/5] Adding files...
git add .
echo [3/5] Committing... (%MSG%)
git commit -m "%MSG%"

echo.
echo [4/5] Syncing with remote (Pull)...
cmd /c "exit /b 0"
git pull origin main --rebase
if errorlevel 1 (
    echo.
    echo [!] Pull failed! (Conflict detected)
    echo     Overwriting remote repository with local code.
    if exist ".git\rebase-merge" (
        git rebase --abort
    )
    if exist ".git\rebase-apply" (
        git rebase --abort
    )
    git push -u origin main --force
    echo.
    echo ============================================
    echo   Success! Force pushed to GitHub.
    echo ============================================
    pause
    exit /b 0
)

echo.
echo [5/5] Pushing to GitHub...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo [!] Push failed!
) else (
    echo.
    echo ============================================
    echo   Success! Pushed to GitHub.
    echo ============================================
)
pause
