# [LOG: 20260410_1920] AI Loop v2 - Claude API + Patch Mode + Modularization
# 사용법:
#   기본 (handoff 문서 사용):
#     powershell -ExecutionPolicy Bypass -File "./loop_system/ai-loop.ps1"
#   커스텀 프롬프트:
#     powershell -ExecutionPolicy Bypass -File "./loop_system/ai-loop.ps1" -PromptFile "./loop_system/prompts/modularize_large_functions.txt"
#   사이클 수 변경:
#     powershell -ExecutionPolicy Bypass -File "./loop_system/ai-loop.ps1" -Cycles 5
param (
    [int]$Cycles = 3,
    [string]$PromptFile = ""
)

# ============================================================
# TLS 1.2 활성화 (Windows PowerShell 5.1 호환)
# ============================================================
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

# ============================================================
# .env 파일에서 API 키 읽기
# ============================================================
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERR] .env 파일이 없습니다: $envFile" -ForegroundColor Red
    Write-Host "  -> loop_system/.env 파일에 ANTHROPIC_API_KEY=sk-... 형식으로 저장하세요." -ForegroundColor Yellow
    exit 1
}

$ANTHROPIC_API_KEY = ""
$envLines = Get-Content $envFile -Encoding UTF8
foreach ($line in $envLines) {
    if ($line -match '^\s*ANTHROPIC_API_KEY\s*=\s*(.+)$') {
        $ANTHROPIC_API_KEY = $matches[1].Trim()
    }
}

if (-not $ANTHROPIC_API_KEY) {
    Write-Host "[ERR] .env 파일에서 ANTHROPIC_API_KEY를 찾을 수 없습니다." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] API 키 로드 완료 (앞 10자: $($ANTHROPIC_API_KEY.Substring(0,10))...)" -ForegroundColor Green

# ============================================================
# 설정값
# ============================================================
$MODEL = "claude-sonnet-4-20250514"
$MAX_TOKENS = 16384
$API_URL = "https://api.anthropic.com/v1/messages"
$PROJECT_ROOT = Split-Path $PSScriptRoot -Parent
$WORKLOG_FILE = Join-Path $PROJECT_ROOT "WORK_LOG.md"

# 프롬프트 파일 결정
if (-not $PromptFile) {
    $PromptFile = Join-Path $PROJECT_ROOT "docs\prompt_modularization_handoff_20260410.txt"
}
if (-not [System.IO.Path]::IsPathRooted($PromptFile)) {
    $PromptFile = Join-Path $PROJECT_ROOT $PromptFile
}
if (-not (Test-Path $PromptFile)) {
    Write-Host "[ERR] 프롬프트 파일이 없습니다: $PromptFile" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] 프롬프트: $PromptFile" -ForegroundColor Green

# 프로젝트 루트로 이동
Set-Location $PROJECT_ROOT

# ============================================================
# 대상 파일 목록 (모듈화 대상 + 참조 파일)
# ============================================================
$TARGET_FILES = @(
    "public/js/app.js",
    "public/js/core/postScreens.js",
    "public/js/core/commandFooter.js"
)

# ============================================================
# 시스템 프롬프트: 패치 모드 (대용량 파일 대응)
# ============================================================
$SYSTEM_PROMPT = @"
You are a precise code modularization agent for a Vanilla JS BBS project.

YOUR TASK: Read the [TASK DOCUMENT] and extract ONE small, safe sub-function from a large function.

CRITICAL CONSTRAINT:
- Source files like app.js are 4000+ lines. You CANNOT output the entire file.
- Instead, use the PATCH format below to describe changes to existing files.

OUTPUT FORMAT - You MUST use these exact delimiters:

1. For NEW files (complete output):
===NEW FILE: relative/path/to/newModule.js===
(complete file contents - every line, no omissions)
===END NEW FILE===

2. For CHANGES to existing large files (patch mode):
===PATCH: relative/path/to/existingFile.js===

@@ADD IMPORT@@
import { funcName } from './core/newModule.js';
@@END ADD IMPORT@@

@@REMOVE BLOCK@@
(paste the EXACT code block to remove - must match character-for-character)
(include the full function definition from 'function name(' to the closing '}')
(do NOT use "// ..." or any placeholder - paste every line)
@@END REMOVE BLOCK@@

