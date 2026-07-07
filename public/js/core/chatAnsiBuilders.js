import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

export function createChatAnsiBuilders(deps) {
  const {
    ANSI_RESET,
    ansiColor,
    ansiHLine,
    buildTopHeader,
    displayWidth,
    fitCell,
    truncateDisplayText
  } = createAnsiBuilderUtils(deps);

  function buildChatLobbyAnsi(users, rooms) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    function colHeader() {
      if (isMobile) {
        return ansiColor(14) +
          fitCell('번호', 4, 'right') + ' ' +
          fitCell('아이디', 12) + ' ' +
          fitCell('닉네임', 10) + ' ' +
          fitCell('위치', 14) +
          ANSI_RESET;
      }
      return ansiColor(14) +
        fitCell('번호', 4, 'right') + ' ' +
        fitCell('아이디', 15) + ' ' +
        fitCell('닉네임', 12) + ' ' +
        fitCell('현재위치', 25) +
        ANSI_RESET;
    }

    function userLine(user, index) {
      if (isMobile) {
        const num = String(index + 1).padStart(4);
        const userId = fitCell(user.userId || '', 12);
        const nickName = fitCell(user.nickName || user.displayName || '', 10);
        const location = fitCell(user.location || user.screen || '대기실', 14);

        return ansiColor(8) + num + ' ' +
          ansiColor(15) + userId + ' ' +
          ansiColor(11) + nickName + ' ' +
          ansiColor(7) + location +
          ANSI_RESET;
      }
      const num = String(index + 1).padStart(4);
      const userId = fitCell(user.userId || '', 15);
      const nickName = fitCell(user.nickName || user.displayName || '', 12);
      const location = fitCell(user.location || user.screen || '대기실', 25);

      return ansiColor(8) + num + ' ' +
        ansiColor(15) + userId + ' ' +
        ansiColor(11) + nickName + ' ' +
        ansiColor(7) + location +
        ANSI_RESET;
    }

    // [LOG: 20260707_1424] renderAnsiScreenWithTopbar는 본문 앞 4줄을 상단바 헤더로 파싱·제거한다.
    // 다른 모든 빌더처럼 buildTopHeader를 앞에 붙이지 않으면 접속자 컬럼 헤더가 로고 자리에 박히고
    // 본문 첫 4줄(접속자 목록)이 통째로 잘려나가는 화면 깨짐이 발생한다.
    const parts = [
      buildTopHeader({ leftLabel: 'CHAT', centerLabel: '대화실 대기실' }, '', targetCols),
      colHeader(),
      ansiHLine(targetCols, 8)
    ];

    if (!users.length) {
      parts.push(ansiColor(8) + '   접속 중인 사용자가 없습니다.' + ANSI_RESET);
    } else {
      users.slice(0, 12).forEach((user, index) => parts.push(userLine(user, index)));
    }

    parts.push(ansiHLine(targetCols, 8));

    if (rooms && rooms.length) {
      parts.push(
        ansiColor(14) + (isMobile ? ' [방] ' : ' [대화실 목록] ') +
        ansiColor(15) + rooms.slice(0, 3).map((room, index) => `[${index + 1}] ${truncateDisplayText(room.name || room.title || room.no, isMobile ? 8 : 20)}`).join('  ') +
        ANSI_RESET
      );
      parts.push(ansiHLine(targetCols, 8));
    }

    return {
      text: parts.join('\n'),
      leftLabel: 'CHAT',
      centerLabel: '대기실',
      targetCols
    };
  }

  function buildChatRoomAnsi(room, messages, userNick) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const roomName = String(room?.name || room?.title || room?.roomId || '대화실');
    const userCount = room?.userCount || room?.memberCount || '1';

    function msgLine(message) {
      const who = String(message.nickName || message.userId || '?');
      const text = String(message.content || message.message || '');
      const prefix = `[${who}] `;
      const maxText = (targetCols - 2) - displayWidth(prefix);

      const isMe = who === userNick;
      const color = isMe ? ansiColor(10) : ansiColor(11);

      return color + `[${who}] ` + ansiColor(15) + fitCell(text, maxText) + ANSI_RESET;
    }

    // [LOG: 20260707_1424] 대화방도 4줄 상단바 헤더 필수 — 누락 시 첫 메시지가 로고로 오인되고
    // 앞 4줄의 메시지가 잘려나간다. (18줄 패딩 계산과 분리하기 위해 반환 시점에 결합)
    const header = buildTopHeader({ leftLabel: 'CHAT', centerLabel: roomName }, '', targetCols);
    // [LOG: 20260707_1424] 상단바 4줄이 본문 앞에 추가되므로 메시지 슬롯은 16줄이 화면 예산(80x24)에 맞는다.
    // (18줄이면 하단 상태줄이 잘리고 세로 스크롤이 생긴다)
    const parts = [];
    const shown = messages.slice(-16);
    for (const message of shown) {
      parts.push(msgLine(message));
    }

    while (parts.length < 16) {
      parts.push('');
    }

    parts.push(ansiHLine(targetCols, 8));
    parts.push(ansiColor(8) + fitCell(`  (참여자: ${userCount}명 / 종료: /Q)`, targetCols - 2) + ANSI_RESET);

    return {
      text: [header, ...parts].join('\n'),
      leftLabel: 'CHAT',
      centerLabel: roomName,
      targetCols
    };
  }

  return {
    buildChatLobbyAnsi,
    buildChatRoomAnsi
  };
}
