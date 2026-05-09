#!/usr/bin/env node
// [LOG: 20260425_1831] Codex Test REPL Loop — 테스트 기반 자동 수정 루프
// 사용법: node scripts/codex-repl-loop.js "테스트 요구사항" --verify "테스트 실행 명령어" [옵션]
//      또는 node scripts/codex-repl-loop.js --task-file "프롬프트 파일" --verify "테스트 실행 명령어" [옵션]
//
// 예시:
//   node scripts/codex-repl-loop.js "AssetManager.js 단위 테스트 작성" --verify "npm test tests/unit/AssetManager.test.js"
//   node scripts/codex-repl-loop.js --task-file "loop_system/prompts/ralph-browser-loop.md" --memory-file "loop_system/state/ralph-browser-loop.md" --verify "npm run smoke:full-traversal" --evolve --commit

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DEFAULT_MODEL = 'gpt-5.4';
const MEMORY_PROMPT_LINE_LIMIT = 120;
const VERIFY_OUTPUT_LINE_LIMIT = 30;

function askUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    task: '',
    taskFile: '',
    memoryFile: '',
    sessionName: '',
    verifyCommands: [],
    maxRetries: 3,
    mode: 'full-auto',
    model: DEFAULT_MODEL,
    dryRun: false,
    evolveMode: false,
    autoCommit: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--task-file') {
      config.taskFile = args[++i];
    } else if (arg === '--memory-file') {
      config.memoryFile = args[++i];
    } else if (arg === '--session-name') {
      config.sessionName = args[++i];
    } else if (arg === '--verify') {
      config.verifyCommands.push(args[++i]);
    } else if (arg === '--max') {
      config.maxRetries = parseInt(args[++i], 10);
    } else if (arg === '--mode') {
      config.mode = args[++i];
    } else if (arg === '--model') {
      config.model = args[++i];
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--evolve') {
      config.evolveMode = true;
    } else if (arg === '--commit') {
      config.autoCommit = true;
    } else if (!arg.startsWith('--') && !config.task) {
      config.task = arg;
    }
    i++;
  }

  if (!Number.isFinite(config.maxRetries) || config.maxRetries < 1) {
    config.maxRetries = 3;
  }

  return config;
}

function inferSessionName(config) {
  const source = config.sessionName || config.memoryFile || config.taskFile || config.task || 'codex-loop';
  return String(source)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'codex-loop';
}

function loadTaskFromFile(taskFile, cwd) {
  const taskPath = path.resolve(cwd, taskFile);

  if (!fs.existsSync(taskPath)) {
    throw new Error(`Task file not found: ${taskPath}`);
  }

  const task = fs.readFileSync(taskPath, 'utf8').trim();
  if (!task) {
    throw new Error(`Task file is empty: ${taskPath}`);
  }

  return { task, taskPath };
}

function ensureMemoryFile(memoryFile, cwd, sessionName) {
  const memoryPath = path.resolve(cwd, memoryFile);
  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });

  if (!fs.existsSync(memoryPath)) {
    const template = [
      `# ${sessionName} Loop Memory`,
      '',
      '## Mission',
      '- Keep existing user-facing functionality working reliably.',
      '- Prioritize failing verify commands, browser console errors, page errors, and regressions.',
      '- Do not add new features unless a current failing verification explicitly requires it.',
      '',
      '## Completed So Far',
      '- None yet.',
      '',
      '## Next Focus',
      '- Start from the current failing verification output.',
      '',
      '## Repeat Guards',
      '- Do not repeat already-completed work unless a verify command regresses there again.',
      '',
      '## Automated Cycle Log',
      '',
    ].join('\n');

    fs.writeFileSync(memoryPath, template, 'utf8');
  }

  return memoryPath;
}

function trimBlock(text, maxLines) {
  const lines = String(text || '').split(/\r?\n/);
  if (lines.length <= maxLines) {
    return String(text || '').trim();
  }

  const headCount = Math.ceil(maxLines / 2);
  const tailCount = Math.floor(maxLines / 2);

  return [
    ...lines.slice(0, headCount),
    '... [trimmed for brevity] ...',
    ...lines.slice(-tailCount),
  ].join('\n').trim();
}

function formatOutputTail(text, maxLines = VERIFY_OUTPUT_LINE_LIMIT) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return '';
  }
  return lines.slice(-maxLines).join('\n');
}

function formatVerificationForPrompt(results) {
  return results.map((result) => {
    const status = result.success ? 'PASS' : 'FAIL';
    const tail = formatOutputTail(result.output);
    return [
      `[${status}] ${result.command}`,
      tail ? `[Output]\n${tail}` : '[Output]\n(no output)',
    ].join('\n');
  }).join('\n\n');
}

