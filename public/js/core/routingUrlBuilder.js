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
        const url = isUnifiedPdsBoardId(boardId) ? '/pds' : `/board/${boardId}`;
        return (page && page > 1) ? `${url}?page=${page}` : url;
      }

      case 'post-view':
        if (isUnifiedPdsBoardId(boardId)) {
          // [LOG: 20260429_0634] Keep unified PDS detail URLs carrying ?page=N so
          // reload/history restores the same list-page context for adjacent navigation.
          const pdsPageQuery = Number(page || 1) > 1 ? `?page=${encodeURIComponent(page)}` : '';
          return `/pds/${post?.id || ''}${pdsPageQuery}`;
        }
        return `/board/${boardId}/${post?.id || ''}`;

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
        query.set('article', articleNo);
        const articleKey = String(serviceData?.articleKey || serviceData?.article?.articleKey || '').trim();
        const articleLink = String(serviceData?.article?.link || serviceData?.articleLink || '').trim();
        
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

      case 'chat-room':
        return `/chat/${encodeURIComponent(_chatRoomId || '')}`;

      // [LOG: 20260623_0013] vote/ranking URL (origin/main 포팅)
      case 'vote-list':
        return '/game/vote';
      case 'vote-detail':
        return `/game/vote/${encodeURIComponent(serviceData?.voteId || '')}`;
      case 'vote-create':
        return '/game/vote/create';
      case 'ranking-summary':
        return '/game/ranking';
      case 'ranking-detail':
        return `/game/ranking/${encodeURIComponent(serviceData?.category || '')}`;

      case 'help': {
        // [LOG: 20260429_0355] Keep later help pages addressable so reload/history
        // restores the same /help page instead of collapsing to page 1.
        const helpPage = Math.max(1, Number(page || 1));
        return helpPage > 1 ? `/help?page=${encodeURIComponent(helpPage)}` : '/help';
      }

      case 'history':
        return '/history';

      case 'profile':
        return `/profile/${encodeURIComponent(_profileUserId || '')}`;

      case 'myinfo': {
        const myInfoMode = String(_myInfoMode || 'view').trim().toLowerCase();
        if (myInfoMode === 'nickname') return '/myinfo/nick';
        if (myInfoMode === 'password') return '/myinfo/pw';
        if (myInfoMode === 'delete') return '/myinfo/delete';
        return '/myinfo';
      }

      case 'memo-list':
        return '/memo';

      case 'memo-view':
        return `/memo/${encodeURIComponent(_currentMemoId || '')}`;

      case 'memo-write':
        return '/memo/write';

      case 'post-write':
        if (writeMode === 'edit' && post?.id) {
          return `/board/${boardId}/${post.id}/edit`;
        }
        // [LOG: 20260429_0621] Keep reply compose addressable so reload/history
        // restores /board/:boardId/:postId/reply into reply mode, not create mode.
        if (writeMode === 'reply' && post?.id) {
          return `/board/${boardId}/${post.id}/reply`;
        }
        return `/board/${boardId}/write`;

      case 'attachment-list':
        return `/board/${boardId}/${post?.id || ''}/files`;

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
