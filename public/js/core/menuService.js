export function createMenuService(deps) {
  const { apiFetch, compareDoor, state } = deps;
  const sortedChildrenCache = new WeakMap();

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
  // [LOG_ID: 20260714_1800] 로그인 시 이 슬롯을 "정보관리(MYINFO)"로 대체하던 분기를 제거했다 —
  // 20260713_1900에 hanulso.mnu에 별도의 정적 "개인영역(MYINFO)" 최상위 항목이 추가되면서
  // 로그인 상태에서 go=myinfo 항목이 두 번(정보관리/개인영역) 노출되는 순수 중복이 됐다
  // (사용자 보고: 로그인 후 메인 메뉴에 MYINFO 항목 2개). 이 함수는 이제 게스트 전용
  // 회원가입/로그인 서브메뉴만 만들고, 로그인 상태의 처리는 applyRuntimeMenuOverrides에서
  // 슬롯 자체를 제거하는 것으로 옮겼다.
  function createEntryMenuNode(doorVal = '1') {
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
  // [LOG_ID: 20260714_1800] 로그인 상태에서는 이 슬롯 자체를 제거한다 — 정적 "개인영역(MYINFO)"
  // 항목이 이미 그 역할을 하므로 대체 삽입 시 중복이 생겼다. 슬롯이 사라져 door 번호에 구멍이
  // 나지 않도록 남은 항목의 door를 door 순으로 재정렬해 1부터 다시 매긴다.
  function applyRuntimeMenuOverrides(tree) {
    if (!tree || typeof tree !== 'object') return tree;
    const clonedTree = applyMenuNodeOverrides(tree);
    if (getMenuNodeKey(clonedTree) !== 'top') return clonedTree;

    const preserved = (clonedTree.children || []).filter(c => {
      const k = getMenuNodeKey(c).toLowerCase();
      return k !== 'signup' && k !== 'entry' && k !== 'log';
    });

    if (isGuestMenuState()) {
      let originalDoor = '1';
      const origNode = (clonedTree.children || []).find(c => {
        const k = getMenuNodeKey(c).toLowerCase();
        return k === 'signup' || k === 'entry' || k === 'log';
      });
      if (origNode && origNode.door) {
        originalDoor = String(origNode.door).trim();
      }
      clonedTree.children = [createEntryMenuNode(originalDoor), ...preserved];
    } else {
      clonedTree.children = preserved
        .slice()
        .sort((a, b) => compareDoor(a?.door, b?.door))
        .map((child, index) => ({ ...child, door: String(index + 1) }));
    }
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

  function hydrateMenuTree(sourceTree) {
    const guestMenuState = isGuestMenuState();
    const tree = applyRuntimeMenuOverrides(sourceTree);
    if (!tree) return null;
    const lookup = {}, parents = {};
    indexMenuNodes(tree, '', lookup, parents);
    state.menuTree = tree;
    state.menuLookup = lookup;
    state.menuParents = parents;
    state._menuTreeGuestState = guestMenuState;
    return tree;
  }

  async function loadMenuTree() {
    const guestMenuState = isGuestMenuState();
    if (state.menuTree && state._menuTreeGuestState === guestMenuState) return state.menuTree;

    // [LOG_ID: 20260805_1400] 세션 캐시를 활용해 재진입 시 /api/menu 대기시간(Latency)을 0ms로 축소
    try {
      if (typeof sessionStorage !== 'undefined') {
        const cached = sessionStorage.getItem('bbs_raw_menu_tree');
        if (cached) {
          const rawTree = JSON.parse(cached);
          if (rawTree && typeof rawTree === 'object') {
            return hydrateMenuTree(rawTree);
          }
        }
      }
    } catch (e) {}

    const rawTree = await apiFetch('/api/menu');
    try {
      if (typeof sessionStorage !== 'undefined' && rawTree) {
        sessionStorage.setItem('bbs_raw_menu_tree', JSON.stringify(rawTree));
      }
    } catch (e) {}

    return hydrateMenuTree(rawTree);
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
    if (!node || typeof node !== 'object') return [];
    const source = Array.isArray(node.children) ? node.children : [];
    let cached = sortedChildrenCache.get(node);
    if (!cached || cached.source !== source) {
      // [LOG_ID: 20260805_0553] Hydrated menu nodes are immutable. Cache their
      // filtered/sorted children, but return a copy so callers cannot mutate it.
      const sorted = source.filter(Boolean).slice().sort((a, b) => {
        const diff = compareDoor(a?.door, b?.door);
        return diff !== 0 ? diff : String(a?.name || '').localeCompare(String(b?.name || ''), 'ko');
      });
      cached = { source, sorted };
      sortedChildrenCache.set(node, cached);
    }
    return cached.sorted.slice();
  }

  function getMenuNodeLabel(node) {
    return String(node?.name || node?.go || node?.id || '메뉴').trim() || '메뉴';
  }

  function getMenuNodeCode(node) {
    const code = String(node?.go || '').trim().toUpperCase();
    // [LOG_ID: 20260714_1300] 종전엔 board 타입에만 "긴 코드 숨김" 예외를 적용해,
    // help/policy 등 다른 타입의 스네이크케이스 go값(예: guide_cmdhelp)이
    // "(GUIDE_CMDHELP)" 식으로 그대로 노출됐다. 타입 제한을 없애 모든 타입에
    // 동일하게 적용한다.
    return (!code || code === 'TOP' || code.length > 10) ? '' : code;
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
    getMenuParentNode, getMenuNodeRoutePath, hydrateMenuTree, isPasswordResetRoutePath, loadMenuTree, resolveMenuRoute
  };
}
