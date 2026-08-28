# Gemini 안내

공통 규칙은 [`AGENTS.md`](AGENTS.md)를 따릅니다. Gemini CLI와 Antigravity가 사용할 도구별 안내만 둡니다.

## 작업 원칙

- 실제 파일과 테스트를 확인한 뒤 작업합니다.
- 추측하지 않고, 요청 범위 밖의 변경을 하지 않습니다.
- Vanilla JS·HTML·CSS·Node.js 구조와 기존 인증·상태 로직을 보존합니다.
- 외부 서비스 연동 확대와 새 npm 패키지는 사용자 확인 후 추가합니다.

## 검증

```bash
npm run build
npm run check
npm run qa:final
npm run loop:verify
node --check path/to/file.js
```

상세 구조와 01410 UI 기준은 [`AGENTS.md`](AGENTS.md)와 [`docs/01410-ui-reference.md`](docs/01410-ui-reference.md)를 참고합니다.
