#!/usr/bin/env python3
"""
[LOG: 20260410_1925] AI Modularization Loop v3 - Python Edition
Claude API + Patch Mode + Verification Loop

사용법:
  기본 (handoff 문서, 3회):
    python loop_system/ai-loop.py

  커스텀 프롬프트:
    python loop_system/ai-loop.py --prompt loop_system/prompts/modularize_large_functions.txt

  사이클 수 변경:
    python loop_system/ai-loop.py --cycles 5

  드라이런 (API 호출 없이 파일 읽기만 테스트):
    python loop_system/ai-loop.py --dry-run
"""

import os
import sys
import json
import re
import time
import subprocess
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ============================================================
# 경로 설정
# ============================================================
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.resolve()

# ============================================================
# 설정값
# ============================================================
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 16384
API_URL = "https://api.anthropic.com/v1/messages"

TARGET_FILES = [
    "public/js/app.js",
    "public/js/core/postScreens.js",
    "public/js/core/commandFooter.js",
]

WORKLOG_FILE = PROJECT_ROOT / "WORK_LOG.md"

DEFAULT_PROMPT = PROJECT_ROOT / "docs" / "prompt_modularization_handoff_20260410.txt"

# ============================================================
# 컬러 출력 (Windows 터미널 호환)
# ============================================================
def enable_colors():
    """Windows 터미널에서 ANSI 색상 활성화"""
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass

class C:
    """컬러 코드"""
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"
    GRAY = "\033[90m"
    RESET = "\033[0m"
    BOLD = "\033[1m"

def log(color, tag, msg):
    print(f"  {color}[{tag}]{C.RESET} {msg}")

def log_header(msg):
    print(f"\n{C.CYAN}{'=' * 50}")
    print(f"   {msg}")
    print(f"{'=' * 50}{C.RESET}")

def log_cycle(cycle, total):
    print(f"\n{C.CYAN}{'─' * 50}")
    print(f"   Cycle {cycle} / {total}")
    print(f"{'─' * 50}{C.RESET}")

# ============================================================
# .env 파일 읽기
# ============================================================
def load_env():
    """loop_system/.env 에서 API 키 읽기"""
    env_path = SCRIPT_DIR / ".env"
    if not env_path.exists():
        log(C.RED, "ERR", f".env 파일이 없습니다: {env_path}")
        log(C.YELLOW, "TIP", "loop_system/.env 파일에 ANTHROPIC_API_KEY=sk-... 형식으로 저장하세요.")
        sys.exit(1)

    env_vars = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()

    api_key = env_vars.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        log(C.RED, "ERR", ".env 파일에서 ANTHROPIC_API_KEY를 찾을 수 없습니다.")
        sys.exit(1)

    log(C.GREEN, "OK", f"API 키 로드 완료 (앞 10자: {api_key[:10]}...)")
    return api_key

# ============================================================
# 시스템 프롬프트
# ============================================================
SYSTEM_PROMPT = """You are a precise code modularization agent for a Vanilla JS BBS project.

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
"""

