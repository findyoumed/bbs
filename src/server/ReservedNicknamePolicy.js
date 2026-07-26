'use strict';

function normalizeReservedIdentityText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u200B-\u200D\uFEFF._\-()[\]{}<>/\\|"'`~!@#$%^&*+=:;,?]+/g, '');
}

function normalizeReservedNicknameText(value) {
  return normalizeReservedIdentityText(value);
}

function combineTerms(stems, suffixes) {
  const keywords = [];
  stems.forEach((stem) => {
    suffixes.forEach((suffix) => {
      keywords.push(`${stem}${suffix}`);
    });
  });
  return keywords;
}

function buildReservedKeywordList(categories) {
  const seen = new Set();
  const keywords = [];

  categories.forEach((category) => {
    (category.keywords || []).forEach((keyword) => {
      const rawKeyword = String(keyword || '').trim();
      const normalizedKeyword = normalizeReservedIdentityText(rawKeyword);
      if (!normalizedKeyword || seen.has(normalizedKeyword)) {
        return;
      }
      seen.add(normalizedKeyword);
      keywords.push(rawKeyword);
    });
  });

  return Object.freeze(keywords);
}

// [LOG: 20260507_2100] Short official terms are exact-match only to avoid String.includes false positives.
const EXACT_RESERVED_IDENTITY_KEYWORDS = buildReservedKeywordList([
  {
    name: 'exact-system-reserved',
    keywords: [
      '01410', 'sysop', 'admin', 'administrator', 'root', 'system', 'operator',
      'owner', 'staff', 'support', 'official', 'notice', 'webmaster', 'master',
      'manager', 'moderator', 'helpdesk', 'guest', 'postmaster', 'hostmaster',
      'abuse', 'security', '운영자', '운영진', '운영팀', '관리자', '시삽',
      '시샵', '시솝', '시스옵', '공식', '공지', '알림', '고객센터',
      '헬프데스크', '게스트'
    ]
  },
  // [LOG_ID: 20260726_0250] 템플릿 인젝션(SSTI) 탐지 문구("{{7*7}}" 등)는 특수문자를 걷어내는
  // normalizeReservedIdentityText를 거치면 죄다 "77"이라는 흔한 숫자 부분 문자열로 뭉개진다 —
  // 원래 있던 substring-includes 목록(attack-payloads)에 남겨두면 "1977", "lucky777",
  // "user1977"처럼 "77"을 포함하는 극히 평범한 아이디/닉네임/이메일이 전부 SSTI 페이로드로
  // 오인돼 가입이 막히고, 에러 메시지에 "{{7*7}}"라는 내부 탐지 문구까지 그대로 노출됐다
  // (모바일 회원가입 흐름 실측 중 발견 — 자동 생성한 테스트 아이디가 우연히 "77"을 포함해
  // 재현됨). 다른 짧은 예약어처럼 "정확히 이 문자열일 때만" 차단하도록 옮긴다.
  {
    name: 'exact-ssti-canary',
    keywords: ['{{7*7}}', '${7*7}', '<%= 7*7 %>', '#{7*7}', '*{7*7}']
  }
]);

