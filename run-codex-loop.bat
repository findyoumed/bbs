@echo off
setlocal

rem [LOG: 20260428_2320] Codex browser harness dispatcher prompts for iteration count unless --max is provided.
set "TASK_FILE=loop_system\prompts\ralph-browser-loop.md"
set "MEMORY_FILE=loop_system\state\ralph-browser-loop.md"
set "EXTRA_ARGS="

if "%~1"=="" goto run_codex_browser

if /I "%~1"=="ralph" (
    if /I "%~2"=="loop" (
        shift
        shift
        set "EXTRA_ARGS=%*"
        goto run_codex_browser
    )
    if /I "%~2"=="once" goto ralph_once
    if /I "%~2"=="audit" goto ralph_audit
    goto usage
)

set "EXTRA_ARGS=%*"
goto run_codex_browser

:run_codex_browser
node scripts/codex-repl-loop.js --task-file "%TASK_FILE%" --memory-file "%MEMORY_FILE%" --verify "npm run smoke:vercel-ready" --verify "npm run smoke:full-traversal" --commit --evolve %EXTRA_ARGS%
exit /b %ERRORLEVEL%

:ralph_once
powershell -ExecutionPolicy Bypass -File ".\loop_system\ralph-once.ps1"
exit /b %ERRORLEVEL%

:ralph_audit
powershell -ExecutionPolicy Bypass -File ".\loop_system\loop.ps1"
exit /b %ERRORLEVEL%

:usage
echo Usage:
echo   run-codex-loop.bat
echo   run-codex-loop.bat ralph loop [codex-loop options]
echo   run-codex-loop.bat ralph once
echo   run-codex-loop.bat ralph audit
exit /b 1
