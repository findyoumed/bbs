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
if errorlevel 1 goto PULL_FAILED

goto PULL_SUCCESS

:PULL_FAILED
echo.
echo [!] Pull failed! (Conflict detected with remote branch)
echo     Aborting rebase to protect your local work...
if exist ".git\rebase-merge" git rebase --abort
if exist ".git\rebase-apply" git rebase --abort
echo.
echo ==============================================================
echo   [!] Conflict Resolution Guide
echo ==============================================================
echo   Local changes conflict with remote repository.
echo   Rebase has been aborted to prevent local code loss.
echo.
echo   Please resolve conflicts manually:
echo   1. Try merge pull:
echo      git pull origin main
echo   2. Open conflicted files in editor and resolve merge markers.
echo      (Remove conflict symbols and keep desired code)
echo   3. Stage resolved files:
echo      git add [filename]
echo   4. Commit merge:
echo      git commit -m "merge: resolve conflicts with origin/main"
echo   5. Re-run push_github.bat or push directly:
echo      git push origin main
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
