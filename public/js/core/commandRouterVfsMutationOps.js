export function createVfsMutationOps(deps) {
  const {
    vfsService,
    setHint,
    setPrompt,
    showConfirm,
    showEditor,
    handleCmd
  } = deps;

  function finish(message) {
    setHint(message);
    setPrompt('>>');
    return true;
  }

  async function handleMutationCommand({ cmd, parts, context }) {
    if (cmd === 'DEL') {
      const name = parts[1];
      if (!name) {
        return finish('삭제할 파일 이름을 입력해 주세요. (예: DEL MYNOTE)');
      }

      const confirmed = await showConfirm(`파일 [${name}]을 영구적으로 삭제하시겠습니까?`);
      if (!confirmed) {
        return finish('삭제를 취소했습니다.');
      }
      if (vfsService.removeFile(name)) {
        return finish(`파일 [${name}]이 삭제되었습니다.`);
      }
      return finish(`파일 [${name}]을 찾을 수 없습니다.`);
    }

    if (cmd === 'WRITE' || cmd === 'EDIT') {
      const name = parts[1];
      if (!name) {
        return finish(`사용법: ${cmd} [이름]`);
      }

      if (cmd === 'WRITE' && parts.length > 2) {
        const content = parts.slice(2).join(' ');
        vfsService.writeFile(name, content);
        return finish(`파일 [${name}]이 저장되었습니다.`);
      }

      const oldContent = vfsService.getFile(name) || '';
      const newContent = await showEditor(`[${name}] 스크립트 편집`, oldContent);
      if (newContent !== null) {
        vfsService.writeFile(name, newContent);
        return finish(`파일 [${name}]이 저장되었습니다.`);
      }
      return finish('편집을 취소했습니다.');
    }

    if (cmd === 'RUN' || cmd === 'SOURCE') {
      const name = parts[1];
      const args = parts.slice(2);
      if (!name) {
        return finish(`실행할 스크립트 이름을 입력해 주세요. (예: ${cmd} MYSCRIPT)`);
      }

      const content = vfsService.getFile(name);
      if (!content) {
        return finish(`스크립트 [${name}]을 찾을 수 없습니다.`);
      }

      setHint(`스크립트 [${name}] ${cmd === 'RUN' ? '실행' : '로딩'} 중...`);
      setPrompt('>>');
      if (typeof handleCmd === 'function') {
        const lines = content.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
        const batchCmd = lines.join('; ');
        const targetCtx = cmd === 'RUN' ? { args, isScript: true } : context;
        setTimeout(() => handleCmd(batchCmd, targetCtx), 100);
      }
      return true;
    }

    if (cmd === 'TEE') {
      let append = false;
      let name = parts[1];
      if (name === '-a') {
        append = true;
        name = parts[2];
      }

      const content = context && context.pipedData ? context.pipedData : '';
      if (name) {
        if (append) {
          vfsService.appendFile(name, content);
        } else {
          vfsService.writeFile(name, content);
        }
      }
      return finish(content);
    }

    if (cmd === 'CP' || cmd === 'MV') {
      const src = parts[1];
      const dest = parts[2];
      if (!src || !dest) {
        return finish(`사용법: ${cmd} [원본] [대상]`);
      }

      const content = vfsService.getFile(src);
      if (content === null) {
        return finish(`원본 파일 [${src}]을 찾을 수 없습니다.`);
      }

      vfsService.writeFile(dest, content);
      if (cmd === 'MV') {
        vfsService.removeFile(src);
        return finish(`파일 [${src}]을 [${dest}]로 이동했습니다.`);
      }
      return finish(`파일 [${src}]을 [${dest}]로 복사했습니다.`);
    }

    if (cmd === 'TOUCH') {
      const name = parts[1];
      if (!name) {
        return finish('사용법: TOUCH [이름]');
      }

      const content = vfsService.getFile(name) || '';
      vfsService.writeFile(name, content);
      return finish(`파일 [${name}]의 수정 시간을 갱신했습니다.`);
    }

    return false;
  }

  return {
    handleMutationCommand
  };
}
