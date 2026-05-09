import { getMenuNodeKey, indexMenuNodes, applyRuntimeMenuOverrides } from './menuTreeUtils.js';

export function createMenuTreeHelpers(deps) {
  const { apiFetch, compareDoor, state } = deps;

  async function loadMenuTree() {
    if (state.menuTree) return state.menuTree;
    const tree = applyRuntimeMenuOverrides(await apiFetch('/api/menu'));
    if (!tree) { console.error('메뉴 트리 로드 실패'); return null; }
    const lookup = {}, parents = {};
    indexMenuNodes(tree, '', lookup, parents);
    state.menuTree = tree; state.menuLookup = lookup; state.menuParents = parents;
    return tree;
  }

  const getMenuNodeByKey = (key) => state.menuLookup[String(key || '').trim()] || null;
  const getMenuParentNode = (nodeOrKey) => {
    const key = typeof nodeOrKey === 'string' ? nodeOrKey : getMenuNodeKey(nodeOrKey);
    const parentKey = state.menuParents[String(key || '').trim()] || '';
    return parentKey ? getMenuNodeByKey(parentKey) : null;
  };

  const getMenuChildren = (node) => (node?.children || []).filter(Boolean).slice().sort((a, b) => {
    const diff = compareDoor(a?.door, b?.door);
    return diff !== 0 ? diff : String(a?.name || '').localeCompare(String(b?.name || ''), 'ko');
  });

  const getMenuNodeLabel = (node) => String(node?.name || node?.go || node?.id || '메뉴').trim();
  const getMenuNodeCode = (node) => {
    const code = String(node?.go || '').trim().toUpperCase();
    return (!code || code === 'TOP' || (node?.type === 'board' && code.length > 10)) ? '' : code;
  };
  const getMenuNodeTitle = (node) => {
    const label = getMenuNodeLabel(node), code = getMenuNodeCode(node);
    return (!code || label.toUpperCase().includes(`(${code})`)) ? label : `${label} (${code})`;
  };

  const getMenuNodeRoutePath = (nodeOrKey) => {
    const node = typeof nodeOrKey === 'string' ? getMenuNodeByKey(nodeOrKey) : nodeOrKey;
    if (!node) return typeof nodeOrKey === 'string' && nodeOrKey !== 'top' ? `/${nodeOrKey}` : '/';
    const segments = []; let curr = node;
    while (curr) {
      const k = getMenuNodeKey(curr);
      if (k && k !== 'top') segments.unshift(encodeURIComponent(k));
      curr = getMenuParentNode(curr);
    }
    return segments.length ? `/${segments.join('/')}` : '/';
  };

  return {
    getAuthLeafRoutePath: (leaf) => {
      const node = getMenuNodeByKey(leaf); if (node) return getMenuNodeRoutePath(node);
      const base = getMenuNodeRoutePath('log'); return `${base === '/' ? '/log' : base}/${encodeURIComponent(String(leaf || '').trim())}`;
    },
    getMenuChildren, getMenuNodeByKey, getMenuNodeCode, getMenuNodeKey, getMenuNodeLabel, getMenuNodeTitle,
    getMenuParentNode, getMenuNodeRoutePath, loadMenuTree,
    resolveMenuRoute: (segs) => {
      if (!state.menuTree || !Array.isArray(segs) || !segs.length) return null;
      let curr = state.menuTree, matched = null, count = 0;
      for (const seg of segs) {
        const dec = decodeURIComponent(String(seg || '').trim());
        const next = (curr?.children || []).find(c => getMenuNodeKey(c) === dec);
        if (!next) break;
        matched = next; count++; curr = next;
      }
      return matched ? { node: matched, remainingSegments: segs.slice(count).filter(Boolean) } : null;
    },
    getMenuEntries: (nodes) => (nodes || []).filter(n => String(n?.door || '').trim()).map(n => ({
      door: String(n.door).trim(), nodeKey: getMenuNodeKey(n), label: n?.showCode ? getMenuNodeTitle(n) : getMenuNodeLabel(n),
      title: getMenuNodeTitle(n), code: getMenuNodeCode(n), type: n.type || '', boardId: getMenuNodeKey(n)
    }))
  };
}
