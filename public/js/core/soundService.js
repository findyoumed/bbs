/**
 * soundService.js
 * [LOG: 20260426_1308] 사용자 요청에 따른 모든 효과음 기능 제거
 */

export function createSoundService(deps) {
  return {
    playBeep: () => {},
    playError: () => {},
    playNotification: () => {},
    playTransition: () => {},
    toggleMute: () => true
  };
}
