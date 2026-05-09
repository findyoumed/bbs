#!/usr/bin/env python3
"""
[LOG: 20260410_1953] Modularization Candidate Scanner
프로젝트 내 250줄 이상의 대형 함수를 스캔하여 리팩토링 타겟 리스트를 생성합니다.
"""

import os
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
TARGET_DIRS = ["public/js", "src"]
MIN_LINES = 250

def scan_large_functions():
    candidates = []
    
    print(f"\n[스캔 시작] {MIN_LINES}줄 이상의 함수를 찾고 있습니다...\n")
    
    for root_dir in TARGET_DIRS:
        dir_path = PROJECT_ROOT / root_dir
        if not dir_path.exists(): continue
        
        for p in dir_path.rglob("*.js"):
            # node_modules나 build 폴더 제외
            if "node_modules" in str(p) or "dist" in str(p): continue
            
            content = p.read_text(encoding="utf-8")
            lines = content.splitlines()
            
            # 함수 정의 패턴 매칭 (function name() { ... })
            # 매우 단순한 매칭이지만 대략적인 크기 측정에는 유용함
            current_func = None
            start_line = 0
            brace_count = 0
            
            for i, line in enumerate(lines):
                # 함수 시작 탐지
                match = re.search(r'function\s+([a-zA-Z0-9_]+)\s*\(', line)
                if match and brace_count == 0:
                    current_func = match.group(1)
                    start_line = i
                    brace_count = 0
                
                # 중괄호 카운팅으로 함수 끝 탐지
                brace_count += line.count('{')
                brace_count -= line.count('}')
                
                if current_func and brace_count == 0 and i > start_line:
                    length = i - start_line
                    if length >= MIN_LINES:
                        candidates.append({
                            "file": p.relative_to(PROJECT_ROOT),
                            "function": current_func,
                            "lines": length,
                            "start": start_line + 1,
                            "end": i + 1
                        })
                    current_func = None
                    
    return candidates

def report():
    candidates = scan_large_functions()
    
    if not candidates:
        print("✅ 250줄 이상의 대형 함수가 발견되지 않았습니다. 모든 파일이 잘 관리되고 있습니다!")
        return
    
    print(f"{'FILE':<40} | {'FUNCTION':<25} | {'LINES':<6}")
    print("-" * 80)
    
    # 줄 수 순으로 정렬
    for c in sorted(candidates, key=lambda x: x['lines'], reverse=True):
        print(f"{str(c['file']):<40} | {c['function']:<25} | {c['lines']:<6}")
        
    print(f"\n총 {len(candidates)}개의 타겟이 발견되었습니다.")
    print("이 리스트를 기반으로 AI 모듈화 루프를 가동할 수 있습니다.")

if __name__ == "__main__":
    report()
