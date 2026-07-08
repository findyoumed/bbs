'use strict';

/**
 * [LOG_ID: 20260708_1030] requestContext.js의 resolveActionHint()가 만드는 내부 액션 코드
 * (예: 'member_activity', 'list_posts')를 ACT(최근 활동 요약) 화면에 그대로 노출하면
 * "손님님이 member_activity입니다."처럼 영문 스네이크케이스가 한국어 문장에 섞여 나온다.
 * 표시용 한글 문구로 옮기는 번역 테이블. 실제 저장되는 action 값은 그대로 유지하고,
 * 요약을 만들 때만(ActivityRepository.js / ActivityRepositorySupabase.js) 이 함수를 거친다.
 */
const ACTION_LABELS = {
  home: '초기화면 열람 중',
  list_boards: '게시판 목록 열람 중',
  list_posts: '게시글 목록 열람 중',
  read_post: '게시글 열람 중',
  chatting: '대화실에서 대화 중',
  member_activity: '회원 정보 열람 중'
};

function describeAction(action) {
  const key = String(action || '').trim();
  return ACTION_LABELS[key] || '활동 중';
}

module.exports = { describeAction };
