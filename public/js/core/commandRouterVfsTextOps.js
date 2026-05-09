export function createVfsTextOps(deps) {
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

  function resolveContent(name, context, usageText) {
    if (context && context.pipedData !== undefined && context.pipedData !== null) {
      return {
        ok: true,
        content: context.pipedData,
        source: 'PIPE'
      };
    }

    if (!name) {
      return {
        ok: false,
        message: usageText
      };
    }

    const content = vfsService.getFile(name);
    if (content === null || content === undefined) {
      return {
        ok: false,
        message: `파일 [${name}]을 찾을 수 없습니다.`
      };
    }

    return {
      ok: true,
      content,
      source: name
    };
  }

  function readHeadTail(cmd, names, count) {
    let output = '';

    for (const name of names) {
      const content = vfsService.getFile(name);
      if (content === null || content === undefined) {
        output += (output ? '\n' : '') + `파일 [${name}]을 찾을 수 없습니다.`;
        continue;
      }

      const lines = content.split('\n');
      const result = cmd === 'HEAD' ? lines.slice(0, count) : lines.slice(-count);
      if (names.length > 1) {
        output += (output ? '\n' : '') + `==> ${name} <==\n`;
      }
      output += (output ? '\n' : '') + result.join('\n');
    }

    return output;
  }

  async function handleTextCommand({ cmd, parts, context }) {
    if (cmd === 'GREP') {
      const pattern = parts.slice(1).join(' ');
      if (!pattern) {
        return finish('검색할 패턴을 입력해 주세요. (예: GREP GO)');
      }

      try {
        if (context && context.pipedData) {
          const lines = context.pipedData.split('\n');
          const regex = new RegExp(pattern, 'i');
          const matches = lines.filter((line) => regex.test(line)).map((line) => line.trim()).filter((line) => line);

          if (matches.length === 0) {
            return finish(`[${pattern}] 검색 결과가 없습니다 (Piped Input).`);
          }
          return finish(`--- GREP SEARCH (PIPE): [${pattern}] ---\n${matches.join('\n')}\n--- SEARCH END ---`);
        }

        const results = vfsService.searchFiles(pattern);
        if (results.length === 0) {
          return finish(`[${pattern}] 검색 결과가 없습니다.`);
        }

        let output = `--- GREP SEARCH: [${pattern}] ---\n`;
        results.forEach((result) => {
          output += `[${result.name}]: ${result.matches.length} matches\n`;
          result.matches.slice(0, 3).forEach((match) => {
            output += `  > ${match}\n`;
          });
          if (result.matches.length > 3) {
            output += `  ... and ${result.matches.length - 3} more\n`;
          }
        });
        output += '--- SEARCH END ---';
        return finish(output);
      } catch (error) {
        return finish(`잘못된 검색 패턴입니다: ${error.message}`);
      }
    }

    if (cmd === 'WC') {
      const resolved = resolveContent(parts[1], context, '사용법: WC [이름] 또는 PIPE 연결');
      if (!resolved.ok) {
        return finish(resolved.message);
      }

      const lines = resolved.content === '' ? 0 : resolved.content.split('\n').length;
      const words = resolved.content.trim() === '' ? 0 : resolved.content.split(/\s+/).filter((word) => word).length;
      const chars = resolved.content.length;
      return finish(`--- WC (${resolved.source}) ---\nLines: ${lines}, Words: ${words}, Chars: ${chars}\n--- WC END ---`);
    }

    if (cmd === 'SORT') {
      const resolved = resolveContent(parts[1], context, '사용법: SORT [이름] 또는 PIPE 연결');
      if (!resolved.ok) {
        return finish(resolved.message);
      }

      const lines = resolved.content.split('\n').filter((line) => line !== '');
      lines.sort();
      return finish(lines.join('\n'));
    }

    if (cmd === 'UNIQ') {
      const resolved = resolveContent(parts[1], context, '사용법: UNIQ [이름] 또는 PIPE 연결');
      if (!resolved.ok) {
        return finish(resolved.message);
      }

      const uniqueLines = [];
      let lastLine = null;
      for (const line of resolved.content.split('\n')) {
        if (line !== lastLine) {
          uniqueLines.push(line);
          lastLine = line;
        }
      }
      return finish(uniqueLines.join('\n'));
    }

    if (cmd === 'HEAD' || cmd === 'TAIL') {
      let count = 10;
      let fileIdx = 1;

      if (parts[1] && parts[1].startsWith('-')) {
        count = parseInt(parts[1].slice(1), 10) || 10;
        fileIdx = 2;
      }

      const names = parts.slice(fileIdx);
      if (context && context.pipedData) {
        const lines = context.pipedData.split('\n');
        const result = cmd === 'HEAD' ? lines.slice(0, count) : lines.slice(-count);
        return finish(result.join('\n'));
      }

      if (names.length === 0) {
        return finish(`사용법: ${cmd} [-n] [이름...]`);
      }

      return finish(readHeadTail(cmd, names, count));
    }

    if (cmd === 'DIFF') {
      const leftFile = parts[1];
      const rightFile = parts[2];
      if (!leftFile || !rightFile) {
        return finish('사용법: DIFF [파일1] [파일2]');
      }

      const leftContent = vfsService.getFile(leftFile);
      const rightContent = vfsService.getFile(rightFile);
      if (leftContent === null) {
        return finish(`파일 [${leftFile}]을 찾을 수 없습니다.`);
      }
      if (rightContent === null) {
        return finish(`파일 [${rightFile}]을 찾을 수 없습니다.`);
      }

      const leftLines = leftContent.split('\n');
      const rightLines = rightContent.split('\n');
      const max = Math.max(leftLines.length, rightLines.length);
      const diffs = [];
      for (let index = 0; index < max; index += 1) {
        if (leftLines[index] !== rightLines[index]) {
          diffs.push(`Line ${index + 1}:\n < ${leftLines[index] || '(empty)'}\n > ${rightLines[index] || '(empty)'}`);
        }
      }

      if (diffs.length === 0) {
        return finish('두 파일의 내용이 완전히 일치합니다.');
      }
      return finish(`--- DIFF [${leftFile}] vs [${rightFile}] ---\n${diffs.join('\n\n')}\n--- DIFF END ---`);
    }

    return false;
  }

  return {
    handleTextCommand
  };
}
