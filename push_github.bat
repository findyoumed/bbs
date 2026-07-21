@echo off
echo ============================================
echo   GitHub Push - findyoumed/bbs
echo ============================================

if exist ".git" goto GIT_INITIALIZED
echo [1/5] Initializing Git...
git init
git remote add origin https://github.com/findyoumed/bbs.git
:GIT_INITIALIZED

echo.
set MSG=update
set /p MSG="Commit Message (Enter=auto, default=update): "

echo.
echo [2/5] Adding files...
git add .
echo [3/5] Committing... (%MSG%)
git commit -m "%MSG%"

echo.
echo [4/5] Syncing with remote (Pull)...
cmd /c "exit /b 0"
git pull origin main --no-rebase
if errorlevel 1 goto PULL_FAILED

goto PULL_SUCCESS

:PULL_FAILED
echo.
echo [!] Sync failed due to merge conflicts!
echo.
echo ==============================================================
echo   Conflict Resolution Steps:
echo ==============================================================
echo   1. Open conflicted files (like WORK_LOG.md) in your editor.
echo   2. Resolve conflict blocks and save the files.
echo   3. Run the following commands in terminal:
echo      git add [filename]
echo      git commit -m "merge: resolve conflicts"
echo   4. Re-run push_github.bat or push: git push origin main
echo ==============================================================
pause
exit /b 1

:PULL_SUCCESS

echo.
echo [5/5] Pushing to GitHub...
git branch -M main
git push -u origin main
if errorlevel 1 goto PUSH_FAILED

echo.
echo ============================================
echo   Success! Pushed to GitHub.
echo ============================================
goto PUSH_END

:PUSH_FAILED
echo.
echo [!] Push failed!

:PUSH_END
pause