const RESERVED_KEYWORD_CATEGORIES = [
  {
    name: 'family-insults',
    keywords: [
      ...combineTerms(
        [
          '니애미', '니애비', '느금마', '느개비', '니엄마', '니아빠',
          '느그엄마', '느그아빠', '너네엄마', '너네아빠', '모친', '부친',
          '엄마', '아빠', '부모님', '부모욕', '가족욕', '고아', '가정교육',
          '부모없는', '애미없는', '애비없는'
        ],
        [
          '사망조롱', '장례조롱', '화장장조롱', '무덤조롱', '시체조롱',
          '관짝조롱', '패드립', '패드립도배', '욕설도배', '저주드립',
          '비하계정', '모욕닉네임', '조롱닉네임'
        ]
      ),
      '패드립전문가', '패드립장인', '패드립마스터', '패드립빌런',
      '패드립폭격', '패드립닉네임', '가족모욕전문', '부모모욕전문'
    ]
  },
  {
    name: 'hate-and-community-conflict',
    keywords: [
      ...combineTerms(
        [
          '일베', '일베저장소', '메갈리아', '메갈', '워마드', '남성',
          '여성', '한국남자', '한국여자', '한남', '김치녀', '된장녀',
          '맘충', '틀딱', '급식', '잼민이', '엠지세대', '꼰대',
          '전라도', '경상도', '광주', '대구', '부산', '제주도',
          '강원도', '충청도', '서울', '수도권', '지방', '지역',
          '노인', '청소년', '장애인', '질병감염자', '난민',
          '외국인노동자', '조선족', '일본인', '중국인', '흑인',
          '동남아', '성소수자', '특정집단'
        ],
        [
          '혐오선동', '비하도배', '갈등조장', '차별닉네임', '분탕계정',
          '조롱계정', '박멸드립', '살처분드립'
        ]
      ),
      'ilbetrollaccount', 'ilbehateaccount', 'megaliahateaccount',
      'womadhateaccount', 'koreanmenhateaccount', 'koreanwomenhateaccount',
      'genderhatecampaign', 'generationhatecampaign', 'regionalhatecampaign'
    ]
  },
  {
    name: 'illegal-adult-services',
    keywords: [
      ...combineTerms(
        [
          '출장안마', '출장마사지', '조건만남', '원조교제', '성매매',
          '불법유흥', '룸싸롱', '룸살롱', '텐프로', '오피예약',
          '오피텔성매매', '키스방', '대딸방', '풀싸롱', '휴게텔',
          '립카페', '성인마사지', '스폰만남', '스폰녀모집', '스폰남모집',
          '섹파모집', '섹트홍보', '음란채팅', '야동사이트', '야동공유',
          '성인동영상', '음란물공유', '불법촬영물', '몰카영상',
          '리벤지포르노', '딥페이크음란물', '유출영상', '성착취물',
          '아동성착취물', '아청물', '미성년음란물', '텔레그램성착취',
          'n번방자료', '박사방자료', '노출방송', '불법웹캠'
        ],
        [
          '예약문의', '가격문의', '후기공유', '광고계정', '홍보링크',
          '텔레그램방', '카톡문의', '알선계정'
        ]
      ),
      'adultservicebooking', 'escortservicekorea', 'illegaladultchatroom',
      'revengepornsharing', 'deepfakepornsharing', 'childsexualabusematerial'
    ]
  },
  {
    name: 'gambling-and-financial-fraud',
    keywords: [
      ...combineTerms(
        [
          '토토사이트', '사설토토', '안전놀이터', '먹튀없는놀이터',
          '스포츠토토불법', '바카라사이트', '실시간바카라', '온라인카지노',
          '불법카지노', '슬롯사이트', '파워볼사다리', '사다리게임',
          '홀짝게임', '사설경마', '사설경륜', '사설경정', '먹튀검증',
          '토토총판', '바카라총판', '카지노총판', '슬롯총판',
          '주식리딩방', '코인리딩방', '선물리딩방', '로또리딩방',
          '급등주리딩방', '세력주매집방', '비상장투자사기',
          '폰테크', '휴대폰깡', '소액결제현금화', '정보이용료현금화',
          '상품권현금화', '문화상품권현금화', '구글기프트카드현금화',
          '카드깡', '신용카드현금화', '작업대출', '개인돈대출',
          '대포통장', '대포폰', '유심매매', '계좌매입', '명의대여',
          '보이스피싱수거책', '보이스피싱전달책', '대출사기',
          '코인상장사기', '대여계좌', '불법환전'
        ],
        [
          '홍보계정', '가입유도', '추천인코드', '총판모집', '꽁머니지급',
          '수익보장', '텔레그램방', '카톡상담'
        ]
      ),
      'sportsbettingaffiliate', 'illegalcasinoaffiliate', 'cryptoleadingroomscam',
      'stockleadingroomscam', 'loanphishingscam', 'cashoutgiftcardscam'
    ]
  },
  {
    name: 'self-harm-and-violent-crime',
    keywords: [
      ...combineTerms(
        [
          '자살', '자해', '동반자살', '집단자살', '극단선택',
          '자살카페', '자살방', '자해챌린지', '살인예고', '칼부림예고',
          '흉기난동', '테러예고', '폭탄테러', '학교테러', '지하철테러',
          '공항테러', '병원테러', '청부살인', '살인청부', '보복살인',
          '묻지마살인', '집단폭행', '폭행영상', '납치협박', '강도모의',
          '방화예고', '시체훼손', '장기매매', '인신매매', '아동유괴',
          '스토킹살해', '살해협박', '흉기협박', '마약판매', '필로폰판매',
          '대마판매', '마약던지기', '마약배달', '범죄영상', '잔혹영상',
          '참수영상', '고어영상', '고문영상', '학교폭력', '왕따가해',
          '사이버불링', '불법무기', '범죄공모'
        ],
        [
          '조장계정', '방법공유', '모집계정', '초대링크', '텔레그램방',
          '인증계정', '예고닉네임', '협박닉네임'
        ]
      ),
      'violentthreataccount', 'terrorwarningaccount', 'murderthreataccount',
      'selfharmchallengeaccount', 'criminalrecruitmentaccount'
    ]
  },
  {
    name: 'impersonation',
    keywords: [
      ...combineTerms(
        [
          '네이버', '카카오', '구글', '지메일', '유튜브', '마이크로소프트',
          '애플', '아이클라우드', '오픈에이아이', '챗지피티', '메타',
          '페이스북', '인스타그램', '스레드', '왓츠앱', '아마존',
          '쿠팡', '토스', '배민', '은행', '금융감독원', '금감원',
          '경찰청', '검찰청', '법원', '국세청', '홈택스', '관세청',
          '우체국택배', '건강보험공단', '국민건강보험', '국민연금',
          '정부24', '민원24', '대통령실', '선거관리위원회', '관리자',
          '운영자', '보안팀', '고객센터', '인증마크'
        ],
        [
          '공식관리자', '운영팀사칭', '보안센터사칭', '고객센터사칭',
          '인증계정사칭', '피싱사칭'
        ]
      ),
      ...combineTerms(
        [
          'naver', 'kakao', 'google', 'gmail', 'youtube', 'microsoft',
          'office365', 'appleid', 'icloud', 'openai', 'chatgpt', 'meta',
          'facebook', 'instagram', 'threads', 'whatsapp', 'amazon', 'aws',
          'coupang', 'toss', 'government', 'police', 'prosecutor', 'court',
          'taxoffice', 'customs', 'postoffice', 'healthinsurance'
        ],
        [
          'officialsupport', 'admincenterfake', 'securityteamfake',
          'helpdeskfake', 'verifiedaccountfake'
        ]
      )
    ]
  },
  {
    name: 'cult-and-social-abuse',
    keywords: [
      ...combineTerms(
        [
          '사이비종교', '사이비포교', '위장포교', '비밀포교', '청년포교',
          '대학생위장포교', '심리상담위장포교', '성경공부위장포교',
          '무료강연위장포교', '종교사기', '헌금강요', '영생보장',
          '종말론', '휴거예언', '재림예언', '교주찬양', '이단포교',
          '신천지포교', '신천지위장포교', '신천지추수꾼', '신천지센터',
          'jms포교', 'jms추종', 'jms정명석', '구원파포교', '통일교포교',
          '통일교위장모집', '만민중앙교회포교', '대순진리회포교',
          '영생교포교', '라엘리안포교', '가짜뉴스', '허위정보',
          '음모론', '백신음모론', '부정선거선동', '재난괴담',
          '폭동선동', '참사조롱', '피해자신상털이', '좌표찍기',
          '온라인마녀사냥', '허위폭로', '악성루머', '가짜기부금',
          '재난기부사기', '사이비치료'
        ],
        [
          '모집계정', '홍보계정', '초대링크', '단톡방홍보',
          '선동계정', '도배계정', '사기계정'
        ]
      ),
      'cultrecruitaccount', 'pseudochurchrecruit', 'religiousscamaccount',
      'doomsdaycultrecruit', 'fakecharityscamaccount'
    ]
  },
  {
    name: 'attack-payloads',
    keywords: [
      "' or '1'='1", "\" or \"1\"=\"1", "') or ('1'='1",
      "\") or (\"1\"=\"1", "' or 1=1--", "\" or 1=1--",
      "' union select ", "\" union select ", "union/**/select",
      "union%20select", "union+all+select", "/*!union*/select",
      "order by 999", "group by 999", "information_schema.tables",
      "information_schema.columns", "select@@version", "load_file(/etc/passwd)",
      "into outfile /tmp", "into dumpfile /tmp", "benchmark(1000000,md5(1))",
      "sleep(5)--", "pg_sleep(5)--", "waitfor delay '0:0:5'",
      "dbms_pipe.receive_message", "xp_cmdshell whoami", "; drop table users",
      "drop/**/table/**/users", "insert into users values", "updatexml(1,concat",
      "extractvalue(1,concat", "or/**/1=1/**/", "and/**/1=2/**/",
      "admin'--", "admin\"--", "admin/*--", "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>", "<svg/onload=alert(1)>",
      "<body onload=alert(1)>", "<iframe src=javascript:alert(1)>",
      "<object data=javascript:alert(1)>", "<embed src=javascript:alert(1)>",
      "<input autofocus onfocus=alert(1)>", "<details open ontoggle=alert(1)>",
      "<marquee onstart=alert(1)>", "javascript:alert(document.cookie)",
      "javascript:confirm(document.domain)", "onerror=alert(document.cookie)",
      "onload=alert(document.domain)", "onclick=alert(document.cookie)",
      "document.cookie=alert(1)", "window.location=javascript:alert(1)",
      "eval(atob(", "settimeout(alert(1)", "data:text/html,<script>",
      "%3cscript%3ealert(1)%3c/script%3e", "%3cimg%20src=x%20onerror=alert(1)%3e",
      "&#x3c;script&#x3e;alert(1)", "expression(alert(1))",
      "url(javascript:alert(1))", "srcdoc=<script>alert(1)</script>",
      "base64,phnjcmlwd", ";cat /etc/passwd", "|cat /etc/passwd",
      "&&cat /etc/passwd", ";id;whoami", "&& whoami &&", "| whoami |",
      "`whoami`", "$(whoami)", ";nc -e /bin/sh", "bash -i >& /dev/tcp/",
      "/bin/sh -i", "curl http://attacker", "wget http://attacker",
      "powershell -enc ", "powershell.exe -enc ", "cmd.exe /c whoami",
      "certutil -urlcache -split", "bitsadmin /transfer", "invoke-webrequest http",
      "invoke-expression(new-object", "iex(new-object net.webclient)",
      "../../../../etc/passwd", "../etc/passwd", "..%2f..%2fetc%2fpasswd",
      "%2e%2e%2fetc%2fpasswd", "..\\..\\windows\\win.ini",
      "..%5c..%5cwindows%5cwin.ini", "/etc/passwd", "c:\\windows\\win.ini",
      "web-inf/web.xml", "php://filter/convert.base64-encode",
      "php://input", "file:///etc/passwd", "expect://id",
      "data://text/plain;base64", "proc/self/environ",
      "windows/system32/drivers/etc/hosts", "${jndi:ldap://",
      "${jndi:rmi://", "metadata.google.internal/computeMetadata",
      "169.254.169.254/latest/meta-data", "<!doctype foo [ <!entity xxe",
      "<!entity xxe system", "\"$ne\":null", "\"$regex\":\".*\"",
      "$where:function(){return true}", "__proto__[polluted]=true",
      "constructor[prototype][polluted]=true", "runtime.getruntime().exec",
      "process.mainmodule.require", "subprocess.call(['sh','-c'",
      "os.system('cat /etc/passwd')", "file_get_contents('/etc/passwd')",
      "curl_exec(curl_init(", "x_forwarded_for: 127.0.0.1",
      "user_agent: sqlmap", "referer: <script>alert(1)</script>"
    ]
  },
  {
    name: 'phishing-and-copyright',
    keywords: [
      ...combineTerms(
        [
          '큐싱qr', 'qr코드피싱', '가짜qr로그인', '큐알코드사칭',
          '가짜캡차', '클릭픽스', '브라우저업데이트사칭',
          '보안업데이트사칭', 'mfa우회', '2fa우회', '세션토큰탈취',
          '쿠키탈취', '택배주소수정', '택배배송불가', '우체국택배',
          'cj대한통운', '로젠택배', '한진택배', '모바일청첩장',
          '결혼식초대', '모바일부고장', '장례식장주소', '건강검진',
          '건강보험공단', '교통범칙금', '과태료납부', '이파인사칭',
          '통관번호', '관세청통관', '해외직구통관', '카드배송',
          '카드승인', '카드분실', '카드부정사용', '전기요금미납',
          '도시가스미납', '관리비미납', '세금환급', '국세환급',
          '연말정산환급', '재택알바사기', '쇼핑몰리뷰알바',
          '구매대행알바', '로맨스스캠', '중고거래', '안전결제',
          '택배거래', '계정정지', '비밀번호만료', '메일함용량초과',
          '클라우드공유문서', '전자서명', '세금계산서', '급여명세서',
          '인사팀사칭'
        ],
        [
          '피싱링크', '스미싱문자', '사칭계정', '악성앱유도',
          '로그인탈취'
        ]
      ),
      'qr코드피싱링크', '큐싱qr피싱링크', '큐싱qr스미싱문자',
      '청첩장스미싱문자', '부고장스미싱문자', '택배스미싱문자',
      '건강검진스미싱문자', '교통범칙금스미싱문자',
      ...combineTerms(
        [
          '누누티비', '티비위키', '오케이툰', 'oktoon', 'noonootv',
          'tvwiki', '불법스트리밍', '무료영화불법', '무료드라마불법',
          '무료예능불법', '해외축구불법중계', '스포츠불법중계',
          '무료웹툰불법', '불법웹툰', '웹툰미리보기불법',
          '유료웹툰무료', '웹소설불법', '유료소설무료', '만화스캔본',
          '스캔본다운로드', '영화토렌트', '드라마토렌트', '게임크랙',
          '크랙다운로드', '시리얼키공유', '키젠다운로드',
          '불법apk', 'vpn우회불법시청'
        ],
        [
          '주소홍보', '대체사이트', '링크공유', '다운로드공유',
          '텔레그램방'
        ]
      ),
      'quishingattacklink', 'qrphishingloginpage', 'fakecaptchaphishing',
      'clickfixmalwareprompt', 'mfabypassphishing', 'sessiontokentheft',
      'htmlattachmentphishing', 'pdfattachmentphishing', 'becinvoicefraud',
      'giftcardbecfraud', 'copyrightpiracylink', 'illegalstreamingmirror'
    ]
  }
];

