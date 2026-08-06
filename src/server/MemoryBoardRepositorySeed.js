'use strict';

function seedMemoryBoardRepository(repo) {
  // 공지사항
  const notice1 = seedRoot(repo, 'notice', '01410 Web 재구현 계획', 'Phase 3부터 게시판은 실제 저장소와 연결됩니다.\n현재 화면은 80x24 터미널 기준으로 계속 맞춰가고 있습니다.', 'sysop', '운영자');
  seedReply(repo, 'notice', notice1.id, '계층형 정렬 테스트 답글', 'Family / Orderby / Step 정렬 규칙을 그대로 재현하는 중입니다.', 'dev01', '개발자1');
  seedReply(repo, 'notice', notice1.id, '두 번째 답글', '신규 답글은 부모 바로 아래에 삽입되도록 처리합니다.', 'dev02', '개발자2');
  seedRoot(repo, 'notice', '게시판 메뉴 확장 안내', '원본 PC통신(나우누리) 메뉴 구조를 참고하여 게시판과 자료실을 확장하였습니다.\n지역소식, 연예/오락, 자동차함께타기, 불가사의, 컴퓨터초보시절 게시판이 추가되었습니다.', 'sysop', '운영자');

  // 건의하기
  seedRoot(repo, 'tosysop', '건의사항 예시', '메뉴 이동과 글쓰기 흐름을 우선 안정화하고 있습니다.', 'guest', '손님');

  // 열린광장
  for (let index = 0; index < 18; index += 1) {
    seedRoot(
      repo,
      'plaza',
      `자유 게시판 샘플 ${index + 1}`,
      `이 글은 목록/본문/페이지 이동 검증용 샘플입니다.\n번호 ${index + 1}번 게시글입니다.\n긴 본문 스크롤도 확인할 수 있도록 줄 수를 조금 더 넣습니다.\n01410 스타일을 웹에서 재현하는 작업을 진행 중입니다.`,
      `user${(index % 4) + 1}`,
      `회원${(index % 4) + 1}`
    );
  }
  seedRoot(repo, 'plaza', '열린광장에 오신 것을 환영합니다', '이곳은 자유롭게 의견을 나누는 공간입니다.\n정리된 메뉴 구조에 따라 이제 모든 게시판이 정상 작동합니다.', 'user5', '회원5');

  // 유머
  seedRoot(repo, 'humor', '도스 시절 추억', 'autoexec.bat 한 줄에 하루가 걸리던 시절이 있었습니다.\n\nCONFIG.SYS 설정 하나 잘못 건드렸다가 밤새운 경험, 다들 있으시죠?', 'retro1', '레트로');
  seedRoot(repo, 'humor', '286에서 486으로 업그레이드하던 날', '386SX 살까 386DX 살까 한참 고민했던 그 시절...\n결국 486DX33으로 결정했는데 지금 생각하면 웃음이 나옵니다.', 'retro2', '추억남');
  seedRoot(repo, 'humor', 'PC통신 요금 폭탄 맞았던 사연', '한달에 전화비가 십만원 넘게 나왔던 그 시절의 공포를 아십니까?', 'user1', '회원1');

  // 횡설수설
  seedRoot(repo, 'say', '오늘 날씨가 참 좋네요', '짧은 일상을 나누는 횡설수설 게시판입니다.', 'user1', '회원1');
  seedRoot(repo, 'say', '요즘 BBS 쓰는 사람이 있나요', '옛날 생각에 접속해봤습니다. 반갑습니다~', 'oldtimer', '올드타이머');
  seedRoot(repo, 'say', '터미널 글꼴 추천 부탁드립니다', '01410에서 가장 잘 보이는 글꼴이 뭔지 궁금합니다.', 'user3', '회원3');

  // 묻고답하기
  seedRoot(repo, 'qna', 'Turbo C 한글 깨짐 문제', '도스 프로그램에서 CP949 처리를 어떻게 하셨나요?', 'coder1', '질문자');
  seedRoot(repo, 'qna', 'ANSI 코드 색상 표 어디서 구하나요', 'ESC[32m 이런 코드 전체 목록을 보고 싶습니다.', 'user2', '회원2');

  // 가입인사
  seedRoot(repo, 'newface', '안녕하세요! 첫 가입입니다', '01410에 가입하게 되어 기쁩니다.', 'newbie', '신입');
  seedRoot(repo, 'newface', '반갑습니다, 오래된 팬입니다', '90년대 01410 시절부터 PC통신을 해온 사람입니다. 이런 01410이 남아있다니 감동입니다.', 'nostalgia', '추억인');

  // 지역소식
  seedRoot(repo, 'locnews', '서울 도심 벚꽃 개화 시작', '여의도 윤중로와 창경궁 일대에 벚꽃이 피기 시작했습니다.\n주말에 나들이 계획 세우시는 분들 참고하세요.', 'reporter1', '기자1');
  seedRoot(repo, 'locnews', '부산 자갈치 시장 특집', '주말에 부산 다녀왔습니다. 자갈치 시장의 활기를 느껴보세요.', 'traveler', '여행자');
  seedRoot(repo, 'locnews', '대전 엑스포 과학공원 소식', '엑스포 과학공원에서 새로운 전시가 시작됩니다.', 'dj_user', '대전인');

  // 연예/오락
  seedRoot(repo, 'entertain', '서태지와 아이들 은퇴 충격', '1996년 1월 31일, 서태지와 아이들이 갑작스러운 은퇴를 선언했습니다.\n팬들의 충격이 이만저만이 아닙니다.', 'fan1', '팬');
  seedRoot(repo, 'entertain', '드라마 모래시계 시청률 화제', '최근 방영 중인 드라마 모래시계가 엄청난 시청률을 기록하고 있습니다.', 'drama_fan', '드라마팬');
  seedRoot(repo, 'entertain', '이날치 밴드 신보 후기', '요즘 들어도 촌스럽지 않은 우리 음악이 있더군요.', 'music_fan', '음악팬');

  // 자동차함께타기
  seedRoot(repo, 'carpool', '서울→부산 이번 주말 동승자 구합니다', '이번 주 토요일 오전 7시 출발 예정입니다. 유류비 반반 부담하실 분 연락 주세요.', 'driver1', '운전자1');
  seedRoot(repo, 'carpool', '강남→수원 매일 출퇴근 카풀', '매일 오전 8시 강남역 출발, 수원 삼성전자 방향입니다.', 'driver2', '운전자2');

  // 불가사의
  seedRoot(repo, 'mystery', '전국 UFO 목격담 모음', '최근 각지에서 UFO 목격 신고가 잇따르고 있습니다. 여러분의 경험을 공유해 주세요.', 'xfile', 'X파일');
  seedRoot(repo, 'mystery', '피라미드는 어떻게 만들었을까', '수천년 전 기술로 저 거대한 피라미드를 쌓았다는 것이 아직도 불가사의입니다.', 'archaeo', '고고학자');
  seedRoot(repo, 'mystery', '버뮤다 삼각지대 실종 사례 정리', '버뮤다 삼각지대에서 실종된 항공기와 선박의 목록을 정리했습니다.', 'mystery1', '미스터리');

  // 컴퓨터초보시절
  seedRoot(repo, 'novice', '처음 컴퓨터 샀던 날 이야기', '1993년, 286 XT 컴퓨터를 부모님께 졸라 샀던 날이 생각납니다.\n도스 부팅 화면을 보며 얼마나 설레었던지...', 'pc_beginner', '초보1');
  seedRoot(repo, 'novice', 'FORMAT C: 잘못 눌렀던 공포', '실수로 하드디스크를 포맷해버린 날의 그 공포를 아직도 잊지 못합니다.', 'user4', '회원4');
  seedRoot(repo, 'novice', 'AUTOEXEC.BAT 작성하던 시절', 'PATH, SET, MOUSE 드라이버 설정을 한 줄씩 추가하던 그 뿌듯함...', 'dos_master', '도스달인');

  // 공개자료실 - 전체보기
  seedRoot(repo, 'pds_all', 'V3 백신 최신판 1996.04', '바이러스 예방을 위해 최신 백신을 공유합니다. 압축 해제 후 VDIR.EXE 실행하세요.', 'sysop', '운영자');
  seedRoot(repo, 'pds_all', '한글 윈도우즈 95 드라이버 모음', '각종 주변기기 한글 윈도우즈 95 드라이버를 모았습니다.', 'admin', '관리자');

  // 공개자료실 - 유틸리티
  seedRoot(repo, 'pds_util', 'PKZIP 2.04g 공유', '압축 유틸리티의 표준, PKZIP 최신판입니다.', 'util_man', '유틸맨');
  seedRoot(repo, 'pds_util', 'MDIR 최신판 (디렉토리 리스터)', 'DIR 명령어보다 훨씬 보기 좋은 MDIR입니다.', 'dos_fan', '도스팬');
  seedRoot(repo, 'pds_util', 'ARJ 압축 유틸리티', 'PKZIP과 함께 많이 쓰이는 ARJ 압축 프로그램입니다.', 'sharer1', '공유자1');

  // 공개자료실 - 게임
  seedRoot(repo, 'pds_game', '문명 1 (Civilization) 공략 모음', '시드 마이어의 명작 문명 1 공략을 정리했습니다.', 'gamer1', '게이머1');
  seedRoot(repo, 'pds_game', '삼국지 3 세이브 파일 및 공략', '코에이 삼국지 3의 각 시나리오 공략법을 공유합니다.', 'gamer2', '게이머2');
  seedRoot(repo, 'pds_game', 'DOOM 레벨 에디터 (DEU)', 'DOOM 레벨을 직접 만들 수 있는 에디터입니다.', 'doomer', '둠러');

  // 공개자료실 - 그래픽/사진
  seedRoot(repo, 'pds_graphic', 'PoV-Ray 렌더링 이미지 모음', '레이트레이싱으로 만든 고퀄리티 3D 이미지들입니다.', 'graphic1', '그래퍼1');
  seedRoot(repo, 'pds_graphic', '도스용 뷰어 VPIC 최신판', 'GIF, PCX, BMP 등 다양한 포맷을 지원하는 도스용 이미지 뷰어입니다.', 'viewer_fan', '뷰어팬');

  // 공개자료실 - 음악/사운드
  seedRoot(repo, 'pds_sound', 'MOD 음악 파일 모음 (1996년판)', '트래커 음악 MOD 파일 50곡 모음입니다. MODPLAY로 감상하세요.', 'music1', '음악인1');
  seedRoot(repo, 'pds_sound', '사운드블라스터 드라이버 최신판', '크리에이티브 사운드블라스터 AWE32 드라이버 업데이트입니다.', 'sound_man', '사운드맨');

  // 공개자료실 - 프로그래밍
  seedRoot(repo, 'pds_prog', 'Turbo C 2.0 소스 예제 모음', 'Turbo C로 만든 한글 처리, 그래픽, 파일 I/O 예제들입니다.', 'coder_kim', '코더김');
  seedRoot(repo, 'pds_prog', 'QuickBASIC 게임 소스 공개', 'QBasic으로 만든 간단한 아케이드 게임 소스입니다.', 'basic_fan', '베이식팬');
  seedRoot(repo, 'pds_prog', '어셈블리어 COM 파일 제작 튜토리얼', 'TASM으로 작은 COM 파일 만드는 방법을 단계별로 설명합니다.', 'asm_master', '어셈달인');
}

