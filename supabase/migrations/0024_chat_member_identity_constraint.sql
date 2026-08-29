-- [LOG_ID: 20260829_0219] 채팅 참여자 upsert 충돌 키 정합성 보강
-- ChatRoomMemberPersistence는 room_id,user_id 조합으로 재입장을 upsert한다.
-- 신규 프로젝트에도 동일한 유일성 계약을 보장해야 인증 회원의 재접속이
-- 중복 행을 만들지 않고 기존 참여자 기록을 갱신할 수 있다.

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_room_members_room_user_unique
  ON public.chat_room_members (room_id, user_id);
