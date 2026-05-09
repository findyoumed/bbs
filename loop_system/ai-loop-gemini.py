#!/usr/bin/env python3
"""
[LOG: 20260410_1952] AI Modularization Loop v8.1 - Gemini Edition (Hard Target)
- 3회 연속 스킵 시 루프 자동 중단 (API 낭비 방지)
- 과거 작업 내역 차단 (이미 한 일 반복 금지)
- showSignup 등 대형 함수 우선 공략 지시
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
import threading
from datetime import datetime
from pathlib import Path

# ============================================================
# 경로 및 설정
# ============================================================
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.resolve()

MODEL = "gemini-2.5-flash" 
API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

TARGET_FILES = [
    "public/js/app.js",
    "public/js/core/postScreens.js",
    "public/js/core/commandFooter.js",
]

WORKLOG_FILE = PROJECT_ROOT / "WORK_LOG.md"
DEFAULT_PROMPT = PROJECT_ROOT / "docs" / "prompt_modularization_handoff_20260410.txt"

# [LOG: 20260410_1952] UI 및 하트비트 생략 없이 전체 코드 작성 규칙 준수
class C:
    RED = "\033[91m"; GREEN = "\033[92m"; YELLOW = "\033[93m"
    CYAN = "\033[96m"; MAGENTA = "\033[95m"; GRAY = "\033[90m"
    WHITE = "\033[97m"; RESET = "\033[0m"; BOLD = "\033[1m"

def log(color, tag, msg): print(f"  {color}[{tag}]{C.RESET} {msg}")

def render_progress_bar(current, total, bar_len=30, label="Overall"):
    p = float(current) / total; f = int(bar_len * p)
    b = "█" * f + "░" * (bar_len - f)
    print(f"\r  {C.CYAN}{label}: {C.WHITE}[{C.CYAN}{b}{C.WHITE}] {int(p*100)}% ({current}/{total}){C.RESET}", end="", flush=True)

def heartbeat_task(stop_event):
    start = time.time(); chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]; i = 0
    while not stop_event.is_set():
        e = int(time.time() - start)
        print(f"\r  {C.MAGENTA}{chars[i]} AI 분석 중... ({e}s){C.RESET}", end="", flush=True)
        i = (i + 1) % len(chars)
        if e > 0 and e % 20 == 0: print(f"\n  {C.GRAY}[정보] 아직 분석 중... ({e}s){C.RESET}")
        time.sleep(0.1)
    print("\r" + " " * 50 + "\r", end="", flush=True)

# API & Key Rotation
def load_keys():
    env = SCRIPT_DIR / ".env"
    if not env.exists(): return []
    with open(env, "r", encoding="utf-8") as f:
        txt = f.read()
    m = re.search(r"GEMINI_API_KEYS\s*=\s*(.+)", txt)
    return [k.strip() for k in m.group(1).split(",") if k.strip()] if m else []

def call_gemini_api(keys, msg):
    for i, key in enumerate(keys):
        url = API_URL_TEMPLATE.format(model=MODEL, key=key)
        body = {"contents": [{"parts": [{"text": msg}]}], "generationConfig": {"temperature": 0.1, "maxOutputTokens": 8192}}
        stop = threading.Event(); hb = threading.Thread(target=heartbeat_task, args=(stop,)); hb.start()
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers={"Content-Type":"application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=180) as r:
                stop.set(); hb.join()
                res = json.loads(r.read().decode("utf-8"))
                if 'candidates' in res and res['candidates'][0].get('content'):
                    return res['candidates'][0]['content']['parts'][0]['text'], None
                log(C.YELLOW, "WARN", "결과 없음 (필터링)")
        except urllib.error.HTTPError as e:
            stop.set(); hb.join()
            if e.code in [429, 503]: log(C.YELLOW, "ROTATE", f"키 {i+1} 과부하, 전환..."); time.sleep(1); continue
            return None, f"HTTP {e.code}"
        except Exception: stop.set(); hb.join(); continue
    return None, "All keys failed"

# Patch Logic
def apply_patches(out):
    applied = []
    # NEW FILE
    for m in re.finditer(r'===NEW FILE:\s*(.+?)===\s*\n([\s\S]*?)===END NEW FILE===', out):
        p = PROJECT_ROOT / m.group(1).strip(); p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(m.group(2).strip() + "\n", encoding="utf-8"); applied.append(m.group(1).strip())
    # PATCH
    for m in re.finditer(r'===PATCH:\s*(.+?)===\s*\n([\s\S]*?)===END PATCH===', out):
        f = m.group(1).strip(); p = PROJECT_ROOT / f; body = m.group(2)
        if not p.exists(): continue
        txt = p.read_text(encoding="utf-8"); mod = False
        for imp in re.finditer(r'@@ADD IMPORT@@\s*\n([\s\S]*?)@@END ADD IMPORT@@', body):
            l = imp.group(1).strip()
            if l not in txt: txt = l + "\n" + txt; mod = True
        for rm in re.finditer(r'@@REMOVE BLOCK@@\s*\n([\s\S]*?)@@END REMOVE BLOCK@@', body):
            b = rm.group(1).strip()
            if b in txt: txt = txt.replace(b, ""); mod = True
        for rp in re.finditer(r'@@REPLACE BLOCK@@\s*\n([\s\S]*?)@@WITH@@\s*\n([\s\S]*?)@@END REPLACE BLOCK@@', body):
            s, r = rp.group(1).strip(), rp.group(2).strip()
            if s in txt: txt = txt.replace(s, r); mod = True
        if mod: p.write_text(txt, encoding="utf-8"); applied.append(f)
    return applied

# Main Loop
def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--cycles", type=int, default=10); args = parser.parse_args()
    keys = load_keys()
    log(C.CYAN, "START", f"BBS 모듈화 루프 v8.1 가동 (목표: {args.cycles}회)")
    
    prev_work = ""; prev_err = ""; skip_count = 0
    
    for cycle in range(1, args.cycles + 1):
        print(f"\n{C.BOLD}▶ CYCLE {cycle} / {args.cycles}{C.RESET}")
        render_progress_bar(cycle - 1, args.cycles)
        
        ctx = ""
        for f in TARGET_FILES:
            if (PROJECT_ROOT / f).exists(): ctx += f"\n[FILE: {f}]\n{(PROJECT_ROOT / f).read_text(encoding='utf-8')}\n"
        
        prompt = Path(DEFAULT_PROMPT).read_text(encoding="utf-8")
        # 초보자 가독성을 위해 작업 지시 메시지 강화
        msg = f"[OBJECTIVE]\n{prompt}\n\n[RULE]\n1. EXTRACT ONE NEW FUNCTION.\n2. DO NOT REPEAT PREVIOUS WORK.\n3. FOCUS ON LARGE FUNCTIONS (>250 LINES).\n\n"
        if prev_work: msg += f"[COMPLETED SO FAR]\n{prev_work}\n\n"
        if prev_err: msg += f"[FIX THESE ERRORS]\n{prev_err}\n\n"
        msg += f"[SOURCE CODE]\n{ctx}"
        
        out, err = call_gemini_api(keys, msg)
        if err: log(C.RED, "CRITICAL", err); break
        
        # 응답 파일 저장
        (SCRIPT_DIR / f"response_cycle_{cycle}.txt").write_text(out, encoding="utf-8")
        
        summary = re.search(r'===SUMMARY===\s*\n([\s\S]*?)===END SUMMARY===', out)
        applied = apply_patches(out)
        
        if applied:
            print(f"  [테스트] 검증 중...", end="", flush=True)
            res = subprocess.run(["npm", "run", "smoke:vercel-ready"], shell=True, cwd=PROJECT_ROOT, capture_output=True)
            if res.returncode == 0:
                print(f" {C.GREEN}성공{C.RESET}")
                prev_work += f"- {summary.group(1).strip() if summary else 'Worked on ' + str(applied)}\n"
                prev_err = ""; skip_count = 0
            else:
                print(f" {C.RED}실패{C.RESET}"); prev_err = "Test failed. Fix previous patch."
                skip_count += 1
        else:
            log(C.YELLOW, "SKIP", "이번 사이클 변경 사항 없음")
            skip_count += 1
            if skip_count >= 3:
                log(C.RED, "STOP", "3회 연속 작업 실패/스킵으로 인해 자동 중지합니다.")
                break

        render_progress_bar(cycle, args.cycles)
        print()

if __name__ == "__main__":
    main()
