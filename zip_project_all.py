# [LOG: 20260418_1025] gitignore 예외 없이 모든 파일/폴더 압축하는 스크립트 추가
import os
import zipfile
from pathlib import Path

def zip_project_all(output_filename=None):
    """
    Zips the current directory including all files and folders.
    (No .gitignore exclusion)
    """
    root_dir = Path.cwd()
    if output_filename is None:
        output_filename = f"{root_dir.name}_all.zip"
    
    print(f"Creating {output_filename}...")
    
    count = 0
    # [LOG: 20260418_1025] 모든 파일/폴더를 포함하되, 자기 자신(결과물 zip)은 제외
    # 쓰기 모드에서는 metadata_encoding 지원 안됨
    with zipfile.ZipFile(output_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file_path in root_dir.rglob("*"):
            if file_path.is_file():
                # 결과물 zip 파일 자체는 압축 대상에서 제외
                if file_path.name == output_filename:
                    continue
                
                arcname = str(file_path.relative_to(root_dir)).replace(os.sep, "/")
                zipf.write(file_path, arcname)
                count += 1

    print(f"Done! {count} files added to {output_filename}.")

if __name__ == "__main__":
    zip_project_all()
