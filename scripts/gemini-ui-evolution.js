#!/usr/bin/env node
// [LOG: 20260424_2206] Gemini UI Evolution Harness v5
// PC/모바일 세로/모바일 가로 3가지 환경의 엣지 케이스를 스스로 찾아 개선하는 자동 반복 스크립트

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function askUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function runCommand(command, args = [], cwd, useShell = false) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: useShell, // false로 두면 cmd.exe를 안 거치고 깔끔하게 실행됨 (git용)
      env: { ...process.env, PAGER: 'cat' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: err.message,
      });
    });
  });
}

async function gitPreCheck(cwd) {
  const gitVersion = await runCommand('git', ['--version'], cwd, false);
  if (!gitVersion.success) return false;

  const gitStatus = await runCommand('git', ['status', '--porcelain'], cwd, false);
  if (gitStatus.exitCode === 128) return false;

  if (gitStatus.stdout.length > 0) {
    console.log('⚠️  커밋되지 않은 변경사항이 있습니다. 하네스가 자동으로 세이브포인트를 생성합니다.');
  }
  return true;
}

async function gitSavepoint(label, cwd) {
  await runCommand('git', ['add', '.'], cwd, false);
  const diffCheck = await runCommand('git', ['diff', '--cached', '--quiet'], cwd, false);

  if (!diffCheck.success) {
    // 셸을 거치지 않으면(shell: false) 배열 요소가 문자열 그대로 전달되므로 따옴표 문제가 안 생깁니다.
    const commitResult = await runCommand('git', ['commit', '-m', label], cwd, false);
    if (commitResult.success) {
      console.log('   ✅ 세이브포인트 생성 완료');
      return true;
    } else {
      console.log(`   ⚠️ 커밋 실패: ${commitResult.stderr.split('\n')[0]}`);
      return false;
    }
  } else {
    console.log('   ℹ️ 변경사항 없음 — 세이브포인트 불필요');
    return true;
  }
}

async function gitRollback(cwd) {
  await runCommand('git', ['reset', 'HEAD', '.'], cwd, false);
  await runCommand('git', ['checkout', '--', '.'], cwd, false);
  await runCommand('git', ['clean', '-fd'], cwd, false);
  console.log('   ✅ 롤백 완료 (마지막 세이브포인트로 복원)');
}

async function gitCommitSuccess(iteration, cwd) {
  await runCommand('git', ['add', '.'], cwd, false);
  const diffCheck = await runCommand('git', ['diff', '--cached', '--quiet'], cwd, false);

  if (!diffCheck.success) {
    const label = `feat(ui): gemini evolution iteration ${iteration} passed`;
    const commitResult = await runCommand('git', ['commit', '-m', label], cwd, false);
    if (commitResult.success) {
      console.log('   ✅ 성공 커밋 저장 완료');
      return { committed: true };
    } else {
      console.log(`   ⚠️ 성공 커밋 실패: ${commitResult.stderr.split('\n')[0]}`);
      return { committed: false, error: true };
    }
  } else {
    console.log('   ℹ️ 변경된 파일 없음 — 커밋 건너뜀');
    return { committed: false, skipped: true };
  }
}

