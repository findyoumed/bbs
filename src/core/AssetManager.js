/**
 * [LOG: 20260320_2125] 에셋 매니저 구현 (CP949 인코딩 패치)
 * [LOG: 20260404_1200] SSR→CSR 전환: 템플릿 처리 제거, raw text 반환으로 단순화
 * [LOG: 20260404_1500] CP949→UTF-8 변환 완료: 파일들이 UTF-8 로 저장됨
 * 역할: legacy/txt/ 폴더에서 파일을 읽어 원본 텍스트 반환
 *       매크로 치환은 브라우저의 public/js/core/TemplateEngine.js 가 담당
 */
const fs = require('fs');
const path = require('path');

function normalizeAssetPath(filename) {
    const raw = String(filename || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const withoutTxtPrefix = raw.replace(/^txt\//i, '');
    const normalized = path.normalize(withoutTxtPrefix);
    if (!normalized || normalized === '.' || normalized.startsWith('..')) {
        return '';
    }
    return normalized;
}

class AssetManager {
    constructor(legacyTxtPath) {
        this.legacyTxtPath = legacyTxtPath;
    }

    async getAsset(filename) {
        // [LOG: 20260404_2318] 메뉴 XML 의 txt/... 경로를 legacy/txt 기준 상대경로로 정규화
        const assetPath = normalizeAssetPath(filename);
        if (!assetPath) {
            // [LOG: 20260425_2220] 잘못된 상대경로는 디렉터리 read 시도 전에 즉시 차단
            console.error(`Asset load error [${filename}]:`, 'Invalid asset path');
            return `\x1b[31m[Error loading asset: ${filename}]\x1b[0m`;
        }
        const filePath = path.join(this.legacyTxtPath, assetPath);

        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            console.error(`Asset load error [${filename}]:`, err);
            return `\x1b[31m[Error loading asset: ${filename}]\x1b[0m`;
        }
    }

    exists(filename) {
        const assetPath = normalizeAssetPath(filename);
        if (!assetPath) {
            return false;
        }
        return fs.existsSync(path.join(this.legacyTxtPath, assetPath));
    }
}

if (typeof module !== 'undefined') {
    module.exports = AssetManager;
}
