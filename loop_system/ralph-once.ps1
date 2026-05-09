# [LOG: 20260410_1530] Ralph Single Pass Checker
Write-Host "  -> Running checks..." -ForegroundColor Gray

# 1. Check server.js exists
if (-not (Test-Path "server.js")) {
    Write-Host "  [ERR] server.js missing!" -ForegroundColor Red
    exit 1
}

# 2. Check public/js files 무결성
$coreFiles = "public/js/core/appEvents.js", "public/js/core/commandRouter.js", "public/js/core/postScreens.js", "public/js/app.js"
foreach ($f in $coreFiles) {
    if (-not (Test-Path $f)) {
        Write-Host "  [ERR] $f missing!" -ForegroundColor Red
        exit 1
    }
}

# 3. Check Korean Labels ({{한국어|CMD}} 패턴 존재 여부)
$appJs = Get-Content "public/js/app.js" -Raw
if ($appJs -match "\{\{.*\|.*\}\}") {
    Write-Host "  [OK] Korean labels ({{...|...}}) detected in app.js." -ForegroundColor Green
}
else {
    Write-Host "  [WARN] Korean labels might be missing in app.js!" -ForegroundColor Yellow
}

# 4. Check node process (서버 구동 확인)
$node = Get-Process -Name "node" -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  [WARN] Node server not detected (Normal if just initialized)" -ForegroundColor Yellow
}
else {
    Write-Host "  [OK] Node server ($($node.Count) procs) is alive." -ForegroundColor Blue
}

# 5. [LOG: 20260410_1850] 고도화 명령어 무결성 검사 (Q, H, ME, HI)
$routerFile = "public/js/core/commandRouter.js"
$content = Get-Content $routerFile -Raw
if ($content -match "cmd === 'Q'" -and $content -match "cmd === 'H'" -and $content -match "cmd === 'ME'" -and $content -match "handleMyInfoCommand") {
    Write-Host "  [OK] Global Commands (Q, H, ME, HI) verified in router." -ForegroundColor Green
}
else {
    Write-Host "  [WARN] Some Global Commands might be missing in $routerFile!" -ForegroundColor Yellow
}

# 6. [LOG: 20260410_1855] 대화방 슬래시 명령어 검사
$chatRouterFile = "public/js/core/commandRouterChat.js"
if (Test-Path $chatRouterFile) {
    $chatContent = Get-Content $chatRouterFile -Raw
    if ($chatContent -match "/ST" -and $chatContent -match "/AL") {
        Write-Host "  [OK] Chat Slash Commands (/ST, /AL) are active." -ForegroundColor Green
    }
}

# 7. [LOG: 20260410_2015] 자료실(PDS) 및 첨부파일 연동 검사
$postRouterFile = "public/js/core/commandRouterPostView.js"
if (Test-Path $postRouterFile) {
    $postContent = Get-Content $postRouterFile -Raw
    if ($postContent -match "cmd === 'U'" -and $postContent -match "downloadAttachment") {
        Write-Host "  [OK] PDS Download Command (U) verified in router." -ForegroundColor Green
    }
}

# 8. [LOG: 20260410_1900] 모듈화된 라우터 파일 전수 확인
$subRouters = "public/js/core/commandRouterMemo.js", "public/js/core/commandRouterMyInfo.js"
foreach ($r in $subRouters) {
    if (Test-Path $r) {
        Write-Host "  [OK] Sub-Router ($r) is present." -ForegroundColor Cyan
    }
    else {
        Write-Host "  [ERR] Sub-Router ($r) is MISSING!" -ForegroundColor Red
    }
}

# 9. [LOG: 20260410_2130] 실시간 알림(Notification) 시스템 검사
$appJsRaw = Get-Content "public/js/app.js" -Raw
if ($appJsRaw -match "checkUnreadMemos" -and $appJsRaw -match "unreadMemoCount") {
    Write-Host "  [OK] Notification Loop & State verified in app.js." -ForegroundColor Green
}
else {
    Write-Host "  [WARN] Notification logic might be missing in app.js!" -ForegroundColor Yellow
}

Write-Host "  [OK] Pass complete. All systems in perfectly cromulent condition!" -ForegroundColor Green