@@REPLACE BLOCK@@
(paste the EXACT original code to find)
@@WITH@@
(paste the replacement code)
@@END REPLACE BLOCK@@

===END PATCH===

3. Summary:
===SUMMARY===
- What was extracted: (function name, line count)
- New file created: (path)
- Changes to source: (what import was added, what was removed)
- Why this is safe: (no side effects, no dependency changes)
===END SUMMARY===

RULES:
1. Extract exactly ONE small sub-function per cycle. Not the entire large function.
2. The REMOVE BLOCK must contain the EXACT source code, character for character.
3. Copy at least 3-5 lines of the original so the script can find and match it.
4. Do NOT modify boot paths, routing, or authentication flows.
5. Do NOT omit code with "// ..." or "/* rest */".
6. Preserve all existing functionality.
7. Use ES6 module syntax: export function / import { } from
"@

# ============================================================
# 패치 적용 함수
# ============================================================
function Apply-Patches {
    param(
        [string]$AiOutput
    )

    $appliedFiles = @()
    $patchErrors = @()

    # --- 1) ===NEW FILE:=== 블록 처리 ---
    $newFilePattern = '===NEW FILE:\s*(.+?)===\s*\r?\n([\s\S]*?)===END NEW FILE==='
    $newFileMatches = [regex]::Matches($AiOutput, $newFilePattern)

    foreach ($m in $newFileMatches) {
        $filePath = $m.Groups[1].Value.Trim()
        $fileContent = $m.Groups[2].Value.TrimEnd("`r", "`n", " ") + "`n"

        $fullPath = Join-Path $PROJECT_ROOT $filePath
        $dir = Split-Path $fullPath -Parent
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }

        [System.IO.File]::WriteAllText($fullPath, $fileContent, [System.Text.UTF8Encoding]::new($false))
        Write-Host "    [NEW] $filePath" -ForegroundColor Green
        $appliedFiles += $filePath
    }

    # --- 2) ===PATCH:=== 블록 처리 ---
    $patchPattern = '===PATCH:\s*(.+?)===\s*\r?\n([\s\S]*?)===END PATCH==='
    $patchMatches = [regex]::Matches($AiOutput, $patchPattern)

    foreach ($pm in $patchMatches) {
        $patchFile = $pm.Groups[1].Value.Trim()
        $patchBody = $pm.Groups[2].Value

        $fullPath = Join-Path $PROJECT_ROOT $patchFile
        if (-not (Test-Path $fullPath)) {
            $patchErrors += "[PATCH] File not found: $patchFile"
            Write-Host "    [ERR] 파일 없음: $patchFile" -ForegroundColor Red
            continue
        }

        $currentContent = [System.IO.File]::ReadAllText($fullPath, [System.Text.UTF8Encoding]::new($false))
        $modified = $false

        # --- 2a) @@ADD IMPORT@@ 처리 ---
        $addImportPattern = '@@ADD IMPORT@@\s*\r?\n([\s\S]*?)@@END ADD IMPORT@@'
        $addImportMatches = [regex]::Matches($patchBody, $addImportPattern)

        foreach ($aim in $addImportMatches) {
            $importLine = $aim.Groups[1].Value.Trim()

            # 이미 존재하는지 확인
            if ($currentContent.Contains($importLine)) {
                Write-Host "    [SKIP] import 이미 존재: $importLine" -ForegroundColor DarkGray
            } else {
                # 파일 상단의 기존 import 블록 뒤에 추가
                $importInsertPattern = '(?m)(^import\s+.+$)'
                $importMatches = [regex]::Matches($currentContent, $importInsertPattern)

                if ($importMatches.Count -gt 0) {
                    # 마지막 import 문 뒤에 추가
                    $lastImport = $importMatches[$importMatches.Count - 1]
                    $insertPos = $lastImport.Index + $lastImport.Length
                    $currentContent = $currentContent.Insert($insertPos, "`n$importLine")
                } else {
                    # import 문이 없으면 파일 맨 앞에 추가
                    $currentContent = "$importLine`n$currentContent"
                }
                Write-Host "    [ADD] import 추가: $importLine" -ForegroundColor Cyan
                $modified = $true
            }
        }

        # --- 2b) @@REMOVE BLOCK@@ 처리 ---
        $removePattern = '@@REMOVE BLOCK@@\s*\r?\n([\s\S]*?)@@END REMOVE BLOCK@@'
        $removeMatches = [regex]::Matches($patchBody, $removePattern)

        foreach ($rm in $removeMatches) {
            $blockToRemove = $rm.Groups[1].Value.TrimEnd("`r", "`n", " ")

            # 정규화: \r\n → \n 으로 통일하여 매칭
            $normalizedContent = $currentContent -replace "`r`n", "`n"
            $normalizedBlock = $blockToRemove -replace "`r`n", "`n"

            if ($normalizedContent.Contains($normalizedBlock)) {
                $currentContent = $currentContent.Replace($blockToRemove, "")
                # 빈 줄 정리 (3줄 이상 연속 공백 → 2줄로)
                $currentContent = [regex]::Replace($currentContent, '(\r?\n){4,}', "`n`n`n")
                Write-Host "    [DEL] 코드 블록 제거됨 ($($blockToRemove.Split("`n").Count)줄)" -ForegroundColor Yellow
                $modified = $true
            } else {
                # \r\n 정규화 후 재시도
                $contentNorm = $currentContent -replace "`r`n", "`n"
                $blockNorm = $blockToRemove -replace "`r`n", "`n"
                if ($contentNorm.Contains($blockNorm)) {
                    $currentContent = $contentNorm.Replace($blockNorm, "")
                    $currentContent = [regex]::Replace($currentContent, '(\n){4,}', "`n`n`n")
                    Write-Host "    [DEL] 코드 블록 제거됨 (줄바꿈 정규화 후, $($blockToRemove.Split("`n").Count)줄)" -ForegroundColor Yellow
                    $modified = $true
                } else {
                    # 첫 5줄만 보여주기
                    $preview = ($blockToRemove -split "`n" | Select-Object -First 5) -join "`n"
                    $patchErrors += "[REMOVE] Block not found in $patchFile. First 5 lines: $preview"
                    Write-Host "    [ERR] 제거할 블록을 찾을 수 없음!" -ForegroundColor Red
                    Write-Host "          첫 3줄: $(($blockToRemove -split "`n" | Select-Object -First 3) -join ' | ')" -ForegroundColor DarkRed
                }
            }
        }

        # --- 2c) @@REPLACE BLOCK@@ 처리 ---
        $replacePattern = '@@REPLACE BLOCK@@\s*\r?\n([\s\S]*?)@@WITH@@\s*\r?\n([\s\S]*?)@@END REPLACE BLOCK@@'
        $replaceMatches = [regex]::Matches($patchBody, $replacePattern)

        foreach ($rplc in $replaceMatches) {
            $searchText = $rplc.Groups[1].Value.TrimEnd("`r", "`n", " ")
            $replaceText = $rplc.Groups[2].Value.TrimEnd("`r", "`n", " ")

            # 정규화된 매칭
            $contentNorm = $currentContent -replace "`r`n", "`n"
            $searchNorm = $searchText -replace "`r`n", "`n"

            if ($contentNorm.Contains($searchNorm)) {
                $currentContent = $contentNorm.Replace($searchNorm, $replaceText)
                Write-Host "    [RPL] 코드 블록 교체됨 ($($searchText.Split("`n").Count)줄 → $($replaceText.Split("`n").Count)줄)" -ForegroundColor Cyan
                $modified = $true
            } else {
                $preview = ($searchText -split "`n" | Select-Object -First 3) -join ' | '
                $patchErrors += "[REPLACE] Search block not found in $patchFile. First 3 lines: $preview"
                Write-Host "    [ERR] 교체할 블록을 찾을 수 없음!" -ForegroundColor Red
                Write-Host "          첫 3줄: $preview" -ForegroundColor DarkRed
            }
        }

        # 변경된 파일 저장
        if ($modified) {
            [System.IO.File]::WriteAllText($fullPath, $currentContent, [System.Text.UTF8Encoding]::new($false))
            Write-Host "    [SAVE] $patchFile 저장 완료" -ForegroundColor Green
            $appliedFiles += $patchFile
        }
    }

    # --- 3) 레거시 ===FILE:=== 블록도 지원 (완전 덮어쓰기) ---
    $legacyPattern = '===FILE:\s*(.+?)===\s*\r?\n([\s\S]*?)===END FILE==='
    $legacyMatches = [regex]::Matches($AiOutput, $legacyPattern)

    foreach ($lm in $legacyMatches) {
        $filePath = $lm.Groups[1].Value.Trim()
        $fileContent = $lm.Groups[2].Value.TrimEnd("`r", "`n", " ") + "`n"

        $fullPath = Join-Path $PROJECT_ROOT $filePath
        $dir = Split-Path $fullPath -Parent
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }

        [System.IO.File]::WriteAllText($fullPath, $fileContent, [System.Text.UTF8Encoding]::new($false))
        Write-Host "    [FILE] $filePath (전체 덮어쓰기)" -ForegroundColor Green
        $appliedFiles += $filePath
    }

    return @{
        Files = $appliedFiles
        Errors = $patchErrors
    }
}

