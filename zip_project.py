# [LOG: 20260404_1240]
import os
import zipfile
import fnmatch
from pathlib import Path

def parse_gitignore(gitignore_path):
    """
    Parses a .gitignore file and returns a list of patterns and the base directory.
    """
    patterns = []
    base_dir = gitignore_path.parent
    if gitignore_path.exists():
        with open(gitignore_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    patterns.append((base_dir, line))
    return patterns

def is_ignored(path, all_patterns):
    """
    Checks if a given path is ignored by any of the .gitignore patterns.
    """
    for base_dir, pattern in all_patterns:
        try:
            # Get relative path from the directory where .gitignore is located
            rel_path = path.relative_to(base_dir)
            rel_path_str = str(rel_path).replace(os.sep, "/")

            # Simple directory ignore (e.g. node_modules/)
            if pattern.endswith("/"):
                p = pattern.rstrip("/")
                if p in rel_path.parts:
                    return True
            
            # Glob matching
            if fnmatch.fnmatch(rel_path_str, pattern) or fnmatch.fnmatch(path.name, pattern):
                return True
            
            # Root-level exact match
            if pattern.startswith("/") and fnmatch.fnmatch(rel_path_str, pattern.lstrip("/")):
                return True

        except ValueError:
            # Path is not under this .gitignore's base_dir
            continue
    return False

# [LOG: 20260406_1810] 결과물 파일명을 폴더명으로 변경
def zip_project(output_filename=None):
    """
    Zips the current directory excluding files ignored by .gitignore.
    """
    root_dir = Path.cwd()
    if output_filename is None:
        output_filename = f"{root_dir.name}.zip"
    
    all_patterns = []

    # [LOG: 20260904_1750] 1. 기본 무시 폴더 추가 (node_modules/ 포함)
    all_patterns.append((root_dir, ".git/"))
    all_patterns.append((root_dir, output_filename))
    # [LOG: 20260805_1749] docs/ 폴더 용량 문제로 압축 제외 추가
    all_patterns.append((root_dir, "docs/"))
    # [LOG: 20260902_1804] AI 관련 대용량 폴더 및 파이썬 캐시 제외
    for ignore_dir in ["node_modules/", ".gemini/", ".claude/", ".agents/", ".codex/", "artifacts/", "__pycache__/"]:
        all_patterns.append((root_dir, ignore_dir))

    print(f"Creating {output_filename}...")

    # [LOG: 20260805_1748] 압축 진행 상황(진행률 및 추가 파일명) 콘솔 출력 추가
    # [LOG: 20260903_1223] rglob → os.walk 교체: 무시 폴더를 진입 전에 차단해 대용량 폴더(docs/ 등) 순회 생략
    # [LOG: 20260904_1750] rglob 제외: os.walk 내부에서 .gitignore 파싱으로 변경하여 전체 스캔 방지
    # 2. Collect files to include
    target_files = []
    for dirpath, dirs, files in os.walk(root_dir):
        dir_path = Path(dirpath)

        if ".gitignore" in files:
            all_patterns.extend(parse_gitignore(dir_path / ".gitignore"))

        # 무시 대상 폴더는 순회 자체를 건너뜀 (핵심 최적화: docs/ 68,296개 파일 건너뜀)
        dirs[:] = [d for d in dirs if not is_ignored(dir_path / d, all_patterns)]

        for filename in files:
            file_path = dir_path / filename
            # [LOG: 20260411_1252] .env 및 zip_project.py 파일 강제 포함
            if not is_ignored(file_path, all_patterns) or filename in [".env", "zip_project.py"]:
                target_files.append(file_path)

    total_files = len(target_files)
    print(f"Total target files: {total_files}")

    count = 0
    # [LOG: 20260417_1050] metadata_encoding 제거 (쓰기 모드에서 지원 안됨)
    # [LOG: 20260904_1751] 콘솔 출력 병목 해결 (100개 단위로만 출력)
    with zipfile.ZipFile(output_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
        for index, file_path in enumerate(target_files, 1):
            arcname = str(file_path.relative_to(root_dir)).replace(os.sep, "/")
            zipf.write(file_path, arcname)
            if index % 100 == 0 or index == total_files:
                print(f"[{index}/{total_files}] Added: {arcname}")
            count += 1

    print(f"Done! {count} files added to {output_filename}.")

if __name__ == "__main__":
    zip_project()
