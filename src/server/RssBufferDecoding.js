'use strict';

// [LOG_ID: 20260730_0800] `decodeXmlBuffer`(RssServiceBase.js, RSS/XML 피드 응답 디코딩)와
// `decodeHtmlBuffer`(RssNewsService.js, 기사 본문 HTML 디코딩)는 charset을 알아내는 방식은
// 서로 다르다(XML은 <?xml encoding="..."?> 선언을, HTML은 <meta charset>/http-equiv 태그를
// 본다 — 이 차이는 진짜 의도된 것이라 각 파일에 남겨둔다) — 하지만 charset을 알아낸 "이후"
// 실제로 버퍼를 문자열로 바꾸는 마지막 5줄은 두 파일에 바이트 그대로 복제돼 있었다.
function decodeBufferWithCharset(buffer, charset) {
  const decoderName = /^(euc-kr|cp949|windows-949|ks_c_5601-1987)$/.test(charset) ? 'windows-949' : 'utf-8';
  try {
    return new TextDecoder(decoderName).decode(new Uint8Array(buffer));
  } catch (err) {
    return new TextDecoder('utf-8').decode(new Uint8Array(buffer));
  }
}

module.exports = {
  decodeBufferWithCharset
};
