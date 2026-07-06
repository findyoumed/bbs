import { UI_TEXT } from './i18n.js';

export function createTerminalSequentialRenderer(deps) {
  const {
    screenEl,
    performanceService,
    soundService,
    setBusy,
    showNotification
  } = deps;

  let renderAbortController = null;

  function interruptRendering() {
    if (renderAbortController) {
      renderAbortController.abort = true;
      renderAbortController = null;
    }
  }

  async function renderScreenSequential(htmlContent, options = {}) {
    if (!screenEl) {
      return;
    }

    const renderStartTime = performance.now();
    interruptRendering();
    const controller = { abort: false, skip: false, userScrolledUp: false };
    renderAbortController = controller;

    const {
      delay = 20,
      onComplete,
      clear = true,
      scrollIntoView = false,
      container = screenEl,
      // [LOG: 20260706_2230] reveal-in-place 모드: 전체를 먼저 삽입(레이아웃 확정) 후
      // 줄 단위로 visibility만 해제. footer가 줄마다 밀리는 jitter가 원천적으로 없다.
      revealInPlace = false
    } = options;

    if (clear) {
      container.innerHTML = '';
      container.scrollTop = 0;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const lines = Array.from(tempDiv.querySelectorAll('.ansi-line'));

    if (lines.length === 0) {
      container.innerHTML = htmlContent;
      onComplete?.();
      renderAbortController = null;
      return;
    }

    if (revealInPlace) {
      // 모든 줄을 pending(숨김)으로 표시한 뒤 통째로 삽입 → 첫 프레임에 최종 높이 확보.
      for (const line of lines) {
        line.classList.add('ansi-line--pending');
      }
      const fragment = document.createDocumentFragment();
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
      container.appendChild(fragment);
    }

    const progressContainer = document.getElementById('render-progress');
    const progressBar = progressContainer?.querySelector('.render-progress-bar');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');

    if (progressContainer) {
      progressContainer.classList.add('is-visible');
    }
    if (scrollBottomBtn) {
      scrollBottomBtn.classList.remove('is-visible');
      scrollBottomBtn.onclick = () => {
        controller.userScrolledUp = false;
        scrollBottomBtn.classList.remove('is-visible');
        // [LOG: 20260706] 다른 모든 스크롤과 동일하게 즉시 점프(터미널 감성). smooth 제거.
        container.lastElementChild?.scrollIntoView({ behavior: 'auto', block: 'end' });
      };
    }

    const onScroll = () => {
      const isAtBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 50;
      if (!isAtBottom && !controller.skip) {
        if (!controller.userScrolledUp) {
          controller.userScrolledUp = true;
          scrollBottomBtn?.classList.add('is-visible');
        }
      } else if (isAtBottom) {
        controller.userScrolledUp = false;
        scrollBottomBtn?.classList.remove('is-visible');
      }
    };
    container.addEventListener('scroll', onScroll);

    soundService.playTransition();

    const skipHandler = (event) => {
      if (!['Enter', ' ', 'Escape'].includes(event.key)) {
        return;
      }

      controller.skip = true;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', skipHandler, { capture: true, once: true });

    screenEl.parentElement?.classList.remove('is-loading');
    screenEl.classList.remove('is-loading');
    setBusy(true);

    try {
      for (let index = 0; index < lines.length; index += 1) {
        if (controller.abort) {
          break;
        }

        if (progressBar) {
          progressBar.style.width = `${((index + 1) / lines.length) * 100}%`;
        }

        if (controller.skip) {
          if (revealInPlace) {
            // 남은 줄 전부 즉시 공개 (레이아웃은 이미 확정 → 스크롤 점프만 최종 위치로)
            for (let remaining = index; remaining < lines.length; remaining += 1) {
              lines[remaining].classList.remove('ansi-line--pending');
            }
            lines[lines.length - 1]?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
          } else {
            const fragment = document.createDocumentFragment();
            for (let remaining = index; remaining < lines.length; remaining += 1) {
              fragment.appendChild(lines[remaining]);
            }
            container.appendChild(fragment);
            container.scrollTop = container.scrollHeight;
          }
          break;
        }

        if (revealInPlace) {
          lines[index].classList.remove('ansi-line--pending');
        } else {
          container.appendChild(lines[index]);
        }

        if (scrollIntoView && !controller.userScrolledUp) {
          // [LOG: 20260706_2230] reveal 모드는 'nearest': 이미 보이는 줄엔 스크롤 안 함(뷰포트 안정),
          // 화면을 넘어가는 긴 본문에서만 터미널처럼 아래로 따라 내려간다.
          lines[index].scrollIntoView({ behavior: 'auto', block: revealInPlace ? 'nearest' : 'end' });
        }

        if (delay > 0) {
          const jitter = (Math.random() * 0.4 + 0.8);
          await new Promise((resolve) => window.setTimeout(resolve, delay * jitter));
        }
      }
    } catch (error) {
      console.error('[Terminal] Rendering exception:', error);
      container.innerHTML = htmlContent;
      showNotification(UI_TEXT.RENDER_ERROR, 3000, 'warn');
    } finally {
      if (revealInPlace) {
        // [LOG: 20260706_2230] 중단(abort)·예외 등 어떤 경로로 끝나도 숨은 줄이 남지 않게 보장.
        // (반쯤 안 보이는 화면은 터미널 메타포가 아니라 깨진 상태다.)
        for (const line of lines) {
          line.classList.remove('ansi-line--pending');
        }
      }
      window.removeEventListener('keydown', skipHandler, { capture: true });
      container.removeEventListener('scroll', onScroll);
      if (progressContainer) {
        progressContainer.classList.remove('is-visible');
      }
      if (scrollBottomBtn) {
        scrollBottomBtn.classList.remove('is-visible');
      }
      setBusy(false);
    }

    onComplete?.();

    if (performanceService) {
      const duration = Math.round(performance.now() - renderStartTime);
      performanceService.recordRender(duration, lines.length, controller.skip);
    }

    if (renderAbortController === controller) {
      renderAbortController = null;
    }
  }

  return {
    interruptRendering,
    renderScreenSequential
  };
}
