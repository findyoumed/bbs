/**
 * [LOG: 20260410_2345] ANSI 렌더링 엔진 코어
 */
import { displayWidth, isWideChar } from './ansiRenderUtils.js';

export function createAnsiEngine(deps) {
    const { state } = deps;

    const ANSI_PALETTES = {
        default: [
            '#000000', '#aa0000', '#00aa00', '#aa5500', '#0000aa', '#aa00aa', '#00aaaa', '#aaaaaa',
            '#555555', '#ff5555', '#55ff55', '#ffff55', '#5555ff', '#ff55ff', '#55ffff', '#ffffff'
        ],
        amber: [
            '#000000', '#ffb000', '#ffb000', '#ffb000', '#ffb000', '#ffb000', '#ffb000', '#ffb000',
            '#ffb000', '#ffcc00', '#ffcc00', '#ffcc00', '#ffcc00', '#ffcc00', '#ffcc00', '#ffcc00'
        ],
        green: [
            '#000000', '#00ff00', '#00ff00', '#00ff00', '#00ff00', '#00ff00', '#00ff00', '#00ff00',
            '#00ff00', '#33ff33', '#33ff33', '#33ff33', '#33ff33', '#33ff33', '#33ff33', '#33ff33'
        ]
    };

    function escCell(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function ansiToHTML(text) {
        // [LOG: 20260709_1040] 클라이언트단 렌더링 초입에서 NFD 자모를 NFC 결합 형태 음절로 정규화하여 자모 분리 렌더링을 방지
        text = String(text || '').normalize('NFC');
        const COLS = 80;
        const ROWS = 25;
        const buf = Array.from({ length: ROWS }, () =>
            Array.from({ length: COLS }, () => ({ ch: ' ', fg: 7, bg: 0, bold: false, rev: false }))
        );

        let row = 0, col = 0;
        let fg = 7, bg = 0, bold = false, rev = false;

        function putChar(ch) {
            if (row >= ROWS || col >= COLS) return;
            buf[row][col] = { ch, fg, bg, bold, rev };
            col++;
        }

        for (let i = 0; i < text.length;) {
            if (text[i] === '\x1b' && text[i + 1] === '[') {
                let j = i + 2;
                let arg = '';
                while (j < text.length && /[0-9;]/.test(text[j])) { arg += text[j]; j++; }
                const cmd = text[j];
                i = j + 1;

                if (cmd === 'm') {
                    const codes = arg.split(';').map(Number);
                    if (arg === '') codes.push(0);
                    for (const code of codes) {
                        if (code === 0) { fg = 7; bg = 0; bold = false; rev = false; }
                        else if (code === 1) bold = true;
                        else if (code === 7) rev = true;
                        else if (code >= 30 && code <= 37) fg = code - 30;
                        else if (code >= 40 && code <= 47) bg = code - 40;
                        else if (code === 39) fg = 7;
                        else if (code === 49) bg = 0;
                    }
                }
            } else if (text[i] === '\r') {
                col = 0; i++;
            } else if (text[i] === '\n') {
                col = 0; row++; i++;
            } else {
                const cp = text.codePointAt(i);
                putChar(text[i]);
                i += cp > 0xFFFF ? 2 : 1;
            }
        }

        const lines = [];
        const plainRows = [];
        for (let r = 0; r < ROWS; r++) {
            let html = '';
            let plain = '';
            let cFg = -1, cBg = -1, cBold = false, cRev = false, chunk = '';

            const flush = () => {
                if (!chunk) return;
                let actualFg = cFg < 0 ? 7 : cFg;
                let actualBg = cBg < 0 ? 0 : cBg;

                // [LOG: 20260611_1220] Handle ANSI Reverse attribute
                if (cRev) {
                    const tmp = actualFg;
                    actualFg = (actualBg === 0) ? 0 : actualBg;
                    actualBg = (tmp === 7 && cFg < 0) ? 7 : tmp;
                }

                const classes = [];
                classes.push(`ansi-fg-${actualFg}`);
                if (actualBg !== 0) classes.push(`ansi-bg-${actualBg}`);
                if (cBold) classes.push('ansi-bold');

                const classAttr = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
                html += `<span${classAttr}>${escCell(chunk)}</span>`;
                chunk = '';
            };

            for (let c = 0; c < COLS; c++) {
                const cell = buf[r][c];
                if (cell.ch === '\x00') continue;
                plain += cell.ch;
                if (cell.fg !== cFg || cell.bg !== cBg || cell.bold !== cBold || cell.rev !== cRev) {
                    flush();
                    cFg = cell.fg; cBg = cell.bg; cBold = cell.bold; cRev = cell.rev;
                }
                chunk += cell.ch;
            }
            flush();
            plainRows.push(plain);
            lines.push(`<div class="ansi-line">${html || '\u00a0'}</div>`);
        }
        return { html: lines.join(''), rows: plainRows, cols: COLS, rowCount: ROWS };
    }

    return { ansiToHTML };
}
