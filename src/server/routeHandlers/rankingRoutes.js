'use strict';

const BaseRouter = require('./BaseRouter');

// [LOG: 20260622_2301] RankingRouter 구현 — 랭킹 API 핸들러
class RankingRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/ranking', handler: 'getRanking' }
    ];
  }

  async getRanking() {
    const { memberRepository, boardRepository } = this.deps;
    const isSupabase = memberRepository.getMeta().driver === 'supabase';

    let members = [];
    let posts = [];

    // 1. 데이터 소스 획득 (Supabase / Memory 분기)
    if (isSupabase) {
      // Supabase 모드
      // [LOG: 20260623_0100] 회원 테이블명은 SUPABASE_MEMBERS_TABLE로 가변이므로 레포 설정값을 사용한다.
      const membersTable = memberRepository.table || 'members';
      const { data: memberRows, error: memberError } = await memberRepository.client
        .from(membersTable)
        .select('user_id, nick_name, level')
        .not('user_id', 'eq', 'guest');

      if (memberError) this.error(502, `회원 데이터 랭킹 조회 실패: ${memberError.message}`);
      members = memberRows || [];

      // [LOG: 20260623_0100] posts 테이블은 배포별로 컬럼명이 가변(author_id/user_id, hit/hits,
      // recommend/likes, is_deleted 유무)이라 컬럼을 하드코딩하면 PostgREST가
      // "column ... does not exist" 502를 낸다. select('*')로 안전하게 받고,
      // soft-delete 필터도 DB가 아닌 JS에서 처리(컬럼 부재 시에도 안전)한다.
      const postsTable = (boardRepository.tables && boardRepository.tables.posts) || 'posts';
      const { data: postRows, error: postError } = await boardRepository.client
        .from(postsTable)
        .select('*');

      if (postError) this.error(502, `게시글 데이터 랭킹 조회 실패: ${postError.message}`);
      posts = (postRows || []).filter(p => p.is_deleted !== true);
    } else {
      // Memory 모드
      members = Array.from(memberRepository.members.values())
        .filter(m => m.userId !== 'guest')
        .map(m => ({
          user_id: m.userId,
          nick_name: m.nickName,
          level: m.level
        }));

      posts = (boardRepository.posts || []).map(p => ({
        user_id: p.userId,
        nick_name: p.nickName,
        hit: p.hit,
        recommend: p.recommend
      }));
    }

    // 2. 레벨 랭킹 산출
    const levelRanking = members
      .map(m => ({
        userId: m.user_id,
        nickName: m.nick_name || m.user_id,
        level: Number(m.level || 1)
      }))
      .sort((a, b) => b.level - a.level || a.userId.localeCompare(b.userId))
      .slice(0, 50);

    // 3. 게시글 관련 집계 (글수, 조회수, 추천수)
    const userStats = {}; // userId -> { userId, nickName, postCount, hitsSum, recommendsSum }

    for (const post of posts) {
      const userId = post.user_id || post.author_id || 'guest';
      if (userId === 'guest') continue;

      const nickName = post.author_nickname || post.nick_name || userId;
      // hit/hits, recommend/likes 중 있는 값 채택
      const hit = Number(post.hits ?? post.hit ?? 0);
      const recommend = Number(post.recommend ?? post.likes ?? 0);

      if (!userStats[userId]) {
        userStats[userId] = {
          userId,
          nickName,
          postCount: 0,
          hitsSum: 0,
          recommendsSum: 0
        };
      }

      userStats[userId].postCount++;
      userStats[userId].hitsSum += hit;
      userStats[userId].recommendsSum += recommend;
    }

    const statsList = Object.values(userStats);

    // 글수 랭킹 Top-50
    const postRanking = [...statsList]
      .filter(s => s.postCount > 0)
      .sort((a, b) => b.postCount - a.postCount || a.userId.localeCompare(b.userId))
      .slice(0, 50)
      .map(s => ({ userId: s.userId, nickName: s.nickName, count: s.postCount }));

    // 조회수 랭킹 Top-50
    const hitRanking = [...statsList]
      .filter(s => s.hitsSum > 0)
      .sort((a, b) => b.hitsSum - a.hitsSum || a.userId.localeCompare(b.userId))
      .slice(0, 50)
      .map(s => ({ userId: s.userId, nickName: s.nickName, count: s.hitsSum }));

    // 추천수 랭킹 Top-50
    const recommendRanking = [...statsList]
      .filter(s => s.recommendsSum > 0)
      .sort((a, b) => b.recommendsSum - a.recommendsSum || a.userId.localeCompare(b.userId))
      .slice(0, 50)
      .map(s => ({ userId: s.userId, nickName: s.nickName, count: s.recommendsSum }));

    return this.send(200, {
      levelRanking,
      postRanking,
      hitRanking,
      recommendRanking
    });
  }
}

async function handleRankingRoutes(deps) {
  const router = new RankingRouter(deps);
  return await router.handle();
}

module.exports = handleRankingRoutes;
