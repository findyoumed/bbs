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
      container = screenEl
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
        container.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
          const fragment = document.createDocumentFragment();
          for (let remaining = index; remaining < lines.length; remaining += 1) {
            fragment.appendChild(lines[remaining]);
          }
          container.appendChild(fragment);
          container.scrollTop = container.scrollHeight;
          break;
        }

        container.appendChild(lines[index]);

        if (scrollIntoView && !controller.userScrolledUp) {
          lines[index].scrollIntoView({ behavior: 'auto', block: 'end' });
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