function buildLoopTask(baseTask, config, attempt, phase, verification) {
  const sections = [
    baseTask,
    [
      '[Harness Policy]',
      '- Focus on existing functionality working reliably.',
      '- Do not add new user-facing features, redesigns, or scope expansion unless a failing verify command requires it.',
      '- Prioritize failing verify commands, Playwright console errors, page errors, broken routes, and regressions in current flows.',
      '- Before finishing this cycle, update WORK_LOG.md and the loop memory file with completed work, current stable areas, and the next focus so the next cycle does not repeat work.',
    ].join('\n'),
  ];

  if (config.memoryFile) {
    sections.push([
      '[Loop Memory File]',
      `Path: ${config.memoryFile}`,
      'Read this file first and update its human summary sections before you finish this cycle.',
    ].join('\n'));

    sections.push([
      '[Loop Memory Snapshot]',
      trimBlock(config.memorySnapshot || '(empty)', MEMORY_PROMPT_LINE_LIMIT),
    ].join('\n'));
  }

  sections.push([
    '[Cycle Context]',
    `- Session: ${config.sessionName}`,
    `- Attempt: ${attempt}/${config.maxRetries}`,
    '- Keep scope tight. Fix the highest-signal existing issue first, then re-verify.',
  ].join('\n'));

  if (phase === 'retry' && verification) {
    sections.push([
      '[Retry Evidence]',
      'The previous cycle failed verification. Fix these errors before touching anything else.',
      formatVerificationForPrompt(verification.results),
    ].join('\n\n'));
  }

  if (phase === 'evolve') {
    sections.push([
      '[Evolution Directive]',
      'The previous cycle passed verification.',
      '- Evolve automatically to the next cycle without inventing new features.',
      '- Choose the next highest-risk existing flow or latent runtime issue.',
      '- Prefer reliability improvements, defensive error handling, browser/runtime cleanup, and regression prevention over new capability.',
      '- Use the loop memory file to avoid repeating work that is already complete unless a verify command regressed there again.',
    ].join('\n'));

    if (verification) {
      sections.push([
        '[Previous Successful Verification]',
        formatVerificationForPrompt(verification.results),
      ].join('\n\n'));
    }
  }

  return sections.join('\n\n');
}

function timestamp() {
  const now = new Date();
  return now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

function runCommand(cmd, cwd) {
  return new Promise((resolve) => {
    console.log(`\n[RUN] ${cmd}`);
    const child = spawn(cmd, {
      cwd,
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, PAGER: 'cat' },
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    child.stderr.on('data', (data) => {
      output += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, output, exitCode: code });
    });

    child.on('error', (err) => {
      resolve({ success: false, output: err.message, exitCode: 1 });
    });
  });
}

function runProcess(bin, args, cwd, options = {}) {
  const { echo = true, streamOutput = true } = options;

  return new Promise((resolve) => {
    if (echo) {
      console.log(`\n[RUN] ${bin} ${args.join(' ')}`);
    }

    const child = spawn(bin, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PAGER: 'cat' },
    });

    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      if (streamOutput) process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
      if (streamOutput) process.stderr.write(data);
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, output, exitCode: code });
    });

    child.on('error', (err) => {
      resolve({ success: false, output: err.message, exitCode: 1 });
    });
  });
}

async function runVerification(commands, cwd) {
  let allPassed = true;
  const results = [];

  for (const cmd of commands) {
    const result = await runCommand(cmd, cwd);
    if (!result.success) allPassed = false;
    results.push({ command: cmd, ...result });
  }

  return { allPassed, results };
}

function runCodex(task, config, cwd) {
  return new Promise((resolve) => {
    const taskFilePath = path.join(cwd, '.codex-repl-task.txt');
    fs.writeFileSync(taskFilePath, task, 'utf8');

    const shortPrompt = 'Read the file .codex-repl-task.txt in the project root and follow all instructions in it exactly.';
    const args = [];

    if (config.mode === 'full-auto' || config.mode === 'auto') {
      args.push('--full-auto');
      args.push('--no-alt-screen');
    }

    args.push('exec');
    args.push('--model', config.model || DEFAULT_MODEL);
    args.push(`"${shortPrompt}"`);

    console.log('\n------------------------------------------------------------');
    console.log(`🤖 Codex 실행 (세션: ${config.sessionName}, 모델: ${config.model || DEFAULT_MODEL})`);
    console.log(`   테스트 목표: ${task.substring(0, 120)}${task.length > 120 ? '...' : ''}`);
    console.log('------------------------------------------------------------\n');

    const child = spawn('codex', args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PAGER: 'cat' },
    });

    child.on('close', (code) => {
      try { fs.unlinkSync(taskFilePath); } catch (error) {}
      resolve({ exitCode: code, success: code === 0 });
    });

    child.on('error', (err) => {
      console.error('\n❌ Codex 실행 실패:', err.message);
      try { fs.unlinkSync(taskFilePath); } catch (error) {}
      resolve({ exitCode: 1, success: false });
    });
  });
}

