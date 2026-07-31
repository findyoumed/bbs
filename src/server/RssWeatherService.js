'use strict';
const RssServiceBase = require('./RssServiceBase');
const { parseWeatherFeedXml, parseWeatherMenuXml } = require('./RssServiceXmlParsers');

// WMO weather code → 한글 날씨 변환
const WMO_WEATHER = {
  0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림',
  45: '안개', 48: '안개', 51: '이슬비', 53: '이슬비', 55: '이슬비',
  56: '진눈깨비', 57: '진눈깨비', 61: '약한 비', 63: '비', 65: '강한 비',
  66: '진눈깨비', 67: '진눈깨비', 71: '약한 눈', 73: '눈', 75: '강한 눈',
  77: '싸락눈', 80: '소나기', 81: '소나기', 82: '강한 소나기',
  85: '눈보라', 86: '눈보라', 95: '뇌우', 96: '우박 뇌우', 99: '우박 뇌우'
};

// 영문 도시/지역명 → 한글 변환
const CITY_KO = {
  'Seoul': '서울', 'Busan': '부산', 'Incheon': '인천', 'Daegu': '대구',
  'Daejeon': '대전', 'Gwangju': '광주', 'Ulsan': '울산', 'Sejong': '세종',
  'Suwon': '수원', 'Suwon-si': '수원', 'Goyang-si': '고양', 'Goyang': '고양',
  'Yongin-si': '용인', 'Yongin': '용인', 'Seongnam-si': '성남', 'Seongnam': '성남',
  'Bucheon-si': '부천', 'Bucheon': '부천', 'Ansan-si': '안산', 'Ansan': '안산',
  'Anyang-si': '안양', 'Anyang': '안양', 'Namyangju-si': '남양주', 'Namyangju': '남양주',
  'Hwaseong-si': '화성', 'Hwaseong': '화성', 'Uijeongbu-si': '의정부',
  'Siheung-si': '시흥', 'Gimpo-si': '김포', 'Gwangmyeong-si': '광명',
  'Hanam-si': '하남', 'Paju-si': '파주', 'Gunpo-si': '군포', 'Osan-si': '오산',
  'Icheon-si': '이천', 'Yangju-si': '양주', 'Pyeongtaek-si': '평택',
  'Cheonan': '천안', 'Cheonan-si': '천안', 'Cheongju-si': '청주', 'Cheongju': '청주',
  'Jeonju': '전주', 'Jeonju-si': '전주', 'Jeju-si': '제주', 'Jeju': '제주',
  'Changwon': '창원', 'Changwon-si': '창원', 'Gimhae-si': '김해',
  'Pohang-si': '포항', 'Pohang': '포항', 'Gumi-si': '구미',
  'Chuncheon-si': '춘천', 'Chuncheon': '춘천', 'Wonju-si': '원주', 'Wonju': '원주',
  'Yeosu-si': '여수', 'Mokpo-si': '목포', 'Suncheon-si': '순천',
  'Gyeonggi-do': '경기도', 'Gangwon-do': '강원도',
  'Chungcheongbuk-do': '충청북도', 'Chungcheongnam-do': '충청남도',
  'Jeollabuk-do': '전라북도', 'Jeollanam-do': '전라남도',
  'Gyeongsangbuk-do': '경상북도', 'Gyeongsangnam-do': '경상남도',
  'Jeju-do': '제주도'
};

function toKoreanCity(city, region) {
  return CITY_KO[city] || CITY_KO[region] || city || region || '알 수 없음';
}

function createWeatherFetchOptions(timeoutMs = 5000) {
  const options = {
    headers: { 'User-Agent': 'OldDOS-BBS Web RSS Fetcher' }
  };

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    options.signal = AbortSignal.timeout(timeoutMs);
  }

  return options;
}

