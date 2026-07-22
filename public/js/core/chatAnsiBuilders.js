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

    // [LOG_ID: 20260718_1600] 방 목록을 olddos-bbs 원본의 정렬된 표로 재구성:
    //   `번호  방장(닉네임)  인원(n/m)  공개/비공개  주제`
    // 종전엔 "#번호 공개(인원) [개설자] 제목"을 한 줄에 욱여넣어 정렬이 안 맞고 개설자가
    // 아이디([guest])로 나왔다. 원본은 방장을 닉네임으로, 공개여부를 별도 칸으로 보여준다.
    // 방장 닉네임은 room.ownerNick(있으면)·없으면 owner를 쓴다.
    const roomCol = isMobile
      ? { no: 4, owner: 0, occ: 6, pub: 0 }
      : { no: 4, owner: 12, occ: 7, pub: 8 };
    const roomTitleWidth = targetCols
      - (roomCol.no + 1 + (roomCol.owner ? roomCol.owner + 1 : 0) + roomCol.occ + 1 + (roomCol.pub ? roomCol.pub + 1 : 0));

    // 방 목록 헤더
    let roomHeader = ansiColor(14) + fitCell('번호', roomCol.no, 'right') + ' ';
    if (roomCol.owner) roomHeader += fitCell('방장', roomCol.owner) + ' ';
    roomHeader += fitCell('인원', roomCol.occ, 'right') + ' ';
    if (roomCol.pub) roomHeader += fitCell('공개', roomCol.pub) + ' ';
    roomHeader += fitCell('주제', roomTitleWidth) + ANSI_RESET;
    parts.push(roomHeader);

    // [LOG_ID: 20260722_2900] 하이텔 길라잡이 책(그림 6.1 "대기실 상황") 실측 — 원전은 방 번호/
    // 제목 줄 바로 아래에 그 방에 있는 참여자들의 이름을 나열해 누가 있는지 미리 보여준다.
    // 지금까지는 인원 "수"만 보여주고 누가 있는지는 방에 직접 들어가야만 알 수 있었다 —
    // room.participants(publicRoom()이 이미 userId/nickName만 내려줌, 스키마 변경 불필요)로
    // 채운다. 한 줄 늘어나는 만큼 목록에 보여주는 방 수를 6→4로 줄여 24줄 예산을 지킨다.
    const maxRoomsToShow = isMobile ? 3 : 4;
    const maxNamesPerRoom = isMobile ? 2 : 4;
    if (!rooms || !rooms.length) {
      parts.push(ansiColor(8) + '   개설된 대화방이 없습니다.' + ANSI_RESET);
    } else {
      rooms.slice(0, maxRoomsToShow).forEach((room) => {
        const ownerNick = String(room.ownerName || room.ownerNick || room.owner || 'guest');
        const pubStr = room.visibility === '비밀방' ? '비공개' : '공개';
        const occStr = `${room.userCount}/${room.maxUser}`;
        const titleStr = room.title || room.name || '대화방';

        let line = ansiColor(15) + fitCell(String(room.no), roomCol.no, 'right') + ' ';
        if (roomCol.owner) line += ansiColor(11) + fitCell(ownerNick, roomCol.owner) + ' ';
        line += ansiColor(10) + fitCell(occStr, roomCol.occ, 'right') + ' ';
        if (roomCol.pub) line += ansiColor(room.visibility === '비밀방' ? 13 : 8) + fitCell(pubStr, roomCol.pub) + ' ';
        line += ansiColor(15) + fitCell(titleStr, roomTitleWidth) + ANSI_RESET;
        parts.push(line);

        const participants = Array.isArray(room.participants) ? room.participants : [];
        if (participants.length) {
          const shownNames = participants
            .slice(0, maxNamesPerRoom)
            .map((p) => `${p.nickName || p.userId}(${p.userId})`)
            .join('  ');
          const overflowCount = participants.length - maxNamesPerRoom;
          const previewText = overflowCount > 0 ? `${shownNames} 외 ${overflowCount}명` : shownNames;
          parts.push(ansiColor(8) + fitCell(`   ${previewText}`, targetCols - 1) + ANSI_RESET);
        }
      });
    }

    // 예산(24줄)에 맞게 패딩 줄 추가
    const joinedLines = parts.join('\n').split('\n');
    while (joinedLines.length < 24) {
      joinedLines.push('');
    }

    return {
      text: joinedLines.slice(0, 24).join('\n'),
      leftLabel: 'CHAT',
      centerLabel: '대기실',
      targetCols
    };
  }

  function buildChatRoomAnsi(room, messages, userNick, myId) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const roomName = String(room?.name || room?.title || room?.roomId || '대화실');
    const userCount = room?.userCount || room?.memberCount || '1';

    // [LOG_ID: 20260713_1020] 귓속말 필터링 및 렌더링
    const myIdNormalized = String(myId || '').trim().toLowerCase();
    
    // 제3자의 귓속말은 완전히 걸러내고, 나와 연관된 귓속말만 노출
    const filteredMessages = (messages || []).filter((msg) => {
      const text = String(msg.content || msg.message || '');
      const whisperMatch = text.match(/^\[TO:(\S+)\]\s*(.+)$/i);
      if (whisperMatch) {
        const recipient = whisperMatch[1].trim().toLowerCase();
        const sender = String(msg.userId || '').trim().toLowerCase();
        // 내가 보냈거나, 나에게 온 귓속말인 경우에만 통과
        return recipient === myIdNormalized || sender === myIdNormalized;
      }
      return true;
    });

    function msgLine(message) {
      const who = String(message.nickName || message.userId || '?');
      const senderId = String(message.userId || '').trim().toLowerCase();

      // [LOG_ID: 20260722_2800] 하이텔 책(그림 6.2 "대화실 참여") 실측 — 원전은 입장/퇴장할 때
      // "■■ 닉네임(아이디) 님이 입장(퇴장)하였습니다. ■■" 시스템 메시지를 대화 로그에 함께
      // 남긴다(join()/leave()가 서버에서 이 메시지를 만들어 messagesByRoomNo에 심어둔다).
      if (message.type === 'system') {
        const idLabel = senderId ? `(${message.userId})` : '';
        const verb = message.eventType === 'leave' ? '퇴장' : '입장';
        const line = `■■ ${who}${idLabel} 님이 ${verb}하였습니다. ■■`;
        return ansiColor(14) + fitCell(line, targetCols - 2) + ANSI_RESET;
      }

      let text = String(message.content || message.message || '');

      const whisperMatch = text.match(/^\[TO:(\S+)\]\s*(.+)$/i);
      if (whisperMatch) {
        // 나에게 온 귓속말 또는 내가 보낸 귓속말인 경우
        const recipient = whisperMatch[1].trim();
        const actualText = whisperMatch[2].trim();
        const isFromMe = senderId === myIdNormalized;

        const prefix = isFromMe 
          ? `[귓속말 -> ${recipient}] ` 
          : `[귓속말][${who}] `;
          
        const maxText = (targetCols - 2) - displayWidth(prefix);
        // 귓속말은 Hitel 원전 감성을 살려 핑크색(13)으로 표시
        return ansiColor(13) + prefix + ansiColor(15) + fitCell(actualText, maxText) + ANSI_RESET;
      }

      // [LOG_ID: 20260722_2700] 하이텔 책(그림 6.2 "대화실 참여") 실측 대조 — 원전은
      // "[닉네임] 메시지"가 아니라 "닉네임(아이디)   메시지"(대괄호 없이, 이름 뒤에 아이디를
      // 괄호로 붙이고 고정폭으로 맞춘 뒤 메시지) 형식이었다. 대괄호 프리픽스는 우리 쪽 임의
      // 표기였음 — 원전 형식으로 교체한다(사용자 요청: "하이텔과 똑같이 만들어").
      const idLabel = senderId ? `(${message.userId})` : '';
      const label = `${who}${idLabel}`;
      const labelWidth = isMobile ? 12 : 18;
      const prefix = fitCell(label, labelWidth) + '  ';
      const maxText = (targetCols - 2) - displayWidth(prefix);

      const isMe = who === userNick;
      const color = isMe ? ansiColor(10) : ansiColor(11);

      return color + prefix + ansiColor(15) + fitCell(text, maxText) + ANSI_RESET;
    }

    // [LOG: 20260707_1424] 대화방도 4줄 상단바 헤더 필수 — 누락 시 첫 메시지가 로고로 오인되고
    // 앞 4줄의 메시지가 잘려나간다. (18줄 패딩 계산과 분리하기 위해 반환 시점에 결합)
    const header = buildTopHeader({ leftLabel: 'CHAT', centerLabel: roomName }, '', targetCols);
    // [LOG: 20260707_1424] 상단바 4줄이 본문 앞에 추가되므로 메시지 슬롯은 16줄이 화면 예산(80x24)에 맞는다.
    // (18줄이면 하단 상태줄이 잘리고 세로 스크롤이 생긴다)
    const parts = [];
    const shown = filteredMessages.slice(-16);
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
