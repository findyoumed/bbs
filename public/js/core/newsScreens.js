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
    setReady,
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
    if (!screenNode) return;

    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));

    const layer = createHotspotLayer();
    const positionedButtons = [];
    const sourceLinkButtons = [];

    // 1. [엔터] 복귀 가이드 핫스팟 (갈무리 모드 전용)
    const enterGuideIdx = lineNodes.findIndex((lineNode) => String(lineNode?.textContent || '').includes('[엔터]를 누르면 페이지 보기로 돌아갑니다'));
    if (enterGuideIdx >= 0) {
      const sourceText = String(lineNodes[enterGuideIdx].textContent || '');
      const guideOffset = sourceText.indexOf('[엔터]');
      if (guideOffset >= 0) {
        const trimmedEnd = sourceText.replace(/\s+$/g, '').length;
        const bounds = measureLineSegmentBounds(screenNode, lineNodes[enterGuideIdx], guideOffset, trimmedEnd);
        if (bounds) {
          const btn = createHotspotButton('ENTER', '페이지 보기로 복귀', bounds);
          btn.classList.add('ansi-hotspot--return-guide');
          layer.appendChild(btn);
          positionedButtons.push({ button: btn, rowIdx: enterGuideIdx, isGuide: true, startCol: guideOffset, endCol: trimmedEnd });
        }
      }
    }

    // 2. 원문 기사 핫스팟 (원문 링크가 있을 때만)
    const linkStartIdx = lineNodes.findIndex((lineNode) => String(lineNode?.textContent || '').includes('원문:'));
    const sourceLinkGroup = `news-source-link-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    function getSourceLinkBounds(rowIdx) {
      const sourceText = String(lineNodes[rowIdx]?.textContent || '');
      if (!sourceText.trim() || sourceText.trim() === '마지막 페이지입니다' || sourceText.includes('[엔터]') || sourceText.includes('복사되었습니다')) return null;

      return rowIdx === linkStartIdx
        ? (() => {
            const urlOffset = sourceText.indexOf('http');
            if (urlOffset < 0) return null;
            const trimmedEnd = sourceText.replace(/\s+$/g, '').length;
            return measureLineSegmentBounds(screenNode, lineNodes[rowIdx], urlOffset, trimmedEnd);
          })()
        : (measureServiceLineBounds(screenNode, lineNodes[rowIdx]) || estimateServiceLineBounds(screenNode, lineNodes[rowIdx]));
    }

    if (link && linkStartIdx >= 0) {
      for (let rowIdx = linkStartIdx; rowIdx < lineNodes.length; rowIdx += 1) {
        const sourceText = String(lineNodes[rowIdx]?.textContent || '');
        if (!sourceText.trim() || sourceText.trim() === '마지막 페이지입니다' || sourceText.includes('[엔터]') || sourceText.includes('복사되었습니다')) break;

        const bounds = getSourceLinkBounds(rowIdx);
        if (!bounds) continue;
        const btn = createHotspotButton('', '원문 기사 열기', bounds);
        btn.dataset.externalUrl = link;
        btn.dataset.hotspotGroup = sourceLinkGroup;
        btn.classList.add('ansi-hotspot--source-link');
        btn.removeAttribute('data-cmd');
        layer.appendChild(btn);
        sourceLinkButtons.push(btn);
        positionedButtons.push({ button: btn, rowIdx, isGuide: false });
      }
      bindGroupedHotspotHover(sourceLinkButtons);
    }

    // 3. 리사이즈/리프레시 로직 갱신
    function refreshAllBounds() {
      if (screenNode.isConnected === false) return;
      positionedButtons.forEach(({ button, rowIdx, isGuide, startCol, endCol }) => {
        if (isGuide) {
          const sourceText = String(lineNodes[rowIdx]?.textContent || '');
          const bounds = measureLineSegmentBounds(screenNode, lineNodes[rowIdx], startCol, endCol);
          if (bounds) {
            button.style.left = `${bounds.left}px`;
            button.style.top = `${bounds.top}px`;
            button.style.width = `${bounds.width}px`;
            button.style.height = `${bounds.height}px`;
          }
        } else {
          const bounds = getSourceLinkBounds(rowIdx);
          if (bounds) {
            button.style.left = `${bounds.left}px`;
            button.style.top = `${bounds.top}px`;
            button.style.width = `${bounds.width}px`;
            button.style.height = `${bounds.height}px`;
          }
        }
      });
    }

    function scheduleRefresh(delay = 0) {
      if (delay > 0) {
        window.setTimeout(refreshAllBounds, delay);
        return;
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(refreshAllBounds);
      } else {
        window.setTimeout(refreshAllBounds, 0);
      }
    }

    if (layer.childElementCount > 0) {
      screenNode.appendChild(layer);
      scheduleRefresh();
      scheduleRefresh(250);
      scheduleRefresh(1000);
      scheduleRefresh(1600);

      Array.from(screenNode.querySelectorAll('.news-article-image')).forEach((image) => {
        if (image.complete) {
          scheduleRefresh();
          return;
        }
        image.addEventListener('load', () => scheduleRefresh(), { once: true });
        image.addEventListener('error', () => scheduleRefresh(), { once: true });
      });

      if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        document.fonts.ready.then(refreshAllBounds).catch(() => {});
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
    let source = String(value || '').trim();
    if (!source) return '';

    // [LOG_ID: 20260709_1648] 스키마리스(//) 및 프로토콜이 생략된 호스트 주소(news.kbs.co.kr 등)에 https: 프로토콜 보정 추가
    if (/^\/\//.test(source)) {
      source = 'https:' + source;
    } else if (/^[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\//.test(source) && !source.includes('://')) {
      source = 'https://' + source;
    }

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

    // [LOG_ID: 20260710_1120] URL에는 짧게 자른 키(예: 앞 8자리)가 실릴 수 있으므로 prefix 매칭을 허용한다.
    let byKey = null;
    if (expectedKey && expectedKey.length >= 6) {
      byKey = list.find((item) => getNewsArticleKey(item).startsWith(expectedKey)) || null;
    }

    let byLink = null;
    if (expectedLink) {
      byLink = list.find((item) => normalizeUrl(getNewsArticleLink(item)) === normalizeUrl(expectedLink)) || null;
    }

    const byNo = target ? list.find((item, index) => String(item?.no || (index + 1)) === target) : null;

    const keyConflict = byKey && byNo && byKey !== byNo;
    const linkConflict = byLink && byNo && byLink !== byNo;

    if (keyConflict || linkConflict) {
      return byNo;
    }

    // [LOG_ID: 20260709_1720] 충돌이 잦은 링크 대신 가장 유니크한 고유 식별자 키(byKey)를 최우선으로 매칭하여 복원한다.
    if (byKey) return byKey;
    if (byLink) return byLink;
    if (byNo) return byNo;

    return null;
  }

  function normalizeUrl(value) {
    let str = String(value || '').trim();
    if (!str) return '';
    str = str.replace(/^https?:\/\//i, '');
    str = str.replace(/^www\./i, '');
    
    // [LOG_ID: 20260709_1720] SBS news_id, 오마이뉴스 CNTN_CD 등 쿼리스트링 식별자를 지켜 충돌을 막는다.
    // 단, 유입 경로별로 달라지는 plink, cooper, ref, oc 등 트래킹 파라미터만 제거하고 정렬하여 비교한다.
    const qIdx = str.indexOf('?');
    if (qIdx !== -1) {
      const baseUrl = str.substring(0, qIdx);
      const queryStr = str.substring(qIdx + 1);
      const parts = queryStr.split('&');
      const params = [];
      for (const part of parts) {
        if (!part) continue;
        const [k, v] = part.split('=');
        const key = decodeURIComponent(k).trim().toLowerCase();
        if (['plink', 'cooper', 'ref', 'oc', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].includes(key)) {
          continue;
        }
        params.push({ k, v });
      }
      params.sort((a, b) => a.k.localeCompare(b.k));
      const newQuery = params.map(p => `${p.k}=${p.v || ''}`).join('&');
      str = baseUrl + (newQuery ? `?${newQuery}` : '');
    }
    
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
    if (typeof document !== 'undefined') {
      delete document.body.dataset.printView;
      delete document.documentElement.dataset.printView;
    }
    state.screen = 'news-menu';
    if (!fromHistory) { updateURL(); pushHistory(); }

    const data = await loadNewsMenu();
    const topics = getNewsTopics(data);
    state.serviceData = { ...data, topics, topicDoor: '' };

    const items = topics.map((topic) => ({
      door: topic.door, name: topic.title || topic.name,
      id: `news-${topic.door}`, boardId: `news-${topic.door}`
    }));
    // [LOG_ID: 20260707_2300] footer는 본문 스트리밍이 끝나고 새 내용이 준비된 뒤에만 드러난다.
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: buildBoardSelectAnsi(items, { titlePath: ['뉴스/인물'] }),
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(getMenuNodeByKey('news')?.footer, getCommandFooterText('newsMenu'));
      }
    });

    renderBoardSelectHotspots(rendered.screenNode, items);
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  async function showNewsList(topicDoor, options = false) {
    if (typeof document !== 'undefined') {
      delete document.body.dataset.printView;
      delete document.documentElement.dataset.printView;
    }
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
      // [LOG_ID: 20260707_2345] loadingTimer(위)는 "80ms 후 로딩 화면을 보여줄지" 결정하는 바깥 타이머일
      // 뿐이다. 이미 그 80ms가 지나 showNewsLoading()→setLoading()이 실행됐다면, setLoading 내부에서
      // 스스로 건 400ms 지연 타이머(본문을 "연결하는 중입니다"로 통째로 덮어쓰는 타이머)는 이 clearTimeout으로
      // 취소되지 않는다 — setReady(true)가 그 내부 타이머를 취소하는 유일한 방법이다. 이걸 빠뜨리면,
      // 데이터가 늦게 도착했을 때 새 화면이 다 그려지고 footer까지 새로 갱신된 "후"에 내부 타이머가 뒤늦게
      // 발동해 방금 그린 본문을 로딩 문구로 덮어써 버려서, "연결하는 중입니다" 문구와 새 화면의 footer 힌트가
      // 동시에 보이는 것처럼 어긋나 보였다.
      setReady(true);

      const newsListView = buildNewsListAnsi(topicTitle, items, requestedPageNo);

      state.serviceData = {
        topics, topicDoor, topicTitle, items,
        pageCount: newsListView.pageCount, pageNo: newsListView.pageNo,
        listPageNo: newsListView.pageNo, listPageSize: newsListView.pageSize
      };
      if (!fromHistory) { updateURL(); pushHistory(); }
      // [LOG_ID: 20260707_2300] footer는 본문 스트리밍이 끝나고 새 내용이 준비된 뒤에만 드러난다.
      const rendered = await renderAnsiScreenWithTopbarSequential({
        ansiText: newsListView.text,
        ansiToHTML,
        screenEl,
        renderScreenSequential,
        afterBodyRender: async () => {
          await applyCommandFooter(getMenuNodeByKey('news')?.footer, getCommandFooterText('newsList'));
        }
      });
      renderNewsArticleHotspots(rendered.screenNode, newsListView.items, 2);

      if (shouldAutoFocusCommandInput()) cmdInput.focus();
    } catch (error) {
      clearTimeout(loadingTimer);
      throw error;
    }
  }

  async function showNewsArticle(topicDoor, articleNo, options = {}) {
    const fullView = Boolean(options?.fullView);
    if (typeof document !== 'undefined') {
      if (fullView) {
        document.body.dataset.printView = 'true';
        document.documentElement.dataset.printView = 'true';
      } else {
        delete document.body.dataset.printView;
        delete document.documentElement.dataset.printView;
      }
    }
    if (fullView && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
    const requestedPageNo = Math.max(1, Number.parseInt(options?.pageNo, 10) || 1);
    const fromHistory = Boolean(options?.fromHistory);
    const forceReload = Boolean(options?.forceReload);
    const requestedArticleKey = String(options?.articleKey || options?.key || '').trim();
    const sameView = String(state.serviceData?.topicDoor || '') === String(topicDoor)
      && String(state.serviceData?.articleNo || '') === String(articleNo)
      && Number(state.serviceData?.pageNo || 1) === requestedPageNo
      && (!requestedArticleKey || String(state.serviceData?.articleKey || '').trim() === requestedArticleKey);

    // [LOG_ID: 20260710_1120] articleNo(no)는 피드가 백그라운드에서 재구성될 때마다 위치가 바뀔 수 있어
    // URL/화면에 노출하는 "표시 번호"로 쓰기엔 불안정하다. 같은 기사(topicDoor+articleNo 동일)를 다시 그리는
    // 경우(본문 페이지 이동 B/F, 새로고침 L 등)엔 기존 표시 번호를 그대로 이어가고, 진짜 새로운 기사 선택
    // (목록 클릭, A/N 이동)일 때만 이번 요청 번호를 새 표시 번호로 채택한다.
    const isSameArticleAsBefore = String(state.serviceData?.topicDoor || '') === String(topicDoor)
      && String(state.serviceData?.articleNo || '') === String(articleNo);
    const preservedDisplayNo = isSameArticleAsBefore ? state.serviceData?.displayNo : null;

    // [LOG_ID: 20260709_1450] 화면 전환 실패 시 복원을 위해 이전 screen을 저장
    const prevScreen = state.screen;
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
        detail = await loadNewsArticleState(topicDoor, articleNo, requestOptions);
      } catch (error) {
        if (error?.type === 'cancelled') {
          return;
        }
        // [LOG: 20260619_1900] 탐색 중 불완전 기사 에러는 호출자가 스킵 처리할 수 있도록 re-throw
        // [LOG_ID: 20260709_1450] throw 전에 state.screen을 이전 화면으로 복원한다.
        // L571에서 미리 'news-view'로 바꿨지만, 불완전 기사이면 화면 전환이 실제로 일어나지 않으므로
        // 이전 screen 값(news-list 등)으로 되돌려야 F/B 등 단축키가 올바른 screen 기준으로 작동한다.
        if (options.skipOnIncomplete) {
          state.screen = prevScreen;
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
    // [LOG_ID: 20260710_1400] A/N 인접 탐색은 "사용자가 보던 목록 스냅샷" 기준이어야 한다.
    // 여기서 최신 피드를 새로 받아 items를 교체하면, 백그라운드 재구성(새 기사 유입 + 날짜 미상
    // 기사 재정렬)으로 인접 관계 자체가 바뀌어 N/A가 사용자 목록 기준으로 멀리 떨어진 기사로
    // 이동하는 문제(예: 20번에서 N → 목록상 196번이던 기사)가 생긴다. 현재 상태의 items에
    // 대상 기사가 존재하면 그 스냅샷을 그대로 재사용하고, 없을 때만 새로 로드한다.
    const sameTopicItems = String(state.serviceData?.topicDoor || '') === String(topicDoor)
      && Array.isArray(state.serviceData?.items) ? state.serviceData.items : [];
    if (sameTopicItems.length > 0 && findNewsArticle(sameTopicItems, articleNo, requestOptions)) {
      topics = getNewsTopics(state.serviceData);
      topicTitle = String(state.serviceData?.topicTitle || '').trim();
      items = sameTopicItems;
    } else {
      try {
        const topicResult = await loadNewsTopicState(topicDoor, targetListPageNo);
        topics = topicResult.topics;
        topicTitle = topicResult.topicTitle;
        items = topicResult.items;
      } catch (e) {
        console.warn('Failed to load topic state for list page preloading:', e.message);
      }
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
    } else {
      if (matchedListArticle) {
        resolvedArticle = {
          ...matchedListArticle,
          ...resolvedArticle
        };
      }
    }

    // [LOG_ID: 20260709_1250] 클라이언트측 2차 방어 가드: 캐시 오염 등으로 인해 비정상적으로 잘린 
    // 기사 본문이 렌더링되려는 경우, 상세 화면 그리기를 강제 차단하고 리스트로 조용히 튕겨낸다.
    // [LOG_ID: 20260709_1440] pageNo > 1인 경우(F키로 2페이지+ 요청) 잘린 기사 판단을 건너뛴다.
    // 이미 이전 페이지가 렌더링된 기사는 정상 기사임이 확인된 것이므로 차단하면 안 된다.
    if (requestedPageNo <= 1) {
      const clientTrimmed = String(resolvedArticle.body || resolvedArticle.description || '').trim();
      const isClientTruncated = /[.]{2,}$|[…,\-:/]$/.test(clientTrimmed)
        || /[며고나면지를을은는이가와과의로]/.test(clientTrimmed.slice(-3));
      // [LOG_ID: 20260710_1330] 속보 스텁 기사("후속기사가 이어집니다" 단문)는 본문이 30자 미만이
      // 정상이므로 서버와 동일하게 속보 키워드가 있으면 최소 길이 기준을 10자로 완화한다.
      const isBreakingStub = /속보|단독|긴급|breaking/i.test(String(resolvedArticle.title || ''));
      const minClientLength = isBreakingStub ? 10 : 30;

      if (isClientTruncated || clientTrimmed.length < minClientLength) {
        console.debug('클라이언트측 잘린 기사 감지로 차단:', articleNo);
        // [LOG_ID: 20260709_1255] 단축키 N/A를 통한 순차 탐색 도중 잘린 기사를 만나면
        // 에러를 던져야 이전/다음 순차 스킵 탐색기가 멈추지 않고 다음 정상 기사를 계속 탐색할 수 있다.
        const incompleteError = new Error(`불완전한 뉴스 기사입니다: ${articleNo}`);
        incompleteError.type = 'incomplete';
        if (options?.skipOnIncomplete) {
          // [LOG_ID: 20260709_1450] 화면 전환 안 일어났으므로 이전 screen으로 복원
          state.screen = prevScreen;
          throw incompleteError;
        }
        await showNewsList(topicDoor, {
          fromHistory: true,
          pageNo: Math.max(1, Number(state.serviceData?.listPageNo || 1))
        });
        return;
      }
    }


    // [LOG_ID: 20260710_1530] fullView(PR 갈무리 모드): 본문 전체를 페이지 분할 없이 한 번에 출력.
    const articleView = buildNewsArticleAnsi(resolvedTopicTitle, resolvedArticle, requestedPageNo, { fullView });
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
      // [LOG_ID: 20260710_1210] URL 노출 번호 우선순위: A/N 등 호출자가 명시한 순차 번호 >
      // 같은 기사 재렌더링 시 보존된 번호 > 이번 요청 번호. 서버 스냅샷의 위치 번호(no)는 쓰지 않는다.
      displayNo: String(options?.displayNo || preservedDisplayNo || articleNo),
      articleKey: getNewsArticleKey(resolvedArticle),
      articleLink: getNewsArticleLink(resolvedArticle),
      article: resolvedArticle, items,
      // [LOG_ID: 20260710_1530] fullView에서는 페이지 컨텍스트(pageNo/pageCount)를 진입 당시 값으로
      // 보존해, [엔터] 복귀 시 보던 페이지로 정확히 돌아가게 한다. articleView는 단일 페이지(1/1)를 반환.
      pageCount: fullView ? Math.max(1, Number(state.serviceData?.pageCount || 1)) : articleView.pageCount,
      pageNo: fullView ? requestedPageNo : articleView.pageNo,
      _printView: fullView,
      listPageNo: resolvedListPageNo, listPageSize: currentListPageSize
    };
    if (!fromHistory && !sameView) { updateURL(); pushHistory(); }

    // [LOG_ID: 20260707_2300] footer는 본문 스트리밍이 끝나고 새 내용이 준비된 뒤에만 드러난다.
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: articleView.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(getMenuNodeByKey('news')?.footer, getCommandFooterText(fullView ? 'serviceArticleFull' : 'serviceArticle'));
        if (fullView && typeof window !== 'undefined') {
          window.scrollTo(0, 0);
        }
      }
    });
    renderNewsArticleImage(rendered.screenNode, state.serviceData.article, articleView.pageNo);
    renderNewsSourceLinkHotspots(rendered.screenNode, state.serviceData.article);

    if (fullView && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }

    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  return {
    showNewsArticle,
    showNewsList,
    showNewsMenu
  };
}
