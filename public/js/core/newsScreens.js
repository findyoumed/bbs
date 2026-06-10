import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldDisplayNewsArticleImage } from './newsPhotoArticleUtils.js';

export function createNewsScreens(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    buildBoardSelectAnsi,
    buildNewsArticleAnsi,
    buildNewsListAnsi,
    cmdInput,
    getCommandFooterText,
    getMenuNodeByKey,
    loadNewsArticle,
    loadNewsArticles,
    loadNewsMenu,
    screenEl,
    setFooterVisibility,
    setHint,
    setLoading,
    state,
    updateURL,
    measureServiceLineBounds,
    estimateServiceLineBounds,
    measureLineSegmentBounds,
    createHotspotLayer,
    createHotspotButton,
    renderScreenSequential
  } = deps;

  function shouldAutoFocusCommandInput() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function renderBoardSelectHotspots(screenNode, boards, lineOffset = 0) {
    if (!screenNode || !boards.length) return;
    const layer = createHotspotLayer();
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));

    boards.forEach((board, index) => {
      const rowIdx = lineOffset + index;
      if (!lineNodes[rowIdx]) return;
      const bounds = measureServiceLineBounds(screenNode, lineNodes[rowIdx]) || estimateServiceLineBounds(screenNode, lineNodes[rowIdx]);
      layer.appendChild(createHotspotButton(board?.door || '', board.name || '', bounds));
    });

    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }

  function renderNewsArticleHotspots(screenNode, articles, lineOffset = 0) {
    if (!screenNode || !articles.length) return;
    const layer = createHotspotLayer();
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));

    articles.slice(0, 15).forEach((article, index) => {
      const rowIdx = lineOffset + index;
      if (!lineNodes[rowIdx]) return;
      const bounds = measureServiceLineBounds(screenNode, lineNodes[rowIdx]) || estimateServiceLineBounds(screenNode, lineNodes[rowIdx]);
      layer.appendChild(createHotspotButton(article?.no || index + 1, article?.title || `뉴스 ${index + 1}`, bounds));
    });

    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }

  function renderNewsSourceLinkHotspots(screenNode, article) {
    const link = getNewsArticleLink(article);
    if (!screenNode || !link) return;

    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    const linkStartIdx = lineNodes.findIndex((lineNode) => String(lineNode?.textContent || '').includes('원문:'));
    if (linkStartIdx < 0) return;

    const layer = createHotspotLayer();
    const sourceLinkButtons = [];
    const positionedButtons = [];
    const sourceLinkGroup = `news-source-link-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    function getSourceLinkBounds(rowIdx) {
      const sourceText = String(lineNodes[rowIdx]?.textContent || '');
      if (!sourceText.trim() || sourceText.trim() === '마지막 페이지입니다') return null;

      return rowIdx === linkStartIdx
        ? (() => {
            const urlOffset = sourceText.indexOf('http');
            if (urlOffset < 0) return null;
            const trimmedEnd = sourceText.replace(/\s+$/g, '').length;
            return measureLineSegmentBounds(screenNode, lineNodes[rowIdx], urlOffset, trimmedEnd);
          })()
        : (measureServiceLineBounds(screenNode, lineNodes[rowIdx]) || estimateServiceLineBounds(screenNode, lineNodes[rowIdx]));
    }

    function applySourceLinkBounds(button, rowIdx) {
      const bounds = getSourceLinkBounds(rowIdx);
      if (!bounds) return false;
      button.style.left = `${bounds.left}px`;
      button.style.top = `${bounds.top}px`;
      button.style.width = `${bounds.width}px`;
      button.style.height = `${bounds.height}px`;
      return true;
    }

    function refreshSourceLinkBounds() {
      if (screenNode.isConnected === false) return;
      positionedButtons.forEach(({ button, rowIdx }) => {
        applySourceLinkBounds(button, rowIdx);
      });
    }

    function scheduleSourceLinkRefresh(delay = 0) {
      if (delay > 0) {
        window.setTimeout(refreshSourceLinkBounds, delay);
        return;
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(refreshSourceLinkBounds);
      } else {
        window.setTimeout(refreshSourceLinkBounds, 0);
      }
    }

    for (let rowIdx = linkStartIdx; rowIdx < lineNodes.length; rowIdx += 1) {
      const sourceText = String(lineNodes[rowIdx]?.textContent || '');
      if (!sourceText.trim() || sourceText.trim() === '마지막 페이지입니다') break;

      const bounds = getSourceLinkBounds(rowIdx);

      if (!bounds) continue;
      const btn = createHotspotButton('', '원문 기사 열기', bounds);
      btn.dataset.externalUrl = link;
      btn.dataset.hotspotGroup = sourceLinkGroup;
      btn.classList.add('ansi-hotspot--source-link');
      btn.removeAttribute('data-cmd');
      layer.appendChild(btn);
      sourceLinkButtons.push(btn);
      positionedButtons.push({ button: btn, rowIdx });
    }

    bindGroupedHotspotHover(sourceLinkButtons);
    if (layer.childElementCount > 0) {
      screenNode.appendChild(layer);

      // [LOG: 20260505_1935] Photo images load after text render, so source-link hotspots must be remeasured.
      scheduleSourceLinkRefresh();
      scheduleSourceLinkRefresh(250);
      scheduleSourceLinkRefresh(1000);
      scheduleSourceLinkRefresh(1600);

      Array.from(screenNode.querySelectorAll('.news-article-image')).forEach((image) => {
        if (image.complete) {
          scheduleSourceLinkRefresh();
          return;
        }
        image.addEventListener('load', refreshSourceLinkBounds, { once: true });
        image.addEventListener('error', refreshSourceLinkBounds, { once: true });
      });

      if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        document.fonts.ready.then(refreshSourceLinkBounds).catch(() => {});
      }
    }
  }

  function bindGroupedHotspotHover(buttons) {
    const groupedButtons = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
    if (groupedButtons.length <= 1) return;

    const setHovered = (isHovered) => {
      groupedButtons.forEach((button) => {
        button.classList.toggle('is-group-hovered', Boolean(isHovered));
      });
    };

    groupedButtons.forEach((button) => {
      button.addEventListener('mouseenter', () => setHovered(true));
      button.addEventListener('mouseleave', () => setHovered(false));
      button.addEventListener('focus', () => setHovered(true));
      button.addEventListener('blur', () => setHovered(false));
    });
  }

  function renderNewsArticleImage(screenNode, article, pageNo = 1) {
    const imageUrl = normalizeNewsImageUrl(article?.imageUrl);
    if (!screenNode || !imageUrl || Number(pageNo) !== 1 || !shouldDisplayNewsArticleImage(article)) return;

    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    const hlineChar = String.fromCharCode(0x2500);
    const hlineNode = lineNodes.find((lineNode) => {
      const text = String(lineNode?.textContent || '').trim();
      return text.length >= 8 && Array.from(text).every((ch) => ch === hlineChar);
    });
    if (!hlineNode) return;

    const frame = document.createElement('div');
    frame.className = 'news-article-image-frame';

    const img = document.createElement('img');
    img.className = 'news-article-image';
    img.src = imageUrl;
    img.alt = String(article?.title || '뉴스 사진').trim() || '뉴스 사진';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';

    frame.appendChild(img);
    hlineNode.insertAdjacentElement('afterend', frame);
  }

  function normalizeNewsImageUrl(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    try {
      const url = new URL(source, window.location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.href;
      }
    } catch (error) {
      void error;
    }
    return '';
  }

  function pushHistory() {
    state.history.push({
      screen: state.screen,
      board: state.board,
      boardMenuPath: state.boardMenuPath,
      boardMenuTitle: state.boardMenuTitle,
      serviceData: JSON.parse(JSON.stringify(state.serviceData || {})),
      page: state.page
    });
  }

  function getNewsTopics(data) {
    if (Array.isArray(data?.topics)) return data.topics;
    if (Array.isArray(data?.items)) return data.items.map(item => ({ ...item, title: String(item?.title || item?.name || '').trim() }));
    if (Array.isArray(data?.newspapers)) return data.newspapers.map(item => ({ ...item, title: String(item?.title || item?.name || '').trim() }));
    return [];
  }

  function getNewsArticleKey(article) {
    return String(article?.articleKey || '').trim();
  }

  function getNewsArticleLink(article) {
    return String(article?.link || '').trim();
  }

  function getNewsArticleRequestOptions(article, options = {}) {
    const articleKey = String(options?.articleKey || options?.key || getNewsArticleKey(article)).trim();
    const link = String(options?.link || getNewsArticleLink(article)).trim();
    return { articleKey, link };
  }

  function findNewsArticle(items, articleNo, options = {}) {
    const list = Array.isArray(items) ? items : [];
    const requestOptions = getNewsArticleRequestOptions(null, options);
    if (requestOptions.articleKey) {
      return list.find((item) => getNewsArticleKey(item) === requestOptions.articleKey) || null;
    }
    if (requestOptions.link) {
      return list.find((item) => getNewsArticleLink(item) === requestOptions.link) || null;
    }

    return list.find((item, index) => String(item?.no || (index + 1)) === String(articleNo)) || null;
  }

  function isExpectedNewsArticle(article, requestOptions = {}) {
    const expectedKey = String(requestOptions?.articleKey || '').trim();
    const expectedLink = String(requestOptions?.link || '').trim();
    if (expectedKey && getNewsArticleKey(article) && getNewsArticleKey(article) !== expectedKey) {
      return false;
    }
    if (expectedLink && getNewsArticleLink(article) && getNewsArticleLink(article) !== expectedLink) {
      return false;
    }
    return true;
  }

  // [LOG: 20260610_1427] Clear screen and hide footer during news loading to hide unrelated command hints
  function showNewsLoading(message) {
    const text = String(message || '뉴스 기사로 이동 중 입니다...').trim();
    if (typeof setLoading === 'function') {
      setLoading(text);
    } else {
      if (screenEl) {
        screenEl.classList.add('is-loading');
        screenEl.innerHTML = `<div class="loading">${esc(text)}</div>`;
      }
      if (cmdInput) {
        cmdInput.disabled = true;
      }
      if (typeof setFooterVisibility === 'function') {
        setFooterVisibility(false);
      }
    }
  }

  // [LOG: 20260610_1436] Removed getNewsSourceLoadingMessage as two-stage connection loading is no longer required.

  async function loadNewsTopicState(topicDoor) {
    const currentTopicDoor = String(state.serviceData?.topicDoor || '').trim();
    const currentItems = Array.isArray(state.serviceData?.items) ? state.serviceData.items : [];
    const topics = getNewsTopics(state.serviceData);

    if (currentTopicDoor === String(topicDoor) && currentItems.length > 0) {
      return { topics, topicTitle: String(state.serviceData?.topicTitle || '').trim(), items: currentItems };
    }

    const articles = await loadNewsArticles(topicDoor);
    const topic = topics.find((item) => String(item.door) === String(topicDoor));
    const topicTitle = String(articles?.topic?.title || articles?.category?.title || topic?.title || topic?.name || '').trim();
    return { topics, topicTitle, items: articles?.items || [] };
  }

  async function showNewsMenu(fromHistory = false) {
    state.screen = 'news-menu';
    if (!fromHistory) { updateURL(); pushHistory(); }

    const data = await loadNewsMenu();
    const topics = getNewsTopics(data);
    state.serviceData = { ...data, topics, topicDoor: '' };

    const items = topics.map((topic) => ({
      door: topic.door, name: topic.title || topic.name,
      id: `news-${topic.door}`, boardId: `news-${topic.door}`
    }));
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: buildBoardSelectAnsi(items, { titlePath: ['뉴스/인물'] }),
      ansiToHTML,
      screenEl,
      renderScreenSequential
    });

    renderBoardSelectHotspots(rendered.screenNode, items);
    await applyCommandFooter(getMenuNodeByKey('news')?.footer, getCommandFooterText('newsMenu'));
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  async function showNewsList(topicDoor, options = false) {
    const normalizedOptions = typeof options === 'boolean' ? { fromHistory: options } : (options || {});
    const fromHistory = Boolean(normalizedOptions.fromHistory);
    const requestedPageNo = Math.max(1, Number.parseInt(normalizedOptions.pageNo, 10) || 1);

    state.screen = 'news-list';
    // [LOG: 20260610_1510] Delightful loader delay to prevent screen flashing on fast/cached loads
    let loadingTimer = setTimeout(() => {
      showNewsLoading('뉴스 목록을 불러오는 중입니다...');
    }, 150);

    try {
      const { topics, topicTitle, items } = await loadNewsTopicState(topicDoor);
      clearTimeout(loadingTimer);

      const newsListView = buildNewsListAnsi(topicTitle, items, requestedPageNo);

      state.serviceData = {
        topics, topicDoor, topicTitle, items,
        pageCount: newsListView.pageCount, pageNo: newsListView.pageNo,
        listPageNo: newsListView.pageNo, listPageSize: newsListView.pageSize
      };
      if (!fromHistory) { updateURL(); pushHistory(); }
      const rendered = await renderAnsiScreenWithTopbarSequential({
        ansiText: newsListView.text,
        ansiToHTML,
        screenEl,
        renderScreenSequential
      });
      renderNewsArticleHotspots(rendered.screenNode, newsListView.items, 2);

      await applyCommandFooter(getMenuNodeByKey('news')?.footer, getCommandFooterText('newsList'));
      if (shouldAutoFocusCommandInput()) cmdInput.focus();
    } catch (error) {
      clearTimeout(loadingTimer);
      throw error;
    }
  }

  async function showNewsArticle(topicDoor, articleNo, options = {}) {
    const requestedPageNo = Math.max(1, Number.parseInt(options?.pageNo, 10) || 1);
    const fromHistory = Boolean(options?.fromHistory);
    const forceReload = Boolean(options?.forceReload);
    const requestedArticleKey = String(options?.articleKey || options?.key || '').trim();
    const sameView = String(state.serviceData?.topicDoor || '') === String(topicDoor)
      && String(state.serviceData?.articleNo || '') === String(articleNo)
      && Number(state.serviceData?.pageNo || 1) === requestedPageNo
      && (!requestedArticleKey || String(state.serviceData?.articleKey || '').trim() === requestedArticleKey);
    state.screen = 'news-view';
    // [LOG: 20260610_1453] Skip loading overlay when navigating to article view since it is fast and waitable.
    const { topics, topicTitle, items } = await loadNewsTopicState(topicDoor);
    const article = findNewsArticle(items, articleNo, options);
    const articleIndex = items.findIndex((item) => item === article);

    if (!article) {
      await showNewsList(topicDoor, {
        fromHistory, pageNo: Math.max(1, Number(state.serviceData?.listPageNo || 1))
      });
      return;
    }

    let resolvedTopicTitle = topicTitle;
    let resolvedArticle = article;
    const canReuseCurrentArticle = !forceReload
      && String(state.serviceData?.topicDoor || '') === String(topicDoor)
      && String(state.serviceData?.articleNo || '') === String(article?.no || articleNo)
      && (!requestedArticleKey || String(state.serviceData?.articleKey || '').trim() === requestedArticleKey)
      && state.serviceData?.article;

    if (canReuseCurrentArticle) {
      resolvedArticle = { ...article, ...state.serviceData.article };
      resolvedTopicTitle = String(state.serviceData?.topicTitle || topicTitle).trim() || topicTitle;
    } else {
      try {
        // [LOG: 20260610_1436] Skip updating loading message to 'connecting to source' since load time is fast.
        const requestOptions = getNewsArticleRequestOptions(article, options);
        const detail = await loadNewsArticle(topicDoor, article?.no || articleNo, requestOptions);
        if (detail?.article && isExpectedNewsArticle(detail.article, requestOptions)) {
          resolvedArticle = { ...article, ...detail.article };
        }
        if (detail?.topic?.title) resolvedTopicTitle = String(detail.topic.title).trim() || topicTitle;
      } catch (error) { console.error('뉴스 본문 상세 로드 실패:', error.message); }
    }

    const articleView = buildNewsArticleAnsi(resolvedTopicTitle, resolvedArticle, requestedPageNo);
    const currentListPageSize = Math.max(1, Number(state.serviceData?.listPageSize || 15));
    const resolvedListPageNo = Math.max(
      1,
      Number.parseInt(options?.listPageNo, 10)
      || Number(state.serviceData?.listPageNo || 0)
      || (articleIndex >= 0 ? Math.floor(articleIndex / currentListPageSize) + 1 : 1)
    );

    state.serviceData = {
      topics, topicDoor, topicTitle: resolvedTopicTitle,
      articleNo: String(article?.no || articleNo),
      articleKey: getNewsArticleKey(resolvedArticle),
      article: resolvedArticle, items,
      pageCount: articleView.pageCount, pageNo: articleView.pageNo,
      listPageNo: resolvedListPageNo, listPageSize: currentListPageSize
    };
    if (!fromHistory && !sameView) { updateURL(); pushHistory(); }

    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: articleView.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential
    });
    renderNewsArticleImage(rendered.screenNode, state.serviceData.article, articleView.pageNo);
    renderNewsSourceLinkHotspots(rendered.screenNode, state.serviceData.article);

    await applyCommandFooter(getMenuNodeByKey('news')?.footer, getCommandFooterText('serviceArticle'));
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  return {
    showNewsArticle,
    showNewsList,
    showNewsMenu
  };
}
