# 버그 인수인계: 프롬프트-커서 사이 간격이 순간적으로 넓어졌다 좁아지는 문제 ("space1/space2")

## 저장소
`D:\work\bbs\www-bbs` — PC통신(한국 BBS) 스타일 터미널 UI를 흉내내는 Vanilla JS 웹앱.
Git 저장소, 최근 관련 커밋: `b7de2c5`, `e71196f` (아래에서 설명하는 시도들이 여기 반영되어 있음).

## 증상
`http://localhost:3002/service/news` 등 화면 전환이 일어나는 페이지에서, 하단 명령줄 프롬프트("선택 >>")와
입력 캐럿(커스텀 블록 커서) 사이의 간격이 **아주 짧은 순간(약 수백 ms) 넓어 보였다가 저절로 좁아진다.**
- 정상 상태 스크린샷: `D:\work\bbs\www-bbs\space1.png`
- 비정상(간격 넓음) 상태 스크린샷: `D:\work\bbs\www-bbs\space2.png`
- 사용자가 직접 녹화한 재현 영상: `D:\work\bbs\www-bbs\space.mp4`

사용자는 이 현상을 **매우 확신을 갖고 반복적으로 직접 목격했다고 보고**하고 있고, 시크릿 모드에서도 재현되어
브라우저 확장 프로그램이 원인이 아님이 확인됐다. 여러 차례의 수정(아래 참고) 후에도 "**아직도 해결이 안되었다**"고
알려온 상태 — 즉 지금까지의 가설과 수정은 전부 근본 원인이 아니었을 가능성이 높다.

## 이미 배제되었거나 확인된 사실
1. 브라우저 확장 프로그램 원인 아님 (시크릿 모드에서도 재현).
2. **관찰자 효과(observer effect) 있음**: 디버거에서 "Break on attribute modifications"를 걸어두면
   재현이 안 된다고 사용자가 직접 확인함. 이는 문제가 타이밍에 극도로 민감한 레이스 컨디션이며,
   디버깅 도구 자체가 타이밍을 바꿔 문제를 회피시킬 수 있음을 시사한다.
3. `console.log` 기반 진단도 오버헤드로 타이밍을 바꿔 재현을 방해할 수 있다고 판단되어,
   이후 `performance.mark()`(초저부하) 기반 계측으로 전환했었음(현재는 전부 제거된 상태).
4. Layout Instability API(`PerformanceObserver({type:'layout-shift'})`)는 `visibility: hidden ↔ visible`
   전환을 레이아웃 이동으로 감지하지 못해서, 이 종류의 버그를 잡는 데 한계가 있었다.

## 지금까지 시도했지만 "근본 원인은 아니었던" 수정들 (그래도 유지 중, 되돌리지 말 것)
아래는 전부 코드베이스에 이미 반영되어 있고 나름대로 유효한 개선이었지만, 사용자가 재현이 계속된다고
보고할 때마다 하나씩 시도했던 가설들이다. **결과적으로 이 중 어느 것도 "space2/space1" 재현을 완전히
없애지는 못했다** (아래 "최근 시도"까지 포함).

1. **CSS `ch` → `em` 단위 통일** (`public/style.css`, `public/styles/retro-terminal.css`):
   `1ch`는 "현재 적용된 폰트의 숫자 0 글자 폭"으로 정의되어, 폰트가 폴백→커스텀(DungGeunMo/Sam3KRFont,
   현재 `/fonts/*.woff`로 자체 호스팅 중)으로 전환되는 도중 값이 달라진다. `column-gap`, prompt renderer
   너비, `.terminal-cursor` 너비, `#cmd-prompt` margin-right 등 여러 곳에서 `ch`를 전부 `em`으로
   바꿨다. **레이아웃 안정화에는 도움이 됐지만 이 버그의 근본 원인은 아니었다.**
2. **`menuNavigation.js`의 `showMain()`/`showBoardSelect()`가 데이터 로딩 시작 전에 즉시
   `setHint(''); setPrompt('');`를 호출해 프롬프트 텍스트 자체가 순간적으로 빈 문자열이 되던 문제**를
   발견하고 그 두 줄을 제거함. 화면 녹화 프레임 분석으로 실제로 이 문제(프롬프트 텍스트가 비는 것)가
   있었음을 확인하고 고쳤으나, **사용자는 그 이후에도 재현을 계속 보고했다.**