# ============================================================
# Claude API 호출
# ============================================================
def call_claude_api(api_key, user_message, max_retries=3):
    """Claude Messages API 호출. 429 Rate Limit 시 자동 재시도."""

    body = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": user_message}
        ]
    }

    body_bytes = json.dumps(body, ensure_ascii=False).encode("utf-8")

    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(
            API_URL,
            data=body_bytes,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json; charset=utf-8",
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["content"][0]["text"], None
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            if e.code == 429 and attempt < max_retries:
                wait_sec = 65
                log(C.YELLOW, "WAIT", f"Rate limit (429) 감지. {wait_sec}초 대기 후 재시도... ({attempt}/{max_retries})")
                time.sleep(wait_sec)
                continue
            return None, f"HTTP {e.code}: {err_body}"
        except urllib.error.URLError as e:
            return None, f"URL Error: {e.reason}"
        except Exception as e:
            return None, f"Exception: {str(e)}"

    return None, "Max retries exceeded"

# ============================================================
# 패치 적용
# ============================================================
def apply_patches(ai_output):
    """AI 응답에서 파일 블록/패치를 파싱하고 적용한다."""

    applied_files = []
    patch_errors = []

    # --- 1) ===NEW FILE:=== 블록 처리 ---
    new_file_pattern = r'===NEW FILE:\s*(.+?)===\s*\n([\s\S]*?)===END NEW FILE==='
    for match in re.finditer(new_file_pattern, ai_output):
        file_path = match.group(1).strip()
        file_content = match.group(2).rstrip() + "\n"

        full_path = PROJECT_ROOT / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(file_content, encoding="utf-8")

        log(C.GREEN, "NEW", file_path)
        applied_files.append(file_path)

    # --- 2) ===PATCH:=== 블록 처리 ---
    patch_pattern = r'===PATCH:\s*(.+?)===\s*\n([\s\S]*?)===END PATCH==='
    for match in re.finditer(patch_pattern, ai_output):
        patch_file = match.group(1).strip()
        patch_body = match.group(2)

        full_path = PROJECT_ROOT / patch_file
        if not full_path.exists():
            patch_errors.append(f"[PATCH] File not found: {patch_file}")
            log(C.RED, "ERR", f"파일 없음: {patch_file}")
            continue

        current_content = full_path.read_text(encoding="utf-8")
        modified = False

        # --- 2a) @@ADD IMPORT@@ ---
        add_import_pattern = r'@@ADD IMPORT@@\s*\n([\s\S]*?)@@END ADD IMPORT@@'
        for imp_match in re.finditer(add_import_pattern, patch_body):
            import_line = imp_match.group(1).strip()

            if import_line in current_content:
                log(C.GRAY, "SKIP", f"import 이미 존재: {import_line}")
            else:
                # 마지막 import 문 뒤에 추가
                import_positions = list(re.finditer(r'^import\s+.+$', current_content, re.MULTILINE))
                if import_positions:
                    last_import = import_positions[-1]
                    insert_pos = last_import.end()
                    current_content = (
                        current_content[:insert_pos] +
                        "\n" + import_line +
                        current_content[insert_pos:]
                    )
                else:
                    current_content = import_line + "\n" + current_content

                log(C.CYAN, "ADD", f"import 추가: {import_line}")
                modified = True

        # --- 2b) @@REMOVE BLOCK@@ ---
        remove_pattern = r'@@REMOVE BLOCK@@\s*\n([\s\S]*?)@@END REMOVE BLOCK@@'
        for rm_match in re.finditer(remove_pattern, patch_body):
            block_to_remove = rm_match.group(1).rstrip()

            # 줄바꿈 정규화하여 매칭
            content_norm = current_content.replace("\r\n", "\n")
            block_norm = block_to_remove.replace("\r\n", "\n")

            if block_norm in content_norm:
                current_content = content_norm.replace(block_norm, "")
                # 빈 줄 3줄 이상 → 2줄로 정리
                current_content = re.sub(r'\n{4,}', '\n\n\n', current_content)
                line_count = block_norm.count("\n") + 1
                log(C.YELLOW, "DEL", f"코드 블록 제거됨 ({line_count}줄)")
                modified = True
            else:
                preview_lines = block_norm.split("\n")[:3]
                preview = " | ".join(preview_lines)
                patch_errors.append(f"[REMOVE] Block not found in {patch_file}. First 3 lines: {preview}")
                log(C.RED, "ERR", "제거할 블록을 찾을 수 없음!")
                print(f"          첫 3줄: {preview}")

        # --- 2c) @@REPLACE BLOCK@@ ---
        replace_pattern = r'@@REPLACE BLOCK@@\s*\n([\s\S]*?)@@WITH@@\s*\n([\s\S]*?)@@END REPLACE BLOCK@@'
        for rpl_match in re.finditer(replace_pattern, patch_body):
            search_text = rpl_match.group(1).rstrip()
            replace_text = rpl_match.group(2).rstrip()

            content_norm = current_content.replace("\r\n", "\n")
            search_norm = search_text.replace("\r\n", "\n")

            if search_norm in content_norm:
                current_content = content_norm.replace(search_norm, replace_text, 1)
                s_lines = search_norm.count("\n") + 1
                r_lines = replace_text.count("\n") + 1
                log(C.CYAN, "RPL", f"코드 블록 교체됨 ({s_lines}줄 -> {r_lines}줄)")
                modified = True
            else:
                preview_lines = search_norm.split("\n")[:3]
                preview = " | ".join(preview_lines)
                patch_errors.append(f"[REPLACE] Search block not found in {patch_file}. First 3 lines: {preview}")
                log(C.RED, "ERR", f"교체할 블록을 찾을 수 없음!")
                print(f"          첫 3줄: {preview}")

        # 변경된 파일 저장
        if modified:
            full_path.write_text(current_content, encoding="utf-8")
            log(C.GREEN, "SAVE", f"{patch_file} 저장 완료")
            applied_files.append(patch_file)

    # --- 3) 레거시 ===FILE:=== 블록 지원 (완전 덮어쓰기) ---
    legacy_pattern = r'===FILE:\s*(.+?)===\s*\n([\s\S]*?)===END FILE==='
    for match in re.finditer(legacy_pattern, ai_output):
        file_path = match.group(1).strip()
        file_content = match.group(2).rstrip() + "\n"

        full_path = PROJECT_ROOT / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(file_content, encoding="utf-8")

        log(C.GREEN, "FILE", f"{file_path} (전체 덮어쓰기)")
        applied_files.append(file_path)

    return applied_files, patch_errors

# ============================================================
# 검증
# ============================================================
def run_verification(applied_files):
    """수정된 파일 구문 검사 + smoke 테스트"""
    all_passed = True
    errors = []
    check_num = 1

    # 1) 수정된 JS 파일 구문 검사
    js_files = sorted(set(f for f in applied_files if f.endswith(".js")))
    for js_file in js_files:
        js_path = PROJECT_ROOT / js_file
        if not js_path.exists():
            continue

        print(f"    [{check_num}] 구문 검사: {js_file}...", end="", flush=True)
        try:
            result = subprocess.run(
                ["node", "--input-type=module", "--check"],
                input=js_path.read_text(encoding="utf-8"),
                capture_output=True, text=True, timeout=30,
                cwd=str(PROJECT_ROOT)
            )
            if result.returncode == 0:
                print(f" {C.GREEN}[PASS]{C.RESET}")
            else:
                print(f" {C.RED}[FAIL]{C.RESET}")
                err_msg = (result.stderr or result.stdout).strip()
                errors.append(f"[{js_file} syntax] {err_msg}")
                all_passed = False
        except Exception as e:
            print(f" {C.RED}[FAIL] {e}{C.RESET}")
            errors.append(f"[{js_file} syntax] Exception: {e}")
            all_passed = False
        check_num += 1

    # 2) npm run smoke:vercel-ready
    print(f"    [{check_num}] npm run smoke:vercel-ready...", end="", flush=True)
    try:
        result = subprocess.run(
            ["npm", "run", "smoke:vercel-ready"],
            capture_output=True, text=True, timeout=60,
            cwd=str(PROJECT_ROOT), shell=True
        )
        if result.returncode == 0:
            print(f" {C.GREEN}[PASS]{C.RESET}")
        else:
            print(f" {C.RED}[FAIL]{C.RESET}")
            err_msg = (result.stderr or result.stdout).strip()[:500]
            errors.append(f"[smoke:vercel-ready] {err_msg}")
            all_passed = False
    except Exception as e:
        print(f" {C.RED}[FAIL] {e}{C.RESET}")
        errors.append(f"[smoke:vercel-ready] Exception: {e}")
        all_passed = False
    check_num += 1

    # 3) npm run smoke:boards
    print(f"    [{check_num}] npm run smoke:boards...", end="", flush=True)
    try:
        result = subprocess.run(
            ["npm", "run", "smoke:boards"],
            capture_output=True, text=True, timeout=60,
            cwd=str(PROJECT_ROOT), shell=True
        )
        if result.returncode == 0:
            print(f" {C.GREEN}[PASS]{C.RESET}")
        else:
            print(f" {C.RED}[FAIL]{C.RESET}")
            err_msg = (result.stderr or result.stdout).strip()[:500]
            errors.append(f"[smoke:boards] {err_msg}")
            all_passed = False
    except Exception as e:
        print(f" {C.RED}[FAIL] {e}{C.RESET}")
        errors.append(f"[smoke:boards] Exception: {e}")
        all_passed = False

    return all_passed, errors

# ============================================================
# WORK_LOG 기록
# ============================================================
def write_worklog(cycle, total, applied_files, passed, errors_text=""):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status = "ALL PASSED" if passed else "FAILED"
    files_str = ", ".join(applied_files) if applied_files else "(none)"

    entry = f"\n## [{timestamp}] AI Loop Cycle {cycle}/{total} - {status}\n\n"
    entry += f"**LOG_ID: AI_LOOP_CYCLE_{cycle}**\n"
    entry += f"변경 파일: {files_str}\n"
    entry += f"검증: 구문 검사 + smoke:vercel-ready + smoke:boards\n"

    if passed:
        entry += "결과: ALL PASSED\n"
    else:
        entry += f"에러:\n{errors_text}\n"

    with open(WORKLOG_FILE, "a", encoding="utf-8") as f:
        f.write(entry)

# ============================================================
# SUMMARY 추출
# ============================================================
def extract_summary(ai_output):
    match = re.search(r'===SUMMARY===\s*\n([\s\S]*?)===END SUMMARY===', ai_output)
    if match:
        return match.group(1).strip()
    return ""

# ============================================================
# 메인 루프
# ============================================================
def main():
    enable_colors()

    # 인자 파싱
    parser = argparse.ArgumentParser(description="AI Modularization Loop v3")
    parser.add_argument("--cycles", type=int, default=3, help="반복 횟수 (기본: 3)")
    parser.add_argument("--prompt", type=str, default="", help="프롬프트 파일 경로")
    parser.add_argument("--delay", type=int, default=70, help="사이클 사이 대기 초 (기본: 70, rate limit 방지)")
    parser.add_argument("--dry-run", action="store_true", help="API 호출 없이 파일 읽기만 테스트")
    args = parser.parse_args()

    # API 키 로드
    api_key = load_env()

    # 프롬프트 파일 결정
    if args.prompt:
        prompt_path = Path(args.prompt)
        if not prompt_path.is_absolute():
            prompt_path = PROJECT_ROOT / prompt_path
    else:
        prompt_path = DEFAULT_PROMPT

    if not prompt_path.exists():
        log(C.RED, "ERR", f"프롬프트 파일이 없습니다: {prompt_path}")
        sys.exit(1)

    log(C.GREEN, "OK", f"프롬프트: {prompt_path.name}")

    # 작업 디렉토리 변경
    os.chdir(PROJECT_ROOT)

    # 헤더 출력
    log_header(f"AI MODULARIZATION LOOP v3 (Python)\n   Cycles: {args.cycles} | Model: {MODEL}\n   Delay: {args.delay}s | Mode: PATCH")

    if args.dry_run:
        log(C.YELLOW, "DRY-RUN", "API 호출 없이 파일 읽기만 테스트합니다.")

    # 루프 상태
    previous_errors = ""
    previous_work = ""
    final_success = False

    for cycle in range(1, args.cycles + 1):
        log_cycle(cycle, args.cycles)

        # ====================================================
        # 1단계: 프롬프트 + 현재 파일 읽기
        # ====================================================
        log(C.GRAY, "1", "파일 읽는 중...")

        task_prompt = prompt_path.read_text(encoding="utf-8")

        file_contexts = ""
        for tf in TARGET_FILES:
            tf_path = PROJECT_ROOT / tf
            if tf_path.exists():
                content = tf_path.read_text(encoding="utf-8")
                line_count = content.count("\n") + 1
                file_contexts += f"\n---\n[CURRENT FILE: {tf} ({line_count} lines)]\n{content}\n"

        # ====================================================
        # 2단계: 사용자 메시지 구성
        # ====================================================
        log(C.GRAY, "2", "프롬프트 구성 중...")

        user_message = f"[TASK DOCUMENT]\n{task_prompt}\n\n[CYCLE INFO]\nThis is cycle {cycle} of {args.cycles}.\n"

        if previous_work:
            user_message += (
                f"\n[PREVIOUS CYCLES COMPLETED]\n{previous_work}\n"
                f"Do NOT repeat the same extraction. Pick a DIFFERENT sub-function this time.\n"
            )

        if previous_errors:
            user_message += f"\n[PREVIOUS CYCLE ERRORS - FIX THESE]\n{previous_errors}\n"

        user_message += f"\n[SOURCE FILES]\n{file_contexts}\n"

        # ====================================================
        # 3단계: Claude API 호출
        # ====================================================
        if args.dry_run:
            log(C.YELLOW, "DRY", f"API 호출 생략 (프롬프트 크기: {len(user_message):,} chars)")
            log(C.GREEN, "OK", "드라이런 완료. 파일 읽기/프롬프트 구성 정상.")
            continue

        log(C.YELLOW, "3", f"Claude API 호출 중 ({MODEL})...")

        ai_output, error = call_claude_api(api_key, user_message)

        if error:
            log(C.RED, "ERR", f"API 호출 실패: {error}")
            previous_errors = f"API call failed: {error}"
            final_success = False
            write_worklog(cycle, args.cycles, [], False, error)
            continue

        log(C.GREEN, "OK", "API 응답 수신 완료!")

        # ====================================================
        # 4단계: 응답 저장 (디버깅용)
        # ====================================================
        response_path = SCRIPT_DIR / f"response_cycle_{cycle}.txt"
        response_path.write_text(ai_output, encoding="utf-8")
        log(C.GRAY, "SAVE", f"응답 저장: {response_path.name}")

        # ====================================================
        # 5단계: 패치 적용
        # ====================================================
        log(C.GRAY, "5", "패치 적용 중...")

        applied_files, patch_errors = apply_patches(ai_output)

        if not applied_files and not patch_errors:
            log(C.YELLOW, "WARN", "적용할 파일 블록이 없습니다!")
            log(C.YELLOW, "TIP", f"response_cycle_{cycle}.txt 를 열어서 AI 응답을 직접 확인하세요.")
            previous_errors = "No file blocks or patches found in AI response. You MUST use ===NEW FILE:=== and ===PATCH:=== delimiters as specified."
            write_worklog(cycle, args.cycles, [], False, "PARSE ERROR (no blocks)")
            continue

        if patch_errors:
            log(C.YELLOW, "WARN", "패치 적용 중 에러 발생:")
            for pe in patch_errors:
                print(f"      - {pe}")

        # SUMMARY 출력
        summary = extract_summary(ai_output)
        if summary:
            print(f"\n  {C.MAGENTA}[AI SUMMARY]{C.RESET}")
            for line in summary.split("\n"):
                print(f"    {C.MAGENTA}{line}{C.RESET}")
            print()

        # ====================================================
        # 6단계: 검증
        # ====================================================
        log(C.YELLOW, "6", "검증 시작...")

        all_passed, verify_errors = run_verification(applied_files)

        # 패치 에러도 합산
        if patch_errors:
            all_passed = False
            verify_errors.extend(patch_errors)

        errors_text = "\n".join(verify_errors)

        # ====================================================
        # 7단계: 결과 기록
        # ====================================================
        write_worklog(cycle, args.cycles, applied_files, all_passed, errors_text)

        if all_passed:
            print(f"\n  {C.GREEN}{'=' * 46}")
            print(f"  Cycle {cycle}: ALL CHECKS PASSED!")
            print(f"  {'=' * 46}{C.RESET}")

            previous_errors = ""
            previous_work += f"Cycle {cycle}: Extracted from {', '.join(applied_files)}. "
            if summary:
                previous_work += summary + "\n"
            final_success = True
        else:
            print(f"\n  {C.YELLOW}[WARN] Cycle {cycle}: 검증 실패. 에러를 다음 사이클에 전달합니다.{C.RESET}")
            previous_errors = errors_text
            final_success = False

        # 다음 사이클 전 대기 (rate limit 방지)
        if cycle < args.cycles and not args.dry_run:
            log(C.GRAY, "WAIT", f"다음 사이클까지 {args.delay}초 대기 중...")
            time.sleep(args.delay)

    # ============================================================
    # 최종 결과
    # ============================================================
    print(f"\n{C.CYAN}{'=' * 50}{C.RESET}")
    # 성공/실패 카운트 집계
    if final_success:
        print(f"   {C.GREEN}RESULT: LAST CYCLE PASSED{C.RESET}")
        print(f"   {C.GREEN}마지막 사이클이 성공했습니다.{C.RESET}")
    else:
        print(f"   {C.YELLOW}RESULT: ISSUES REMAIN{C.RESET}")
        if previous_errors:
            print(f"   {C.YELLOW}남은 에러:{C.RESET}")
            for line in previous_errors.split("\n"):
                if line.strip():
                    print(f"   - {line}")
        print()
        print(f"   {C.YELLOW}확인할 파일:{C.RESET}")
        print(f"   - loop_system/response_cycle_*.txt (AI 원본 응답)")
        print(f"   - WORK_LOG.md (결과 기록)")
    print(f"{C.CYAN}{'=' * 50}{C.RESET}")

if __name__ == "__main__":
    main()
