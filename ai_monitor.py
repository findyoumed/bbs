# -*- coding: utf-8 -*-
# [LOG: 20260724_1639] ai_monitor.py v3 — 전략 전환
# Windows UI Automation이 Antigravity IDE(Electron) 요소를 감지 못하므로,
# 키보드 단축키 전송 방식으로 전환한다.
# 트랜스크립트 파일 변경 감지 → Antigravity 창 활성화 → 키보드 단축키 자동 전송
r"""
Antigravity AI Monitor v3
- 트랜스크립트 JSONL 파일 변경을 감시
- ask_permission / write_to_file 등 도구 호출 감지 시
- Antigravity IDE 창을 찾아서 활성화하고
- Alt+A (Accept all) 키 전송
"""

import os
import sys
import time
import glob
import threading
import subprocess

ANTIGRAVITY_DIR = r"C:\Users\new01\.gemini\antigravity-ide"

# 감지 키워드 (트랜스크립트에 기록되는 도구명/이벤트)
TRIGGER_KEYWORDS = [
    "ask_permission",
    "ask_question",
    "write_to_file",
    "replace_file_content",
    "multi_replace_file_content",
    "run_command",
    "requestfeedback",
    "request_feedback",
]

# --- 음성 알림 ---
def play_sound():
    """비프음 2회"""
    try:
        subprocess.run(
            ["powershell", "-c", "[console]::beep(1800, 200); [console]::beep(2200, 200);"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3
        )
    except Exception:
        pass


# --- 키보드 단축키 전송 ---
def send_accept_keys():
    """
    Antigravity IDE 창을 찾아 활성화하고 Accept all 단축키를 보낸다.
    Alt+A → Accept all
    """
    try:
        ps_script = r"""
        $wshell = New-Object -ComObject wscript.shell

        # Antigravity IDE 또는 VS Code 창 찾기
        $target = Get-Process | Where-Object {
            $_.MainWindowTitle -ne '' -and (
                $_.MainWindowTitle -like '*Antigravity*' -or
                $_.MainWindowTitle -like '*Visual Studio Code*' -or
                $_.ProcessName -eq 'Code'
            )
        } | Select-Object -First 1

        if ($target) {
            # 창 활성화
            $wshell.AppActivate($target.Id)
            Start-Sleep -Milliseconds 200

            # Accept all (Alt+A)
            $wshell.SendKeys('%a')
            Start-Sleep -Milliseconds 300

            # 혹시 Submit 다이얼로그면 Enter
            $wshell.SendKeys('{ENTER}')

            Write-Host "SENT:Alt+A,Enter to PID=$($target.Id) '$($target.MainWindowTitle)'"
        } else {
            Write-Host "NO_WINDOW"
        }
        """
        result = subprocess.run(
            ["powershell", "-c", ps_script],
            capture_output=True, text=True, timeout=5
        )
        out = result.stdout.strip()
        if out:
            print(f"    [KEY] {out}")
    except Exception as e:
        print(f"    [KEY] 예외: {e}")


# --- 파일 탐색 ---
def get_target_files():
    files = []
    for fname in ["cli.log", "history.jsonl"]:
        p = os.path.join(ANTIGRAVITY_DIR, fname)
        if os.path.exists(p):
            files.append(p)

    log_dir = os.path.join(ANTIGRAVITY_DIR, "log")
    if os.path.exists(log_dir):
        files.extend(glob.glob(os.path.join(log_dir, "*.log")))

    brain_dir = os.path.join(ANTIGRAVITY_DIR, "brain")
    if os.path.exists(brain_dir):
        files.extend(glob.glob(os.path.join(brain_dir, "**", "*.jsonl"), recursive=True))
        files.extend(glob.glob(os.path.join(brain_dir, "*", ".system_generated", "logs", "*.jsonl")))

    return list(dict.fromkeys(files))


# --- 메인 감시 루프 ---
def monitor():
    print("=" * 60)
    print(" [Antigravity AI Monitor v3] 가동")
    print(f" 감시 경로: {ANTIGRAVITY_DIR}")
    print(" 방식: 트랜스크립트 키워드 감지 → Alt+A / Enter 자동 전송")
    print("=" * 60)

    file_offsets = {}
    for fpath in get_target_files():
        try:
            file_offsets[fpath] = os.path.getsize(fpath)
        except Exception:
            file_offsets[fpath] = 0

    found_count = len(file_offsets)
    print(f"\n[INIT] 감시 파일: {found_count}개")
    print("[INIT] 모니터링 시작! (Ctrl+C로 종료)\n")

    last_trigger_time = 0

    while True:
        try:
            time.sleep(0.5)
            current_files = get_target_files()

            for fpath in current_files:
                if not os.path.exists(fpath):
                    continue
                try:
                    curr_size = os.path.getsize(fpath)
                    prev_size = file_offsets.get(fpath, 0)

                    if curr_size > prev_size:
                        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                            f.seek(prev_size)
                            new_text = f.read()
                        file_offsets[fpath] = curr_size

                        if not new_text.strip():
                            continue

                        new_lower = new_text.lower()
                        matched = [kw for kw in TRIGGER_KEYWORDS if kw in new_lower]

                        if matched:
                            now = time.time()
                            # 3초 쿨다운
                            if now - last_trigger_time > 3.0:
                                last_trigger_time = now
                                fname = os.path.basename(fpath)
                                print(f"\n>>> 🔔 [{', '.join(matched[:2])}] (파일: {fname})")
                                play_sound()
                                send_accept_keys()

                    elif curr_size < prev_size:
                        file_offsets[fpath] = curr_size

                except Exception:
                    pass

        except KeyboardInterrupt:
            print("\n[EXIT] 모니터링 종료.")
            break
        except Exception:
            time.sleep(1)


if __name__ == "__main__":
    monitor()