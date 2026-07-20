@echo off
chcp 65001 >nul
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
echo   [!] 충돌 해결 가이드 (Conflict Resolution Guide)
echo ==============================================================
echo   로컬 변경사항과 원격 저장소의 파일이 충돌하여 동기화할 수 없습니다.
echo   로컬 코드가 유실되지 않도록 임시 rebase 상태는 취소되었습니다.
echo.
echo   안전하게 충돌을 해결하려면 아래 단계를 수동으로 실행하세요:
echo   1. 수동으로 병합[Merge] 시도:
echo      git pull origin main
echo   2. 충돌이 발생한 파일들을 에디터로 열어 충돌 마커를 정리합니다.
echo      [충돌 표시 기호 제거 및 최종 코드 선택]
echo   3. 충돌 수정 완료 후 스테이징:
echo      git add [파일명]
echo   4. 병합 커밋 완료:
echo      git commit -m "merge: resolve conflicts with origin/main"
echo   5. 이 배치 스크립트[push_github.bat]를 재실행하거나 직접 푸시합니다:
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
