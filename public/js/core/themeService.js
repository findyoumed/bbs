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
    const root = document.documentElement;
    const bgColor = isBlue ? '#0000aa' : '#000000';
    const textShadow = isBlue ? '0 0 2px rgba(255, 255, 255, 0.4)' : 'none';

    root.setAttribute('data-theme', isBlue ? 'blue' : 'dark');
    document.body.classList.toggle('theme-blue', isBlue);

    // [LOG: 20260428_1442] theme-immediate-style 태그 동기화:
    // 초기 로드 시 !important로 고정된 html/body 배경색을 테마 전환 시에도 함께 갱신
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
    const next = state.theme === 'blue' ? 'default' : 'blue';
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
    if (saved === 'default' || saved === 'dark') {
      applyTheme('default');
    } else {
      applyTheme('blue');
    }
  }

  return { applyTheme, toggleTheme, restoreTheme };
}
