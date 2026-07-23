import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createWeatherScreens(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    buildWeatherLocalAnsi,
    buildWeatherMenuAnsi,
    buildWeatherAnsi,
    cmdInput,
    getCommandFooterText,
    getMenuNodeByKey,
    loadLocalWeather,
    loadWeatherFeed,
    loadWeatherRegions,
    screenEl,
    // [LOG_ID: 20260707_2030] setLoading 주입 누락 수정
    setLoading,
    state,
    updateURL,
    createHotspotLayer,
    createHotspotButton,
    measureServiceLineBounds,
    estimateServiceLineBounds,
    measureLineSegmentBounds,
    renderScreenSequential
  } = deps;

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

  function renderWeatherRegionHotspots(screenNode, items, regionStartLine, half) {
    if (!screenNode || !items.length) return;
    const layer = createHotspotLayer();
    const bodyNode = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyNode.querySelectorAll('.ansi-line'));
    const screenRect = screenNode.getBoundingClientRect();
    const bodyRect = bodyNode.getBoundingClientRect();

    // [LOG: 20260428_1020] CSS zoom/scale(1.15 등) 이중 확대 방지를 위해 스케일 역산
    const scaleX = screenNode.offsetWidth > 0 ? screenRect.width / screenNode.offsetWidth : 1;
    const scaleY = screenNode.offsetHeight > 0 ? screenRect.height / screenNode.offsetHeight : 1;

    const bodyStyle = getComputedStyle(bodyNode);
    const padLeft = parseFloat(bodyStyle.paddingLeft) || 0;
    const padRight = parseFloat(bodyStyle.paddingRight) || 0;

    const contentWidth = (bodyRect.width / scaleX) - padLeft - padRight;
    const cellW = Math.max(8, contentWidth / 80);
    const contentLeft = ((bodyRect.left - screenRect.left) / scaleX) + padLeft;

    for (let row = 0; row < half; row++) {
      const lineNode = lineNodes[regionStartLine + row];
      if (!lineNode) continue;
      const lineRect = lineNode.getBoundingClientRect();
      const rowTop = (lineRect.top - screenRect.top) / scaleY;
      const rowHeight = Math.max((lineRect.height / scaleY), 16);
      const leftItem = items[row];
      const rightItem = items[row + half];

      if (leftItem) {
        layer.appendChild(createHotspotButton(leftItem.door, leftItem.name, {
          left: contentLeft, top: rowTop, width: 26 * cellW, height: rowHeight
        }));
      }
      if (rightItem) {
        layer.appendChild(createHotspotButton(rightItem.door, rightItem.name, {
          left: contentLeft + 30 * cellW, top: rowTop, width: 24 * cellW, height: rowHeight
        }));
      }
    }
    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }

  // [LOG_ID: 20260723_2100] "F:다음 페이지에서 시간별 상세 확인" 안내 줄이 텍스트로만 표시되고
  // 클릭할 수 없었다(사용자 보고: "이부분클릭가능해야지") — newsScreens.js의 "[엔터]" 복귀 안내와
  // 동일한 패턴으로, 렌더된 줄에서 해당 문구를 찾아 F 명령을 실행하는 핫스팟을 그 위에 올린다.
  // [LOG_ID: 20260723_2200] 요약(1페이지)뿐 아니라 시간별 상세(2페이지 이후)에도 같은 형태의
  // "F:다음 페이지 보기" 안내가 추가됐으므로, 문구 전문 대신 "F:"로 시작하는 줄을 범용으로 찾는다.
  function renderWeatherHourlyHintHotspot(screenNode) {
    if (!screenNode) return;
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    const rowIdx = lineNodes.findIndex((node) => String(node.textContent || '').trim().startsWith('F:'));
    if (rowIdx < 0) return;

    const lineNode = lineNodes[rowIdx];
    const sourceText = String(lineNode.textContent || '');
    const startIdx = sourceText.search(/\S/);
    const trimmedEnd = sourceText.replace(/\s+$/g, '').length;
    if (startIdx < 0 || trimmedEnd <= startIdx) return;

    const bounds = measureLineSegmentBounds(screenNode, lineNode, startIdx, trimmedEnd)
      || measureServiceLineBounds(screenNode, lineNode)
      || estimateServiceLineBounds(screenNode, lineNode);
    if (!bounds) return;

    const label = sourceText.trim().replace(/^F:/, '');
    const layer = createHotspotLayer();
    layer.appendChild(createHotspotButton('F', label, bounds));
    screenNode.appendChild(layer);
  }

  async function renderWeatherMenuScreen(items) {
    const result = buildWeatherMenuAnsi(items);
    // [LOG_ID: 20260707_2300] footer(힌트/입력줄)는 본문 스트리밍이 끝나고 새 내용이 준비된
    // 뒤에야 드러난다 — afterBodyRender에서 applyCommandFooter를 실행해 순서를 보장한다.
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: result.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(getMenuNodeByKey('weather')?.footer, getCommandFooterText('weatherMenu'));
      }
    });
    // [LOG: 20260428_1018] Header is 4 lines, so items start at (regionStartLine - 4) in the body container
    const bodyOffset = result.regionStartLine - 4;
    renderWeatherRegionHotspots(rendered.screenNode, items, bodyOffset, result.half);
  }

  function normalizeRegionName(name) {
    const mapping = {
      '서울특별시': '서울시',
      '강원특별자치도': '강원도',
      '전북특별자치도': '전라북도',
      '제주특별자치도': '제주도'
    };
    return mapping[name] || name;
  }

  async function showWeatherMenu(fromHistory = false) {
    state.screen = 'weather-menu';
    if (!fromHistory) { updateURL(); pushHistory(); }

    const data = await loadWeatherRegions();
    state.serviceData = data;
    const items = [
      { door: '0', name: '내 위치 날씨', kind: 'local', id: 'weather-local', boardId: 'weather-local' },
      ...(data?.items || []).map((region) => ({
        door: region.door, name: normalizeRegionName(region.title || region.province),
        id: `weather-${region.door}`, boardId: `weather-${region.door}`
      }))
    ];
    state.serviceData.menuItems = items;

    // [LOG_ID: 20260707_1900] PC통신은 화면 아래(입력줄)가 가장 마지막에 나타나야 한다.
    // 이 화면만 즉시 렌더(sequential=false)로 남아 있어 다른 서비스 메뉴와 달리 본문이
    // 한 번에 툭 튀어나오던 문제를 없앤다 — 뉴스/게시판과 같은 위→아래 스트리밍으로 통일.
    await renderWeatherMenuScreen(items);
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  async function showWeatherView(regionDoor, options = {}) {
    const normalizedOptions = typeof options === 'boolean'
      ? { fromHistory: options }
      : (options || {});
    const fromHistory = normalizedOptions.fromHistory || false;
    // [LOG: 20260429_0427] Keep weather pagination addressable so page changes
    // update the URL/history contract instead of collapsing back to page 1.
    const requestedPageNo = Math.max(1, Number.parseInt(normalizedOptions.pageNo, 10) || 1);
    state.screen = 'weather-view';
    const isLocalWeather = String(regionDoor) === 'local' || String(regionDoor) === '0';

    if (isLocalWeather) {
      const shouldReuseLocal = String(state.serviceData?.regionDoor || '') === 'local'
        && state.serviceData?.localWeather
        && normalizedOptions.forceReload !== true;

      if (!shouldReuseLocal) {
        const local = await loadLocalWeather().catch((error) => ({
          unavailable: true,
          message: error?.message || '내 위치 날씨를 불러오지 못했습니다.'
        }));
        const regions = state.serviceData?.items || [];
        const menuItems = state.serviceData?.menuItems || [];
        state.serviceData = {
          regionDoor: 'local',
          region: '내 위치',
          items: regions,
          menuItems,
          localWeather: local,
          pageNo: 1,
          pageCount: 1
        };
      }

      if (!fromHistory) { updateURL(); pushHistory(); }

      const localResult = buildWeatherLocalAnsi(state.serviceData?.localWeather);
      state.serviceData.pageNo = localResult.pageNo;
      state.serviceData.pageCount = localResult.pageCount;

      if (!fromHistory) { updateURL(); pushHistory(); }

      // [LOG_ID: 20260707_2300] 본문도 위→아래 스트리밍으로 통일하고, footer는 본문+새 내용이
      // 모두 준비된 뒤에만 드러낸다(afterBodyRender).
      await renderAnsiScreenWithTopbarSequential({
        ansiText: localResult.text,
        ansiToHTML,
        screenEl,
        renderScreenSequential,
        afterBodyRender: async () => {
          await applyCommandFooter(getMenuNodeByKey('weather')?.footer, getCommandFooterText('weatherView'));
        }
      });

      if (shouldAutoFocusCommandInput()) cmdInput.focus();
      return;
    }

    const isSameRegion = String(state.serviceData?.regionDoor) === String(regionDoor)
      && Array.isArray(state.serviceData?.weatherItems) && Array.isArray(state.serviceData?.dailyItems);
    if (!isSameRegion) {
      if (typeof setLoading === 'function') setLoading('연결하는 중입니다..');
      const feed = await loadWeatherFeed(regionDoor);
      const regions = state.serviceData?.items || [];
      const region = regions.find((item) => String(item.door) === String(regionDoor));
      const regionName = feed?.region?.title || region?.title || region?.province || '';
      state.serviceData = {
        regionDoor, region: regionName, items: regions,
        weatherItems: feed?.items || [], dailyItems: feed?.daily || [],
        unavailable: !!feed?.unavailable, unavailableMessage: feed?.message || ''
      };
    }

    const weatherResult = buildWeatherAnsi(
      {
        region: state.serviceData.region,
        items: state.serviceData.weatherItems,
        daily: state.serviceData.dailyItems,
        unavailable: state.serviceData.unavailable,
        message: state.serviceData.unavailableMessage
      },
      requestedPageNo
    );
    state.serviceData.pageNo = weatherResult.pageNo;
    state.serviceData.pageCount = weatherResult.pageCount;

    if (!fromHistory) { updateURL(); pushHistory(); }

    // [LOG_ID: 20260707_2300] 본문도 위→아래 스트리밍으로 통일 (weather-menu/local과 동일 규칙).
    const rendered = await renderAnsiScreenWithTopbarSequential({
      ansiText: weatherResult.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(getMenuNodeByKey('weather')?.footer, getCommandFooterText('weatherView'));
      }
    });
    renderWeatherHourlyHintHotspot(rendered.screenNode);

    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  return {
    showWeatherMenu,
    showWeatherView
  };
}