function setToSortedArray(setLike) {
  return Array.from(setLike).sort((a, b) => a.localeCompare(b));
}

async function listDirtyFiles(cwd) {
  const [tracked, staged, untracked] = await Promise.all([
    runProcess('git', ['diff', '--name-only', '--'], cwd, { echo: false, streamOutput: false }),
    runProcess('git', ['diff', '--cached', '--name-only', '--'], cwd, { echo: false, streamOutput: false }),
    runProcess('git', ['ls-files', '--others', '--exclude-standard'], cwd, { echo: false, streamOutput: false }),
  ]);

  const files = new Set();
  [tracked.output, staged.output, untracked.output].forEach((chunk) => {
    String(chunk || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => files.add(line));
  });

  return files;
}

function appendAutomationLog(config, entry) {
  if (!config.memoryPath) {
    return;
  }

  const lines = [
    '',
    `### [${timestamp()}] Cycle ${entry.attempt}/${config.maxRetries} - ${entry.status}`,
    '',
    `- Status: ${entry.status}`,
  ];

  entry.results.forEach((result) => {
    lines.push(`- ${result.success ? 'PASS' : 'FAIL'}: ${result.command}`);
  });

  if (entry.files && entry.files.length > 0) {
    lines.push(`- Files changed this cycle: ${entry.files.join(', ')}`);
  }

  if (entry.commitMessage) {
    lines.push(`- Commit message: ${entry.commitMessage}`);
  }

  if (entry.commitNote) {
    lines.push(`- Auto-commit: ${entry.commitNote}`);
  }

  if (entry.nextFocus) {
    lines.push(`- Next focus: ${entry.nextFocus}`);
  }

  fs.appendFileSync(config.memoryPath, `${lines.join('\n')}\n`, 'utf8');
}

async function commitCycleChanges(config, cwd, attempt, baselineDirtyFiles) {
  const currentDirtyFiles = await listDirtyFiles(cwd);
  const filesToCommit = setToSortedArray(
    new Set(Array.from(currentDirtyFiles).filter((file) => !baselineDirtyFiles.has(file)))
  );
  const excludedFiles = setToSortedArray(
    new Set(Array.from(currentDirtyFiles).filter((file) => baselineDirtyFiles.has(file)))
  );

  if (filesToCommit.length === 0) {
    return {
      success: false,
      skipped: true,
      files: [],
      excludedFiles,
      message: '',
      note: baselineDirtyFiles.size > 0
        ? 'Skipped because only pre-existing dirty files remain; auto-commit avoids unrelated work.'
        : 'Skipped because there are no new dirty files to commit.',
    };
  }

  const addResult = await runProcess('git', ['add', '--', ...filesToCommit], cwd);
  if (!addResult.success) {
    return {
      success: false,
      skipped: false,
      files: filesToCommit,
      excludedFiles,
      message: '',
      note: `git add failed: ${formatOutputTail(addResult.output, 10) || 'unknown error'}`,
    };
  }

  const commitMessage = `chore: ${config.sessionName} cycle ${attempt} pass`;
  const commitResult = await runProcess('git', ['commit', '-m', commitMessage], cwd);
  if (!commitResult.success) {
    return {
      success: false,
      skipped: false,
      files: filesToCommit,
      excludedFiles,
      message: commitMessage,
      note: `git commit failed: ${formatOutputTail(commitResult.output, 10) || 'unknown error'}`,
    };
  }

  return {
    success: true,
    skipped: false,
    files: filesToCommit,
    excludedFiles,
    message: commitMessage,
    note: 'Committed successfully.',
  };
}