const COMMON_RESTRICTED_KEYWORDS = buildReservedKeywordList(RESERVED_KEYWORD_CATEGORIES);
const RESERVED_NICKNAME_KEYWORDS = COMMON_RESTRICTED_KEYWORDS;
const RESERVED_USER_ID_KEYWORDS = COMMON_RESTRICTED_KEYWORDS;
const RESERVED_EMAIL_KEYWORDS = COMMON_RESTRICTED_KEYWORDS;

function isSysopUserId(userId) {
  return String(userId || '').trim().toLowerCase() === 'sysop';
}

function findExactReservedKeyword(value, keywords) {
  const normalizedValue = normalizeReservedIdentityText(value);
  if (!normalizedValue) return '';

  return keywords.find((keyword) => (
    normalizeReservedIdentityText(keyword) === normalizedValue
  )) || '';
}

function findReservedKeyword(value, keywords) {
  const normalizedValue = normalizeReservedIdentityText(value);
  if (!normalizedValue) return '';

  const exactKeyword = findExactReservedKeyword(value, EXACT_RESERVED_IDENTITY_KEYWORDS);
  if (exactKeyword) return exactKeyword;

  return keywords.find((keyword) => {
    const normalizedKeyword = normalizeReservedIdentityText(keyword);
    return normalizedKeyword && normalizedValue.includes(normalizedKeyword);
  }) || '';
}

