// [LOG_ID: 20260728_1628] 마이그레이션 0021 nick_name UNIQUE 인덱스 적용
// pg 라이브러리로 직접 DDL 실행
'use strict';

async function main() {
  let pg;
  try {
    pg = require('pg');
  } catch (e) {
    console.log('pg 모듈 없음:', e.message);
    return;
  }

  const { Client } = pg;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('pg 연결 성공!');

    // 현재 members 테이블 인덱스 확인
    const { rows: indexes } = await client.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='members' ORDER BY indexname"
    );
    console.log('members 현재 인덱스:');
    indexes.forEach(r => console.log('  ' + r.indexname + ': ' + r.indexdef));

    // nick_name UNIQUE 인덱스 생성
    const hasNickUnique = indexes.some(r => r.indexname === 'idx_members_nick_name_unique');
    if (hasNickUnique) {
      console.log('\n[OK] nick_name UNIQUE 인덱스 이미 존재 — 마이그레이션 0021 완전 적용 완료');
    } else {
      console.log('\nnick_name UNIQUE 인덱스 생성 중...');
      await client.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_members_nick_name_unique ON public.members (nick_name) WHERE nick_name IS NOT NULL AND nick_name <> ''"
      );
      console.log('[OK] nick_name UNIQUE 인덱스 생성 완료');
    }

    // email UNIQUE 인덱스 확인 (이미 적용됨이 테스트로 확인됨)
    const hasEmailUnique = indexes.some(r => r.indexname === 'idx_members_email_unique');
    if (hasEmailUnique) {
      console.log('[OK] email UNIQUE 인덱스 이미 존재');
    } else {
      console.log('\nemail UNIQUE 인덱스 생성 중...');
      await client.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_unique ON public.members (email) WHERE email IS NOT NULL AND email <> ''"
      );
      console.log('[OK] email UNIQUE 인덱스 생성 완료');
    }

    // 최종 확인
    const { rows: finalIndexes } = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename='members' ORDER BY indexname"
    );
    console.log('\n최종 members 인덱스:');
    finalIndexes.forEach(r => console.log('  ' + r.indexname));

  } catch (err) {
    console.error('오류:', err.message);
    if (err.code) console.error('코드:', err.code);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
