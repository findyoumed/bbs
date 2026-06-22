import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldDisplayNewsArticleImage } from './newsPhotoArticleUtils.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

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

  const NEWS_HOVER_PREFETCH_DELAY_MS = 250;

  function renderBoardSelectHotspots(screenNode, boards, lineOffset = 0) {
    if (!screenNode || !boards.length) return;
    const layer = createHotspotLayer();
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));

    boards.forEach((board, index) => {
      const rowIdx = lineOffset + index;
      if (!lineNodes[rowIdx]) return;
      const bounds = measureServiceLineBounds(screenNode, lineNodes[rowIdx]) || estimateServiceLineBounds(screenNode, lineNodes[rowIdx]);
      const btn = createHotspotButton(board?.door || '', board.name || '', bounds);

      // [LOG: 20260610_2005] Hover pre-fetching for snappy terminal feel
      // [LOG: 20260617_0945] Pre-fetch hover checks key with page 1 index
      // [LOG: 20260617_1124] Delay hover prefetch so click navigation is not forced to wait on an accidental mouse pass.
      let prefetchTimer = 0;
      const clearPrefetchTimer = () => {
        if (prefetchTimer) {
          window.clearTimeout(prefetchTimer);
          prefetchTimer = 0;
        }
      };
      btn.addEventListener('mouseover', () => {
        clearPrefetchTimer();
        const prefetchKey = `${board.door}:1`;
        prefetchTimer = window.setTimeout(() => {
          prefetchTimer = 0;
          if (!topicCache.has(prefetchKey) && !topicPendingRequests.has(prefetchKey)) {
            void loadNewsTopicState(board.door, 1);
          }
        }, NEWS_HOVER_PREFETCH_DELAY_MS);
      });
      btn.addEventListener('mouseout', clearPrefetchTimer);

      layer.appendChild(btn);
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

    // [LOG: 20260616_1410] Ensure correct path is resolved
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

    const isYoutube = imageUrl.includes('youtube.com/') || imageUrl.includes('youtu.be/') || imageUrl.includes('youtube-nocookie.com/');

    if (isYoutube) {
      const frame = document.createElement('div');
      frame.className = 'news-article-video-frame';

      let embedUrl = imageUrl;
      if (!imageUrl.includes('/embed/')) {
        const watchMatch = imageUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
        if (watchMatch && watchMatch[1]) {
          embedUrl = `https://www.youtube.com/embed/${watchMatch[1]}`;
        }
      }

      const iframe = document.createElement('iframe');
      iframe.className = 'news-article-video';
      iframe.src = embedUrl;
      iframe.title = String(article?.title || '뉴스 영상').trim() || '뉴스 영상';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;

      frame.appendChild(iframe);
      hlineNode.insertAdjacentElement('afterend', frame);
    } else {
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
    const expectedKey = String(requestOptions?.articleKey || '').trim();
    const expectedLink = String(requestOptions?.link || '').trim();
    const target = String(articleNo || '').trim();

    let byLink = null;
    if (expectedLink) {
      byLink = list.find((item) => getNewsArticleLink(item) === expectedLink) || null;
    }

    let byKey = null;
    if (expectedKey) {
      byKey = list.find((item) => getNewsArticleKey(item) === expectedKey) || null;
    }

    const byNo = target ? list.find((item, index) => String(item?.no || (index + 1)) === target) : null;

    const keyConflict = byKey && byNo && byKey !== byNo;
    const linkConflict = byLink && byNo && byLink !== byNo;

    if (keyConflict || linkConflict) {
      return byNo;
    }

    if (byLink) return byLink;
    if (byKey) return byKey;
    if (byNo) return byNo;

    return null;
  }

  function normalizeUrl(value) {
    let str = String(value || '').trim();
    if (!str) return '';
    str = str.replace(/^https?:\/\//i, '');
    str = str.replace(/^www\./i, '');
    const qIdx = str.indexOf('?');
    if (qIdx !== -1) str = str.substring(0, qIdx);
    const hIdx = str.indexOf('#');
    if (hIdx !== -1) str = str.substring(0, hIdx);
    return str.replace(/\/+$/, '').trim();
  }

  function isExpectedNewsArticle(article, requestOptions = {}) {
    const expectedKey = String(requestOptions?.articleKey || '').trim();
    const expectedLink = String(requestOptions?.link || '').trim();
    
    const articleLink = getNewsArticleLink(article);
    const articleKey = getNewsArticleKey(article);
    
    if (expectedLink && articleLink) {
      if (normalizeUrl(articleLink) === normalizeUrl(expectedLink)) {
        return true;
      }
    }
    
    if (expectedKey && articleKey && articleKey !== expectedKey) {
      return false;
    }
    if (expectedLink && articleLink && normalizeUrl(articleLink) !== normalizeUrl(expectedLink)) {
      return false;
    }
    return true;
  }

  function showNewsLoading(message) {
    const text = String(message || '뉴스 기사로 이동 중입니다..').trim();
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

  // [LOG: 20260610_1935] Module-level cache for instant news topic switching
  const topicCache = new Map();
  const topicPendingRequests = new Map();

  // [LOG: 20260617_1725] Module-level cache for news article details to avoid redundant crawling
  const articleCache = new Map();
  const articlePendingRequests = new Map();

  // [LOG: 20260617_0945] Support pageNo in topicCache to isolate page datasets
  async function loadNewsTopicState(topicDoor, pageNo = 1) {
    const topics = getNewsTopics(state.serviceData);
    const cacheKey = `${topicDoor}:${pageNo}`;
    const cached = topicCache.get(cacheKey);

    if (cached && cached.items.length > 0) {
      return cached;
    }

    const currentTopicDoor = String(state.serviceData?.topicDoor || '').trim();
    const currentItems = Array.isArray(state.serviceData?.items) ? state.serviceData.items : [];
    const currentPageNo = Number(state.serviceData?.pageNo || 1);

    if (currentTopicDoor === String(topicDoor) && currentItems.length > 0 && currentPageNo === Number(pageNo)) {
      const result = { topics, topicTitle: String(state.serviceData?.topicTitle || '').trim(), items: currentItems };
      topicCache.set(cacheKey, result);
      return result;
    }

    const pending = topicPendingRequests.get(cacheKey);
    if (pending) {
      return await pending;
    }

    const request = (async () => {
      const articles = await loadNewsArticles(topicDoor, pageNo);
      const topic = topics.find((item) => String(item.door) === String(topicDoor));
      const topicTitle = String(articles?.topic?.title || articles?.category?.title || topic?.title || topic?.name || '').trim();
      const result = { topics, topicTitle, items: articles?.items || [] };

      topicCache.set(cacheKey, result);
      return result;
    })();

    topicPendingRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (topicPendingRequests.get(cacheKey) === request) {
        topicPendingRequests.delete(cacheKey);
      }
    }
  }

  // [LOG: 20260617_1730] Unified article load helper with client-side caching
  async function loadNewsArticleState(topicDoor, articleNo, requestOptions) {
    const articleKey = requestOptions.articleKey || '';
    const link = requestOptions.link || '';
    const cacheKey = articleKey || (link ? `link:${normalizeUrl(link)}` : `no:${articleNo}`);
    
    const cached = articleCache.get(cacheKey);
    if (cached) return cached;

    const pending = articlePendingRequests.get(cacheKey);
    if (pending) return await pending;

    const request = (async () => {
      const detail = await loadNewsArticle(topicDoor, articleNo, requestOptions);
      // [LOG: 20260622_1500] 서버가 불완전 기사를 404 대신 200+available:false 로 알리므로,
      // 기존 404 기반 흐름(자동 스킵/목록 복귀)과 동일하게 동작하도록 동일 메시지 에러로 변환한다.
      // 불완전 기사는 캐시하지 않아 피드 갱신 후 재시도가 가능하도록 한다.
      if (detail && detail.available === false) {
        const incompleteError = new Error(detail.message || `불완전한 뉴스 기사입니다: ${articleNo}`);
        incompleteError.type = 'incomplete';
        throw incompleteError;
      }
      if (detail?.article) {
        articleCache.set(cacheKey, detail);
      }
      return detail;
    })();

    articlePendingRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (articlePendingRequests.get(cacheKey) === request) {
        articlePendingRequests.delete(cacheKey);
      }
    }
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
    let loadingTimer = setTimeout(() => {
      showNewsLoading('연결하는 중입니다..');
    }, 80);

    try {
      const { topics, topicTitle, items } = await loadNewsTopicState(topicDoor, requestedPageNo);
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

  // [LOG: 20260622_1114] Fix truncated news article body by prioritizing API details first and dynamically guessing targetListPageNo from actual article number
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

    // Get metadata details from options or sessionStorage
    let articleKey = requestedArticleKey;
    let link = String(options?.link || '').trim();

    if (!articleKey && !link) {
      const sessionKey = `news:metadata:${topicDoor}:${articleNo}`;
      try {
        const sessionData = sessionStorage.getItem(sessionKey);
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          articleKey = parsed.key || '';
          link = parsed.link || '';
        }
      } catch (e) {
        console.error('Failed to load news metadata from sessionStorage', e);
      }
    }

    const requestOptions = { articleKey, link };

    // Check if we can reuse the current article state
    const canReuseCurrentArticle = !forceReload
      && String(state.serviceData?.topicDoor || '') === String(topicDoor)
      && String(state.serviceData?.articleNo || '') === String(articleNo)
      && (!articleKey || String(state.serviceData?.articleKey || '').trim() === articleKey)
      && state.serviceData?.article;

    let detail = null;
    let resolvedArticle = null;
    let resolvedTopicTitle = '';

    if (canReuseCurrentArticle) {
      resolvedArticle = { ...state.serviceData.article };
      resolvedTopicTitle = String(state.serviceData?.topicTitle || '').trim();
      if (resolvedArticle.detailFetched === false) {
        console.warn('Article detail not fully fetched, but allowing entry as fallback');
      }
    } else {
      try {
        console.log('[DEBUG_NEWS] Fetching article detail from API with options:', requestOptions);
        detail = await loadNewsArticleState(topicDoor, articleNo, requestOptions);
        console.log('[DEBUG_NEWS] detail payload received:', detail);
      } catch (error) {
        if (error?.type === 'cancelled') {
          return;
        }
        // [LOG: 20260619_1900] 탐색 중 불완전 기사 에러는 호출자가 스킵 처리할 수 있도록 re-throw
        if (options.skipOnIncomplete && /불완전한 뉴스 기사/.test(error?.message || '')) {
          throw error;
        }
        // [LOG: 20260620_1200] 불완전 기사 등 예상된 로드 실패는 조용히 목록으로 복귀한다(콘솔 노이즈 억제).
        console.debug('뉴스 본문 상세 로드 실패, 목록으로 복귀:', error.message);
        await showNewsList(topicDoor, {
          fromHistory: true,
          pageNo: Math.max(1, Number(state.serviceData?.listPageNo || 1))
        });
        return;
      }
    }

    const fetchedArticle = canReuseCurrentArticle ? resolvedArticle : detail?.article;
    if (!fetchedArticle) {
      console.warn('[DEBUG_NEWS] fetchedArticle is missing, redirecting to list');
      await showNewsList(topicDoor, {
        fromHistory,
        pageNo: Math.max(1, Number(state.serviceData?.listPageNo || 1))
      });
      return;
    }

    // Determine the list page we should load to pre-load adjacent article contexts
    const pageSize = 15;
    const guessedListPageNo = fetchedArticle.no ? Math.ceil(fetchedArticle.no / pageSize) : 1;
    const targetListPageNo = Math.max(
      1,
      Number(options?.listPageNo || state.serviceData?.listPageNo || guessedListPageNo || 1)
    );

    let topics = [];
    let topicTitle = '';
    let items = [];
    try {
      const topicResult = await loadNewsTopicState(topicDoor, targetListPageNo);
      topics = topicResult.topics;
      topicTitle = topicResult.topicTitle;
      items = topicResult.items;
    } catch (e) {
      console.warn('Failed to load topic state for list page preloading:', e.message);
    }

    // Match the article within the newly loaded list context
    const matchedListArticle = findNewsArticle(items, articleNo, requestOptions);
    const articleIndex = items.findIndex((item) => item === matchedListArticle);

    if (!canReuseCurrentArticle) {
      // Merge: server fetched article detail is source of truth, list article is fallback
      resolvedArticle = {
        ...(matchedListArticle || {}),
        ...fetchedArticle,
        title: fetchedArticle.title || matchedListArticle?.title || '',
        description: fetchedArticle.description || matchedListArticle?.description || '',
        body: fetchedArticle.body || fetchedArticle.description || matchedListArticle?.body || matchedListArticle?.description || ''
      };
      resolvedTopicTitle = String(detail?.topic?.title || topicTitle || '').trim();
      console.log('[DEBUG_NEWS] Merged resolvedArticle body length:', resolvedArticle.body.length);
    } else {
      if (matchedListArticle) {
        resolvedArticle = {
          ...matchedListArticle,
          ...resolvedArticle
        };
      }
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
      articleNo: String(resolvedArticle?.no || articleNo),
      articleKey: getNewsArticleKey(resolvedArticle),
      articleLink: getNewsArticleLink(resolvedArticle),
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