function findReservedNicknameKeyword(nickName) {
  return findReservedKeyword(nickName, RESERVED_NICKNAME_KEYWORDS);
}

function findReservedUserIdKeyword(userId) {
  return findReservedKeyword(userId, RESERVED_USER_ID_KEYWORDS);
}

function findReservedEmailKeyword(email) {
  const localPart = String(email || '').split('@')[0];
  return findReservedKeyword(localPart, RESERVED_EMAIL_KEYWORDS);
}

function validateReservedNickname(nickName, userId) {
  const keyword = findReservedNicknameKeyword(nickName);
  return {
    allowed: !keyword || isSysopUserId(userId),
    keyword
  };
}

function validateReservedUserId(userId) {
  const keyword = findReservedUserIdKeyword(userId);
  return {
    allowed: !keyword,
    keyword
  };
}

function validateReservedEmail(email) {
  const keyword = findReservedEmailKeyword(email);
  return {
    allowed: !keyword,
    keyword
  };
}

function getReservedNicknameMessage(keyword = '') {
  const suffix = keyword ? ` (${keyword})` : '';
  return `사용할 수 없는 닉네임${suffix}입니다.`;
}

function getReservedUserIdMessage(keyword = '') {
  const suffix = keyword ? ` (${keyword})` : '';
  return `사용할 수 없는 ID${suffix}입니다.`;
}

function getReservedEmailMessage(keyword = '') {
  const suffix = keyword ? ` (${keyword})` : '';
  return `사용할 수 없는 이메일 주소${suffix}입니다.`;
}

module.exports = {
  EXACT_RESERVED_IDENTITY_KEYWORDS,
  RESERVED_KEYWORD_CATEGORIES,
  RESERVED_NICKNAME_KEYWORDS,
  RESERVED_USER_ID_KEYWORDS,
  RESERVED_EMAIL_KEYWORDS,
  findReservedNicknameKeyword,
  findReservedUserIdKeyword,
  findReservedEmailKeyword,
  getReservedNicknameMessage,
  getReservedUserIdMessage,
  getReservedEmailMessage,
  isSysopUserId,
  normalizeReservedIdentityText,
  normalizeReservedNicknameText,
  validateReservedNickname,
  validateReservedUserId,
  validateReservedEmail
};
