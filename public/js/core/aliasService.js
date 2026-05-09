/**
 * aliasService.js
 * [LOG: 20260428_1800] Evolution Mode 17/500: Command Alias & Macro System.
 * - Allows users to define custom short commands for longer ones.
 */

export function createAliasService(deps) {
  const { state, saveAliases } = deps;

  // Initialize aliases if not present
  if (!state.aliases) {
    state.aliases = {};
  }

  /**
   * Expands a command if it matches an alias.
   * Supports basic positional arguments [1], [2], ... or just appending remaining args.
   */
  function expand(input) {
    if (!input) return input;
    
    const parts = input.trim().split(/\s+/);
    const head = parts[0].toUpperCase();
    const args = parts.slice(1);

    const alias = state.aliases[head];
    if (!alias) return input;

    let expanded = alias;

    // Replace [1], [2], ... with arguments
    if (expanded.includes('[')) {
      args.forEach((arg, index) => {
        const placeholder = `[${index + 1}]`;
        if (expanded.includes(placeholder)) {
          expanded = expanded.split(placeholder).join(arg);
        }
      });
      // Replace remaining placeholders with empty string or handle them
      expanded = expanded.replace(/\[\d+\]/g, '');
    } else {
      // Simple replacement: append args if no placeholders
      if (args.length > 0) {
        expanded = `${expanded} ${args.join(' ')}`;
      }
    }

    return expanded.trim();
  }

  function setAlias(name, target) {
    if (!name) return false;
    const key = name.toUpperCase();
    
    // Prevent recursive or dangerous aliases (optional)
    if (key === 'ALIAS') return false;

    state.aliases[key] = target;
    if (saveAliases) saveAliases(state.aliases);
    return true;
  }

  function removeAlias(name) {
    const key = name.toUpperCase();
    if (state.aliases[key]) {
      delete state.aliases[key];
      if (saveAliases) saveAliases(state.aliases);
      return true;
    }
    return false;
  }

  function getAliases() {
    return state.aliases || {};
  }

  function clearAliases() {
    state.aliases = {};
    if (saveAliases) saveAliases(state.aliases);
  }

  return {
    expand,
    setAlias,
    removeAlias,
    getAliases,
    clearAliases
  };
}
