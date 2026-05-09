export function createVfsInspectOps(deps) {
  const {
    vfsService,
    setHint,
    setPrompt
  } = deps;

  function finish(message) {
    setHint(message);
    setPrompt('>>');
    return true;
  }

  function renderFileTable(files) {
    let table = '이름           크기(B)    최종 수정일\n';
    table += '--------------------------------------------------\n';
    let totalSize = 0;

    files.forEach((file) => {
      const name = file.name.padEnd(14).slice(0, 14);
      const sizeVal = file.size || 0;
      totalSize += sizeVal;
      const size = String(sizeVal).padStart(7);
      const date = new Date(file.updatedAt).toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      table += `${name} ${size}    ${date}\n`;
    });

    table += '--------------------------------------------------\n';
    table += `합계: ${files.length}개 파일, ${totalSize} bytes`;
    return table;
  }

  function readFiles(names) {
    let output = '';

    for (const name of names) {
      const content = vfsService.getFile(name);
      if (content === null || content === undefined) {
        output += (output ? '\n' : '') + `파일 [${name}]을 찾을 수 없습니다.`;
        continue;
      }

      if (names.length > 1) {
        output += (output ? '\n' : '') + `--- [${name}] ---\n`;
      }
      output += (output ? '\n' : '') + content;
    }

    return output;
  }

  async function handleInspectCommand({ cmd, parts }) {
    if (cmd === 'FILES' || cmd === 'DIR') {
      const files = vfsService.listFiles();
      if (files.length === 0) {
        return finish('저장된 파일이 없습니다. (EDIT [이름] 으로 생성)');
      }
      return finish(`파일 목록:\n${renderFileTable(files)}`);
    }

    if (cmd === 'INFO') {
      const name = parts[1];
      if (!name) {
        return finish('정보를 확인할 파일 이름을 입력해 주세요. (예: INFO MYNOTE)');
      }

      const meta = vfsService.getFileMeta(name);
      if (!meta) {
        return finish(`파일 [${name}]을 찾을 수 없습니다.`);
      }

      const created = new Date(meta.createdAt).toLocaleString();
      const updated = new Date(meta.updatedAt).toLocaleString();
      return finish(`--- [${name}] 정보 ---\n크기: ${meta.size} bytes\n생성: ${created}\n수정: ${updated}\n--- INFO END ---`);
    }

    if (cmd === 'TYPE' || cmd === 'CAT') {
      const names = parts.slice(1);
      if (names.length === 0) {
        return finish(`사용법: ${cmd} [이름1] [이름2] ...`);
      }

      return finish(readFiles(names));
    }

    if (cmd === 'PWD') {
      return finish('현재 위치: /vfs (Virtual File System Root)');
    }

    return false;
  }

  return {
    handleInspectCommand
  };
}