# ============================================================
# 루프 시작
# ============================================================
$previousErrors = ""
$previousWork = ""
$finalSuccess = $false

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   AI MODULARIZATION LOOP v2" -ForegroundColor Cyan
Write-Host "   Cycles: $Cycles | Model: $MODEL" -ForegroundColor Cyan
Write-Host "   Mode: PATCH (대용량 파일 대응)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

for ($i = 1; $i -le $Cycles; $i++) {
    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor Cyan
    Write-Host "   Cycle $i / $Cycles" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Cyan

    # ========================================================
    # 1단계: 프롬프트 + 현재 파일 읽기
    # ========================================================
    Write-Host "  [1] 파일 읽는 중..." -ForegroundColor Gray

    $taskPrompt = Get-Content $PromptFile -Raw -Encoding UTF8

    $fileContexts = ""
    foreach ($tf in $TARGET_FILES) {
        $tfPath = Join-Path $PROJECT_ROOT $tf
        if (Test-Path $tfPath) {
            $tfContent = Get-Content $tfPath -Raw -Encoding UTF8
            $lineCount = (Get-Content $tfPath).Count
            $fileContexts += @"

---
[CURRENT FILE: $tf ($lineCount lines)]
$tfContent
"@
        }
    }

    # ========================================================
    # 2단계: 사용자 메시지 구성
    # ========================================================
    Write-Host "  [2] 프롬프트 구성 중..." -ForegroundColor Gray

    $userMessage = @"
[TASK DOCUMENT]
$taskPrompt

[CYCLE INFO]
This is cycle $i of $Cycles.
"@

    if ($previousWork) {
        $userMessage += @"

[PREVIOUS CYCLES COMPLETED]
$previousWork
Do NOT repeat the same extraction. Pick a DIFFERENT sub-function this time.
"@
    }

    if ($previousErrors) {
        $userMessage += @"

[PREVIOUS CYCLE ERRORS - FIX THESE]
$previousErrors
"@
    }

    $userMessage += @"

[SOURCE FILES]
$fileContexts
"@

    # ========================================================
    # 3단계: Claude API 호출
    # ========================================================
    Write-Host "  [3] Claude API 호출 중 ($MODEL)..." -ForegroundColor Yellow

    $bodyObject = @{
        model = $MODEL
        max_tokens = $MAX_TOKENS
        system = $SYSTEM_PROMPT
        messages = @(
            @{
                role = "user"
                content = $userMessage
            }
        )
    }

    $bodyJson = $bodyObject | ConvertTo-Json -Depth 10 -Compress

    $headers = @{
        "x-api-key"         = $ANTHROPIC_API_KEY
        "anthropic-version"  = "2023-06-01"
        "content-type"       = "application/json; charset=utf-8"
    }

    $aiOutput = ""
    try {
        $response = Invoke-RestMethod -Uri $API_URL -Method Post `
            -Headers $headers `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyJson)) `
            -TimeoutSec 300

        $aiOutput = $response.content[0].text
        Write-Host "  [OK] API 응답 수신 완료!" -ForegroundColor Green
    }
    catch {
        $errMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errBody = $reader.ReadToEnd()
                $reader.Close()
                $errMsg += " | Body: $errBody"
            } catch {}
        }
        Write-Host "  [ERR] API 호출 실패: $errMsg" -ForegroundColor Red
        $previousErrors = "API call failed: $errMsg"

        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "## [$timestamp] AI Loop Cycle $i - API ERROR`n$errMsg`n" | Out-File -FilePath $WORKLOG_FILE -Append -Encoding utf8
        continue
    }

    # ========================================================
    # 4단계: 응답 저장 (디버깅용)
    # ========================================================
    $responsePath = Join-Path $PSScriptRoot "response_cycle_$i.txt"
    [System.IO.File]::WriteAllText($responsePath, $aiOutput, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  [SAVE] 응답 저장: $responsePath" -ForegroundColor DarkGray

    # ========================================================
    # 5단계: 패치 적용
    # ========================================================
    Write-Host "  [5] 패치 적용 중..." -ForegroundColor Gray

    $patchResult = Apply-Patches -AiOutput $aiOutput

    if ($patchResult.Files.Count -eq 0 -and $patchResult.Errors.Count -eq 0) {
        Write-Host "  [WARN] 적용할 파일 블록이 없습니다!" -ForegroundColor Yellow
        Write-Host "  -> response_cycle_$i.txt 를 열어서 AI 응답을 직접 확인하세요." -ForegroundColor Yellow
        $previousErrors = "No file blocks or patches found in AI response. You MUST use ===NEW FILE:=== and ===PATCH:=== delimiters as specified."

        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "## [$timestamp] AI Loop Cycle $i - PARSE ERROR (no blocks)`n" | Out-File -FilePath $WORKLOG_FILE -Append -Encoding utf8
        continue
    }

    if ($patchResult.Errors.Count -gt 0) {
        Write-Host "  [WARN] 패치 적용 중 에러 발생:" -ForegroundColor Yellow
        foreach ($pe in $patchResult.Errors) {
            Write-Host "    - $pe" -ForegroundColor Yellow
        }
    }

    # SUMMARY 블록 출력
    $summaryPattern = '===SUMMARY===\s*\r?\n([\s\S]*?)===END SUMMARY==='
    $summaryMatch = [regex]::Match($aiOutput, $summaryPattern)
    if ($summaryMatch.Success) {
        Write-Host ""
        Write-Host "  [AI SUMMARY]" -ForegroundColor Magenta
        $summaryText = $summaryMatch.Groups[1].Value.Trim()
        $summaryText -split "`n" | ForEach-Object {
            Write-Host "    $_" -ForegroundColor Magenta
        }
        Write-Host ""
    }

    # ========================================================
    # 6단계: 검증
    # ========================================================
    Write-Host "  [6] 검증 시작..." -ForegroundColor Yellow
    $allPassed = $true
    $verifyErrors = ""

    # 검사 1: 수정/생성된 JS 파일들 구문 검사
    $jsFilesToCheck = $patchResult.Files | Where-Object { $_ -match '\.js$' } | Sort-Object -Unique
    $checkNum = 1

    foreach ($jsFile in $jsFilesToCheck) {
        $jsFullPath = Join-Path $PROJECT_ROOT $jsFile
        if (Test-Path $jsFullPath) {
            Write-Host "    [$checkNum] 구문 검사: $jsFile..." -NoNewline
            try {
                $winPath = $jsFile -replace '/', '\'
                $syntaxResult = & cmd /c "type `"$winPath`" | node --input-type=module --check 2>&1"
                if ($LASTEXITCODE -eq 0) {
                    Write-Host " [PASS]" -ForegroundColor Green
                } else {
                    Write-Host " [FAIL]" -ForegroundColor Red
                    $verifyErrors += "[$jsFile syntax] $($syntaxResult -join ' ')`n"
                    $allPassed = $false
                }
            } catch {
                Write-Host " [FAIL] $($_.Exception.Message)" -ForegroundColor Red
                $verifyErrors += "[$jsFile syntax] Exception: $($_.Exception.Message)`n"
                $allPassed = $false
            }
            $checkNum++
        }
    }

    # 검사: npm run smoke:vercel-ready
    Write-Host "    [$checkNum] npm run smoke:vercel-ready..." -NoNewline
    try {
        $smokeResult1 = & npm run smoke:vercel-ready 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host " [PASS]" -ForegroundColor Green
        } else {
            Write-Host " [FAIL]" -ForegroundColor Red
            $verifyErrors += "[smoke:vercel-ready] $($smokeResult1 -join ' ')`n"
            $allPassed = $false
        }
    } catch {
        Write-Host " [FAIL] $($_.Exception.Message)" -ForegroundColor Red
        $verifyErrors += "[smoke:vercel-ready] Exception: $($_.Exception.Message)`n"
        $allPassed = $false
    }
    $checkNum++

    # 검사: npm run smoke:boards
    Write-Host "    [$checkNum] npm run smoke:boards..." -NoNewline
    try {
        $smokeResult2 = & npm run smoke:boards 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host " [PASS]" -ForegroundColor Green
        } else {
            Write-Host " [FAIL]" -ForegroundColor Red
            $verifyErrors += "[smoke:boards] $($smokeResult2 -join ' ')`n"
            $allPassed = $false
        }
    } catch {
        Write-Host " [FAIL] $($_.Exception.Message)" -ForegroundColor Red
        $verifyErrors += "[smoke:boards] Exception: $($_.Exception.Message)`n"
        $allPassed = $false
    }

    # 패치 에러도 합산
    if ($patchResult.Errors.Count -gt 0) {
        $allPassed = $false
        $verifyErrors += ($patchResult.Errors -join "`n") + "`n"
    }

    # ========================================================
    # 7단계: 결과 기록
    # ========================================================
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    if ($allPassed) {
        $logEntry = @"

## [$timestamp] AI Loop Cycle $i/$Cycles - ALL PASSED

**LOG_ID: AI_LOOP_CYCLE_$i**
변경 파일: $($patchResult.Files -join ', ')
검증: 구문 검사 + smoke:vercel-ready + smoke:boards
결과: ALL PASSED

"@
        $logEntry | Out-File -FilePath $WORKLOG_FILE -Append -Encoding utf8

        Write-Host ""
        Write-Host "  ========================================" -ForegroundColor Green
        Write-Host "  Cycle ${i}: ALL CHECKS PASSED!" -ForegroundColor Green
        Write-Host "  ========================================" -ForegroundColor Green

        $previousErrors = ""
        $previousWork += "Cycle ${i}: Extracted from $($patchResult.Files -join ', '). "
        if ($summaryMatch.Success) {
            $previousWork += $summaryMatch.Groups[1].Value.Trim() + "`n"
        }
        $finalSuccess = $true

    } else {
        $logEntry = @"

## [$timestamp] AI Loop Cycle $i/$Cycles - FAILED

**LOG_ID: AI_LOOP_CYCLE_$i**
변경 파일: $($patchResult.Files -join ', ')
에러:
$verifyErrors

"@
        $logEntry | Out-File -FilePath $WORKLOG_FILE -Append -Encoding utf8

        Write-Host ""
        Write-Host "  [WARN] Cycle ${i}: 검증 실패. 에러를 다음 사이클에 전달합니다." -ForegroundColor Yellow
        $previousErrors = $verifyErrors
        $finalSuccess = $false
    }
}

# ============================================================
# 최종 결과
# ============================================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
if ($finalSuccess) {
    Write-Host "   RESULT: SUCCESS" -ForegroundColor Green
    Write-Host "   모든 사이클이 성공적으로 완료되었습니다." -ForegroundColor Green
} else {
    Write-Host "   RESULT: ISSUES REMAIN" -ForegroundColor Yellow
    Write-Host "   남은 에러:" -ForegroundColor Yellow
    $previousErrors -split "`n" | ForEach-Object {
        if ($_.Trim()) { Write-Host "   - $_" -ForegroundColor Yellow }
    }
    Write-Host ""
    Write-Host "   확인할 파일:" -ForegroundColor Yellow
    Write-Host "   - loop_system/response_cycle_*.txt (AI 원본 응답)" -ForegroundColor Yellow
    Write-Host "   - WORK_LOG.md (결과 기록)" -ForegroundColor Yellow
}
Write-Host "==========================================" -ForegroundColor Cyan
