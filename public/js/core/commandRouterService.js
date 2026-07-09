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
    state,
    showToast
  } = deps;

  function getNewsArticleOptions(article, extra = {}) {
    return {
      ...extra,
      articleKey: String(article?.articleKey || extra.articleKey || '').trim(),
      link: String(article?.link || extra.link || '').trim()
    };
  }

  return async function handleServiceCommand({ s, cmd, rawCmd, context }) {
    // [LOG_ID: 20260623_1300] Restore GAME input handling.
    const goGame = async () => { await showBoardSelect('game'); return true; };
    if (s === 'bio-input') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showBiorhythmResult(rawCmd); return true; } return false; }
    if (s === 'bio-result') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showBiorhythm(); return true; } if (/^\d{8}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showBiorhythmResult(rawCmd); return true; } return false; }
    if (s === 'fortune-input') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (/^\d{4}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showFortuneResult(rawCmd); return true; } return false; }
    if (s === 'fortune-result') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (cmd === 'L') { await showFortune(); return true; } if (/^\d{4}$/.test(String(rawCmd).replace(/\D/g, ''))) { await showFortuneResult(rawCmd); return true; } return false; }
    if (s === 'mbti-list' || s === 'mbti-detail') { if (cmd === 'T') { await showMain(); return true; } if (['P', 'M', 'B'].includes(cmd)) return goGame(); if (s === 'mbti-detail' && cmd === 'L') { await showMbti(); return true; } if (/^(1[0-6]|[1-9]|[EI][SN][TF][JP])$/.test(cmd)) { await showMbtiDetail(cmd); return true; } return false; }
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
              setHint('본문 전체를 불러올 수 없는 기사입니다.');
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
      const currentIndex = articles.findIndex((item, index) => String(item?.no || (index + 1)) === String(state.serviceData?.articleNo || ''));
      const pageNo = Math.max(1, Number(state.serviceData?.pageNo || 1));
      const pageCount = Math.max(1, Number(state.serviceData?.pageCount || 1));
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
          // [LOG_ID: 20260709_1310] 현재 보고 있는 기사가 페이징 목록에 없는 경우 (페이지 경계 초과 시)
          // 0번 인덱스(skipIdx = 0)로 오작동 점프하는 것을 방지하고 실제 번호를 기준으로 이전/다음 기사를 호출한다.
          const currentNoNum = parseInt(state.serviceData?.articleNo || '0', 10);
          if (currentNoNum > 0) {
            // A(이전글)는 기사 번호가 작아지는 방향(-1), N(다음글)은 기사 번호가 커지는 방향(+1)
            const targetNo = String(cmd === 'A' ? currentNoNum - 1 : currentNoNum + 1);
            if (state.serviceData?.topicDoor) {
              try {
                await showNewsArticle(state.serviceData.topicDoor, targetNo, {
                  listPageNo: state.serviceData?.listPageNo || 1,
                  skipOnIncomplete: true
                });
              } catch (err) {
                // 다음 기사도 짤린 기사 등으로 에러가 발생한 경우, 튕기지 않고 한 번 더 순차 이동 시도 (+-2)
                const targetNo2 = String(cmd === 'A' ? currentNoNum - 2 : currentNoNum + 2);
                await showNewsArticle(state.serviceData.topicDoor, targetNo2, {
                  listPageNo: state.serviceData?.listPageNo || 1,
                  skipOnIncomplete: true
                });
              }
            }
          }
          return true;
        }
      }
      if (cmd === 'A') {
        // [LOG_ID: 20260709_1350] A(이전글)는 번호가 작아지는 방향이므로, 인덱스가 증가하는 방향(skipIdx++)으로 전진해야 한다.
        let skipIdx = currentIndex + 1;
        while (skipIdx < articles.length && skipIdx <= currentIndex + 5) {
          const prevArticle = articles[skipIdx];
          if (!prevArticle || !state.serviceData?.topicDoor) break;
          try {
            await showNewsArticle(state.serviceData.topicDoor, prevArticle.no || String(skipIdx + 1), getNewsArticleOptions(prevArticle, {
              listPageNo: state.serviceData?.listPageNo || 1,
              skipOnIncomplete: true
            }));
            break;
          } catch (err) {
            if (/불완전한 뉴스 기사/.test(err?.message || '')) { skipIdx++; continue; }
            break;
          }
        }
        return true;
      }
      if (cmd === 'N') {
        // [LOG_ID: 20260709_1350] N(다음글)은 번호가 커지는 방향이므로, 인덱스가 감소하는 방향(skipIdx--)으로 후진해야 한다.
        let skipIdx = currentIndex - 1;
        while (skipIdx >= 0 && skipIdx >= currentIndex - 5) {
          const nextArticle = articles[skipIdx];
          if (!nextArticle || !state.serviceData?.topicDoor) break;
          try {
            await showNewsArticle(state.serviceData.topicDoor, nextArticle.no || String(skipIdx + 1), getNewsArticleOptions(nextArticle, {
              listPageNo: state.serviceData?.listPageNo || 1,
              skipOnIncomplete: true
            }));
            break;
          } catch (err) {
            if (/불완전한 뉴스 기사/.test(err?.message || '')) { skipIdx--; continue; }
            break;
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
          try {
            await navigator.clipboard.writeText(text);
            // [LOG: 20260613_1205] 힌트바 대신 푸터 하단 알림창에 띄우도록 수정
            if (typeof showToast === 'function') {
              showToast('기사 내용이 클립보드에 복사되었습니다.', 3000, 'success');
            } else {
              setHint('기사 내용이 클립보드에 복사되었습니다.');
            }
          } catch {
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
