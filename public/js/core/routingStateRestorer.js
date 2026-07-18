export function createRoutingStateRestorer(deps) {
  const {
    getMenuNodeByKey,
    getMenuNodeKey,
    loadMenuTree,
    logger,
    resolveMenuRoute,
    state,
    showBoardSelect,
    showChatLobby,
    showChatRoom,
    showHelp,
    showHistory,
    showLogin,
    showMain,
    showMemoList,
    showMemoView,
    showMemoWrite,
    showMyInfo,
    showNewsArticle,
    showNewsList,
    showNewsMenu,
    showPasswordReset,
    showPolicy,
    showAttachmentList,
    showPostList,
    showPostView,
    showPostWrite,
    showMemberSearch,
    showMenuIndex,
    showMyStats,
    showProfile,
    showSignup,
    showUnifiedPdsList,
    showUnifiedPdsPost,
    showWeatherMenu,
    showWeatherView,
    isUnifiedPdsBoardId,
    // [LOG: 20260623_0013] vote/ranking 스크린 복구 액션 (origin/main 포팅)
    showVoteList,
    showVoteDetail,
    showVoteCreate,
    // [LOG_ID: 20260719_1600] 토론의 광장(CONF) 복구 액션
    showConfRooms,
    showConfAgendas,
    showConfAgenda,
    showConfRoomCreate,
    showConfAgendaNew,
    showRanking,
    showRankingDetail,
    showBiorhythm,
    showBiorhythmResult,
    showFortune,
    showFortuneResult,
    showMbti,
    showMbtiDetail,
    showRetroArt,
    showRetroArtView
  } = deps;

  // [LOG: 20260429_0206] Restore board write/edit URLs into the actual post-write
  // screen instead of leaving /board/:boardId/write and /board/:boardId/:postId/edit
  // stuck on list/detail views after a reload or history restore.
  async function restoreBoardWrite(boardId, page) {
    await showPostList(boardId, page, {}, true);
    return await showPostWrite('create');
  }

  async function restoreBoardEdit(boardId, postId) {
    await showPostView(boardId, postId, true);
    return await showPostWrite('edit', state?.post || { id: postId });
  }

  // [LOG: 20260429_0621] Restore /board/:boardId/:postId/reply into the actual
  // reply compose screen instead of collapsing back to post-view on reload/history.
  async function restoreBoardReply(boardId, postId) {
    await showPostView(boardId, postId, true);
    return await showPostWrite('reply', state?.post || { id: postId });
  }

  const routeHandlers = {
    async menu(segments) {
      const menuPath = segments[1] || 'top';
      await showBoardSelect(menuPath, '', true);
    },

    // [LOG: 20260429_0556] Restore /log/* auth entry routes directly so login,
    // password reset, and signup subflows do not depend on menu-tree hydration.
    async log(segments) {
      const leaf = String(segments[1] || '').trim();

      if (!leaf) {
        return await showBoardSelect('log', '', true);
      }

      if (leaf === 'login') {
        return await showLogin(true);
      }

      if (leaf === 'password') {
        return await showPasswordReset(true);
      }

      if (leaf === 'signup') {
        const flowMap = {
          'email': 'email',
          'agree': 'agree',
          'profile': 'oauth-profile'
        };
        const signupFlow = flowMap[String(segments[2] || '').trim()] || 'menu';
        return await showSignup(true, signupFlow);
      }

      return await showBoardSelect('log', '', true);
    },

    async board(segments, query) {
      const [, boardId, postId, sub] = segments;
      const page = parseInt(query.get('page') || '1', 10);

      if (!boardId) {
        return await showMain(true);
      }

      // [LOG_ID: 20260717_1925] URL 상의 대문자 boardId를 본래의 boardId(key)로 복구하여 API 호출 및 컴포넌트에 넘깁니다.
      let resolvedBoardId = boardId;
      if (typeof findBoardByKey === 'function') {
        const found = findBoardByKey(boardId);
        if (found) {
          resolvedBoardId = found.boardId || found.id || boardId;
        }
      }

      if (isUnifiedPdsBoardId(resolvedBoardId)) {
        if (postId && !sub && /^\d+$/.test(postId)) {
          return await showUnifiedPdsPost(postId, page, true);
        }
        if (!postId) {
          return await showUnifiedPdsList(page, true);
        }
      }

      if (postId === 'write') {
        return await restoreBoardWrite(resolvedBoardId, page);
      }
      if (postId && sub === 'edit') {
        return await restoreBoardEdit(resolvedBoardId, postId);
      }
      if (postId && sub === 'reply') {
        return await restoreBoardReply(resolvedBoardId, postId);
      }
      if (postId && sub === 'files') {
        return await showAttachmentList(resolvedBoardId, postId, true);
      }
      if (postId) {
        return await showPostView(resolvedBoardId, postId, true);
      }
      return await showPostList(resolvedBoardId, page, {}, true);
    },

    async service(segments, query) {
      const [, service, param] = segments;
      const articleNo = query.get('article');
      const page = parseInt(query.get('page') || '1', 10);

      if (service === 'weather') {
        if (param) {
          // [LOG: 20260429_0427] Restore /service/weather/:region?page=N into the
          // same weather page instead of dropping later pages on reload/history.
          return await showWeatherView(param, { fromHistory: true, pageNo: page });
        }
        return await showWeatherMenu(true);
      }

      if (service === 'news') {
        if (param) {
          if (articleNo) {
            // [LOG: 20260617_2155] Retrieve news metadata from sessionStorage if missing in URL
            let articleKey = query.get('key') || query.get('articleKey') || '';
            let link = query.get('link') || '';

            if (!articleKey && !link) {
              const sessionKey = `news:metadata:${param}:${articleNo}`;
              try {
                const sessionData = sessionStorage.getItem(sessionKey);
                if (sessionData) {
                  const parsed = JSON.parse(sessionData);
                  articleKey = parsed.key || '';
                  link = parsed.link || '';
                }
              } catch (e) {
                console.error('Failed to load news metadata from sessionStorage', e);
              }
            }

            return await showNewsArticle(param, articleNo, {
              fromHistory: true,
              pageNo: page,
              articleKey,
              link
            });
          }
          return await showNewsList(param, { fromHistory: true, pageNo: page });
        }
        return await showNewsMenu(true);
      }

      await showMain(true);
    },

    async login() {
      await showLogin(true);
    },

    async password() {
      await showPasswordReset(true);
    },

    async signup(segments) {
      const flowMap = {
        'email': 'email',
        'agree': 'agree',
        'profile': 'oauth-profile'
      };
      const signupFlow = flowMap[segments[1]] || 'menu';
      await showSignup(true, signupFlow);
    },

    async chat(segments) {
      if (segments[1]) {
        return await showChatRoom(decodeURIComponent(segments[1]), true);
      }
      await showChatLobby(true);
    },

    async help(_segments, query) {
      // [LOG: 20260429_0355] Restore /help?page=N into the same help page instead of
      // coercing the second argument to boolean and snapping back to page 1.
      const page = Math.max(1, parseInt(query?.get('page') || '1', 10) || 1);
      await showHelp('', { fromHistory: true, page });
    },

    // [LOG_ID: 20260715_2400] /policy/:kind 복원 — help와 동일 패턴. 이 핸들러가 없으면
    // buildURLForState가 새로 부여한 /policy/tos 등을 새로고침/뒤로가기 시 복원할 수 없어
    // showMain()으로 떨어진다.
    async policy(segments, query) {
      const page = Math.max(1, parseInt(query?.get('page') || '1', 10) || 1);
      await showPolicy(segments[1] || 'tos', page, true);
    },

    async history() {
      if (showHistory) {
        return await showHistory(true);
      }
      await showMain(true);
    },

    async profile(segments) {
      const userId = decodeURIComponent(segments[1] || '');
      if (userId) {
        return await showProfile(userId, true);
      }
      await showMain(true);
    },

    // [LOG_ID: 20260716_1400] /member 복원 — 하이텔 (1)-24 이용자검색.
    async member() {
      if (typeof showMemberSearch === 'function') {
        return await showMemberSearch(true);
      }
      await showMain(true);
    },

    // [LOG_ID: 20260716_1600] /index?page=N 복원 — 하이텔 (1)-6/8 전체 메뉴 안내.
    async index(_segments, query) {
      if (typeof showMenuIndex === 'function') {
        const page = Math.max(1, parseInt(query?.get('page') || '1', 10) || 1);
        return await showMenuIndex(page, true);
      }
      await showMain(true);
    },

    // [LOG_ID: 20260716_2200] /account 복원 — 하이텔 (1)-25 계열 이용 현황.
    async account() {
      if (typeof showMyStats === 'function') {
        return await showMyStats(true);
      }
      await showMain(true);
    },

    async myinfo(segments) {
      const modeMap = {
        nick: 'nickname',
        nickname: 'nickname',
        pw: 'password',
        password: 'password',
        delete: 'delete'
      };
      const mode = modeMap[String(segments[1] || '').trim().toLowerCase()] || 'view';
      await showMyInfo(true, { mode });
    },

    async memo(segments, query) {
      // [LOG: 20260429_0515] Restore /memo/write into the actual compose screen
      // instead of collapsing back to the memo list after reload/history restore.
      if (segments[1] === 'write') {
        return await showMemoWrite('');
      }
      if (segments[1]) {
        return await showMemoView(decodeURIComponent(segments[1]), true);
      }
      // [LOG_ID: 20260713_1000] URL 쿼리 파라미터에서 box 복원
      // [LOG_ID: 20260716_1800] 편지보관함(archive) 추가 — 알 수 없는 값은 받은쪽지함으로 떨군다.
      const box = String(query?.get('box') || 'inbox');
      state._memoBox = ['inbox', 'sent', 'archive'].includes(box) ? box : 'inbox';
      await showMemoList(true);
    },
    // [LOG_ID: 20260714_1200] 여론광장(AGORA) 라우트 — 투표/설문. 종전 /game/vote 하위에 있던 것을
    // 최상위로 옮겼다(오락실 하위 중복 항목 제거와 함께). /agora, /agora/create, /agora/:voteId.
    // [LOG_ID: 20260718_2230] go 코드를 "acro"에서 "agora"로 정정(사용자 지적).
    async agora(segments) {
      const [, sub] = segments;
      if (sub === 'create') {
        if (typeof showVoteCreate === 'function') return await showVoteCreate(true);
      } else if (sub) {
        if (typeof showVoteDetail === 'function') return await showVoteDetail(Number(sub), true);
      }
      if (typeof showVoteList === 'function') return await showVoteList(true);
      return await showMain(true);
    },
    // [LOG_ID: 20260719_1600] 토론의 광장(CONF) 라우트 — /conf, /conf/open, /conf/:roomNo,
    // /conf/:roomNo/new, /conf/agenda/:agendaId.
    async conf(segments) {
      const [, sub, param] = segments;
      if (sub === 'open') {
        if (typeof showConfRoomCreate === 'function') return await showConfRoomCreate(true);
      } else if (sub === 'agenda' && param) {
        if (typeof showConfAgenda === 'function') return await showConfAgenda(Number(param), true);
      } else if (sub) {
        if (param === 'new' && typeof showConfAgendaNew === 'function') {
          return await showConfAgendaNew(Number(sub), true);
        }
        if (typeof showConfAgendas === 'function') return await showConfAgendas(Number(sub), true);
      }
      if (typeof showConfRooms === 'function') return await showConfRooms(true);
      return await showMain(true);
    },
    // [LOG: 20260623_0013] game(ranking) 라우트 복구 핸들러 (origin/main 포팅)
    async game(segments) {
      const [, sub, param] = segments;
      // [LOG_ID: 20260623_1630] Restore local GAME utility routes that share /game/* with vote/ranking.
      if (sub === 'bio' || sub === 'biorhythm') {
        if (typeof showBiorhythm === 'function') return await showBiorhythm(true);
      }
      if (sub === 'fortune') {
        if (typeof showFortune === 'function') return await showFortune(true);
      }
      if (sub === 'mbti') {
        if (param && typeof showMbtiDetail === 'function') {
          return await showMbtiDetail(decodeURIComponent(param), true);
        }
        if (typeof showMbti === 'function') return await showMbti(true);
      }
      // [LOG_ID: 20260711_1400] 추억의 접속화면 (olddos-bbs txt/door 아트 이식)
      if (sub === 'retro') {
        if (param && typeof showRetroArtView === 'function') {
          const shown = await showRetroArtView(decodeURIComponent(param), true);
          if (shown) return shown;
        }
        if (typeof showRetroArt === 'function') return await showRetroArt(true);
      }
      if (sub === 'ranking') {
        if (param) {
          if (typeof showRankingDetail === 'function') return await showRankingDetail(param, true);
        }
        if (typeof showRanking === 'function') return await showRanking(true);
      }
      // [LOG: 20260707_1430] /game 단독 딥링크(새로고침)가 초기화면으로 폴백하던 문제 수정.
      // 이 핸들러가 rootSegment 'game'을 선점해 범용 메뉴 복원(showBoardSelect)에 도달하지
      // 못하므로, 하위 경로가 없으면 오락실 메뉴를 직접 복원한다.
      if (!sub) {
        return await showBoardSelect('game', '', true);
      }
      await showMain(true);
    }
  };

  async function restoreStateFromURL() {
    try {
      const segments = window.location.pathname.split('/').filter(Boolean);
      const queryParams = new URLSearchParams(window.location.search);
      const page = parseInt(queryParams.get('page') || '1', 10);

      if (segments.length === 0) {
        return await showMain(true);
      }

      const rootSegment = segments[0];
      if (routeHandlers[rootSegment]) {
        return await routeHandlers[rootSegment](segments, queryParams);
      }

      await loadMenuTree();
      const routeMatch = resolveMenuRoute(segments);

      if (routeMatch) {
        const { node: routeNode, remainingSegments } = routeMatch;
        const routeNodeKey = getMenuNodeKey(routeNode);

        if (routeNode.type === 'menu' && routeNodeKey === 'pds') {
          if (remainingSegments.length === 0) {
            return await showUnifiedPdsList(page, true);
          }
          if (remainingSegments.length === 1 && /^\d+$/.test(remainingSegments[0])) {
            return await showUnifiedPdsPost(remainingSegments[0], page, true);
          }
        }

        if (routeNode.type === 'menu' && remainingSegments.length === 0) {
          return await showBoardSelect(routeNodeKey, '', true);
        }

        if (routeNode.type === 'signup') {
          const flowMap = {
            'email': 'email',
            'agree': 'agree',
            'profile': 'oauth-profile'
          };
          const signupFlow = flowMap[remainingSegments[0]] || 'menu';
          return await showSignup(true, signupFlow);
        }

        if (routeNode.type === 'login' && remainingSegments.length === 0) {
          return await showLogin(true);
        }

        if (routeNode.type === 'password-reset' && remainingSegments.length === 0) {
          return await showPasswordReset(true);
        }
        if (routeNode.type === 'biorhythm' && typeof showBiorhythm === 'function') return await showBiorhythm(true);
        if (routeNode.type === 'fortune' && typeof showFortune === 'function') return await showFortune(true);
        if (routeNode.type === 'mbti' && typeof showMbti === 'function') return remainingSegments[0] && typeof showMbtiDetail === 'function' ? await showMbtiDetail(remainingSegments[0], true) : await showMbti(true);
        // [LOG_ID: 20260711_1400] 추억의 접속화면 (olddos-bbs txt/door 아트 이식)
        if (routeNode.type === 'retro-art' && typeof showRetroArt === 'function') return remainingSegments[0] && typeof showRetroArtView === 'function' && await showRetroArtView(remainingSegments[0], true) ? true : await showRetroArt(true);
        // [LOG_ID: 20260713_1700] 쪽지함(전자우편) 메인 메뉴 진입점 — /memo 직접 접속/새로고침 복원
        if (routeNode.type === 'memo' && typeof showMemoList === 'function') return await showMemoList(true);
      }

      // [LOG_ID: 20260717_1930] /board 접두사 제거 대응: 첫 세그먼트가 게시판 키(대소문자 무관)인 경우 복원
      const firstSeg = segments[0];
      if (firstSeg && typeof findBoardByKey === 'function') {
        const boardObj = findBoardByKey(firstSeg);
        if (boardObj) {
          const postId = segments[1];
          const sub = segments[2];
          const resolvedBoardId = boardObj.boardId || boardObj.id || firstSeg;

          if (postId === 'write') {
            return await restoreBoardWrite(resolvedBoardId, page);
          }
          if (postId && sub === 'edit') {
            return await restoreBoardEdit(resolvedBoardId, postId);
          }
          if (postId && sub === 'reply') {
            return await restoreBoardReply(resolvedBoardId, postId);
          }
          if (postId && sub === 'files') {
            return await showAttachmentList(resolvedBoardId, postId, true);
          }
          if (postId) {
            return await showPostView(resolvedBoardId, postId, true);
          }
          return await showPostList(resolvedBoardId, page, {}, true);
        }
      }

      const menuNode = getMenuNodeByKey(segments[0] || '');
      if (menuNode?.type === 'menu') {
        return await showBoardSelect(getMenuNodeKey(menuNode), '', true);
      }

      await showMain(true);
    } catch (error) {
      if (logger) {
        logger.error('[Routing Error] URL 복원 실패', {
          path: window.location.pathname,
          search: window.location.search,
          error: error.message,
          stack: error.stack
        });
      } else {
        console.error('[Routing Error] URL 복원 실패:', error);
      }
      await showMain(true);
    }
  }

  return {
    restoreStateFromURL
  };
}
