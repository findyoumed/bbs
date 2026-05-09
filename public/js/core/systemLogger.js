/**
 * systemLogger.js
 * [LOG: 20260428_0900] Evolution Mode 14: Client-side system logging and diagnostics.
 * [LOG: 20260428_1900] Evolution Mode 19: Enhanced system logger with environment diagnostics and fatal level.
 */

export function createSystemLogger(options = {}) {
  const maxEntries = options.maxEntries || 200;
  let logs = [];
  const listeners = new Set();
  const state = options.state || {};

  function log(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      data,
      id: Math.random().toString(36).substring(2, 9),
      workspaceId: state.currentWorkspaceId || null
    };

    logs.push(entry);
    if (logs.length > maxEntries) {
      logs.shift();
    }

    listeners.forEach(callback => callback(entry, logs));
    
    // Also log to console for developer convenience
    const consoleMethod = level.toLowerCase() === 'error' || level.toLowerCase() === 'fatal' ? 'error' : 
                          level.toLowerCase() === 'warn' ? 'warn' : 'log';
    if (data) {
      console[consoleMethod](`[${entry.level}] ${message}`, data);
    } else {
      console[consoleMethod](`[${entry.level}] ${message}`);
    }
  }

  function logSystemInfo() {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio,
      memory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        rtt: navigator.connection.rtt,
        downlink: navigator.connection.downlink
      } : 'unknown'
    };
    log('INFO', 'System Environment Info Captured', info);
    return info;
  }

  return {
    info: (msg, data) => log('INFO', msg, data),
    warn: (msg, data) => log('WARN', msg, data),
    error: (msg, data) => log('ERROR', msg, data),
    fatal: (msg, data) => log('FATAL', msg, data),
    cmd: (msg, data) => log('CMD', msg, data),
    
    logSystemInfo,
    getLogs: () => [...logs],
    clear: () => {
      logs = [];
      log('INFO', 'System log cleared.');
    },
    
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    
    getFormattedLogs: () => {
      return logs.map(l => {
        const time = new Date(l.timestamp).toLocaleTimeString();
        const ws = l.workspaceId ? `[WS:${l.workspaceId}] ` : '';
        return `[${time}] ${ws}[${l.level.padEnd(5)}] ${l.message}`;
      }).join('\n');
    }
  };
}
