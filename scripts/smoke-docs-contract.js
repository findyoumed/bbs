'use strict';

/**
 * Verify that the shared 01410 development contract remains backed by the
 * reference catalogues and the implementation/test entry points it names.
 * This is intentionally read-only: it does not parse or execute reference
 * binaries and it never requires a live server or external service.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  const candidates = [
    path.join(projectRoot, relativePath),
    // Reference bundles may be kept under docs/bbs to keep the repository
    // root focused on the web service; both layouts are valid.
    path.join(projectRoot, 'docs', 'bbs', relativePath)
  ];
  const absolutePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!absolutePath) {
    throw new Error(`missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function assertIncludes(text, relativePath, fragments) {
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      throw new Error(`${relativePath} is missing required marker: ${fragment}`);
    }
  }
}

function main() {
  const principlesPath = 'docs/01410-common-principles.md';
  const principles = read(principlesPath);
  assertIncludes(principles, principlesPath, [
    '# 01410 공통 개발 원칙',
    '## 1. 명령어 중심 이동',
    '## 2. ANSI 터미널 화면 구조',
    '## 3. 입력 parity',
    '## 4. 본문·힌트·오류 영역 분리',
    '## 5. 서비스 문맥 보존',
    '## 6. 저장소와 보안 경계',
    '## 7. 모바일 제약',
    '`GO <keyword>`',
    'ANSI/CSI',
    'service-role',
    '320/360/390/430px'
  ]);

  const referencedFiles = [
    'docs/PC통신_자료_학습카탈로그.md',
    'docs/PC통신_GO_호환성_카탈로그.md',
    'docs/NURIE_NRE_CATALOG.md',
    'docs/01410-ui-reference.md',
    'docs/PC통신_명령어_완전_정리.txt',
    'nurie/HITEL.MNU',
    'nurie-source/GOMENU.C',
    'public/js/core/commandRouterService.js',
    'public/js/core/terminalUiCore.js',
    'public/style.css',
    'scripts/smoke-go-ansi.js',
    'scripts/smoke-command-parity.js',
    'scripts/smoke-mobile-viewports.js'
  ];
  for (const relativePath of referencedFiles) read(relativePath);

  const agents = read('AGENTS.md');
  assertIncludes(agents, 'AGENTS.md', [
    'PC통신동호회 01410',
    '80×24 ANSI',
    'docs/01410-ui-reference.md',
    'docs/PC통신_참고_북마크_리스트.md'
  ]);

  const mobileSmoke = read('scripts/smoke-mobile-viewports.js');
  assertIncludes(mobileSmoke, 'scripts/smoke-mobile-viewports.js', [
    'width: 320',
    'width: 360',
    'width: 390',
    'width: 430',
    'verifyMobileTouchInteractions'
  ]);

  const result = {
    ok: true,
    principles: principlesPath,
    referencesChecked: referencedFiles.length,
    contractMarkers: 12,
    mobileViewports: [320, 360, 390, 430]
  };
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
