/**
 * [LOG: 20260320_2120] 템플릿 엔진 구현
 * 역할: [nummembers], [red] 등 원본 BB코드를 ANSI/사설 코드로 치환
 */

const COLOR_NAMES = [
    "black", "darkgrey", "blue", "lightblue", "green", "lightgreen",
    "cyan", "lightcyan", "red", "lightred", "purple", "magenta",
    "brown", "yellow", "grey", "white"
];

class TemplateEngine {
    constructor() {
        this.mappings = {};
    }

    // 동적 데이터 업데이트 (DB 등에서 가져온 값)
    updateData(data) {
        this.mappings = {
            "[hostname]": data.hostname || "01410",
            "[nummembers]": data.nummembers || "0",
            "[numconns]": data.numconns || "1",
            "[numarticles]": data.numarticles || "0",
            "[todaynumarticles]": data.todaynumarticles || "0"
        };
    }

    process(text) {
        let result = text;

        // 1. 동적 매크로 치환
        for (const [tag, value] of Object.entries(this.mappings)) {
            result = result.split(tag).join(value);
        }

        // 2. 글자색 치환 [color] -> \x1b[=NF
        COLOR_NAMES.forEach((name, i) => {
            const tag = `[${name}]`;
            const ansi = `\x1b[=${i}F`;
            result = result.split(tag).join(ansi);
        });

        // 3. 배경색 치환 [bcolor] -> \x1b[=NG
        COLOR_NAMES.forEach((name, i) => {
            const tag = `[b${name}]`;
            const ansi = `\x1b[=${i}G`;
            result = result.split(tag).join(ansi);
        });

        // 4. 기타 특수 태그 (속성 초기화 등)
        result = result.split("[reset]").join("\x1b[0m");

        return result;
    }
}

if (typeof module !== 'undefined') {
    module.exports = TemplateEngine;
}
