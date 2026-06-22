export function createMenuService(deps) {
  const { apiFetch, compareDoor, state } = deps;

  function isGuestMenuState() {
    return Boolean(state.user?.isGuest ?? true);
  }

  function getMenuNodeKey(node) {
    return String(node?.go || node?.id || '').trim();
  }

  function cloneMenuTreeNode(node) {
    if (!node || typeof node !== 'object') return node;
    return {
      ...node,
      children: Array.isArray(node.children)
        ? node.children.map((child) => cloneMenuTreeNode(child))
        : []
    };
  }

  // [LOG: 20260622_1030] 원래 mnu 파일에 설정된 door 키 매핑을 받아와 반영하도록 개선
  function createEntryMenuNode(doorVal = '1') {
    if (!isGuestMenuState()) {
      return {
        type: 'myinfo',
        go: 'myinfo',
        id: 'myinfo',
        door: doorVal,
        text: '',
        showCode: true,
        accessLevel: 1,
        name: '정보관리',
        header: '',
        footer: 'txt/cmd_menu_footer.txt',
        children: []
      };
    }

    const children = [
      { type: 'signup', go: 'signup', id: 'signup', door: '1', name: '회원가입', children: [] },
      { type: 'login', go: 'login', id: 'signin', door: '2', name: '로그인: 이메일/아이디', children: [] },
      { type: 'oauth-login', go: 'google', id: 'google_login', door: '3', name: '로그인: 구글', children: [] },
      { type: 'oauth-login', go: 'kakao', id: 'kakao_login', door: '4', name: '로그인: 카카오', children: [] },
      { type: 'password-reset', go: 'password', id: 'password', door: '5', name: '비밀번호 찾기', children: [] }
    ];
    return {
      type: 'menu', go: 'log', id: 'log', door: doorVal,
      text: '', showCode: true, accessLevel: 1,
      name: '회원가입 / 로그인', header: '', footer: 'txt/cmd_menu_footer.txt',
      children
    };
  }

  function applyMenuNodeOverrides(node) {
    if (!node || typeof node !== 'object') return node;
    const nextNode = cloneMenuTreeNode(node);
    if (getMenuNodeKey(nextNode) === 'pds') {
      nextNode.name = '자료실';
    }
    nextNode.children = Array.isArray(nextNode.children)
      ? nextNode.children.map((child) => applyMenuNodeOverrides(child))
      : [];
    return nextNode;
  }

  // [LOG: 20260622_1030] 원래 로드된 signup/log 메뉴 노드의 door 단축키 설정을 추출하여 전달하도록 보완
  function applyRuntimeMenuOverrides(tree) {
    if (!tree || typeof tree !== 'object') return tree;
    const clonedTree = applyMenuNodeOverrides(tree);
    if (getMenuNodeKey(clonedTree) !== 'top') return clonedTree;

    let originalDoor = '1';
    const origNode = (clonedTree.children || []).find(c => {
      const k = getMenuNodeKey(c).toLowerCase();
      return k === 'signup' || k === 'entry' || k === 'log';
    });
    if (origNode && origNode.door) {
      originalDoor = String(origNode.door).trim();
    }

    const preserved = (clonedTree.children || []).filter(c => {
      const k = getMenuNodeKey(c).toLowerCase();
      return k !== 'signup' && k !== 'entry' && k !== 'log';
    });
    clonedTree.children = [createEntryMenuNode(originalDoor), ...preserved];
    return clonedTree;
  }

  function indexMenuNodes(node, parentKey, lookup, parents) {
    const key = getMenuNodeKey(node);
    if (key) {
      lookup[key] = node;
      parents[key] = String(parentKey || '').trim();
    }
    for (const child of node?.children || []) {
      indexMenuNodes(child, key, lookup, parents);
    }
  }

  async function loadMenuTree() {
    const guestMenuState = isGuestMenuState();
    if (state.menuTree && state._menuTreeGuestState === guestMenuState) return state.menuTree;
    const tree = applyRuntimeMenuOverrides(await apiFetch('/api/menu'));
    if (!tree) return null;
    const lookup = {}, parents = {};
    indexMenuNodes(tree, '', lookup, parents);
    state.menuTree = tree;
    state.menuLookup = lookup;
    state.menuParents = parents;
    state._menuTreeGuestState = guestMenuState;
    return tree;
  }

  function getMenuNodeByKey(key) {
    return state.menuLookup[String(key || '').trim()] || null;
  }

  function getMenuParentNode(nodeOrKey) {
    const key = typeof nodeOrKey === 'string' ? nodeOrKey : getMenuNodeKey(nodeOrKey);
    const parentKey = state.menuParents[String(key || '').trim()] || '';
    return parentKey ? getMenuNodeByKey(parentKey) : null;
  }

  function getMenuChildren(node) {
    return (node?.children || []).filter(Boolean).slice().sort((a, b) => {
      const diff = compareDoor(a?.door, b?.door);
      return diff !== 0 ? diff : String(a?.name || '').localeCompare(String(b?.name || ''), 'ko');
    });
  }

  function getMenuNodeLabel(node) {
    return String(node?.name || node?.go || node?.id || '메뉴').trim() || '메뉴';
  }

  function getMenuNodeCode(node) {
    const code = String(node?.go || '').trim().toUpperCase();
    return (!code || code === 'TOP' || (node?.type === 'board' && code.length > 10)) ? '' : code;
  }

  function getMenuNodeTitle(node) {
    const label = getMenuNodeLabel(node), code = getMenuNodeCode(node);
    return (!code || label.toUpperCase().includes(`(${code})`)) ? label : `${label} (${code})`;
  }

  function getMenuNodeRoutePath(nodeOrKey) {
    const node = typeof nodeOrKey === 'string' ? getMenuNodeByKey(nodeOrKey) : nodeOrKey;
    if (!node) return typeof nodeOrKey === 'string' && nodeOrKey !== 'top' ? `/${nodeOrKey}` : '/';
    const segments = [];
    let curr = node;
    while (curr) {
      const k = getMenuNodeKey(curr);
      if (k && k !== 'top') segments.unshift(encodeURIComponent(k));
      curr = getMenuParentNode(curr);
    }
    return segments.length ? `/${segments.join('/')}` : '/';
  }

  function getAuthLeafRoutePath(leafKey) {
    const node = getMenuNodeByKey(leafKey);
    if (node) return getMenuNodeRoutePath(node);
    const authBase = getMenuNodeRoutePath('log');
    return `${authBase === '/' ? '/log' : authBase}/${encodeURIComponent(String(leafKey || '').trim())}`;
  }

  function normalizeRoutePath(pathname) {
    const rawPath = String(pathname || '').trim();
    const normalizedPath = rawPath ? `/${rawPath.replace(/^\/+/, '')}` : '/';
    return normalizedPath !== '/' ? normalizedPath.replace(/\/+$/, '') : normalizedPath;
  }

  // [LOG: 20260429_0545] Password recovery bootstrap needs a boolean route check
  // so recovery mode only arms on the actual password-reset path.
  function isPasswordResetRoutePath(pathname) {
    return normalizeRoutePath(pathname) === normalizeRoutePath(getAuthLeafRoutePath('password'));
  }

  function resolveMenuRoute(segments) {
    if (!state.menuTree || !Array.isArray(segments) || !segments.length) return null;
    let curr = state.menuTree, matched = null, count = 0;
    for (const seg of segments) {
      const decoded = decodeURIComponent(String(seg || '').trim());
      const next = (curr?.children || []).find(c => getMenuNodeKey(c) === decoded);
      if (!next) break;
      matched = next; count++; curr = next;
    }
    return matched ? { node: matched, remainingSegments: segments.slice(count).filter(Boolean) } : null;
  }

  function getMenuEntries(nodes) {
    return (nodes || []).filter(n => String(n?.door || '').trim()).map(n => ({
      door: String(n.door).trim(), nodeKey: getMenuNodeKey(n),
      label: n?.showCode ? getMenuNodeTitle(n) : getMenuNodeLabel(n),
      title: getMenuNodeTitle(n), code: getMenuNodeCode(n),
      type: n.type || '', boardId: getMenuNodeKey(n)
    }));
  }

  return {
    getAuthLeafRoutePath, getMenuChildren, getMenuEntries, getMenuNodeByKey,
    getMenuNodeCode, getMenuNodeKey, getMenuNodeLabel, getMenuNodeTitle,
    getMenuParentNode, getMenuNodeRoutePath, isPasswordResetRoutePath, loadMenuTree, resolveMenuRoute
  };
}
