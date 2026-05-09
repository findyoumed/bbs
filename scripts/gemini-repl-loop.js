#!/usr/bin/env node
// [LOG: 20260424_2033] Gemini REPL Loop — 자동 검증 반복 스크립트
// [LOG: 20260428_1555] Fix: Added fallback to .gemini-repl-task.txt if task argument is missing.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

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

// ─── 인자 파싱 ───────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    task: '',
    verifyCommands: [],
    maxRetries: 3,
    mode: 'full-auto',
    model: '',
    dryRun: false,
    evolveMode: false,
    autoCommit: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--verify' && args[i + 1]) {
      config.verifyCommands.push(args[i + 1]);
      i += 2;
    } else if (arg === '--evolve') {
      config.evolveMode = true;
      i += 1;
    } else if (arg === '--max' && args[i + 1]) {
      config.maxRetries = Math.max(1, parseInt(args[i + 1], 10) || 3);
      i += 2;
    } else if (arg === '--mode' && args[i + 1]) {
      config.mode = args[i + 1] === 'ask' ? 'ask' : 'full-auto';
      i += 2;
    } else if (arg === '--model' && args[i + 1]) {
      config.model = args[i + 1];
      i += 2;
    } else if (arg === '--dry-run') {
      config.dryRun = true;
      i += 1;
    } else if (arg === '--commit') {
      config.autoCommit = true;
      i += 1;
    } else if (!config.task && !arg.startsWith('--')) {
      config.task = arg;
      i += 1;
    } else {
      i += 1;
    }
  }

  return config;
}

// ─── 명령어 실행 (Promise 래퍼) ──────────────────────────────
function runCommand(command, cwd) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const shellFlag = isWindows ? '/c' : '-c';

    const child = spawn(shell, [shellFlag, command], {
      cwd: cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PAGER: 'cat' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0,
        output: (stdout + '\n' + stderr).trim(),
      });
    });

    child.on('error', (err) => {
      resolve({
        exitCode: 1,
        stdout: '',
        stderr: err.message,
        success: false,
        output: err.message,
      });
    });
  });
}