function seedMemoryBoardRepository(repo) {
  const boardCounters = {};

  function seedRoot(repo, boardId, title, content, userId, nickName) {
    const now = new Date(Date.now() - repo.nextPostId * 60000).toISOString();
    const id = repo.nextPostId++;
    boardCounters[boardId] = (boardCounters[boardId] || 0) + 1;
    const localId = boardCounters[boardId];
    const post = {
      id,
      localId,
      boardId,
      family: id,
      orderby: 0,
      step: 0,
      userId,
      nickName,
      title,
      content,
      hit: Math.floor((id * 7) % 91),
      recommend: Math.floor((id * 3) % 11),
      createdAt: now,
      updatedAt: now
    };
    repo.posts.push(post);
    return post;
  }

  function seedReply(repo, boardId, parentPostId, title, content, userId, nickName) {
    const parent = repo.posts.find((entry) => entry.boardId === boardId && entry.id === Number(parentPostId));
    if (!parent) return null;

    for (const post of repo.posts) {
      if (post.boardId === boardId && post.family === parent.family && post.orderby > parent.orderby) {
        post.orderby += 1;
      }
    }

    const now = new Date(Date.now() - repo.nextPostId * 60000).toISOString();
    const id = repo.nextPostId++;
    boardCounters[boardId] = (boardCounters[boardId] || 0) + 1;
    const localId = boardCounters[boardId];
    const replyPost = {
      id,
      localId,
      boardId,
      family: parent.family,
      orderby: parent.orderby + 1,
      step: parent.step + 1,
      userId,
      nickName,
      title,
      content,
      hit: Math.floor((id * 5) % 57),
      recommend: Math.floor((id * 2) % 7),
      createdAt: now,
      updatedAt: now
    };

    repo.posts.push(replyPost);
    return replyPost;
  }

  // 공지사항
  const notice1 = seedRoot(repo, 'notice', '01410 Web 재구현 계획', 'Phase 3부터 게시판은 실제 저장소와 연결됩니다.\n현재 화면은 80x24 터미널 기준으로 계속 맞춰가고 있습니다.', 'sysop', '운영자');
  seedReply(repo, 'notice', notice1.id, '계층형 정렬 테스트 답글', 'Family / Orderby / Step 정렬 규칙을 그대로 재현하는 중입니다.', 'dev01', '개발자1');
  seedReply(repo, 'notice', notice1.id, '두 번째 답글', '신규 답글은 부모 바로 아래에 삽입되도록 처리합니다.', 'dev02', '개발자2');
  seedRoot(repo, 'notice', '게시판 메뉴 확장 안내', '원본 PC통신(나우누리) 메뉴 구조를 참고하여 게시판과 자료실을 확장하였습니다.\n지역소식, 연예/오락, 자동차함께타기, 불가사의, 컴퓨터초보시절 게시판이 추가되었습니다.', 'sysop', '운영자');

  // 건의하기
  seedRoot(repo, 'tosysop', '건의사항 예시', '메뉴 이동과 글쓰기 흐름을 우선 안정화하고 있습니다.', 'guest', '손님');

  // 열린광장
  for (let index = 0; index < 18; index += 1) {
    seedRoot(
      repo,
      'plaza',
      `자유 게시판 샘플 ${index + 1}`,
      `이 글은 목록/본문/페이지 이동 검증용 샘플입니다.\n번호 ${index + 1}번 게시글입니다.\n긴 본문 스크롤도 확인할 수 있도록 줄 수를 조금 더 넣습니다.\n01410 스타일을 웹에서 재현하는 작업을 진행 중입니다.`,
      `user${(index % 4) + 1}`,
      `회원${(index % 4) + 1}`
    );
  }
  seedRoot(repo, 'plaza', '열린광장에 오신 것을 환영합니다', '이곳은 자유롭게 의견을 나누는 공간입니다.\n정리된 메뉴 구조에 따라 이제 모든 게시판이 정상 작동합니다.', 'user5', '회원5');

  // 유머
  seedRoot(repo, 'humor', '도스 시절 추억', 'autoexec.bat 한 줄에 하루가 걸리던 시절이 있었습니다.\n\nCONFIG.SYS 설정 하나 잘못 건드렸다가 밤새운 경험, 다들 있으시죠?', 'retro1', '레트로');
  seedRoot(repo, 'humor', '286에서 486으로 업그레이드하던 날', '386SX 살까 386DX 살까 한참 고민했던 그 시절...\n결국 486DX33으로 결정했는데 지금 생각하면 웃음이 나옵니다.', 'retro2', '추억남');
  seedRoot(repo, 'humor', 'PC통신 요금 폭탄 맞았던 사연', '한달에 전화비가 십만원 넘게 나왔던 그 시절의 공포를 아십니까?', 'user1', '회원1');

  // 횡설수설
  seedRoot(repo, 'say', '오늘 날씨가 참 좋네요', '짧은 일상을 나누는 횡설수설 게시판입니다.', 'user1', '회원1');
  seedRoot(repo, 'say', '요즘 BBS 쓰는 사람이 있나요', '옛날 생각에 접속해봤습니다. 반갑습니다~', 'oldtimer', '올드타이머');
  seedRoot(repo, 'say', '터미널 글꼴 추천 부탁드립니다', '01410에서 가장 잘 보이는 글꼴이 뭔지 궁금합니다.', 'user3', '회원3');

  // 묻고답하기
  seedRoot(repo, 'qna', 'Turbo C 한글 깨짐 문제', '도스 프로그램에서 CP949 처리를 어떻게 하셨나요?', 'coder1', '질문자');
  seedRoot(repo, 'qna', 'ANSI 코드 색상 표 어디서 구하나요', 'ESC[32m 이런 코드 전체 목록을 보고 싶습니다.', 'user2', '회원2');

  // 가입인사
  seedRoot(repo, 'newface', '안녕하세요! 첫 가입입니다', '01410에 가입하게 되어 기쁩니다.', 'newbie', '신입');
  seedRoot(repo, 'newface', '반갑습니다, 오래된 팬입니다', '90년대 01410 시절부터 PC통신을 해온 사람입니다. 이런 01410이 남아있다니 감동입니다.', 'nostalgia', '추억인');

  // 지역소식
  seedRoot(repo, 'locnews', '서울 도심 벚꽃 개화 시작', '여의도 윤중로와 창경궁 일대에 벚꽃이 피기 시작했습니다.\n주말에 나들이 계획 세우시는 분들 참고하세요.', 'reporter1', '기자1');
  seedRoot(repo, 'locnews', '부산 자갈치 시장 특집', '주말에 부산 다녀왔습니다. 자갈치 시장의 활기를 느껴보세요.', 'traveler', '여행자');
  seedRoot(repo, 'locnews', '대전 엑스포 과학공원 소식', '엑스포 과학공원에서 새로운 전시가 시작됩니다.', 'dj_user', '대전인');

  // 연예/오락
  seedRoot(repo, 'entertain', '서태지와 아이들 은퇴 충격', '1996년 1월 31일, 서태지와 아이들이 갑작스러운 은퇴를 선언했습니다.\n팬들의 충격이 이만저만이 아닙니다.', 'fan1', '팬');
  seedRoot(repo, 'entertain', '드라마 모래시계 시청률 화제', '최근 방영 중인 드라마 모래시계가 엄청난 시청률을 기록하고 있습니다.', 'drama_fan', '드라마팬');
  seedRoot(repo, 'entertain', '이날치 밴드 신보 후기', '요즘 들어도 촌스럽지 않은 우리 음악이 있더군요.', 'music_fan', '음악팬');

  // 자동차함께타기
  seedRoot(repo, 'carpool', '서울→부산 이번 주말 동승자 구합니다', '이번 주 토요일 오전 7시 출발 예정입니다. 유류비 반반 부담하실 분 연락 주세요.', 'driver1', '운전자1');
  seedRoot(repo, 'carpool', '강남→수원 매일 출퇴근 카풀', '매일 오전 8시 강남역 출발, 수원 삼성전자 방향입니다.', 'driver2', '운전자2');

  // 불가사의
  seedRoot(repo, 'mystery', '전국 UFO 목격담 모음', '최근 각지에서 UFO 목격 신고가 잇따르고 있습니다. 여러분의 경험을 공유해 주세요.', 'xfile', 'X파일');
  seedRoot(repo, 'mystery', '피라미드는 어떻게 만들었을까', '수천년 전 기술로 저 거대한 피라미드를 쌓았다는 것이 아직도 불가사의입니다.', 'archaeo', '고고학자');
  seedRoot(repo, 'mystery', '버뮤다 삼각지대 실종 사례 정리', '버뮤다 삼각지대에서 실종된 항공기와 선박의 목록을 정리했습니다.', 'mystery1', '미스터리');

  // 컴퓨터초보시절
  seedRoot(repo, 'novice', '처음 컴퓨터 샀던 날 이야기', '1993년, 286 XT 컴퓨터를 부모님께 졸라 샀던 날이 생각납니다.\n도스 부팅 화면을 보며 얼마나 설레었던지...', 'pc_beginner', '초보1');
  seedRoot(repo, 'novice', 'FORMAT C: 잘못 눌렀던 공포', '실수로 하드디스크를 포맷해버린 날의 그 공포를 아직도 잊지 못합니다.', 'user4', '회원4');
  seedRoot(repo, 'novice', 'AUTOEXEC.BAT 작성하던 시절', 'PATH, SET, MOUSE 드라이버 설정을 한 줄씩 추가하던 그 뿌듯함...', 'dos_master', '도스달인');

  // 공개자료실 - 전체보기
  seedRoot(repo, 'pds_all', 'V3 백신 최신판 1996.04', '바이러스 예방을 위해 최신 백신을 공유합니다. 압축 해제 후 VDIR.EXE 실행하세요.', 'sysop', '운영자');
  seedRoot(repo, 'pds_all', '한글 윈도우즈 95 드라이버 모음', '각종 주변기기 한글 윈도우즈 95 드라이버를 모았습니다.', 'admin', '관리자');

  // 공개자료실 - 유틸리티
  seedRoot(repo, 'pds_util', 'PKZIP 2.04g 공유', '압축 유틸리티의 표준, PKZIP 최신판입니다.', 'util_man', '유틸맨');
  seedRoot(repo, 'pds_util', 'MDIR 최신판 (디렉토리 리스터)', 'DIR 명령어보다 훨씬 보기 좋은 MDIR입니다.', 'dos_fan', '도스팬');
  seedRoot(repo, 'pds_util', 'ARJ 압축 유틸리티', 'PKZIP과 함께 많이 쓰이는 ARJ 압축 프로그램입니다.', 'sharer1', '공유자1');

  // 공개자료실 - 게임
  seedRoot(repo, 'pds_game', '문명 1 (Civilization) 공략 모음', '시드 마이어의 명작 문명 1 공략을 정리했습니다.', 'gamer1', '게이머1');
  seedRoot(repo, 'pds_game', '삼국지 3 세이브 파일 및 공략', '코에이 삼국지 3의 각 시나리오 공략법을 공유합니다.', 'gamer2', '게이머2');
  seedRoot(repo, 'pds_game', 'DOOM 레벨 에디터 (DEU)', 'DOOM 레벨을 직접 만들 수 있는 에디터입니다.', 'doomer', '둠러');

  // 공개자료실 - 그래픽/사진
  seedRoot(repo, 'pds_graphic', 'PoV-Ray 렌더링 이미지 모음', '레이트레이싱으로 만든 고퀄리티 3D 이미지들입니다.', 'graphic1', '그래퍼1');
  seedRoot(repo, 'pds_graphic', '도스용 뷰어 VPIC 최신판', 'GIF, PCX, BMP 등 다양한 포맷을 지원하는 도스용 이미지 뷰어입니다.', 'viewer_fan', '뷰어팬');

  // 공개자료실 - 음악/사운드
  seedRoot(repo, 'pds_sound', 'MOD 음악 파일 모음 (1996년판)', '트래커 음악 MOD 파일 50곡 모음입니다. MODPLAY로 감상하세요.', 'music1', '음악인1');
  seedRoot(repo, 'pds_sound', '사운드블라스터 드라이버 최신판', '크리에이티브 사운드블라스터 AWE32 드라이버 업데이트입니다.', 'sound_man', '사운드맨');

  // 공개자료실 - 프로그래밍
  seedRoot(repo, 'pds_prog', 'Turbo C 2.0 소스 예제 모음', 'Turbo C로 만든 한글 처리, 그래픽, 파일 I/O 예제들입니다.', 'coder_kim', '코더김');
  seedRoot(repo, 'pds_prog', 'QuickBASIC 게임 소스 공개', 'QBasic으로 만든 간단한 아케이드 게임 소스입니다.', 'basic_fan', '베이식팬');
  seedRoot(repo, 'pds_prog', '어셈블리어 COM 파일 제작 튜토리얼', 'TASM으로 작은 COM 파일 만드는 방법을 단계별로 설명합니다.', 'asm_master', '어셈달인');
}

module.exports = {
  seedMemoryBoardRepository
};