3. **`terminalInputUi.js`의 `shouldRenderCursor()`에서 `!cmdInput.disabled` 조건 제거**:
   `setLoading()`이 데이터 로딩 시작과 동시에 `cmdInput.disabled=true`를 설정하는데, 이 조건 때문에
   프롬프트 텍스트는 그대로인 채 커스텀 블록 커서(`.terminal-cursor`)만 로딩 시간(수백 ms)만큼 사라지는
   것을 화면 녹화 307프레임 분석(ffmpeg+sharp, 아래 기법 참고)으로 확정하고 수정함. Playwright로
   `disabled=true` 강제 설정 시 커서가 계속 `visible`임을 검증, 4패턴 회귀 18회 통과.
   **이것이 "최종 근본 원인"이라고 결론 내렸었으나, 사용자는 여전히 미해결이라고 함.**
4. **`updateCursorPosition()`의 `cursorEl.style.left`가 여전히 `ch` 단위였던 것**을 발견해 나머지
   폭 계산과 동일하게 `displayWidth(text) * 0.5em` 관례로 통일함(`public/js/core/terminalInputUi.js:78-88`).
   이것도 **문제를 해결하지 못했다.**

## 결론: 지금까지의 가설(폰트 로딩 ch/em 전환, 커서 visibility, 프롬프트 텍스트 빈 값)은 전부 틀렸거나 불충분하다
사용자가 계속 "직접 봤다"고 강하게 확신하는 만큼 실재하는 버그일 가능성이 높지만, 위 네 차례의 시도가
모두 실패했다는 것은 **원인이 폰트 로딩/커서 visibility 계열이 아니라 완전히 다른 곳에 있을 가능성**을
시사한다. 다음을 의심해볼 것:
- `#terminal-prompt-row`, `#cmd-hint`의 style/class 변화 자체는 `cursorStateObserver`(MutationObserver,
  `terminalInputUi.js` 내부)의 감시 대상이 아니다 — 이전 세션에서 "잠재적 누락 지점"으로 논의만 되고
  실제로는 고치지 않은 채 남아있다.
- `applyCommandFooter()`(`public/js/core/terminalHintFooter.js`)가 비동기로 asset을 로드하는 동안
  (`await loadAssetText(assetPath)`) 실제 네트워크/디스크 지연이 있는 상황(로컬 dev 서버가 아니라
  실제 배포 환경이나 인위적으로 느린 네트워크 스로틀링)에서 어떤 일이 벌어지는지 재확인이 필요하다.
- `renderAnsiScreenWithTopbarSequential()`(`public/js/core/ansiTopbarScreen.js`)의 hide/show 타이밍과
  `applyCommandFooter`의 hide/show 타이밍이 서로 다른 두 개의 독립된 비동기 흐름이라는 점 — 그 사이에
  아직 발견 못한 경합 지점이 있을 수 있다.
- 폰트 자체 호스팅으로 전환된 이후(`/fonts/DungGeunMo.woff`, `/fonts/Sam3KRFont.woff`)에도 재현되는지
  재확인 필요 — CDN 지연이 사라졌으니 재현 빈도나 양상이 달라졌을 수 있다.
- **"1초 뒤에 저절로 돌아온다"는 표현**에 주목할 것 — 지금까지 고친 것들은 전부 "로딩 시간(수백 ms)"
  규모였는데, 사용자는 반복적으로 "1초"라는 더 긴 시간을 언급했다. 이는 폰트 로딩이나 데이터 fetch보다
  느린 다른 타이머(예: `cursorRetryTimer`의 200ms 재시도 루프, `animation: cursor-blink 1s step-end
  infinite`의 블링크 주기, 또는 `document.fonts.ready`/`loadingdone` 이후 실행되는
  `scheduleCursorLayoutSync()`의 `requestAnimationFrame` + `setTimeout(50)` 체인)과 관련 있을 가능성을
  시사한다. `.terminal-cursor`의 CSS `animation: cursor-blink 1s ...`이 1초 주기라는 점이 사용자가
  일관되게 "1초"라고 말하는 것과 정확히 일치할 수 있다 — **깜빡임 애니메이션 자체, 또는 애니메이션과
  visibility 토글이 겹치는 순간의 상호작용을 아직 조사하지 않았다.**