// ─── Gemini 실행 ──────────────────────────────────────────────
function runGemini(task, config, cwd) {
  return new Promise((resolve) => {
    const taskFilePath = path.join(cwd, '.gemini-repl-task.txt');

    // 프롬프트를 임시 파일에 저장 (한글/공백/특수문자 안전)
    fs.writeFileSync(taskFilePath, task, 'utf8');

    // Gemini에는 짧은 영문 명령만 전달
    const shortPrompt = 'Read the file .gemini-repl-task.txt in the project root and follow all instructions in it exactly.';

    const args = [];
    if (config.mode === 'full-auto') {
      // Gemini CLI needs -y (yolo) for auto-approval, and -p for headless prompt
      args.push('-y', '-p');
    }
    if (config.model) {
      args.push('--model', config.model);
    }
    args.push(`"${shortPrompt}"`);

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🤖 Gemini 실행 (프롬프트 → .gemini-repl-task.txt)`);
    console.log(`   작업 요약: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`);
    console.log(`${'─'.repeat(60)}\n`);

    const child = spawn('gemini', args, {
      cwd: cwd || process.cwd(),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PAGER: 'cat' },
    });

    child.on('close', (code) => {
      resolve({ exitCode: code, success: code === 0 });
    });

    child.on('error', (err) => {
      console.error('❌ Gemini 실행 실패:', err.message);
      resolve({ exitCode: 1, success: false });
    });
  });
}

// ─── 검증 실행 ───────────────────────────────────────────────
async function runVerification(commands, cwd) {
  const results = [];
  let allPassed = true;

  for (const cmd of commands) {
    console.log(`\n🔍 검증: ${cmd}`);
    const result = await runCommand(cmd, cwd);

    if (result.success) {
      console.log(`   ✅ 통과`);
    } else {
      console.log(`   ❌ 실패 (exit code: ${result.exitCode})`);
      if (result.output) {
        // 에러 출력은 마지막 30줄만 보존 (Gemini에 전달할 때 토큰 절약)
        const lines = result.output.split('\n');
        const trimmed = lines.slice(-30).join('\n');
        console.log(`   출력:\n${trimmed}`);
      }
      allPassed = false;
    }

    results.push({ command: cmd, ...result });
  }

  return { allPassed, results };
}

// ─── 에러 요약 생성 (Gemini 재실행 시 프롬프트에 포함) ────────
function buildRetryPrompt(originalTask, failedResults, attempt, maxRetries) {
  const errorSummary = failedResults
    .filter((r) => !r.success)
    .map((r) => {
      const lines = r.output.split('\n').slice(-20).join('\n');
      return `[실패 명령] ${r.command}\n[에러 출력]\n${lines}`;
    })
    .join('\n\n');

  return [
    `[REPL Loop 자동 재시도 ${attempt}/${maxRetries}]`,
    ``,
    `이전 작업: ${originalTask}`,
    ``,
    `위 작업을 수행했지만 검증에 실패했습니다.`,
    `아래 에러를 분석하고 코드를 수정해 주세요.`,
    ``,
    errorSummary,
    ``,
    `수정 후 위 검증 명령이 통과하도록 해주세요.`,
    `기존 코드를 절대 생략하지 마세요.`,
  ].join('\n');
}

// ─── 타임스탬프 ──────────────────────────────────────────────
function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// ─── 메인 루프 ───────────────────────────────────────────────
async function main() {
  const config = parseArgs(process.argv);
  const cwd = path.resolve(__dirname, '..');

  // 작업 내용이 없으면 .gemini-repl-task.txt 파일에서 읽기 시도
  if (!config.task) {
    const taskFilePath = path.join(cwd, '.gemini-repl-task.txt');
    if (fs.existsSync(taskFilePath)) {
      config.task = fs.readFileSync(taskFilePath, 'utf8').trim();
      console.log(`ℹ️  작업 내용이 지정되지 않아 .gemini-repl-task.txt에서 내용을 읽어왔습니다.`);
    } else {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║           Gemini REPL Loop — 자동 검증 반복              ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  사용법:                                                 ║
║    node scripts/gemini-repl-loop.js "작업 내용"          ║
║      --verify "검증 명령어"                              ║
║                                                          ║
║    * 또는 .gemini-repl-task.txt 파일에 작업 내용을 저장  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
      process.exit(1);
    }
  }

  if (config.verifyCommands.length === 0) {
    console.error('❌ --verify 옵션이 필요합니다.');
    process.exit(1);
  }

  // --max 옵션이 명시되지 않았다면 사용자에게 물어보기
  if (!process.argv.includes('--max')) {
    const answer = await askUser('\n🔄 몇 번 반복하시겠습니까? (숫자 입력, 기본값 3): ');
    const num = parseInt(answer.trim(), 10);
    if (!isNaN(num) && num > 0) {
      config.maxRetries = num;
    }
  }

  console.log(`
╔══════════════════════════════════════════════════════════╗
║              Gemini REPL Loop 시작                      ║
╠══════════════════════════════════════════════════════════╣
║  작업: (파일 또는 인자로부터 로드됨)                    ║
║  검증: ${config.verifyCommands.length}개 명령어${' '.repeat(42)}║
║  최대: ${String(config.maxRetries).padEnd(48)}  ║
║  커밋: ${(config.autoCommit ? '자동 (ON)' : '수동 (OFF)').padEnd(48)}  ║
╚══════════════════════════════════════════════════════════╝
`);

  let currentTask = config.task;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📍 시도 ${attempt}/${config.maxRetries} — ${timestamp()}`);
    console.log(`${'═'.repeat(60)}`);

    // 1) Gemini 실행
    const geminiResult = await runGemini(currentTask, config, cwd);
    if (!geminiResult.success) {
      console.error(`\n❌ Gemini 실행 중 오류가 발생했습니다.`);
      process.exit(1);
    }

    // 2) 검증 실행
    console.log(`\n${'─'.repeat(60)}`);
    console.log('🔍 검증 단계');
    console.log(`${'─'.repeat(60)}`);

    const verification = await runVerification(config.verifyCommands, cwd);

    if (verification.allPassed) {
      if (config.autoCommit) {
        console.log(`\n📦 자동 커밋 중...`);
        const commitMsg = `chore: AI loop pass (Attempt ${attempt})`;
        await runCommand(`git add . && git commit -m "${commitMsg}"`, cwd);
      }

      if (config.evolveMode && attempt < config.maxRetries) {
        console.log(`\n✅ 검증 통과! 진화 모드 진행...`);
        currentTask = `[Evolve Mode] 기존 목표를 계속 발전시켜 주세요.`;
        continue;
      } else {
        console.log(`\n✅ 모든 검증 통과!`);
        process.exit(0);
      }
    }

    // 3) 실패 시 재시도 프롬프트 생성
    if (attempt < config.maxRetries) {
      console.log(`\n⚠️  검증 실패 — 재시도 준비 중...`);
      currentTask = buildRetryPrompt(
        config.task,
        verification.results,
        attempt + 1,
        config.maxRetries
      );
    }
  }

  process.exit(1);
}

main().catch((err) => {
  console.error('치명적 에러:', err);
  process.exit(1);
});
