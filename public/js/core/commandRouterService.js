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
        await showNewsArticle(state.serviceData?.topicDoor, article.no || rawCmd, getNewsArticleOptions(article, { listPageNo: pageNo }));
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
      if (cmd === 'A') {
        const prevArticle = currentIndex > 0 ? articles[currentIndex - 1] : null;
        if (prevArticle && state.serviceData?.topicDoor) {
          await showNewsArticle(state.serviceData.topicDoor, prevArticle.no || String(currentIndex), getNewsArticleOptions(prevArticle));
        }
        return true;
      }
      if (cmd === 'N') {
        const nextArticle = currentIndex >= 0 ? articles[currentIndex + 1] : null;
        if (nextArticle && state.serviceData?.topicDoor) {
          await showNewsArticle(state.serviceData.topicDoor, nextArticle.no || String(currentIndex + 2), getNewsArticleOptions(nextArticle));
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

      return false;
    }

    return false;
  };
}
