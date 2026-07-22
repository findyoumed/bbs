// [LOG_ID: 20260722_2300] 'guest-blocked' — 게스트가 회원정보 화면에 접근했을 때 안내 메시지를
// 먼저 보여주고 ENTER로 초기화면 이동을 기다리는 전용 모드(아래 ensureMyInfoAccess 참고).
const MYINFO_MODES = new Set(['view', 'nickname', 'email', 'password', 'delete', 'guest-blocked']);
// [LOG: 20260509_0959] delete-confirm이 idle로 정규화되면 탈퇴 확인 프롬프트가 비밀번호 프롬프트로 되돌아간다.
const MYINFO_STAGES = new Set(['idle', 'email-current', 'email-new', 'password-current', 'password-new', 'password-confirm', 'password-saving', 'delete-password', 'delete-confirm', 'delete-complete']);

export function createMyInfoState(state) {
    function normalizeMode(mode) {
        const normalized = String(mode || 'view').trim().toLowerCase();
        return MYINFO_MODES.has(normalized) ? normalized : 'view';
    }

    function getMode() {
        return normalizeMode(state._myInfoMode);
    }

    function setMode(mode) {
        state._myInfoMode = normalizeMode(mode);
    }

    function getStage() {
        const normalized = String(state._myInfoStage || 'idle').trim().toLowerCase();
        return MYINFO_STAGES.has(normalized) ? normalized : 'idle';
    }

    function setStage(stage) {
        const normalized = String(stage || '').trim().toLowerCase();
        state._myInfoStage = MYINFO_STAGES.has(normalized) ? normalized : 'idle';
    }

    function getDraft() {
        return state._myInfoDraft && typeof state._myInfoDraft === 'object'
            ? state._myInfoDraft
            : {};
    }

    function setDraft(nextDraft = {}) {
        state._myInfoDraft = { ...getDraft(), ...nextDraft };
    }

    function clearDraft() {
        state._myInfoDraft = {};
    }

    function getTranscript() {
        return Array.isArray(state._myInfoTranscript) ? state._myInfoTranscript : [];
    }

    function appendTranscriptLine(line) {
        const prompt = String(line?.prompt || '');
        const value = String(line?.value || '');
        const isHtml = Boolean(line?.isHtml);
        if (!prompt.trim() && !value.trim()) {
            return;
        }
        state._myInfoTranscript = [...getTranscript(), { prompt, value, isHtml }];
    }

    function clearTranscript() {
        state._myInfoTranscript = [];
    }

    function setMessage(text = '', type = 'notice') {
        state._myInfoMessage = String(text || '').trim();
        state._myInfoMessageType = type === 'error' ? 'error' : 'notice';
    }

    function clearMessage() {
        state._myInfoMessage = '';
        state._myInfoMessageType = 'notice';
    }

    function resetMyInfoState() {
        setMode('view');
        setStage('idle');
        clearDraft();
        clearTranscript();
        clearMessage();
    }

    return {
        appendTranscriptLine,
        clearDraft,
        clearMessage,
        clearTranscript,
        getDraft,
        getMode,
        getStage,
        getTranscript,
        resetMyInfoState,
        setDraft,
        setMessage,
        setMode,
        setStage
    };
}
