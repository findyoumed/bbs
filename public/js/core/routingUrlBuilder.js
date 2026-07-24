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
        const lowercaseBoardId = String(boardId || '').toLowerCase();
        const url = isUnifiedPdsBoardId(boardId) ? '/pds' : `/${lowercaseBoardId}`;
        return (page && page > 1) ? `${url}?page=${page}` : url;
      }

      case 'post-view': {
        const postNum = (post?.localId !== undefined && post?.localId !== null) ? post.localId : (post?.id || '');
        if (isUnifiedPdsBoardId(boardId)) {
          // [LOG: 20260429_0634] Keep unified PDS detail URLs carrying ?page=N so
          // reload/history restores the same list-page context for adjacent navigation.
          const pdsPageQuery = Number(page || 1) > 1 ? `?page=${encodeURIComponent(page)}` : '';
          return `/pds/${postNum}${pdsPageQuery}`;
        }
        return `/${String(boardId || '').toLowerCase()}/${postNum}`;
      }

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

      // [LOG_ID: 20260723_1049] 오락실 기능들의 URL 스키마를 /game/* 네임스페이스 하위에 명시적으로 고정
      case 'bio-input':
      case 'bio-result': return '/game/bio';
      case 'fortune-input':
      case 'fortune-result': return '/game/fortune';
      case 'mbti-intro':
      case 'mbti-test':
      case 'mbti-list': return '/game/mbti';
      case 'mbti-detail': return `/game/mbti/${encodeURIComponent(state._mbtiCode || '')}`;
      // [LOG_ID: 20260719_1600] 천리안 원전 온라인 철학관(BLOOD/SAJU) 재현
      case 'blood-input':
      case 'blood-result': return '/game/blood';
      case 'compat-input':
      case 'compat-input2':
      case 'compat-result': return '/game/compat';
      case 'tojeong-input':
      case 'tojeong-result': return '/game/tojeong';
      // [LOG_ID: 20260720_1358] 오락실 게임 5종 — 진행 상태는 URL로 복원하지 않는다(새로고침=새 게임).
      case 'omok-play': return getMenuNodeRoutePath('omok');
      case 'oth-play': return getMenuNodeRoutePath('oth');
      case 'base-play': return getMenuNodeRoutePath('base');
      case 'hangman-play': return getMenuNodeRoutePath('hangman');
      case 'puzzle15-play': return getMenuNodeRoutePath('16p');
      case 'scramble-play': return getMenuNodeRoutePath('scramble');
      case 'wp-play': return getMenuNodeRoutePath('wp');
      case 'typing-play': return getMenuNodeRoutePath('typing');
      case 'quiz-play': return getMenuNodeRoutePath('quiz');
      case 'battle-play': return getMenuNodeRoutePath('battle');
      // [LOG_ID: 20260711_1400] 추억의 접속화면 (olddos-bbs txt/door 아트 이식)
      case 'retro-list': return getMenuNodeRoutePath('retro');
      case 'retro-view': return `${getMenuNodeRoutePath('retro')}/${encodeURIComponent(serviceData?.artKey || '')}`;

      case 'chat-room':
        return `/chat/${encodeURIComponent(_chatRoomId || '')}`;

      // [LOG: 20260623_0013] vote URL (origin/main 포팅)
      // [LOG_ID: 20260714_1200] 투표는 오락실이 아니라 최상위 여론광장(AGORA)에 속하므로
      // /game/vote → /acro 로 이전한다(오락실 하위 중복 항목 제거와 함께).
      // [LOG_ID: 20260718_2230] go 코드를 "acro"에서 "agora"로 정정(사용자 지적) — /acro → /agora.
      case 'vote-list':
        return '/agora';
      case 'vote-detail':
        return `/agora/${encodeURIComponent(serviceData?.voteId || '')}`;
      case 'vote-create':
        return '/agora/create';

      // [LOG_ID: 20260719_1600] 토론의 광장(CONF) URL
      // [LOG_ID: 20260718_2300] go 코드를 "conf"에서 "forum"으로 정정(사용자 지적) — /conf → /forum.
      case 'conf-rooms':
        return '/forum';
      case 'conf-room-create':
        return '/forum/open';
      case 'conf-agendas':
        return `/forum/${encodeURIComponent(serviceData?.roomNo || '')}`;
      case 'conf-agenda-new':
        return `/forum/${encodeURIComponent(serviceData?.roomNo || '')}/new`;
      case 'conf-agenda':
        return `/forum/agenda/${encodeURIComponent(serviceData?.agendaId || '')}`;

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

      // [LOG_ID: 20260720_2300] 건의하기(시삽 이메일 발송).
      case 'contact-sysop':
        return getMenuNodeRoutePath('tosysop');

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
        const lowercaseBoardId = String(boardId || '').toLowerCase();
        const editPostId = post?.localId ?? post?.id;
        // [LOG_ID: 20260721_2310] local_id 이전 후 GET /posts/:postId가 local_id로 조회하는데
        // (id != local_id인 실서비스 게시판 전부) 여기만 여전히 전역 id로 URL을 만들어, 수정/답글
        // 작성 화면에서 새로고침하거나 뒤로가기/링크 공유로 그 URL을 다시 열면 엉뚱한 글이 뜨거나
        // 404가 나는 상태였다.
        if (writeMode === 'edit' && editPostId) {
          return `/${lowercaseBoardId}/${editPostId}/edit`;
        }
        // [LOG: 20260429_0621] Keep reply compose addressable so reload/history
        // restores /board/:boardId/:postId/reply into reply mode, not create mode.
        if (writeMode === 'reply' && editPostId) {
          return `/${lowercaseBoardId}/${editPostId}/reply`;
        }
        return `/${lowercaseBoardId}/write`;
      }

      case 'attachment-list':
        return `/${String(boardId || '').toLowerCase()}/${(post?.localId ?? post?.id) || ''}/files`;

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
