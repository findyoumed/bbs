export function createRoutingUrlBuilder(deps) {
  const {
    getAuthLeafRoutePath,
    getMenuNodeRoutePath,
    showPostList,
    showPostView,
    state
  } = deps;

  function isUnifiedPdsBoardId(boardId) {
    return String(boardId || '').trim() === 'pds';
  }

  async function showUnifiedPdsList(page = 1, fromHistory = false) {
    await showPostList('pds', page, {
      menuPath: 'top',
      menuTitle: '자료실'
    }, fromHistory);
  }

  async function showUnifiedPdsPost(postId, page = 1, fromHistory = false) {
    state.boardMenuPath = 'top';
    state.boardMenuTitle = '자료실';
    await showUnifiedPdsList(page, true);
    await showPostView('pds', postId, fromHistory);
  }

  function buildURLForState() {
    const {
      screen, board, post, page, serviceData, writeMode,
      boardMenuPath, _signupFlow, _chatRoomId, _profileUserId, _currentMemoId, _myInfoMode
    } = state;

    const boardId = board?.boardId || board?.id || '';

    switch (screen) {
      case 'board-select':
        return boardMenuPath && boardMenuPath !== 'top' ? getMenuNodeRoutePath(boardMenuPath) : '/';

      case 'post-list': {
        const uppercaseBoardId = String(boardId || '').toUpperCase();
        const url = isUnifiedPdsBoardId(boardId) ? '/pds' : `/${uppercaseBoardId}`;
        return (page && page > 1) ? `${url}?page=${page}` : url;
      }

      case 'post-view':
        if (isUnifiedPdsBoardId(boardId)) {
          // [LOG: 20260429_0634] Keep unified PDS detail URLs carrying ?page=N so
          // reload/history restores the same list-page context for adjacent navigation.
          const pdsPageQuery = Number(page || 1) > 1 ? `?page=${encodeURIComponent(page)}` : '';
          return `/pds/${post?.id || ''}${pdsPageQuery}`;
        }
        return `/${String(boardId || '').toUpperCase()}/${post?.id || ''}`;

      case 'weather-menu':
        return '/service/weather';

      case 'weather-view': {
        // [LOG: 20260429_0427] Keep later weather pages addressable so reload/history
        // restores the same /service/weather/:region?page=N view.
        const weatherPageQuery = Number(serviceData?.pageNo || 1) > 1 ? `?page=${encodeURIComponent(serviceData?.pageNo || 1)}` : '';
        return `/service/weather/${serviceData?.regionDoor || ''}${weatherPageQuery}`;
      }

      case 'news-menu':
        return '/service/news';

      case 'news-list': {
        const pageQuery = Number(serviceData?.pageNo || 1) > 1 ? `?page=${encodeURIComponent(serviceData?.pageNo || 1)}` : '';
        return `/service/news/${serviceData?.topicDoor || ''}${pageQuery}`;
      }

      case 'news-view': {
        const query = new URLSearchParams();
        const articleNo = String(serviceData?.articleNo || '');
        // [LOG_ID: 20260710_1120] 화면에 노출하는 번호는 클릭 당시 번호(displayNo)를 그대로 쓴다.
        // articleNo(no)는 피드가 백그라운드에서 재구성될 때마다 위치가 바뀔 수 있어 URL 번호가
        // 사용자가 실제로 고른 번호와 달라 보이는 문제가 있었다.
        const displayNo = String(serviceData?.displayNo || articleNo);
        query.set('article', displayNo);
        const articleKey = String(serviceData?.articleKey || serviceData?.article?.articleKey || '').trim();
        const articleLink = String(serviceData?.article?.link || serviceData?.articleLink || '').trim();

        // [LOG_ID: 20260710_1120] 번호가 흔들려도 항상 같은 기사를 가리키도록, 링크에서 유도한
        // 안정적인 키의 앞부분을 URL에 함께 싣는다. no와 달리 이 키는 기사 링크가 바뀌지 않는 한
        // 절대 변하지 않으므로, 세션이 끊긴 뒤 재접속하거나 링크를 공유해도 같은 기사로 복원된다.
        if (articleKey) query.set('key', articleKey.slice(0, 8));

        // [LOG: 20260617_2155] Store news metadata in sessionStorage to keep URL clean
        const topicDoor = serviceData?.topicDoor || '';
        if (topicDoor && articleNo && (articleKey || articleLink)) {
          const sessionKey = `news:metadata:${topicDoor}:${articleNo}`;
          try {
            sessionStorage.setItem(sessionKey, JSON.stringify({ key: articleKey, link: articleLink }));
          } catch (e) {
            console.error('Failed to store news metadata in sessionStorage', e);
          }
        }

        if (Number(serviceData?.pageNo || 1) > 1) query.set('page', String(serviceData?.pageNo || 1));
        return `/service/news/${topicDoor}?${query.toString()}`;
      }

      case 'login':
        return getAuthLeafRoutePath('login');

      case 'password-reset':
        return getAuthLeafRoutePath('password');

      case 'signup': {
        const signupBasePath = getAuthLeafRoutePath('signup');
        const flowMap = {
          'email': '/email',
          'agree': '/agree',
          'oauth-profile': '/profile'
        };
        return `${signupBasePath}${flowMap[_signupFlow] || ''}`;
      }

      case 'chat-lobby':
        return '/chat';

      case 'bio-input':
      case 'bio-result': return getMenuNodeRoutePath('bio');
      case 'fortune-input':
      case 'fortune-result': return getMenuNodeRoutePath('fortune');
      case 'mbti-list': return getMenuNodeRoutePath('mbti');
      case 'mbti-detail': return `${getMenuNodeRoutePath('mbti')}/${encodeURIComponent(state._mbtiCode || '')}`;
      // [LOG_ID: 20260711_1400] 추억의 접속화면 (olddos-bbs txt/door 아트 이식)
      case 'retro-list': return getMenuNodeRoutePath('retro');
      case 'retro-view': return `${getMenuNodeRoutePath('retro')}/${encodeURIComponent(serviceData?.artKey || '')}`;

      case 'chat-room':
        return `/chat/${encodeURIComponent(_chatRoomId || '')}`;

      // [LOG: 20260623_0013] vote/ranking URL (origin/main 포팅)
      // [LOG_ID: 20260714_1200] 투표는 오락실이 아니라 최상위 여론광장(ACRO)에 속하므로
      // /game/vote → /acro 로 이전한다(오락실 하위 중복 항목 제거와 함께).
      case 'vote-list':
        return '/acro';
      case 'vote-detail':
        return `/acro/${encodeURIComponent(serviceData?.voteId || '')}`;
      case 'vote-create':
        return '/acro/create';
      case 'ranking-summary':
        return '/game/ranking';
      case 'ranking-detail':
        return `/game/ranking/${encodeURIComponent(serviceData?.category || '')}`;

      // [LOG_ID: 20260719_1600] 토론의 광장(CONF) URL
      case 'conf-rooms':
        return '/conf';
      case 'conf-room-create':
        return '/conf/open';
      case 'conf-agendas':
        return `/conf/${encodeURIComponent(serviceData?.roomNo || '')}`;
      case 'conf-agenda-new':
        return `/conf/${encodeURIComponent(serviceData?.roomNo || '')}/new`;
      case 'conf-agenda':
        return `/conf/agenda/${encodeURIComponent(serviceData?.agendaId || '')}`;

      case 'help': {
        // [LOG: 20260429_0355] Keep later help pages addressable so reload/history
        // restores the same /help page instead of collapsing to page 1.
        const helpPage = Math.max(1, Number(page || 1));
        return helpPage > 1 ? `/help?page=${encodeURIComponent(helpPage)}` : '/help';
      }

      // [LOG_ID: 20260715_2400] 'policy'에 케이스가 없어 default('/')로 떨어졌다 — TOS/PRIVACY
      // 화면의 URL이 TOP과 똑같이 '/'가 되면서 handleHistoryBack()의 "currentPath !== '/'"
      // 판정이 항상 실패해 상위(P)가 GUIDE로 못 돌아가고 곧장 TOP으로 튀는 원인이 됐다
      // (사용자 보고). help와 동일한 패턴으로 고유 경로를 부여한다.
      case 'policy': {
        const policyPage = Math.max(1, Number(page || 1));
        const policyKind = state.policyKind || 'tos';
        return policyPage > 1 ? `/policy/${policyKind}?page=${encodeURIComponent(policyPage)}` : `/policy/${policyKind}`;
      }

      case 'history':
        return '/history';

      case 'profile':
        return `/profile/${encodeURIComponent(_profileUserId || '')}`;

      // [LOG_ID: 20260716_1400] 하이텔 (1)-24 이용자검색. policy 때(20260715_2400)처럼 고유
      // 경로가 없으면 default('/')로 떨어져 TOP과 URL이 같아지고, 그 탓에 handleHistoryBack()의
      // "currentPath !== '/'" 판정이 깨진다 — 처음부터 전용 경로를 준다.
      case 'member-search':
        return '/member';

      // [LOG_ID: 20260716_1600] 하이텔 (1)-6/8 전체 메뉴 안내. help와 동일하게 페이지도 주소에 싣는다.
      case 'menu-index': {
        const indexPage = Math.max(1, Number(page || 1));
        return indexPage > 1 ? `/index?page=${encodeURIComponent(indexPage)}` : '/index';
      }

      // [LOG_ID: 20260716_2200] 하이텔 (1)-25 계열 이용 현황.
      case 'my-stats':
        return '/account';

      case 'myinfo': {
        const myInfoMode = String(_myInfoMode || 'view').trim().toLowerCase();
        if (myInfoMode === 'nickname') return '/myinfo/nick';
        if (myInfoMode === 'password') return '/myinfo/pw';
        if (myInfoMode === 'delete') return '/myinfo/delete';
        return '/myinfo';
      }

      case 'memo-list': {
        // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) — 상자가 셋이 됐다.
        const box = state._memoBox || 'inbox';
        if (box === 'sent') return '/memo?box=sent';
        if (box === 'archive') return '/memo?box=archive';
        return '/memo';
      }

      case 'memo-view':
        return `/memo/${encodeURIComponent(_currentMemoId || '')}`;

      case 'memo-write':
        return '/memo/write';

      case 'post-write': {
        const uppercaseBoardId = String(boardId || '').toUpperCase();
        if (writeMode === 'edit' && post?.id) {
          return `/${uppercaseBoardId}/${post.id}/edit`;
        }
        // [LOG: 20260429_0621] Keep reply compose addressable so reload/history
        // restores /board/:boardId/:postId/reply into reply mode, not create mode.
        if (writeMode === 'reply' && post?.id) {
          return `/${uppercaseBoardId}/${post.id}/reply`;
        }
        return `/${uppercaseBoardId}/write`;
      }

      case 'attachment-list':
        return `/${String(boardId || '').toUpperCase()}/${post?.id || ''}/files`;

      default:
        return '/';
    }
  }

  return {
    buildURLForState,
    isUnifiedPdsBoardId,
    showUnifiedPdsList,
    showUnifiedPdsPost
  };
}
