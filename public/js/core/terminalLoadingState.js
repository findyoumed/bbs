// [LOG_ID: 20260715_1700] terminalUiCore.js가 프로젝트 250줄 제한(qa:final)을 넘어서(295줄)
// setReady/setLoading 로딩 상태 전이 로직만 분리했다. 동작은 전혀 바꾸지 않고 그대로 옮겼다.
export function createTerminalLoadingState(deps) {
  const {
    screenEl,
    cmdInput,
    setBusy,
    setFooterVisibility,
    buildLoadingScreenMarkup,
    normalizeLoadingMessage
  } = deps;

  let loadingTimer = null;
  let progressTimer = null;

  function setReady(isReady) {
    if (!screenEl) return;
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }

    if (isReady) {
      screenEl.parentElement?.classList.remove('is-loading');
      screenEl.classList.remove('is-loading');
      setBusy(false);
      setFooterVisibility(true);
      if (cmdInput) {
        cmdInput.disabled = false;
      }
    } else {
      screenEl.parentElement?.classList.add('is-loading');
      screenEl.classList.add('is-loading');
      setBusy(true);
      // [LOG_ID: 20260707_2015] 20260707_1815에서 도입된 setFooterVisibility(false) 호출을 제거한다.
      // 이 호출은 매 화면 전환마다 #terminal-footer 전체를 display:none으로 지웠다가 되살려,
      // "타이핑/명령 입력 후 힌트바가 잠깐 사라진다"는 회귀를 만들었다 — 20260706_2247에서 고쳤던
      // "로딩 중 하단 프레임 붕괴" 버그를 CSS가 아닌 이 JS 경로로 재도입한 것.
      // PC통신 하단 상태줄은 로딩 여부와 무관하게 항상 같은 자리에 있어야 한다:
      // 힌트 텍스트만 비우고(높이는 min-height로 이미 예약됨), footer 자체는 숨기지 않는다.
    }
  }

  function setLoading(message) {
    if (!screenEl) return;
    if (loadingTimer) clearTimeout(loadingTimer);
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }

    // [LOG_ID: 20260708_1300] 20260708_1215에서 여기 추가했던 "setLoading 시작과 동시에 구분선
    // 즉시 숨김"을 되돌린다. 이 즉시-숨김은 구분선만 먼저 사라지고 프롬프트 행(제출된 명령+"선택 >>")은
    // 그대로 남아있는 새로운 불일치를 만들었다(구분선/힌트는 없어지는데 프롬프트만 남는 문제) — 프롬프트
    // 행은 원래 "제출한 명령을 계속 보여주는" 의도된 동작이라 이와 어긋나 보였다.
    // 근본 원인(postListView/postViewView가 setReady(true)를 렌더 호출보다 먼저 불러, 그 사이 남은
    // await 동안 footer가 먼저 드러나던 것)은 각 화면에서 setReady(true) 위치를 render 직전(남은 await
    // 이후)으로 옮겨 직접 해결했다 — 이제 이 즉시-숨김 없이도 구분선/힌트/프롬프트가 모두 같은 시점에
    // (렌더러가 실제로 시작될 때) 함께 바뀐다.

    setBusy(true);
    if (cmdInput) cmdInput.disabled = true;
    const staticMessage = normalizeLoadingMessage(message);
    // [LOG_ID: 20260708_1420] 20260617_1156이 여기서 즉시 hintEl.innerHTML = ''로 힌트 텍스트를 비우던 것을
    // 제거한다. setLoading()은 화면 전환마다(대부분 400ms 미만으로 빨리 끝남) 호출되는데, 즉시-비움은
    // 프롬프트 행("선택 >>", 제출한 명령을 계속 보여주는 의도된 동작)은 그대로 둔 채 힌트만 먼저
    // 사라지는 새 불일치를 만들었다 — "선택 >>는 남아있는데 힌트바가 없어진다"는 재보고의 원인.
    // 원래 목적("연결하는 중..." 로딩 화면 문구와 낡은 힌트 목록이 동시에 보이는 중복 방지)은 아래
    // 400ms 폴백 타이머가 실제로 화면을 로딩 placeholder로 교체하는 시점에만 힌트를 비워도 충분하다 —
    // 그 전까지는 힌트가 이전 내용을 유지하다가 applyCommandFooter의 setHint()가 새 내용으로 자연스럽게
    // 교체하므로, 빠른 전환(대다수)에서는 깜빡임 없이 프롬프트 행과 완전히 동기화된다.
    loadingTimer = setTimeout(() => {
      screenEl.parentElement?.classList.add('is-loading');
      screenEl.classList.add('is-loading');
      // [LOG_ID: 20260708_1520] screenEl.innerHTML 전체를 로딩 문구로 갈아엎지 않는다. 상단바(로고+시계+
      // 메뉴명)까지 함께 지워지면, footer(구분선/힌트/프롬프트, 로딩 여부와 무관하게 항상 같은 자리를
      // 지킨다는 20260707_2015 원칙에 따라 그대로 남아있음)만 그대로 남고 화면 위쪽만 사라져, 위/아래가
      // 서로 다른 화면처럼 분리되어 보였다("연결하는 중입니다" 밑에 이전 화면의 구분선/힌트가 뜬금없이
      // 붙어있는 것처럼 보이는 문제). 이미 렌더된 상단바 구조(.ansi-screen-body)가 있으면 본문 영역만
      // 교체해 상단바는 그대로 유지한다 — 상단바가 아직 없는 극초반 부팅 등에서만 기존처럼 전체를 교체.
      // [LOG_ID: 20260708_1545] 여기서 hintEl.innerHTML = ''로 힌트만 비우던 것을 제거한다. 이 타이머는
      // renderAnsiScreenWithTopbarSequential이 아직 시작되지 않은(이전 화면이 그대로 떠 있는) 시점에도
      // 발동할 수 있는데, 그 경우 divider/promptRow는 이전 화면 그대로인 채 힌트 텍스트만 갑자기 비어
      // "입력창(선택 >>)은 남아있는데 힌트바만 없어진다"는 것과 동일한 패턴의 새 불일치를 만들었다.
      // 본문을 로딩 문구로 바꾸는 것과 별개로 footer는 아무것도 건드리지 않아야, 어떤 시점에 이 타이머가
      // 발동하든 footer 3요소(구분선/힌트/프롬프트) 사이의 불일치가 구조적으로 생기지 않는다.
      const bodyContainer = screenEl.querySelector('.ansi-screen-body');
      if (bodyContainer) {
        bodyContainer.innerHTML = buildLoadingScreenMarkup(staticMessage);
      } else {
        screenEl.innerHTML = buildLoadingScreenMarkup(staticMessage);
      }
      // [LOG_ID: 20260707_2015] footer 전체를 숨기지 않는다 (위 setReady 주석 참고).
    }, 400);
  }

  return { setReady, setLoading };
}
