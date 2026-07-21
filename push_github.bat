@echo off
chcp 65001 > nul
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
git pull origin main --no-rebase
if errorlevel 1 goto PULL_FAILED

goto PULL_SUCCESS

:PULL_FAILED
echo.
echo [!] 원격 저장소와 동기화 중 파일 충돌^(Conflict^)이 발생했습니다!
echo     충돌 마커가 로컬 파일에 삽입되었으니 아래 가이드를 보고 해결해 주십시오.
echo.
echo ==============================================================
echo   [!] 충돌 해결 가이드 ^(Conflict Resolution Guide^)
echo ==============================================================
echo   원격 저장소와 로컬의 수정 내용이 겹치는 경우 충돌이 일어납니다.
echo   
echo   수동 해결 단계:
echo   1. 에디터^(VS Code 등^)에서 충돌이 발생한 파일^(예: WORK_LOG.md^)을 엽니다.
echo   2. 아래와 같은 충돌 표시 마커를 찾습니다:
echo      ^<^<^<^<^<^<^< HEAD
echo      [로컬 코드 내용]
echo      =======
echo      [원격 저장소의 코드 내용]
echo      ^>^>^>^>^>^>^> [커밋 해시]
echo   3. 필요하지 않은 마커들을 모두 삭제하고 남길 최종 코드로 정리합니다.
echo   4. 에디터에서 수정한 파일을 저장합니다.
echo   5. 터미널에서 다음 명령을 순서대로 실행합니다:
echo      git add 파일명 ^(예: git add WORK_LOG.md^)
echo      git commit -m "merge: 원격 저장소와의 충돌 해결"
echo   6. 다시 push_github.bat을 실행하면 안전하게 푸시가 성공합니다.
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
