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

  // [LOG_ID: 20260713_1000] 대기실 상황판(ST) 원전 레이아웃(그림 6.1) 재현
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
      const num = String(index + 1).padStart(4);
      const userIdVal = user.userId || '';
      const nickNameVal = user.nickName || user.displayName || '';
      const locationVal = user.location || user.screen || '대기실';

      if (isMobile) {
        return ansiColor(8) + num + ' ' +
          ansiColor(15) + fitCell(userIdVal, 12) + ' ' +
          ansiColor(11) + fitCell(nickNameVal, 10) + ' ' +
          ansiColor(7) + fitCell(locationVal, 14) +
          ANSI_RESET;
      }
      return ansiColor(8) + num + ' ' +
        ansiColor(15) + fitCell(userIdVal, 15) + ' ' +
        ansiColor(11) + fitCell(nickNameVal, 12) + ' ' +
        ansiColor(7) + fitCell(locationVal, 25) +
        ANSI_RESET;
    }

    // [LOG_ID: 20260713_1000] 대기실 인원 수 및 대화실 방 정보 통계 라인 빌드
    const lobbyUserCount = users.length;
    const activeRoomCount = rooms.length;
    const totalChatUserCount = rooms.reduce((acc, r) => acc + (r.userCount || 0), 0);

    let infoLineText = '';
    if (isMobile) {
      infoLineText = ` 【대기실】 ${lobbyUserCount}명 / 【대화실】 방:${activeRoomCount}개`;
    } else {
      infoLineText = ` 【대기실】 ${lobbyUserCount} 명 / 【대화실】 (개설방수: ${activeRoomCount}/100 현재참여인원: ${totalChatUserCount} 명)`;
    }

    const parts = [
      buildTopHeader({ leftLabel: 'CHAT', centerLabel: '대화실 대기실' }, '', targetCols),
      ansiColor(11) + infoLineText + ANSI_RESET,
      colHeader(),
      ansiHLine(targetCols, 8)
    ];

    // 접속자는 공간 확보를 위해 6명까지만 제한 출력
    const maxUsersToShow = isMobile ? 4 : 6;
    if (!users.length) {
      parts.push(ansiColor(8) + '   접속 중인 사용자가 없습니다.' + ANSI_RESET);
    } else {
      users.slice(0, maxUsersToShow).forEach((user, index) => parts.push(userLine(user, index)));
    }

    parts.push(ansiHLine(targetCols, 8));

    // 방 목록 세로 리스팅 (#번호 공개/비밀(인원) [개설자] 방제목)
    const maxRoomsToShow = isMobile ? 4 : 6;
    if (!rooms || !rooms.length) {
      parts.push(ansiColor(8) + '   개설된 대화방이 없습니다.' + ANSI_RESET);
    } else {
      rooms.slice(0, maxRoomsToShow).forEach((room) => {
        const roomNoStr = `#${room.no}`;
        const visibilityStr = room.visibility === '비밀방' ? '비밀' : '공개';
        const occupancyStr = `(${room.userCount}/${room.maxUser})`;
        const ownerStr = `[${room.owner || 'guest'}]`;
        const titleStr = room.title || '대화방';

        if (isMobile) {
          const roomMeta = fitCell(`${roomNoStr} ${visibilityStr}${occupancyStr}`, 15);
          const roomTitle = fitCell(titleStr, 27);
          parts.push(
            ansiColor(10) + roomMeta + ' ' +
            ansiColor(15) + roomTitle +
            ANSI_RESET
          );
        } else {
          const roomMeta = fitCell(`${roomNoStr} ${visibilityStr}${occupancyStr}`, 16);
          const roomOwner = fitCell(ownerStr, 15);
          const roomTitle = fitCell(titleStr, 45);
          parts.push(
            ansiColor(10) + roomMeta + ' ' +
            ansiColor(11) + roomOwner + ' ' +
            ansiColor(15) + roomTitle +
            ANSI_RESET
          );
        }
      });
    }

    // 예산(24줄)에 맞게 패딩 줄 추가
    while (parts.length < 24) {
      parts.push('');
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