function getFriendlyLocalWeatherError(error, stageLabel) {
  const rawMessage = String(error?.message || '').trim();
  const rawName = String(error?.name || '').trim();
  const rawCode = String(error?.cause?.code || error?.code || '').trim();
  const technicalText = `${rawName} ${rawCode} ${rawMessage}`;

  // [LOG: 20260611_1715] Do not expose Node fetch internals such as "fetch failed" to the BBS screen.
  if (/fetch failed|aborted|timeout|terminated|network|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR/i.test(technicalText)) {
    return `${stageLabel} 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.`;
  }

  return `${stageLabel} 처리 중 오류가 발생했습니다.`;
}

class RssWeatherService extends RssServiceBase {
  constructor(options = {}) {
    super(options);
    this.weatherMenuPath = options.weatherMenuPath || '';
  }

  async listWeatherRegions() {
    const menu = await this._loadMenu('weather', this.weatherMenuPath, parseWeatherMenuXml);
    return { kind: 'weather', title: '기상 정보', level: 'regions', items: menu.items.map(i => ({ door: i.door, title: i.province })) };
  }

  async _fetchDailyForecast(lat, lon) {
    if (!lat || !lon) return [];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Seoul&forecast_days=10`;
    const parsed = await this._fetchCached(`daily:${lat}:${lon}`, url, (text) => {
      try {
        const data = JSON.parse(text);
        const d = data?.daily;
        if (!d?.time) return { items: [] };
        const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return {
          items: d.time.map((t, i) => {
            const date = new Date(t + 'T00:00:00+09:00');
            const offset = Math.round((date - today) / 86400000);
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const dayName = WEEKDAYS[date.getDay()];
            const suffix = offset === 0 ? ' 오늘' : offset === 1 ? ' 내일' : offset === 2 ? ' 모레' : '';
            return {
              day: `${mm}/${dd}(${dayName})${suffix}`,
              weather: WMO_WEATHER[d.weather_code?.[i]] || '알 수 없음',
              high: d.temperature_2m_max?.[i] != null ? String(Math.round(d.temperature_2m_max[i])) : '',
              low: d.temperature_2m_min?.[i] != null ? String(Math.round(d.temperature_2m_min[i])) : '',
              rainProbability: d.precipitation_probability_max?.[i] != null ? `${d.precipitation_probability_max[i]}%` : ''
            };
          })
        };
      } catch { return { items: [] }; }
    });
    return parsed?.items || [];
  }

  async getWeatherFeed(door) {
    const menu = await this._loadMenu('weather', this.weatherMenuPath, parseWeatherMenuXml);
    const entry = menu.items.find(i => i.door === String(door));
    if (!entry) throw this._notFoundError(`기상 정보 항목 없음: ${door}`);
    const [feed, dailyItems] = await Promise.all([
      this._fetchCached(`weather:${entry.door}`, entry.rss, parseWeatherFeedXml),
      this._fetchDailyForecast(entry.lat, entry.lon)
    ]);
    return {
      kind: 'weather', title: `기상 정보 / ${entry.province}`, level: 'feed',
      region: { door: entry.door, title: entry.province },
      sourceUrl: entry.rss, fetchedAt: new Date().toISOString(),
      unavailable: !!feed.unavailable, message: feed.message || '',
      items: feed.items,
      daily: dailyItems
    };
  }

  async getLocalWeather(clientIp) {
    const cacheKey = `localweather:${clientIp || 'unknown'}`;
    const memory = this._getMemoryCacheEntry(this.feedCache, cacheKey);
    if (memory) return memory;

    // [LOG: 20260801_0828] 실패 결과도 failureCacheTtlMs(1분)로 캐시해 외부 API 반복 호출을 방지한다.
    // 기존엔 성공 결과만 캐시했고 네 가지 실패 경로(geo API 오류, 위치 확인 불가, 날씨 API 오류,
    // 예외)는 캐시 없이 바로 반환했다 — 동일 IP에서 연속 실패가 발생하면 ip-api.com/Open-Meteo를
    // 매 요청마다 재호출했다. ip-api.com 무료 티어는 분당 45회 제한이라 이 경우 rate-limit 오류가
    // 다시 실패를 낳는 음성 피드백이 생길 수 있었다. _fetchCached의 failureCacheTtlMs 처리와 동일하게
    // 모든 경로의 결과를 마지막에 한 번에 캐시한다.
    let result;
    try {
      // 1) IP → 위치 (로컬/사설 IP면 공인IP 자동 감지)
      const isLocal = !clientIp || clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('192.168.') || clientIp.startsWith('10.') || clientIp.startsWith('172.');
      const geoPath = isLocal ? '' : clientIp;
      const geoRes = await this.fetchImpl(
        `http://ip-api.com/json/${geoPath}?fields=status,city,regionName,lat,lon&lang=ko`,
        createWeatherFetchOptions()
      );
      if (!geoRes?.ok) {
        result = { unavailable: true, message: '위치 조회 실패' };
      } else {
        const geo = JSON.parse(await geoRes.text());
        if (geo.status !== 'success' || !geo.lat || !geo.lon) {
          result = { unavailable: true, message: '위치 확인 불가' };
        } else {
          // 2) 현재 날씨 + 5일 예보
          const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=weather_code,temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Seoul&forecast_days=5`;
          const wxRes = await this.fetchImpl(wxUrl, createWeatherFetchOptions());
          if (!wxRes?.ok) {
            result = { unavailable: true, message: '날씨 조회 실패' };
          } else {
            const wx = JSON.parse(await wxRes.text());

            const current = wx?.current || {};
            const d = wx?.daily || {};
            const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const days = (d.time || []).map((t, i) => {
              const date = new Date(t + 'T00:00:00+09:00');
              const offset = Math.round((date - today) / 86400000);
              const mm = String(date.getMonth() + 1).padStart(2, '0');
              const dd = String(date.getDate()).padStart(2, '0');
              const dayName = WEEKDAYS[date.getDay()];
              const suffix = offset === 0 ? ' 오늘' : offset === 1 ? ' 내일' : '';
              return {
                day: `${mm}/${dd}(${dayName})${suffix}`,
                weather: WMO_WEATHER[d.weather_code?.[i]] || '알 수 없음',
                high: d.temperature_2m_max?.[i] != null ? String(Math.round(d.temperature_2m_max[i])) : '',
                low: d.temperature_2m_min?.[i] != null ? String(Math.round(d.temperature_2m_min[i])) : '',
                rainProbability: d.precipitation_probability_max?.[i] != null ? `${d.precipitation_probability_max[i]}%` : ''
              };
            });
            result = {
              city: toKoreanCity(geo.city, geo.regionName),
              region: CITY_KO[geo.regionName] || geo.regionName || '',
              weather: WMO_WEATHER[current.weather_code] ?? '알 수 없음',
              temperature: current.temperature_2m != null ? String(Math.round(current.temperature_2m)) : '',
              days
            };
          }
        }
      }
    } catch (e) {
      result = { unavailable: true, message: getFriendlyLocalWeatherError(e, '위치 날씨') };
    }
    const ttl = result.unavailable ? this.failureCacheTtlMs : this.cacheTtlMs;
    this._setMemoryCacheEntry(this.feedCache, cacheKey, result, ttl);
    return result;
  }

  async getNationalWeatherFeed() {
    const menu = await this._loadMenu('weather', this.weatherMenuPath, parseWeatherMenuXml);
    const regions = await Promise.all(menu.items.map(async entry => {
      const feed = await this._fetchCached(`weather:${entry.door}`, entry.rss, parseWeatherFeedXml);
      return { door: entry.door, title: entry.province, sourceUrl: entry.rss, unavailable: !!feed.unavailable, message: feed.message || '', items: feed.items };
    }));
    const unavailableCount = regions.filter(r => r.unavailable).length;
    return { kind: 'weather', title: '기상 정보 / 전국', level: 'overview', fetchedAt: new Date().toISOString(), summary: `전국 ${regions.length}개 지역${unavailableCount ? ` / 실패 ${unavailableCount}건` : ''}`, regions, unavailableCount };
  }
}

module.exports = RssWeatherService;
