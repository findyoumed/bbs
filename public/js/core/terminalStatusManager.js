/**
 * terminalStatusManager.js
 * [LOG: 20260428_2000] Evolution Mode: Re-building Terminal HUD dashboard.
 * [LOG: 20260428_2015] HUD: Integrated VFS counter, latency, clock, and workspace tabs.
 */

export function createTerminalStatusManager(deps) {
  const { state } = deps;
  let _container = null;
  let _timer = null;

  function init() {
    _container = document.getElementById('hud-container');
    if (!_container) return;

    _render();

    // Refresh clock and state periodically
    if (_timer) clearInterval(_timer);
    _timer = setInterval(() => update(), 1000);
  }

  function update() {
    if (!_container) return;
    _render();
  }

  function setLatency(ms) {
    state.latency = ms;
    update();
  }

  function _render() {
    if (!_container) return;
    _container.style.display = 'none';
    _container.innerHTML = ''; // Hide HUD content
  }

  return {
    init,
    update,
    setLatency
  };
}
