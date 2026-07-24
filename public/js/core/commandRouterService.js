export function createServiceCommandHandler(deps) {
  const {
    setHint,
    showMain,
    showBoardSelect,
    showNewsArticle,
    showWeatherMenu,
    showWeatherView,
    showNewsMenu,
    showNewsList,
    showBiorhythm,
    showBiorhythmResult,
    showFortune,
    showFortuneResult,
    showMbti,
    showMbtiDetail,
    handleMbtiAnswer,
    showBlood,
    showBloodResult,
    showCompat,
    showCompatStep2,
    showCompatResult,
    showTojeong,
    showTojeongResult,
    showRetroArt,
    showRetroArtView,
    // [LOG_ID: 20260720_1358] 오락실 게임 5종 (오목/오델로/숫자야구/영어단어맞추기/숫자판맞추기)
    showOmok,
    omokMove,
    omokResign,
    showOthello,
    othelloMove,
    showBaseball,
    baseballGuess,
    showHangman,
    hangmanGuess,
    hangmanResign,
    showPuzzle15,
    puzzle15Move,
    showScramble,
    scrambleGuess,
    showWp,
    wpGuess,
    showTyping,
    typingGuess,
    showQuiz,
    quizGuess,
    showBattle,
    battleMove,
    battleResign,
    findMember,
    state,
    showToast
  } = deps;

  // [LOG_ID: 20260709_1643] 임시 경고 힌트의 즉각 소거와 잔상 방지를 위한 로컬 힌트 캐시
  let lastCommandServiceHint = '';
  function setServiceHint(text) {
    lastCommandServiceHint = String(text || '');
    setHint(text);
  }

  function getNewsArticleOptions(article, extra = {}) {
    return {
      ...extra,
      articleKey: String(article?.articleKey || extra.articleKey || '').trim(),
      link: String(article?.link || extra.link || '').trim()
    };
  }

  return async function handleServiceCommand({ s, input, cmd, rawCmd, context }) {
    // [LOG_ID: 20260709_1643] 임시 오류/경고 힌트가 노출된 상태에서 사용자가 새 입력을 입력하면 즉시 지워 잔상을 제거한다.
    const isWarningHint = lastCommandServiceHint.includes('불러올 수 없는')
      || lastCommandServiceHint.includes('기사가 없습니다');
    if (isWarningHint) {
      setHint('');
      lastCommandServiceHint = '';
    }

    // [LOG_ID: 20260623_1300] Restore GAME input handling.
    const goGame = async () => { await showBoardSelect('game'); return true; };
    if (s === 'bio-input') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showBiorhythmResult(rawCmd); return true; } return false; }
    if (s === 'bio-result') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showBiorhythm(); return true; } if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showBiorhythmResult(rawCmd); return true; } return false; }
    // [LOG: 20260724_0948] 오늘의 운세 생년월일 8자리 입력 라우팅 정규식 수정
    if (s === 'fortune-input') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showFortuneResult(rawCmd); return true; } return false; }
    if (s === 'fortune-result') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showFortune(); return true; } if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showFortuneResult(rawCmd); return true; } return false; }
    if (['mbti-intro', 'mbti-test', 'mbti-list', 'mbti-detail'].includes(s)) {
      if (cmd === 'T') { await showMain(); return true; }
      if (s === 'mbti-test') {
        if (['P', 'M'].includes(cmd)) return goGame();
        if (typeof handleMbtiAnswer === 'function') {
          return await handleMbtiAnswer(rawCmd);
        }
      }
      if (['P', 'M', 'B'].includes(cmd)) return goGame();
      if (s === 'mbti-detail' && cmd === 'L') { await showMbti(); return true; }
      if (typeof handleMbtiAnswer === 'function') {
        return await handleMbtiAnswer(rawCmd);
      }
      return false;
    }
    // [LOG_ID: 20260719_1600] 천리안 원전 온라인 철학관(BLOOD/SAJU) 재현 — 혈액형 성격진단/궁합/토정비결.
    // [LOG_ID: 20260721_2000] 혈액형 'B'가 P/M/B 내비게이션 단축키와 겹쳐 게임방으로 튕기던 문제 —
    // 혈액형 입력 패턴을 P/M/B 내비게이션 체크보다 먼저 검사해 'B' 입력이 정상적으로 결과로 이어지게 한다.
    if (s === 'blood-input') { if (cmd === 'T') { await showMain(); return true; } if (/^(A|B|O|AB)$/i.test(cmd)) { await showBloodResult(cmd); return true; } if (['P', 'M'].includes(cmd)) return goGame(); return false; }
    // [LOG_ID: 20260725_0830] F로 설명 문단 다음 페이지 이동(전수조사로 발견된 세로 오버플로 수정).
    // B는 이미 "B형 결과 보기"로 쓰이고 있어(아래 A/B/O/AB 분기) 페이지네이션의 "이전"으로는 쓰지 않는다.
    if (s === 'blood-result') { if (cmd === 'T') { await showMain(); return true; } if (cmd === 'F') { const pageNo = Number(state.serviceData?.pageNo || 1); const pageCount = Number(state.serviceData?.pageCount || 1); if (pageNo < pageCount) { await showBloodResult(state.serviceData.bloodCode, false, pageNo + 1); return true; } } if (cmd === 'L') { await showBlood(); return true; } if (/^(A|B|O|AB)$/i.test(cmd)) { await showBloodResult(cmd); return true; } if (['P', 'M'].includes(cmd)) return goGame(); return false; }
    if (s === 'compat-input') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showCompatStep2(rawCmd); return true; } return false; }
    if (s === 'compat-input2') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showCompatResult(rawCmd); return true; } return false; }
    if (s === 'compat-result') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showCompat(); return true; } return false; }
    if (s === 'tojeong-input') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showTojeongResult(rawCmd); return true; } return false; }
    if (s === 'tojeong-result') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showTojeong(); return true; } if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showTojeongResult(rawCmd); return true; } return false; }
    // [LOG_ID: 20260711_1400] 추억의 접속화면 (olddos-bbs txt/door 아트 이식)
    if (s === 'retro-list' || s === 'retro-view') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (s === 'retro-view' && cmd === 'L') { await showRetroArt(); return true; } if (/^\d+$/.test(cmd)) { return await showRetroArtView(cmd); } return false; }
    // [LOG_ID: 20260720_1358] 천리안 원전 6.14.1 "컴퓨터와 게임을" — 오락실 게임 5종.
    // 좌표(H8)·숫자는 반드시 숫자를 포함하므로 단일 문자 내비게이션(T/P/M/B/L)과 충돌하지 않는다.
    // [LOG_ID: 20260720_1600] 천리안 원전 그림179 "/Q : 게임포기" 재현.
    if (s === 'omok-play') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showOmok(); return true; } if (cmd === 'Q') return await omokResign(); const m = cmd.match(/^([A-O])\s*(1[0-5]|[1-9])$/); if (m) return await omokMove(m[1], Number(m[2])); return false; }
    if (s === 'oth-play') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showOthello(); return true; } const m = cmd.match(/^([A-H])\s*([1-8])$/); if (m) return await othelloMove(m[1], Number(m[2])); return false; }
    if (s === 'base-play') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showBaseball(); return true; } if (/^\d{3}$/.test(cmd)) return await baseballGuess(cmd); return false; }
    if (s === 'puzzle15-play') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showPuzzle15(); return true; } if (/^(1[0-5]|[1-9])$/.test(cmd)) return await puzzle15Move(Number(cmd)); return false; }
    // [LOG_ID: 20260720_2020] scramble/wp/typing은 자유 텍스트 추측을 받다 보니 "GO XXX"까지
    // 전부 추측으로 삼켜서 GO 명령으로 못 빠져나가는 함정이 있었다(감사 중 발견 — P/M/B/T/L은
    // 되는데 GO만 안 됨). GO 문법은 추측보다 먼저 걸러 전역 GO 핸들러로 넘긴다.
    if (s === 'scramble-play') {
      const isEnd = state.serviceData?.status === 'end';
      if (isEnd) {
        if (cmd === 'T') { await showMain(); return true; }
        if (['P', 'M', 'B'].includes(cmd)) return goGame();
        if (cmd === 'L') { await showScramble(); return true; }
        await scrambleGuess(rawCmd);
        return true;
      }
      if (cmd === 'T') { await showMain(); return true; }
      if (['P', 'M', 'B'].includes(cmd)) return goGame();
      if (cmd === 'L') { await showScramble(); return true; }
      if (/^GO\s+/i.test(rawCmd)) return false;
      if (rawCmd) return await scrambleGuess(rawCmd);
      return false;
    }
    if (s === 'wp-play') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showWp(); return true; } if (/^GO\s+/i.test(rawCmd)) return false; if (rawCmd) return await wpGuess(rawCmd); return false; }
    if (s === 'typing-play') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showTyping(); return true; } if (/^GO\s+/i.test(rawCmd)) return false; if (input) return await typingGuess(input); return false; }
    if (s === 'quiz-play') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showQuiz(); return true; } if (/^[1-4]$/.test(cmd)) return await quizGuess(cmd); return false; }
    if (s === 'battle-play') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showBattle(); return true; } if (cmd === 'Q') return await battleResign(); const m = cmd.match(/^([A-J])\s*(10|[1-9])$/); if (m) return await battleMove(cmd); return false; }
    // 행맨은 진행 중엔 단일 알파벳이 전부 "추측"이다(T/P/L 포함 — 화면·힌트바에 0:포기만 안내).
    // 게임이 끝난 뒤에야 표준 내비게이션(T/P/M/B/L)이 살아난다.
    if (s === 'hangman-play') {
      const playing = state.serviceData?.kind === 'hangman' && state.serviceData?.status === 'play';
      if (playing) {
        if (cmd === '0') return await hangmanResign();
        if (/^[A-Z]$/.test(cmd)) return await hangmanGuess(cmd);
        return false;
      }
      if (cmd === 'T') { await showMain(); return true; }
      if (['P', 'M', 'B'].includes(cmd)) return goGame();
      if (cmd === 'L') { await showHangman(); return true; }
      return false;
    }
    // [LOG_ID: 20260716_1400] 하이텔 (1)-24 이용자검색 — 아이디/이름으로 회원을 찾아 프로필로 연결.
    // 상위(P)는 이 항목이 속한 GUIDE로 간다(바이오리듬 등이 오락실로 돌아가는 것과 같은 방식).
    if (s === 'member-search') {
      if (cmd === 'T') { await showMain(); return true; }
      if (['P', 'M', 'B'].includes(cmd)) { await showBoardSelect('guide'); return true; }
      // [LOG_ID: 20260718_1400] 검색어는 정규화(대문자화)된 rawCmd가 아니라 **원본 input**을 쓴다.
      // 터미널 파이프라인이 입력을 대문자로 정규화해 "sysop"→"SYSOP"가 되면서, 소문자로 저장된
      // 아이디(getMember는 대소문자 구분)를 못 찾았다(브라우저 실측: "'SYSOP' 이용자를 찾을 수
      // 없습니다"). 닉네임도 대문자화되면 안 되므로 원본 그대로 넘긴다.
      const raw = String(input || '').trim();
      const byId = raw.match(/^BYID\s+(.+)$/i);
      if (byId) return await findMember(byId[1], 'byid');
      const byName = raw.match(/^BYNAME\s+(.+)$/i);
      if (byName) return await findMember(byName[1], 'byname');
      if (raw) return await findMember(raw, 'any');
      return false;
    }

    if (s === 'weather-menu') {
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      if (cmd === 'B' || cmd === 'P' || cmd === 'M') {
        state.history.pop();
        const prev = state.history.pop();
        if (prev) await showBoardSelect(prev.boardMenuPath, prev.boardMenuTitle);
        else await showMain();
        return true;
      }
      if (cmd === 'L') {
        await showWeatherMenu();
        return true;
      }
      if (rawCmd === '0' || rawCmd === '00') {
        await showWeatherView('local');
        return true;
      }
      const regions = state.serviceData?.items || [];
      const region = regions.find((item) => String(item.door) === rawCmd);
      if (region) {
        await showWeatherView(region.door);
        return true;
      }
      return false;
    }

    if (s === 'weather-view') {
      const pageNo = Number(state.serviceData?.pageNo || 1);
      const pageCount = Number(state.serviceData?.pageCount || 1);
      if (cmd === 'P' || cmd === 'M') {
        state.history.pop();
        await showWeatherMenu();
        return true;
      }
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      if (cmd === 'F') {
        if (pageNo < pageCount) {
          await showWeatherView(state.serviceData?.regionDoor, { pageNo: pageNo + 1 });
        }
        return true;
      }
      if (cmd === 'B') {
        if (pageNo > 1) {
          await showWeatherView(state.serviceData?.regionDoor, { pageNo: pageNo - 1 });
        }
        return true;
      }

      const n = parseInt(rawCmd, 10);
      if (!isNaN(n) && n >= 1 && n <= pageCount) {
        await showWeatherView(state.serviceData?.regionDoor, { pageNo: n });
        return true;
      }

      return false;
    }

    if (s === 'news-menu') {
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      if (cmd === 'B' || cmd === 'P' || cmd === 'M') {
        state.history.pop();
        const prev = state.history.pop();
        if (prev) await showBoardSelect(prev.boardMenuPath, prev.boardMenuTitle);
        else await showMain();
        return true;
      }
      if (cmd === 'L') {
        await showNewsMenu();
        return true;
      }
      const topics = state.serviceData?.topics || state.serviceData?.items || [];
      const topic = topics.find((item) => String(item.door) === rawCmd);
      if (topic) {
        await showNewsList(topic.door);
        return true;
      }
      return false;
    }

    if (s === 'news-list') {
      const pageNo = Math.max(1, Number(state.serviceData?.pageNo || 1));
      const pageCount = Math.max(1, Number(state.serviceData?.pageCount || 1));
      if (cmd === 'P' || cmd === 'M') {
        state.history.pop();
        await showNewsMenu();
        return true;
      }
      if (cmd === 'B') {
        if (state.serviceData?.topicDoor && pageNo > 1) {
          await showNewsList(state.serviceData.topicDoor, { pageNo: pageNo - 1 });
        }
        return true;
      }
      if (cmd === 'F') {
        if (state.serviceData?.topicDoor && pageNo < pageCount) {
          await showNewsList(state.serviceData.topicDoor, { pageNo: pageNo + 1 });
        }
        return true;
      }
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      if (cmd === 'L') {
        if (state.serviceData?.topicDoor) {
          await showNewsList(state.serviceData.topicDoor, { pageNo });
        }
        else await showNewsMenu();
        return true;
      }
      const articles = state.serviceData?.items || [];
      const article = articles.find((item, index) => String(item?.no || (index + 1)) === rawCmd);
      if (article && typeof showNewsArticle === 'function') {
        // [LOG: 20260622_1500] 목록에서 직접 클릭한 기사가 불완전(본문 짤림/크롤 실패)이면 조용히 목록으로
        // 되돌아가 "아무 일도 안 일어난" 것처럼 보였다. skipOnIncomplete 로 에러를 받아 안내 토스트를 띄운다.
        try {
          await showNewsArticle(state.serviceData?.topicDoor, article.no || rawCmd, getNewsArticleOptions(article, { listPageNo: pageNo, skipOnIncomplete: true }));
        } catch (err) {
          if (/불완전한 뉴스 기사/.test(err?.message || '')) {
            if (typeof showToast === 'function') {
              showToast('본문 전체를 불러올 수 없는 기사입니다. 다른 기사를 선택해 주세요.', 3000, 'info');
            } else {
              setServiceHint('본문 전체를 불러올 수 없는 기사입니다.');
            }
          } else {
            throw err;
          }
        }
        return true;
      }
      return false;
    }

    if (s === 'news-view') {
      const articles = state.serviceData?.items || [];
      // [LOG_ID: 20260710_1210] articleNo(위치 번호)는 피드 재구성 시점에 따라 items 스냅샷과 어긋날 수
      // 있으므로, 현재 기사 위치는 불변 식별자인 articleKey로 먼저 찾고 번호 매칭은 폴백으로만 쓴다.
      // (번호만으로 찾으면 다른 스냅샷의 엉뚱한 기사를 "현재 위치"로 오인해 A/N이 크게 점프한다.)
      const currentArticleKey = String(state.serviceData?.articleKey || '').trim();
      let currentIndex = currentArticleKey
        ? articles.findIndex((item) => String(item?.articleKey || '').trim() === currentArticleKey)
        : -1;
      if (currentIndex === -1) {
        currentIndex = articles.findIndex((item, index) => String(item?.no || (index + 1)) === String(state.serviceData?.articleNo || ''));
      }
      // [LOG_ID: 20260710_1210] A/N 이동 시 URL에 노출할 순차 번호의 기준값.
      const currentDisplayNo = parseInt(state.serviceData?.displayNo || state.serviceData?.articleNo || '0', 10);
      const pageNo = Math.max(1, Number(state.serviceData?.pageNo || 1));
      const pageCount = Math.max(1, Number(state.serviceData?.pageCount || 1));

      // [LOG_ID: 20260710_1530] PR 갈무리(전체 보기) 모드: [엔터] 입력 시 보던 페이지의
      // 페이지네이션 보기로 복귀한다. (다른 명령은 평소처럼 동작)
      // 주의: 빈 엔터는 commandNormalizer가 news-view에서 'F'(다음쪽)로 정규화하므로 F도 복귀로
      // 처리한다 — 갈무리 모드엔 페이지가 없어 F(다음쪽)가 무의미하다.
      if (state.serviceData?._printView && (cmd === '' || cmd === 'ENTER' || cmd === 'F')) {
        if (state.serviceData?.topicDoor && state.serviceData?.articleNo) {
          await showNewsArticle(state.serviceData.topicDoor, state.serviceData.articleNo, getNewsArticleOptions(state.serviceData?.article, {
            articleKey: state.serviceData?.articleKey,
            pageNo
          }));
        }
        return true;
      }
      if (cmd === 'P' || cmd === 'M') {
        state.history.pop();
        await showNewsList(state.serviceData?.topicDoor, {
          pageNo: Math.max(1, Number(state.serviceData?.listPageNo || 1))
        });
        return true;
      }
      if (cmd === 'B') {
        if (state.serviceData?.topicDoor && state.serviceData?.articleNo && pageNo > 1) {
          await showNewsArticle(state.serviceData.topicDoor, state.serviceData.articleNo, getNewsArticleOptions(state.serviceData?.article, {
            articleKey: state.serviceData?.articleKey,
            pageNo: pageNo - 1
          }));
        }
        return true;
      }
      if (cmd === 'F') {
        if (state.serviceData?.topicDoor && state.serviceData?.articleNo && pageNo < pageCount) {
          await showNewsArticle(state.serviceData.topicDoor, state.serviceData.articleNo, getNewsArticleOptions(state.serviceData?.article, {
            articleKey: state.serviceData?.articleKey,
            pageNo: pageNo + 1
          }));
        }
        return true;
      }
      if (cmd === 'A' || cmd === 'N') {
        if (currentIndex === -1) {
          // [LOG_ID: 20260709_1735] 현재 보고 있는 기사가 페이징 목록에 없는 경우 (페이지 경계 초과 시)
          // 실제 번호를 기준으로 이전/다음 기사를 호출하며, 해당 번호가 위치할 페이지 번호를 동적으로 계산해 제공한다.
          const currentNoNum = parseInt(state.serviceData?.articleNo || '0', 10);
          if (currentNoNum > 0) {
            // A(이전글)는 기사 번호가 작아지는 방향(-1), N(다음글)은 기사 번호가 커지는 방향(+1)
            const targetNoNum = cmd === 'A' ? currentNoNum - 1 : currentNoNum + 1;
            const targetNo = String(targetNoNum);
            const targetListPageNo = Math.ceil(targetNoNum / 15);
            if (state.serviceData?.topicDoor) {
              try {
                await showNewsArticle(state.serviceData.topicDoor, targetNo, {
                  listPageNo: targetListPageNo,
                  skipOnIncomplete: true,
                  // [LOG_ID: 20260710_1210] URL 노출 번호는 사용자 기준 순차 번호로 유지.
                  displayNo: currentDisplayNo > 0 ? String(Math.max(1, cmd === 'A' ? currentDisplayNo - 1 : currentDisplayNo + 1)) : undefined
                });
              } catch (err) {
                // 다음 기사도 짤린 기사 등으로 에러가 발생한 경우, 튕기지 않고 한 번 더 순차 이동 시도 (+-2)
                const targetNo2Num = cmd === 'A' ? currentNoNum - 2 : currentNoNum + 2;
                const targetNo2 = String(targetNo2Num);
                const targetListPageNo2 = Math.ceil(targetNo2Num / 15);
                try {
                  await showNewsArticle(state.serviceData.topicDoor, targetNo2, {
                    listPageNo: targetListPageNo2,
                    skipOnIncomplete: true,
                    displayNo: currentDisplayNo > 0 ? String(Math.max(1, cmd === 'A' ? currentDisplayNo - 2 : currentDisplayNo + 2)) : undefined
                  });
                } catch (err2) {
                  // [LOG_ID: 20260709_1610] +-2 기사도 없는 경우(기사 목록의 끝 경계선 도달) 목록으로 튕기지 않고 안내 문구 표시 후 현재 화면 유지
                  if (typeof showToast === 'function') {
                    showToast(cmd === 'A' ? '이전 기사가 없습니다.' : '다음 기사가 없습니다.', 3000, 'info');
                  } else {
                    setServiceHint(cmd === 'A' ? '이전 기사가 없습니다.' : '다음 기사가 없습니다.');
                  }
                }
              }
            }
          }
          return true;
        }
      }
      if (cmd === 'A') {
        // [LOG_ID: 20260709_1745] A(이전글)=번호 감소. 글 번호(no)와 인덱스는 오름차순(비례)이므로 인덱스를 감소시켜야 번호가 작아진다.
        let skipIdx = currentIndex - 1;
        let success = false;
        while (skipIdx >= 0 && skipIdx >= currentIndex - 5) {
          const prevArticle = articles[skipIdx];
          if (!prevArticle || !state.serviceData?.topicDoor) break;
          const targetNoNum = prevArticle.no || (skipIdx + 1);
          const targetListPageNo = Math.ceil(targetNoNum / 15);
          try {
            await showNewsArticle(state.serviceData.topicDoor, String(targetNoNum), getNewsArticleOptions(prevArticle, {
              listPageNo: targetListPageNo,
              skipOnIncomplete: true,
              // [LOG_ID: 20260710_1210] URL 노출 번호는 스냅샷 위치 번호(no)가 아니라 사용자 기준의
              // 순차 번호(현재 표시 번호 - 이동 칸수)로 넘긴다. 피드 재구성으로 no가 뒤바뀌어도
              // 사용자에게는 8 → A → 7처럼 항상 연속으로 보인다.
              displayNo: currentDisplayNo > 0 ? String(Math.max(1, currentDisplayNo - (currentIndex - skipIdx))) : undefined
            }));
            success = true;
            break;
          } catch (err) {
            // [LOG_ID: 20260709_1745] 로드 실패 시 이전 인덱스(최신 기사)를 계속 탐색하도록 skipIdx를 감소시킴.
            skipIdx--;
            continue;
          }
        }
        if (!success) {
          if (typeof showToast === 'function') {
            showToast('이전 기사가 없습니다.', 3000, 'info');
          } else {
            setServiceHint('이전 기사가 없습니다.');
          }
        }
        return true;
      }
      if (cmd === 'N') {
        // [LOG_ID: 20260709_1745] N(다음글)=번호 증가. 글 번호(no)와 인덱스는 오름차순(비례)이므로 인덱스를 증가시켜야 번호가 커진다.
        let skipIdx = currentIndex + 1;
        let success = false;
        while (skipIdx < articles.length && skipIdx <= currentIndex + 5) {
          const nextArticle = articles[skipIdx];
          if (!nextArticle || !state.serviceData?.topicDoor) break;
          const targetNoNum = nextArticle.no || (skipIdx + 1);
          const targetListPageNo = Math.ceil(targetNoNum / 15);
          try {
            await showNewsArticle(state.serviceData.topicDoor, String(targetNoNum), getNewsArticleOptions(nextArticle, {
              listPageNo: targetListPageNo,
              skipOnIncomplete: true,
              // [LOG_ID: 20260710_1210] URL 노출 번호는 사용자 기준 순차 번호(현재 표시 번호 + 이동 칸수).
              displayNo: currentDisplayNo > 0 ? String(currentDisplayNo + (skipIdx - currentIndex)) : undefined
            }));
            success = true;
            break;
          } catch (err) {
            // [LOG_ID: 20260709_1745] 로드 실패 시 다음 인덱스(과거 기사)를 계속 탐색하도록 skipIdx를 증가시킴.
            skipIdx++;
            continue;
          }
        }
        if (!success) {
          if (typeof showToast === 'function') {
            showToast('다음 기사가 없습니다.', 3000, 'info');
          } else {
            setServiceHint('다음 기사가 없습니다.');
          }
        }
        return true;
      }
      if (cmd === 'T') {
        await showMain();
        return true;
      }
      if (cmd === 'L') {
        if (state.serviceData?.topicDoor && state.serviceData?.articleNo) {
          await showNewsArticle(state.serviceData.topicDoor, state.serviceData.articleNo, getNewsArticleOptions(state.serviceData?.article, {
            articleKey: state.serviceData?.articleKey,
            pageNo,
            forceReload: true
          }));
        } else if (state.serviceData?.topicDoor) {
          await showNewsList(state.serviceData.topicDoor, {
            pageNo: Math.max(1, Number(state.serviceData?.listPageNo || 1))
          });
        } else {
          await showNewsMenu();
        }
        return true;
      }
      if (cmd === 'PR') {
        const art = state.serviceData?.article;
        if (art) {
          const title = String(art.title || '').trim();
          const body = String(art.body || art.description || '').trim();
          const source = art.sourceTitle ? `출처: ${art.sourceTitle}` : '';
          const link = art.link ? `원문: ${art.link}` : '';
          const text = [title, '', body, '', source, link].filter((l, i) => i < 2 || l).join('\n');
          // [LOG_ID: 20260710_1530] 클립보드 복사는 사용자 제스처 직후에 먼저 실행(transient activation 유지),
          // 토스트는 화면 전환이 끝난 뒤에 띄운다(전환 시 토스트 즉시 소거 로직에 지워지지 않도록).
          let copied = false;
          try {
            await navigator.clipboard.writeText(text);
            copied = true;
          } catch {
            copied = false;
          }

          // [LOG_ID: 20260710_1530] PC통신 갈무리 스타일: 본문 전체를 페이지 분할 없이 한 화면에 출력.
          // [엔터]를 누르면 보던 페이지의 페이지네이션 보기로 복귀한다(위 _printView 핸들러).
          if (!state.serviceData?._printView && state.serviceData?.topicDoor && state.serviceData?.articleNo) {
            await showNewsArticle(state.serviceData.topicDoor, state.serviceData.articleNo, getNewsArticleOptions(art, {
              articleKey: state.serviceData?.articleKey,
              pageNo,
              fullView: true
            }));
          }

          // [LOG_ID: 20260710_1203] 성공 토스트는 터미널 본문 자체에 텍스트로 노출되므로 생략한다. 실패 시에만 에러 피드백을 출력한다.
          if (!copied) {
            if (typeof showToast === 'function') {
              showToast('복사 실패: 브라우저 권한을 확인하세요.', 3000, 'error');
            } else {
              setHint('복사 실패: 브라우저 권한을 확인하세요.');
            }
          }
        }
        return true;
      }

      const n = parseInt(rawCmd, 10);
      if (!isNaN(n) && n >= 1 && n <= pageCount) {
        await showNewsArticle(state.serviceData?.topicDoor, state.serviceData?.articleNo, getNewsArticleOptions(state.serviceData?.article, {
          articleKey: state.serviceData?.articleKey,
          pageNo: n
        }));
        return true;
      }

      // [LOG: 20260622_1530] 기사 보기 화면에서 본문 페이지 범위를 벗어난 숫자는 "다른 기사 번호"로 간주해 그 기사로 이동.
      // 기존에는 무시되어(아무 동작 없음) "왜 안 되냐"는 혼란을 줬다. 라이브 피드 어긋남으로 엉뚱한 기사가
      // 열리는 것을 막기 위해, 현재 로드된 목록(items) 안에 있는 기사만 key/link 기반으로 안정 이동한다.
      if (!isNaN(n) && n >= 1) {
        const targetArticle = articles.find((item, index) => String(item?.no || (index + 1)) === rawCmd);
        if (targetArticle && state.serviceData?.topicDoor) {
          try {
            await showNewsArticle(state.serviceData.topicDoor, targetArticle.no || rawCmd, getNewsArticleOptions(targetArticle, {
              listPageNo: state.serviceData?.listPageNo || 1,
              skipOnIncomplete: true
            }));
          } catch (err) {
            if (/불완전한 뉴스 기사/.test(err?.message || '')) {
              if (typeof showToast === 'function') {
                showToast('본문 전체를 불러올 수 없는 기사입니다. 다른 기사를 선택해 주세요.', 3000, 'info');
              } else {
                setHint('본문 전체를 불러올 수 없는 기사입니다.');
              }
            } else {
              throw err;
            }
          }
          return true;
        }
        // 현재 목록에 없는 번호는 직접 이동 불가 → 목록으로 돌아가 선택하거나 N/A로 이동하도록 안내
        if (typeof showToast === 'function') {
          showToast('현재 목록에 없는 기사 번호입니다. P로 목록에 돌아가거나 N/A로 이동하세요.', 3000, 'info');
        } else {
          setHint('현재 목록에 없는 기사 번호입니다. P(목록) 또는 N/A로 이동하세요.');
        }
        return true;
      }

      return false;
    }

    return false;
  };
}
