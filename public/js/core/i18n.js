/**
 * i18n.js
 * [LOG: 20260426_2100] Evolution Mode: Centralized UI string management.
 * [LOG: 20260426_2150] Evolution: Added Help and Category labels.
 */

export const UI_TEXT = {
  // Common
  YES: '예',
  NO: '아니오',
  CANCEL: '취소',
  CONFIRM: '확인',
  ERROR: '오류',
  SUCCESS: '성공',
  WARNING: '경고',
  LOADING: '불러오는 중...',
  SEARCH: '검색',
  ID: '아이디',
  PASSWORD: '비밀번호',

  // Authentication
  LOGIN_SUCCESS: '로그인되었습니다.',
  LOGOUT_SUCCESS: '로그아웃되었습니다.',
  LOGIN_REQUIRED: '로그인이 필요한 기능입니다.',
  PASSWORD_RESET_SENT: '재설정 안내 메일을 전송했습니다.',
  PASSWORD_CHANGED: '비밀번호가 성공적으로 변경되었습니다.',

  // Board / Browsing
  POST_DELETE_CONFIRM: '정말 삭제하시겠습니까?',
  POST_DELETE_TARGET: '삭제할 글',
  POST_DELETE_SUCCESS: '글이 삭제되었습니다.',
  POST_DELETE_MY_ONLY: '본인의 글만 삭제할 수 있습니다.',
  POST_EDIT_MY_ONLY: '본인의 글만 수정할 수 있습니다.',
  POST_NOT_FOUND: '해당 글을 찾을 수 없습니다.',
  
  SEARCH_TITLE_PROMPT: '제목 검색어를 입력해 주세요. (예: LT 안녕)',
  SEARCH_AUTHOR_PROMPT: '작성자 아이디를 입력해 주세요. (예: LI admin)',
  SEARCH_KEYWORD: '검색어 >>',
  SEARCH_AUTHOR_ID: '아이디 >>',

  // Terminal UI
  CMD_UNKNOWN: '',
  CMD_SUGGESTION: '',
  INITIALIZATION_ERROR: '초기화 과정에서 오류가 발생했습니다.',
  
  // Navigation
  GO_TO_MAIN: '메인으로 이동합니다.',
  GO_TO_UPPER: '상위 메뉴로 이동합니다.',
  
  // Feedback
  DATA_LOADING: '데이터를 송수신 중입니다...',
  RENDER_ERROR: '화면 출력 중 일부 오류가 발생했습니다.',

  // Help & Categories
  HELP: '도움말',
  HISTORY: '작업 기록',
  RECENT_COMMAND_HISTORY: '최근 작업 명령 기록',
  POPULAR_COMMANDS: '인기 명령어',
  COMMAND_NAME: '명령어',
  LABEL: '레이블',
  DESCRIPTION: '설명',
  USAGE: '사용법',
  CATEGORY: '카테고리',
  LOGIN_REQUIRED_SHORT: '로그인 필수',
  NO_HISTORY: '기록이 없습니다.',
  NO_DESCRIPTION: '설명이 없습니다.',
  HELP_TOOLTIP_HINT: '(마우스 오버 툴팁으로도 간단한 도움말을 볼 수 있습니다.)',

  CAT_NAV: '[이동 및 내비게이션]',
  CAT_POST: '[게시판 및 글 관리]',
  CAT_SYS: '[시스템 및 진단]',
  CAT_AUTH: '[인증 및 계정]',
  CAT_MEMO: '[쪽지 및 통신]',
  CAT_CHAT: '[채팅 및 대화]',
  CAT_UI: '[화면 및 설정]'
};

export function getUIText(key, fallback = '') {
  return UI_TEXT[key] || fallback || key;
}
