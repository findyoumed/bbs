/**
 * [LOG: 20260424_1755] 테마 서비스 (Theme Service)
 * - 배경색 전환 및 로컬 스토리지 연동 관리
 * [LOG: 20260425_2310] data-theme 기반으로 변경 (Evolution Mode)
 */
export function createThemeService(deps) {
  const { state, setTheme } = deps;

  function applyTheme(themeName) {
    state.theme = themeName;
    const isBlue = state.theme === 'blue';
    const isNownuri = state.theme === 'nownuri';
    const root = document.documentElement;
    
    // [LOG_ID: 20260713_1155] 테마별 배경색 지정 (기본 블랙 / 하이텔 블루 / 나우누리 시안)
    const bgColor = isNownuri ? '#00aaaa' : (isBlue ? '#0000aa' : '#000000');
    const textShadow = 'none';

    root.setAttribute('data-theme', isNownuri ? 'nownuri' : (isBlue ? 'blue' : 'dark'));
    document.body.classList.toggle('theme-blue', isBlue);
    document.body.classList.toggle('theme-nownuri', isNownuri);

    // [LOG: 20260428_1442] theme-immediate-style 태그 동기화:
    const immediateStyle = document.getElementById('theme-immediate-style');
    if (immediateStyle) {
      immediateStyle.textContent =
        ':root { --bgcolor: ' + bgColor + ' !important; --text-shadow: ' + textShadow + ' !important; --color: #ffffff !important; }' +
        'html, body { background-color: ' + bgColor + ' !important; background: ' + bgColor + ' !important; color: #ffffff !important; text-shadow: ' + textShadow + ' !important; transition: none !important; }' +
        '.app-shell, #terminal-wrapper, #terminal-container, #terminal-screen, .ansi-screen { background-color: transparent !important; background: transparent !important; border: none !important; box-shadow: none !important; transition: none !important; }';
    }

    root.style.setProperty('--bgcolor', bgColor);
    root.style.setProperty('--color', '#ffffff');
  }

  function toggleTheme() {
    // [LOG_ID: 20260724_2200] 사용자 요청 — "바탕색에서 이 색상은 빼줘"(나우누리 청록/시안
    // 배경을 C 순환에서 제외). 나우누리 테마 자체(메뉴 번호 처리 등)는 여전히 SET THEME
    // NOWNURI로 명시적으로 쓸 수 있어 완전히 제거하지는 않는다 — 배경색 토글(C)의 순환
    // 목록에서만 뺀다. 기본 -> 블루 -> 기본 2단 순환으로 축소.
    let next = 'default';
    if (state.theme === 'default' || state.theme === 'dark') {
      next = 'blue';
    } else {
      next = 'default';
    }

    applyTheme(next);
    if (typeof setTheme === 'function') {
      setTheme(next);
    } else {
      try {
        localStorage.setItem('bbs_theme', next);
      } catch (e) { }
    }
  }

  function restoreTheme() {
    const saved = state.theme;
    if (saved === 'nownuri') {
      applyTheme('nownuri');
    } else if (saved === 'blue') {
      applyTheme('blue');
    } else {
      applyTheme('default');
    }
  }

  return { applyTheme, toggleTheme, restoreTheme };
}
