import { createServiceUiUtils } from './serviceUiUtils.js';
import { createNewsScreens } from './newsScreens.js';
import { createWeatherScreens } from './weatherScreens.js';
import { createSystemScreens } from './systemScreens.js';

/**
 * [LOG: 20260426_0110] ServiceScreens 리팩토링 및 모듈 분리
 * - News 및 Weather 로직을 각각 전용 스크린 모듈로 분리
 * - 공통 UI 유틸리티(측정, 핫스팟)를 serviceUiUtils로 추출하여 코드 중복 제거 및 가독성 향상
 */
export function createServiceScreens(deps) {
  const { displayWidth, renderScreenSequential } = deps;
  const uiUtils = createServiceUiUtils({ displayWidth });

  const newsScreens = createNewsScreens({
    ...deps,
    ...uiUtils,
    renderScreenSequential
  });

  const weatherScreens = createWeatherScreens({
    ...deps,
    ...uiUtils,
    renderScreenSequential
  });

  const systemScreens = createSystemScreens({
    ...deps,
    ...uiUtils,
    renderScreenSequential
  });

  return {
    ...newsScreens,
    ...weatherScreens,
    ...systemScreens
  };
}
