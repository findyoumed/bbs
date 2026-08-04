<<<<<<< HEAD
/**
 * [LOG_ID: 20260804_1114] Attachment operations are isolated from the core post
 * cache service so they can be loaded only when an attachment feature is used.
 */
=======
// [LOG_ID: 20260804_1114] 첨부파일 조회/업로드/다운로드 로직을 첫 사용 시점에만 불러오도록 분리한다.

>>>>>>> a02d9e17aede33842895ca7e5f781b3897205d30
export function createPostAttachmentService({ apiFetch, state }) {
  async function loadAttachments(boardId, postId) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}/attachments`);
    return Array.isArray(result) ? result : [];
  }

  // [LOG_ID: 20260727_1225] 서버(POST /attachments)는 이미 구현돼 있었지만 이를 호출하는
  // 클라이언트 코드가 전혀 없어(PDS 게시판의 "UP(올리기)" 명령조차 글만 쓰고 파일은 절대
  // 붙이지 못했다) 첨부파일 업로드 자체가 통째로 불가능했다 — 다운로드/목록 조회만 되던
  // 반쪽짜리 기능이었다(사용자 요청 "PDS 업로드/다운로드 전수조사"로 발견).
  async function uploadAttachment(boardId, postId, payload) {
    return apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  function pickAttachmentDownloadName(fileName, contentDisposition) {
    const preferredName = String(fileName || '').trim();
<<<<<<< HEAD
    if (preferredName) return preferredName;
=======
    if (preferredName) {
      return preferredName;
    }
>>>>>>> a02d9e17aede33842895ca7e5f781b3897205d30

    const headerValue = String(contentDisposition || '');
    const encodedMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
    if (encodedMatch?.[1]) {
      try {
        return decodeURIComponent(encodedMatch[1]);
      } catch (error) {
        console.error('첨부 파일명 decode 실패:', error.message);
      }
    }

<<<<<<< HEAD
    const quotedMatch = headerValue.match(/filename=\"?([^\";]+)\"?/i);
    return quotedMatch?.[1]?.trim() || 'attachment.bin';
=======
    const quotedMatch = headerValue.match(/filename="?([^";]+)"?/i);
    if (quotedMatch?.[1]) {
      return quotedMatch[1].trim();
    }

    return 'attachment.bin';
>>>>>>> a02d9e17aede33842895ca7e5f781b3897205d30
  }

  async function downloadAttachment(boardId, postId, attachmentId, fileName = '') {
    const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}/attachments/${attachmentId}/download`, {
      method: 'GET',
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : {}
    });

    if (!response.ok) {
      const rawText = await response.text();
      let message = `첨부 파일 다운로드 실패 (${response.status})`;
      if (rawText) {
        try {
          const payload = JSON.parse(rawText);
          message = String(payload?.message || payload?.error?.message || message);
        } catch (error) {
          message = rawText.trim() || message;
        }
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = pickAttachmentDownloadName(fileName, response.headers.get('content-disposition'));
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return true;
  }

<<<<<<< HEAD
  return { downloadAttachment, loadAttachments, uploadAttachment };
=======
  return {
    loadAttachments,
    uploadAttachment,
    pickAttachmentDownloadName,
    downloadAttachment
  };
>>>>>>> a02d9e17aede33842895ca7e5f781b3897205d30
}
