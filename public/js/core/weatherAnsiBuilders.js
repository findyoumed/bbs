import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

export function createWeatherAnsiBuilders(deps) {
  const {
    ANSI_RESET,
    ansiColor,
    buildPageLabel,
    buildTopHeader,
    fitCell
  } = createAnsiBuilderUtils(deps);

  function groupWeatherByDay(items) {
    const days = [];
    let current = null;
    for (const item of items) {
      const day = item.day || '';
      if (!current || current.day !== day) {
        current = { day, items: [] };
        days.push(current);
      }
      current.items.push(item);
    }
    return days.map((group) => {
      const temps = group.items.map((i) => Number(i.temperature)).filter((t) => !isNaN(t));
      const high = group.items[0]?.high || (temps.length ? Math.max(...temps) : '');
      const low = group.items[0]?.low || (temps.length ? Math.min(...temps) : '');
      const rainProbs = group.items.map((i) => parseInt(i.rainProbability)).filter((r) => !isNaN(r));
      const maxRain = rainProbs.length ? Math.max(...rainProbs) : 0;
      const dayTimeItems = group.items.filter((i) => {
        const h = parseInt(i.hour);
        return h >= 9 && h <= 18;
      });
      const pool = dayTimeItems.length ? dayTimeItems : group.items;
      const weatherCount = {};
      pool.forEach((i) => { weatherCount[i.weather] = (weatherCount[i.weather] || 0) + 1; });
      const mainWeather = Object.entries(weatherCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      return { day: group.day, mainWeather, high, low, maxRain: `${maxRain}%`, items: group.items };
    });
  }

  function buildWeatherAnsi(data, pageNo = 1) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const region = data?.region || '';
    const parts = [];
    const allItems = data?.items || [];
    const dailyItems = data?.daily || [];
    const dayGroups = groupWeatherByDay(allItems);
    // [LOG: 20260724_0942] 15개 시 세로 스크롤바가 생기는 현상을 해결하기 위해 예보 표시 개수를 14로 줄임
    const HOURLY_PAGE_SIZE = 14;

    const subPageInfo = [];
    subPageInfo.push({ type: 'summary' });
    dayGroups.forEach((group, groupIdx) => {
      const items = group.items || [];
      const pagesForGroup = Math.max(1, Math.ceil(items.length / HOURLY_PAGE_SIZE));
      for (let p = 0; p < pagesForGroup; p++) {
        subPageInfo.push({
          type: 'hourly',
          groupIdx,
          dayOffset: p,
          totalSubPages: pagesForGroup
        });
      }
    });

    const pageCount = subPageInfo.length;
    const currentPage = Math.min(Math.max(pageNo, 1), pageCount);
    const info = subPageInfo[currentPage - 1];

    const pageLabel = buildPageLabel(currentPage, pageCount);
    parts.push(buildTopHeader(region ? ['날씨', region] : ['날씨'], pageLabel, targetCols));

    // [LOG_ID: 20260721_2030] data.unavailable를 반영하지 않아 지역 날씨 조회 실패 시 빈 표만
    // 렌더링되던 문제 — 원인/메시지를 안내 문구로 표시한다(내 위치 날씨의 buildLocalWeatherAnsi는
    // 이미 이렇게 처리하고 있었는데 지역 날씨 쪽만 빠져 있었다).
    if (data?.unavailable) {
      parts.push('');
      parts.push(`  ${ansiColor(12)}${data.message || '날씨 정보를 불러올 수 없습니다.'}${ANSI_RESET}`);
      return { text: parts.join('\n'), pageNo: 1, pageCount: 1 };
    }

    if (info.type === 'summary') {
      if (isMobile) {
        parts.push(
          ` ${ansiColor(14)}${fitCell('날짜', 12)}${ANSI_RESET}` +
          `${ansiColor(14)}${fitCell('날씨', 10)}${ANSI_RESET}` +
          `${ansiColor(14)}${fitCell('최고', 6)}${ANSI_RESET}` +
          `${ansiColor(14)}${fitCell('최저', 6)}${ANSI_RESET}` +
          `${ansiColor(14)}${fitCell('강수', 6)}${ANSI_RESET}`
        );
      } else {
        parts.push(
          `  ${ansiColor(14)}${fitCell('날짜', 20)}${ANSI_RESET}` +
          `${ansiColor(14)}${fitCell('날씨', 14)}${ANSI_RESET}` +
          `${ansiColor(14)}${fitCell('최고', 8)}${ANSI_RESET}` +
          `${ansiColor(14)}${fitCell('최저', 8)}${ANSI_RESET}` +
          `${ansiColor(14)}${fitCell('강수', 8)}${ANSI_RESET}`
        );
      }
      parts.push(' ' + '─'.repeat(targetCols - 2));

      const itemsToRender = dailyItems.length > 0 ? dailyItems : dayGroups;
      itemsToRender.forEach((item) => {
        const dayText = item.day || '';
        const weatherText = item.weather || item.mainWeather || '';
        const highText = item.high ? `${item.high}℃` : '';
        const lowText = item.low ? `${item.low}℃` : '';
        const rainText = item.rainProbability || item.maxRain || '';

        if (isMobile) {
          parts.push(
            ` ${ansiColor(11)}${fitCell(dayText.slice(0, 8), 12)}${ANSI_RESET}` +
            `${ansiColor(15)}${fitCell(weatherText, 10)}${ANSI_RESET}` +
            `${ansiColor(13)}${fitCell(highText, 6)}${ANSI_RESET}` +
            `${ansiColor(12)}${fitCell(lowText, 6)}${ANSI_RESET}` +
            `${ansiColor(12)}${fitCell(rainText, 6)}${ANSI_RESET}`
          );
        } else {
          parts.push(
            `  ${ansiColor(11)}${fitCell(dayText, 20)}${ANSI_RESET}` +
            `${ansiColor(15)}${fitCell(weatherText, 14)}${ANSI_RESET}` +
            `${ansiColor(13)}${fitCell(highText, 8)}${ANSI_RESET}` +
            `${ansiColor(12)}${fitCell(lowText, 8)}${ANSI_RESET}` +
            `${ansiColor(12)}${fitCell(rainText, 8)}${ANSI_RESET}`
          );
        }
      });

      if (dayGroups.length > 0) {
        parts.push('');
        parts.push(`  ${ansiColor(8)}F:다음 페이지에서 시간별 상세 확인${ANSI_RESET}`);
      }
    } else if (info.type === 'hourly') {
      const group = dayGroups[info.groupIdx];
      if (group) {
        const subLabel = info.totalSubPages > 1 ? ` (${info.dayOffset + 1}/${info.totalSubPages})` : '';
        // [LOG_ID: 20260623_1141] 시간별 상세 제목도 본문과 동일한 글자 굵기로 렌더링한다.
        parts.push(`  ${ansiColor(11)}── ${group.day}${subLabel} ──${ANSI_RESET}`);

        if (isMobile) {
          parts.push(
            `  ${ansiColor(14)}${fitCell('시', 4)}${ANSI_RESET}` +
            `${ansiColor(14)}${fitCell('날씨', 10)}${ANSI_RESET}` +
            `${ansiColor(14)}${fitCell('기온', 6)}${ANSI_RESET}` +
            `${ansiColor(14)}${fitCell('강수', 6)}${ANSI_RESET}` +
            `${ansiColor(14)}${fitCell('바람', 12)}${ANSI_RESET}`
          );
        } else {
          parts.push(
            `  ${ansiColor(14)}${fitCell('시간', 8)}${ANSI_RESET}` +
            `${ansiColor(14)}${fitCell('날씨', 14)}${ANSI_RESET}` +
            `${ansiColor(14)}${fitCell('기온', 8)}${ANSI_RESET}` +
            `${ansiColor(14)}${fitCell('강수', 6)}${ANSI_RESET}` +
            `${ansiColor(14)}${fitCell('바람', 12)}${ANSI_RESET}`
          );
        }
        parts.push('  ' + '─'.repeat(isMobile ? 38 : 48));

        const startIdx = info.dayOffset * HOURLY_PAGE_SIZE;
        const visibleItems = group.items.slice(startIdx, startIdx + HOURLY_PAGE_SIZE);

        visibleItems.forEach((item) => {
          const hour = fitCell(item.hour || '', isMobile ? 4 : 8);
          const weather = fitCell(item.weather || '', isMobile ? 10 : 14);
          const temp = fitCell(`${item.temperature || ''}℃`, isMobile ? 6 : 8);
          const rain = fitCell(item.rainProbability || '', 6);
          const wind = fitCell(`${item.windDirection || ''} ${item.windSpeed || ''}m/s`, 12);
          parts.push(`  ${ansiColor(11)}${hour}${ANSI_RESET}${ansiColor(15)}${weather}${ANSI_RESET}${ansiColor(13)}${temp}${ANSI_RESET}${ansiColor(12)}${rain}${ANSI_RESET}${ansiColor(8)}${wind}${ANSI_RESET}`);
        });

        // [LOG_ID: 20260723_2200] 시간별 상세 페이지에도 요약 페이지(page 1)와 동일하게
        // 클릭 가능한 "F:다음 페이지" 안내를 넣는다 — 마지막 페이지가 아닐 때만 표시.
        if (currentPage < pageCount) {
          parts.push('');
          parts.push(`  ${ansiColor(8)}F:다음 페이지 보기${ANSI_RESET}`);
        }
      }
    }

    if (currentPage >= pageCount) {
      parts.push('');
      parts.push(`  ${ansiColor(14)}마지막 페이지입니다${ANSI_RESET}`);
    }


    return { text: parts.join('\n'), pageNo: currentPage, pageCount };
  }

  // [LOG_ID: 20260723_1000] buildWeatherAnsi(지역 날씨 요약)는 이미 isMobile 분기가 있었지만
  // 이 함수(내 위치 날씨)는 항상 데스크톱 폭(52칸)으로 고정돼 있어, 모바일(44칸) 화면에서
  // 오른쪽 "강수" 열이 화면 밖으로 잘려 나가던 버그(스크린샷으로 실측 확인)를 고친다.
  function buildLocalWeatherAnsi(local) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const city = local?.city || '알 수 없음';
    const parts = [];
    parts.push(`  ${ansiColor(11)}◈ 내 위치 (${city})${ANSI_RESET}  ${ansiColor(15)}현재 ${local?.temperature || ''}℃ ${local?.weather || ''}${ANSI_RESET}`);

    const widths = isMobile
      ? { day: 12, weather: 10, high: 6, low: 6, rain: 6 }
      : { day: 16, weather: 12, high: 8, low: 8, rain: 8 };

    parts.push(
      `  ${ansiColor(14)}${fitCell('날짜', widths.day)}${ANSI_RESET}` +
      `${ansiColor(14)}${fitCell('날씨', widths.weather)}${ANSI_RESET}` +
      `${ansiColor(14)}${fitCell('최고', widths.high)}${ANSI_RESET}` +
      `${ansiColor(14)}${fitCell('최저', widths.low)}${ANSI_RESET}` +
      `${ansiColor(14)}${fitCell('강수', widths.rain)}${ANSI_RESET}`
    );
    const lineWidth = widths.day + widths.weather + widths.high + widths.low + widths.rain;
    parts.push(`  ${ansiColor(8)}${'─'.repeat(lineWidth)}${ANSI_RESET}`);
    (local?.days || []).forEach((d) => {
      parts.push(
        `  ${ansiColor(11)}${fitCell(d.day || '', widths.day)}${ANSI_RESET}` +
        `${ansiColor(15)}${fitCell(d.weather || '', widths.weather)}${ANSI_RESET}` +
        `${ansiColor(13)}${fitCell(d.high ? `${d.high}℃` : '', widths.high)}${ANSI_RESET}` +
        `${ansiColor(12)}${fitCell(d.low ? `${d.low}℃` : '', widths.low)}${ANSI_RESET}` +
        `${ansiColor(12)}${fitCell(d.rainProbability || '', widths.rain)}${ANSI_RESET}`
      );
    });
    return parts.join('\n');
  }

  function buildWeatherLocalAnsi(local) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const parts = [];
    parts.push(buildTopHeader(['날씨', '내 위치'], '', targetCols));

    if (!local || local.unavailable) {
      parts.push('');
      parts.push(`  ${ansiColor(12)}내 위치 날씨를 불러오지 못했습니다.${ANSI_RESET}`);
      if (local?.message) {
        parts.push(`  ${ansiColor(8)}${local.message}${ANSI_RESET}`);
      }
    } else {
      parts.push(buildLocalWeatherAnsi(local));
    }


    return { text: parts.join('\n'), pageNo: 1, pageCount: 1 };
  }

  function buildWeatherMenuAnsi(regions) {
    const parts = [];
    parts.push(buildTopHeader(['날씨']));
    parts.push(`  ${ansiColor(14)}지역 선택${ANSI_RESET}`);
    parts.push(`  ${ansiColor(8)}${'─'.repeat(52)}${ANSI_RESET}`);
    const regionStartLine = parts.join('\n').split('\n').length;
    const half = Math.ceil(regions.length / 2);
    for (let i = 0; i < half; i++) {
      const left = regions[i];
      const right = regions[i + half];
      const leftDoor = String(left.door).padStart(2, ' ');
      const leftName = left.name || left.title || '';
      let line = `  ${ansiColor(15)}${leftDoor}. ${fitCell(leftName, 20)}${ANSI_RESET}`;
      if (right) {
        const rightDoor = String(right.door).padStart(2, ' ');
        const rightName = right.name || right.title || '';
        line += `    ${ansiColor(15)}${rightDoor}. ${fitCell(rightName, 20)}${ANSI_RESET}`;
      }
      parts.push(line);
    }
    return { text: parts.join('\n'), regionStartLine, half };
  }

  return {
    buildWeatherAnsi,
    buildLocalWeatherAnsi,
    buildWeatherLocalAnsi,
    buildWeatherMenuAnsi
  };
}
