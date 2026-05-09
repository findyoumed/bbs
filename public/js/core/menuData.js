export function createEntryMenuNode() {
  return {
    type: 'menu', go: 'log', id: 'log', door: '1', text: '', showCode: true, accessLevel: 1,
    name: '회원가입 / 로그인', header: '', footer: 'txt/cmd_menu_footer.txt',
    children: [
      { type: 'signup', go: 'signup', id: 'signup', door: '1', name: '회원가입', children: [] },
      { type: 'login', go: 'login', id: 'signin', door: '2', name: '로그인: 이메일/아이디', children: [] },
      { type: 'oauth-login', go: 'google', id: 'google_login', door: '3', name: '로그인: 구글', children: [] },
      { type: 'oauth-login', go: 'kakao', id: 'kakao_login', door: '4', name: '로그인: 카카오', children: [] },
      { type: 'password-reset', go: 'password', id: 'password', door: '5', name: '비밀번호 찾기', children: [] },
      { type: 'myinfo', go: 'myinfo', id: 'myinfo', door: '6', name: '정보변경 (MYINFO)', accessLevel: 2, children: [] }
    ]
  };
}