async function main() {
  const config = parseArgs(process.argv);
  const cwd = path.resolve(__dirname, '..');
  let taskSource = 'inline task';

  if (config.taskFile) {
    try {
      const loaded = loadTaskFromFile(config.taskFile, cwd);
      config.task = loaded.task;
      taskSource = path.relative(cwd, loaded.taskPath);
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  }

  if (!config.task) {
    console.log(`
+------------------------------------------------------------+
|        Codex Test REPL Loop - Test Automation              |
+------------------------------------------------------------+
| Usage: node scripts/codex-repl-loop.js "Test Goal"         |
|        --verify "Test Command" --max N                     |
|   or:  node scripts/codex-repl-loop.js --task-file "file"  |
|        --memory-file "state.md" --verify "Test Command"    |
+------------------------------------------------------------+
`);
    process.exit(1);
  }

  if (config.verifyCommands.length === 0) {
    console.error('❌ --verify option is required.');
    process.exit(1);
  }

  config.sessionName = inferSessionName(config);

  if (config.memoryFile) {
    config.memoryPath = ensureMemoryFile(config.memoryFile, cwd, config.sessionName);
    config.memorySnapshot = fs.readFileSync(config.memoryPath, 'utf8').trim();
  } else {
    config.memoryPath = '';
    config.memorySnapshot = '';
  }

  if (!process.argv.includes('--max')) {
    const answer = await askUser('\n🔄 몇 번 반복하시겠습니까? (기본값 3): ');
    const num = parseInt(answer.trim(), 10);
    if (!Number.isNaN(num) && num > 0) config.maxRetries = num;
  }

  console.log(`\n[START] Codex Test REPL Loop\n- Session: ${config.sessionName}\n- Task Source: ${taskSource}\n- Max Retries: ${config.maxRetries}\n- Auto Commit: ${config.autoCommit ? 'ON' : 'OFF'}\n- Evolve: ${config.evolveMode ? 'ON' : 'OFF'}\n- Memory File: ${config.memoryFile || '(none)'}\n`);

  if (config.dryRun) {
    console.log('🔵 [DRY RUN] Exit after planning.');
    config.verifyCommands.forEach((command) => {
      console.log(`- verify: ${command}`);
    });
    process.exit(0);
  }

  const baseTask = config.task;
  const baselineDirtyFiles = config.autoCommit ? await listDirtyFiles(cwd) : new Set();
  let phase = 'initial';
  let previousVerification = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    if (config.memoryPath) {
      config.memorySnapshot = fs.readFileSync(config.memoryPath, 'utf8').trim();
    }

    const currentTask = buildLoopTask(baseTask, config, attempt, phase, previousVerification);

    console.log(`\n>>> Attempt ${attempt}/${config.maxRetries} (${timestamp()})`);

    const codexResult = await runCodex(currentTask, config, cwd);
    if (!codexResult.success) {
      console.error(`\n❌ Codex 실행 중 오류가 발생했습니다. (Exit Code: ${codexResult.exitCode})`);
      process.exit(1);
    }

    console.log('\n>>> Verification Phase');
    const verification = await runVerification(config.verifyCommands, cwd);
    const changedFiles = setToSortedArray(await listDirtyFiles(cwd));

    if (verification.allPassed) {
      const nextFocus = config.evolveMode && attempt < config.maxRetries
        ? 'Stay inside existing features. Choose the next highest-risk unstable flow and avoid repeating already-complete work from memory.'
        : 'Stop here unless a future verify command or console/page error reveals a regression.';

      let commitResult = {
        success: false,
        skipped: true,
        files: [],
        message: '',
        note: 'Auto-commit disabled.',
      };

      if (config.autoCommit) {
        appendAutomationLog(config, {
          attempt,
          status: 'PASS',
          results: verification.results,
          files: changedFiles,
          commitNote: 'Requested after verification pass.',
          nextFocus,
        });
        commitResult = await commitCycleChanges(config, cwd, attempt, baselineDirtyFiles);
      } else {
        appendAutomationLog(config, {
          attempt,
          status: 'PASS',
          results: verification.results,
          files: changedFiles,
          commitNote: 'Skipped because auto-commit is disabled.',
          nextFocus,
        });
      }

      if (config.autoCommit && commitResult.success) {
        console.log(`\n📦 Automatic Commit Complete: ${commitResult.message}`);
      } else if (config.autoCommit) {
        console.log(`\n📦 Automatic Commit Note: ${commitResult.note}`);
      }

      if (config.evolveMode && attempt < config.maxRetries) {
        console.log('\n✅ Passed! Evolving to the next cycle...');
        previousVerification = verification;
        phase = 'evolve';
        continue;
      }

      console.log(`\n✅ ALL TESTS PASSED! (Finished at attempt ${attempt})`);
      process.exit(0);
    }

    appendAutomationLog(config, {
      attempt,
      status: 'FAIL',
      results: verification.results,
      files: changedFiles,
      commitNote: 'No commit because verification failed.',
      nextFocus: 'Fix the failing verify commands first. Do not start new work until they pass.',
    });

    if (attempt < config.maxRetries) {
      console.log('\n⚠️ Tests failed - preparing next retry cycle...');
      previousVerification = verification;
      phase = 'retry';
      continue;
    }
  }

  console.log(`\n❌ Failed to pass tests after ${config.maxRetries} attempts.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
