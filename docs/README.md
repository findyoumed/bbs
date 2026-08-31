# www-bbs 프로젝트 종합 문서

이 문서는 `www-bbs` 프로젝트의 아키텍처, 파일 구조, 개발 원칙 및 로드맵을 통합한 마스터 문서입니다.

---

## 1. 프로젝트 개요

이 프로젝트는 **"옛 DOS BBS(하이텔, 나우누리 등) 느낌의 UI를 가진 웹 애플리케이션"**입니다.

- **핵심 목표**: 터미널 감성의 UI 유지, 단순하고 이해하기 쉬운 웹앱 구조, 기존 자산의 최대한의 재사용.
- **기술 스택**: 
  - 프런트엔드: HTML5, CSS3, Vanilla JavaScript (ES6+)
  - 백엔드: Node.js (`server.js`)
  - 저장소/인증: Supabase (Auth, Postgres, Realtime, Storage)
- **금지 사항**: React, Vue, TypeScript, Webpack, Vite 등의 복잡한 빌드 도구 및 프레임워크 사용 금지.

---

## 2. 핵심 아키텍처 및 UI 원칙

### 2-1. 시스템 구조
- **Browser**: `public/index.html` 진입점. `public/js/app.js`를 통해 모듈 로드 (`core/appFactory.js`의 `initApp()`이 앱 조립). `core/ansiEngine.js` + `core/terminalUiCore.js`가 DOM 기반 터미널 화면을 그림.
- **Server**: `server.js` 진입점. `src/server/createAppRuntime.js`에서 런타임 조립. `routeHandlers/*`에서 API 처리.
- **Data**: Supabase를 주 저장소로 사용하며, 설정이 없을 경우 메모리 저장소로 동작하는 fallback 구조를 가짐.

### 2-2. UI/UX 원칙
- **80열 논리 유지**: 옛날 통신 화면 기준인 가로 80칸의 격자 구조를 지향함.
- **터미널 스타일**: 텍스트 중심의 메뉴와 명령 흐름을 유지하며, 둥근모꼴(DungGeunMo) 폰트를 권장함.
- **입력 계층**: IME(한글 입력) 상태 기계와 포커스 관리를 중앙화하여 처리함.

### 2-3. 주요 사용자 명령어
- `go [메뉴명]`: 특정 서비스로 바로 이동 (예: `go plaza`, `go chat`)
- `p` 또는 `m`: 이전 화면으로 돌아가기
- `t` 또는 `go top`: 메인 메뉴로 이동 (`top` 단독 입력은 지원하지 않음)
- `q` 또는 `quit`: 현재 서비스 종료
- `bye` 또는 `logout`: 로그아웃 및 종료

---

## 3. 파일 구조 및 책임 (Lookup Table)

| 영역 | 주요 파일/폴더 | 설명 |
| :--- | :--- | :--- |
| **서버 진입** | `server.js`, `src/server/createAppRuntime.js` | 서버 기동 및 환경 설정 |
| **API 처리** | `src/server/createRequestHandler.js`, `routeHandlers/` | HTTP 요청 디스패치 및 도메인 로직 |
| **저장소(DB)** | `src/server/*Repository.js`, `*RepositorySupabase.js` | 게시판, 회원, 메모, 채팅 등 데이터 처리 |
| **프런트 진입** | `public/index.html`, `public/js/app.js` | 브라우저 렌더링 시작점 |
| **상태 관리** | `public/js/app.js`의 `state` 객체, `core/routingModule.js`, `core/commandRouter*.js` | 브라우저 측 상태(`state.screen`) 및 명령 라우팅 |
| **렌더링** | `public/js/core/ansiEngine.js`, `core/terminalUiCore.js`, `core/terminal*.js` | DOM 기반 터미널 화면 렌더링 |
| **레거시 자산** | `legacy/*.mnu`, `legacy/txt/*` | 메뉴 및 텍스트 원본 자산 |

---

## 4. 현재 로드맵 및 우선순위 (2026-04-05 기준)

### 4-1. 주요 과제
1. **구조 기준선 유지**: 워킹트리 구조와 문서 기준의 일치 확인.
2. **렌더링/입력 단순화**: 이벤트 기반 렌더링 강화 및 IME 상태 기계 정리.
3. **접근성 보강**: Screen-level accessibility 의미 구조 재검토.

### 4-2. 검증 게이트
- `npm run build`: 프런트 자산·Vercel 계약 검증
- `npm run check`: 저장소 드라이버와 필수 파일 검증
- `npm run qa:final`: 서버·핵심 파일·기본 API 검증
- `npm run loop:verify`: 결정적 주요 기능 스모크 테스트 일괄 실행
- `npm run smoke:mobile`: 390/360/320px 핵심 경로의 레이아웃·터치·편집기 흐름 검증

모바일 화면을 수정한 경우 `smoke:mobile`을 `loop:verify`와 함께 실행한다. 모바일 검사는
브라우저를 실제 touch 모드로 실행하며, 빠른 24개 loop gate에는 포함하지 않는다.
모바일 smoke에는 직접 게시글·뉴스·쪽지 화면에 긴 한글/URL fixture를 주입하는 read-only 줄바꿈 검사도 포함된다.
좁은 화면 회귀에는 intrinsic-size 이미지·동영상, 긴 `<pre>` 줄바꿈, 짧은 viewport의 hint/footer 표시 검사도 포함된다. UI 변경 후 `npm run smoke:mobile`을 실행한다.

---

## 5. 개발 및 소스 수정 규칙

- **모듈화**: 파일당 라인 수는 250라인을 경고 지점으로 보며, 논리적 단위로 분리 권장.
- **추측 금지**: 불확실한 부분은 질문을 통해 확인.
- **검증 필수**: 수정 후 관련 스모크 테스트를 반드시 실행하여 정상 작동 확인.