## 재현에 사용했던 결정적 기법 (코드 레벨 진단으로 못 찾을 때 유효했음)
1. 사용자에게 화면을 녹화해달라고 요청 (`space.mp4`처럼).
2. `ffmpeg -i space.mp4 -vf fps=25 frame_%04d.png`로 프레임 단위 추출.
3. Node.js `sharp` 라이브러리로 프롬프트 행 영역만 `.extract()`로 크롭.
4. 연속 프레임 간 raw 픽셀 차이를 합산해 "변화가 큰 프레임"을 자동 탐지.
5. 그 프레임들을 실제로 열어서(Read 도구로 이미지 확인) 무엇이 정확히 어떻게 바뀌는지 육안으로 확인.
이 방법이 `performance.mark` 계측이나 MutationObserver보다 더 결정적인 증거를 줬다. **다시 필요하면
이 기법을 그대로 써라** — 단, 이번엔 크롭 영역을 프롬프트 행뿐 아니라 캐럿(`.terminal-cursor`) 영역과
`#cmd-hint` 영역까지 모두 포함해서, "무엇이 넓어 보이는지"(글자 간격? 캐럿 폭? 캐럿 위치? 두 요소 사이
공백?)를 픽셀 단위로 구분해서 봐야 한다 — 지금까지는 "간격이 넓어 보인다"는 사용자의 육안 인상에만
의존해서 매번 다른 부분(ch 단위, 텍스트 빈 값, 커서 visibility, 커서 좌표)을 의심했는데, 정작 "정확히
어느 요소의 어느 속성이 언제 몇 px만큼 바뀌는지"를 프레임 비교로 직접 측정한 적은 한 번(20260708_2015
시점)뿐이었다.

## 핵심 관련 파일
- `public/js/core/terminalInputUi.js` — 커서 관련 로직 전부(`updateCursorPosition`, `shouldRenderCursor`,
  `syncCursorVisibility`, `cursorStateObserver`, `scheduleCursorLayoutSync`, `registerFontCursorSync`).
- `public/js/core/terminalHintFooter.js` — `setPrompt`, `setHint`, `applyCommandFooter`,
  `syncPromptRendererWidth`, `schedulePromptLayoutSync`.
- `public/js/core/ansiTopbarScreen.js` — `renderAnsiScreenWithTopbarSequential`(화면 전환 시
  hint/promptRow visibility hide/show, `is-divider-pending` 토글).
- `public/js/core/menuNavigation.js` — `showMain()`, `showBoardSelect()` (`setLoading()`/`setReady()`
  호출 지점).
- `public/style.css`, `public/styles/retro-terminal.css` — `.terminal-cursor`(특히 `animation:
  cursor-blink 1s step-end infinite` 부분 재확인 필요), `#terminal-prompt-row`, `#cmd-hint`,
  `#terminal-footer`.

## 요청사항
1. 먼저 위에 나열된 네 가지 시도가 실제로 아직도 문제를 완전히 해결하지 못했다는 전제로 접근할 것 —
   "ch/em"이나 "커서 disabled" 계열 가설을 또 반복하지 말고, 반드시 **새로 화면 녹화를 확보하고 프레임
   단위로 재분석**한 뒤에 수정할 것.
2. 특히 "**1초**" 시간 규모와 정확히 일치하는 `.terminal-cursor`의 `cursor-blink` 애니메이션, 그리고
   `cursorRetryTimer`(200ms 간격 재시도)의 상호작용을 우선적으로 의심하고 조사할 것.
3. `#terminal-prompt-row`/`#cmd-hint`의 style/class 변화가 `cursorStateObserver`의 감시 대상에서 빠져
   있다는 잠재적 누락을 확인하고, 필요하면 감시 대상에 포함시킬 것.
4. 수정 후에는 반드시 `npm test`, `npm run smoke:renderer-ui`, `npm run smoke:vercel-ready`를 실행해
   회귀가 없는지 확인할 것.
5. 이 프로젝트는 Vanilla JS만 사용한다 — 프레임워크/라이브러리 제안 금지. `git push` 금지.
   편집 후 `node --input-type=module --check < <file>`로 문법 검증 (확장자 없는 ESM이라 일반
   `node --check`가 아니라 이 형태로만 신뢰 가능).
