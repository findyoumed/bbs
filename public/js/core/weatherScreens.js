import { renderAnsiScreenWithTopbar, renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
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
    state,
    updateURL,
    createHotspotLayer,
    createHotspotButton,
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

  async function renderWeatherMenuScreen(items, sequential = false) {
    const result = buildWeatherMenuAnsi(items);
    let rendered;
    if (sequential) {
      rendered = await renderAnsiScreenWithTopbarSequential({
        ansiText: result.text,
        ansiToHTML,
        screenEl,
        renderScreenSequential
      });
    } else {
      rendered = renderAnsiScreenWithTopbar({
        ansiText: result.text,
        ansiToHTML,
        screenEl
      });
    }
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

    await renderWeatherMenuScreen(items, false);
    await applyCommandFooter(getMenuNodeByKey('weather')?.footer, getCommandFooterText('weatherMenu'));
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

      await renderAnsiScreenWithTopbar({
        ansiText: localResult.text,
        ansiToHTML,
        screenEl,
        renderScreenSequential
      });

      await applyCommandFooter(getMenuNodeByKey('weather')?.footer, getCommandFooterText('weatherView'));
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
        weatherItems: feed?.items || [], dailyItems: feed?.daily || []
      };
    }

    const weatherResult = buildWeatherAnsi(
      { region: state.serviceData.region, items: state.serviceData.weatherItems, daily: state.serviceData.dailyItems },
      requestedPageNo
    );
    state.serviceData.pageNo = weatherResult.pageNo;
    state.serviceData.pageCount = weatherResult.pageCount;

    if (!fromHistory) { updateURL(); pushHistory(); }

    await renderAnsiScreenWithTopbar({
      ansiText: weatherResult.text,
      ansiToHTML,
      screenEl,
      renderScreenSequential
    });

    await applyCommandFooter(getMenuNodeByKey('weather')?.footer, getCommandFooterText('weatherView'));
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  return {
    showWeatherMenu,
    showWeatherView
  };
}
