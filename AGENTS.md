# BBS 프로젝트 AI 작업 규칙

이 파일은 저장소에서 사용하는 공통 AI 작업 지침입니다. 작업 전 관련 소스와 설정을 확인하고, 요청 범위를 벗어난 변경은 하지 않습니다.

## 작업 원칙

1. 불확실한 경로·동작·원인은 추측하지 말고 실제 파일과 테스트로 확인합니다.
2. 수정 전에 대상 파일과 연결된 호출부를 읽고 기존 동작을 보존합니다.
3. 변경 범위를 작게 유지하고, 변경 이유와 검증 결과를 최종 보고에 명시합니다.
4. 새 npm 패키지나 외부 서비스 연동을 추가할 때는 먼저 사용자에게 확인합니다.
5. 비밀값은 코드나 커밋에 넣지 않고 환경변수로 처리합니다.

## 기술 스택과 구조

- 프런트엔드: HTML5, CSS3, Vanilla JavaScript ES modules
- 서버: Node.js 내장 HTTP 모듈
- 데이터·인증: Supabase JS SDK, 설정이 없을 때 Memory/Local fallback
- 사용하지 않는 기술: React, Vue, TypeScript, Webpack, Vite, Next.js

주요 경로:

- `public/index.html` → `public/js/app.js` → `public/js/core/appFactory.js`
- `public/js/core/`: 화면·상태·입력·API 모듈
- `src/server/`: 서버 런타임·라우터·서비스·저장소
- `src/core/`: 서버와 도구가 공유하는 유틸리티
- `legacy/`: 원본 BBS 메뉴와 텍스트 자산

화면은 `state.screen`과 URL을 함께 갱신하며, 터미널 UI는 80×24 ANSI 격자와 키보드 명령 흐름을 유지합니다.

## 검증 명령

```bash
npm run build                 # Vercel 자산·API 계약
npm run check                 # 저장소 드라이버와 필수 파일
npm run qa:final              # 서버·핵심 파일·기본 API
npm run loop:verify           # 결정적 스모크 9개 완료 게이트
node --check path/to/file.js  # 개별 JavaScript 문법
```

기능을 수정하면 관련 스모크 테스트를 추가로 실행합니다. `npm test`는 현재 저장소에 단위 테스트 자산이 없으므로 별도 복구 전까지 완료 게이트로 사용하지 않습니다.

## Git과 문서

- 기본 브랜치는 `main`입니다.
- 커밋·푸시는 사용자의 요청 범위 안에서만 수행합니다.
- 실행에 필요한 문서와 원전 참고자료만 저장소에 유지합니다. 일회성 계획서·작업 로그·채팅 transcript는 커밋하지 않습니다.

## 01410 UI 참고

- 브랜드: `PC통신동호회 01410`
- 원전 참고: `docs/오늘 추억속으로 사라진 01410의 마지막 모습 - 푸른하늘 임묵 네이버 카페.mp4`
- 설계 문서: [`docs/01410-ui-reference.md`](docs/01410-ui-reference.md)
- 참고 링크 모음: [`docs/PC통신_참고_북마크_리스트.md`](docs/PC통신_참고_북마크_리스트.md)
- 새 화면에서도 상단 제목·페이지 표시·고정폭 정렬·하단 명령 힌트를 유지합니다.
