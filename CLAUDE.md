# Claude Code 안내

공통 규칙은 [`AGENTS.md`](AGENTS.md)를 따릅니다. 이 파일에는 Claude Code에 필요한 최소 안내만 둡니다.

## 작업 규칙

- 작업 전에 관련 소스와 설정을 읽습니다.
- 불확실한 내용은 추측하지 않고 확인합니다.
- 요청 범위를 벗어난 리팩터링과 새 패키지 추가는 하지 않습니다.
- 기존 인증·상태·저장소 동작을 보존하고 변경 이유를 보고합니다.
- Vanilla JS, HTML, CSS, Node.js 구조를 유지합니다.

## 기본 검증

```bash
npm run build
npm run check
npm run qa:final
npm run loop:verify
node --check path/to/file.js
```

기능을 수정했으면 해당 기능의 `scripts/smoke-*.js`도 실행합니다. `npm test`는 현재 저장소에 단위 테스트 디렉터리가 없어 실행되지 않으므로 복구 전까지 완료 판정에 사용하지 않습니다.

## 구조 요약

- 브라우저 진입점: `public/js/app.js`
- 브라우저 모듈: `public/js/core/`
- 서버 런타임: `src/server/`
- Vercel API 진입점: `api/index.js`
- 터미널 UI: 80×24 ANSI 격자
