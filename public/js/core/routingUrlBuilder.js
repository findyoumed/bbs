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
        query.set('article', String(serviceData?.articleNo || ''));
        const articleKey = String(serviceData?.articleKey || serviceData?.article?.articleKey || '').trim();
        if (articleKey) query.set('key', articleKey);
        if (Number(serviceData?.pageNo || 1) > 1) query.set('page', String(serviceData?.pageNo || 1));
        return `/service/news/${serviceData?.topicDoor || ''}?${query.toString()}`;
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

      case 'chat-room':
        return `/chat/${encodeURIComponent(_chatRoomId || '')}`;

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
