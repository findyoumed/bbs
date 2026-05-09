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

    # 1. Find all .gitignore files and parse them
    for gitignore_file in root_dir.rglob(".gitignore"):
        all_patterns.extend(parse_gitignore(gitignore_file))
    
    # 2. Add some default ignores if not present
    all_patterns.append((root_dir, ".git/"))
    all_patterns.append((root_dir, output_filename))

    print(f"Creating {output_filename}...")
    
    count = 0
    # [LOG: 20260417_1050] metadata_encoding 제거 (쓰기 모드에서 지원 안됨)
    with zipfile.ZipFile(output_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file_path in root_dir.rglob("*"):
            if file_path.is_file():
                # Check if this file or any of its parents are ignored
                ignored = False
                for p in [file_path] + list(file_path.parents):
                    if is_ignored(p, all_patterns):
                        ignored = True
                        break
                
                # [LOG: 20260411_1252] .env 및 zip_project.py 파일 강제 포함
                if not ignored or file_path.name in [".env", "zip_project.py"]:
                    arcname = str(file_path.relative_to(root_dir)).replace(os.sep, "/")
                    zipf.write(file_path, arcname)
                    # print(f"Added: {arcname}")
                    count += 1

    print(f"Done! {count} files added to {output_filename}.")

if __name__ == "__main__":
    zip_project()