function runGemini(iteration, total, cwd, history) {
  return new Promise((resolve) => {
    let promptText = [
      'You are a UI/UX expert. This project is a retro PC-communication BBS implemented as a web app.',
      'Your mission: improve responsive UI for "PC screen", "Mobile Portrait (max-width:768px)", and "Mobile Landscape (orientation:landscape)".',
      `Current step: [${iteration}/${total}]`,
      'Instructions:',
      '1. Pick ONE of these 3 environments and find a specific Edge Case that could cause UI problems.',
      '   Examples:',
      '   - [Mobile Landscape] Screen height too small causing terminal layout to collapse',
      '   - [Mobile Portrait] Long text or tables overflowing or touch targets too small',
      '   - [PC] Ultra-high resolution causing the terminal width to look unnaturally wide',
      '2. Fix the problem by editing `public/style.css` (add appropriate media query) or JS files.',
      '3. Add a comment exactly like "/* [LOG: Mobile Portrait] fixed touch target sizes */" or "// [LOG: ...] ".',
      '4. Do NOT break any existing working code.',
      '5. Fix only ONE edge case and then stop.',
      '6. CRITICAL: DO NOT execute any terminal commands (e.g. npm, node). The harness will automatically run smoke tests and handle git commits after you finish.',
    ];
    
    if (history && history.length > 0) {
      promptText.push('');
      promptText.push('=== PREVIOUSLY COMPLETED TASKS (DO NOT REPEAT THESE) ===');
      promptText.push(...history);
      promptText.push('========================================================');
      promptText.push('Make sure to find a NEW edge case that is different from the ones listed above.');
    }

    const taskFilePath = path.join(cwd, '.gemini-evolution-task.txt');
    fs.writeFileSync(taskFilePath, promptText.join('\n'), 'utf8');

    const shortPrompt = 'Read the file .gemini-evolution-task.txt in the project root and follow all instructions in it exactly.';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 [${iteration}/${total}] Gemini UI edge case auto-fix (${timestamp()})`);
    console.log(`${'='.repeat(60)}\n`);

    // cmd.exe가 공백을 쪼개는 것을 막기 위해 명시적으로 쌍따옴표로 감싸줍니다.
    // -p 플래그를 사용하여 Non-interactive (Headless) 모드로 띄워야만 AI가 작업을 마치고 알아서 종료(exit 0)합니다.
    const child = spawn('gemini', ['-y', '-p', `"${shortPrompt}"`], {
      cwd: cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, PAGER: 'cat' },
    });

    child.on('close', (code) => resolve(code === 0));
    child.on('error', (err) => {
      console.error('❌ Gemini 실행 실패:', err.message);
      resolve(false);
    });
  });
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = { maxIterations: 0, dryRun: false };

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--max' && args[i + 1]) {
      config.maxIterations = Math.max(1, parseInt(args[i + 1], 10) || 0);
      i += 2;
    } else if (args[i] === '--dry-run') {
      config.dryRun = true;
      i += 1;
    } else {
      i += 1;
    }
  }
  return config;
}

async function main() {
  const config = parseArgs(process.argv);
  const cwd = path.resolve(__dirname, '..');

  let totalIterations = config.maxIterations;
  if (totalIterations === 0) {
    console.log('\n🎯 Gemini UI Evolution Harness');
    const answer = await askUser('몇 번 반복할까요? (1~50, 기본값 10): ');
    totalIterations = parseInt(answer, 10);
    if (isNaN(totalIterations) || totalIterations < 1) totalIterations = 10;
    if (totalIterations > 50) totalIterations = 50;
  }

  if (config.dryRun) {
    console.log('\n🔵 [DRY RUN] 실제 실행하지 않고 계획만 출력합니다.\n');
    process.exit(0);
  }

  const gitOk = await gitPreCheck(cwd);
  if (!gitOk) process.exit(1);

  await gitSavepoint('chore(harness): initial savepoint', cwd);

  const preCheck = await runCommand('npm', ['run', 'smoke:vercel-ready'], cwd, true);
  if (!preCheck.success) {
    console.error('❌ 하네스 시작 전에 이미 Smoke Test가 실패합니다!');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  const evolutionHistory = [];

  for (let i = 1; i <= totalIterations; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 회차 ${i}/${totalIterations} — ${timestamp()}`);
    console.log(`${'='.repeat(60)}`);

    await gitSavepoint(`chore(harness): before iteration ${i}`, cwd);

    const geminiSuccess = await runGemini(i, totalIterations, cwd, evolutionHistory);

    if (!geminiSuccess) {
      console.error('\n⚠️ Gemini 비정상 종료. 자동 롤백 중...');
      await gitRollback(cwd);
      failCount++;
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    console.log('\n🔍 [STEP 3] Smoke Test...');
    const verifyResult = await runCommand('npm', ['run', 'smoke:vercel-ready'], cwd, true);

    if (verifyResult.success) {
      console.log('   ✅ Smoke Test 통과!');
      const commitState = await gitCommitSuccess(i, cwd);
      
      if (commitState.committed) {
        successCount++;
        // 방금 성공적으로 커밋된 내용에서 AI가 작성한 [LOG: ...] 주석을 추출합니다.
        const diffLog = await runCommand('git', ['log', '-1', '-p'], cwd, false);
        const logLines = diffLog.stdout
          .split('\n')
          .filter(line => line.startsWith('+') && line.includes('[LOG:'))
          .map(line => line.replace(/^\+/, '').replace(/\/\*/g, '').replace(/\*\//g, '').replace(/\/\//g, '').trim());
        
        if (logLines.length > 0) {
          console.log(`   🧠 히스토리 기록 추가: ${logLines[0]}`);
          evolutionHistory.push(`- Step ${i}: ${logLines[0]}`);
        } else {
          // 주석을 못 찾았을 경우 수정된 파일명이라도 기록합니다.
          const nameOnly = await runCommand('git', ['show', '--name-only', '--format='], cwd, false);
          const files = nameOnly.stdout.split('\n').filter(Boolean).join(', ');
          console.log(`   🧠 히스토리 기록 추가: Modified ${files}`);
          evolutionHistory.push(`- Step ${i}: Modified ${files}`);
        }
      }
    } else {
      console.log('   ❌ Smoke Test 실패! 자동 롤백 중...');
      await gitRollback(cwd);
      failCount++;
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n완료. 총 ${totalIterations}회 중 성공 ${successCount}회, 실패(롤백) ${failCount}회 (${Math.floor(elapsed / 60)}분 ${elapsed % 60}초)`);
}

main().catch((err) => {
  console.error('치명적 에러:', err);
  process.exit(1);
});
