// [LOG: 20260903_1215] 주석 노출 방지를 위해 HTML 및 JS 주석을 안전하게 제거하는 유틸리티 모듈
'use strict';

/**
 * HTML 주석(<!-- ... -->)을 제거합니다.
 * @param {string} htmlText 
 * @returns {string}
 */
function stripHtmlComments(htmlText) {
  if (typeof htmlText !== 'string') return htmlText;
  return htmlText.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * JavaScript 코드에서 따옴표 안의 문자열은 유지하면서
 * 실제 라인 주석(// ...)과 블록 주석(/* ... *\/)을 제거합니다.
 * @param {string} jsText 
 * @returns {string}
 */
function stripJsComments(jsText) {
  if (typeof jsText !== 'string') return jsText;
  return jsText.replace(
    (/(["'])(?:(?=(\\?))\2[\s\S])*?\1|(`(?:[^`\\]|\\.|\$(?!\{))*`)|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g),
    (match, singleDouble, backslash, template, comment) => {
      if (comment) {
        return '';
      }
      return match;
    }
  );
}

/**
 * 확장자에 따라 주석을 제거한 텍스트를 반환합니다.
 * @param {string} content 
 * @param {string} ext (.html 또는 .js)
 * @returns {string}
 */
function stripCommentsByExtension(content, ext) {
  if (ext === '.html') {
    return stripHtmlComments(content);
  }
  if (ext === '.js') {
    return stripJsComments(content);
  }
  return content;
}

module.exports = {
  stripHtmlComments,
  stripJsComments,
  stripCommentsByExtension
};
