'use strict';

const { createValidationError } = require('../httpUtils');

const FIELD_LABELS = {
  userId: 'ID',
  nickName: '이용자명',
  email: '이메일',
  password: '비밀번호',
  passwordConfirm: '비밀번호 확인',
  recipientUserId: '받는 회원 ID',
  title: '제목',
  subject: '제목',
  content: '내용',
  redirectTo: '이동 경로',
  userIdOrEmail: '아이디 또는 이메일',
  sex: '성별',
  level: '회원 레벨',
  page: '페이지'
};

function getSourceLabel(source) {
  if (source === 'body') return '입력값';
  if (source === 'query') return '조회 조건';
  return '요청값';
}

function getFieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

function hasFinalConsonant(text) {
  const lastChar = String(text || '').trim().slice(-1);
  if (!lastChar) return false;
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return /[013678klmnptLMNPRST]/.test(lastChar);
  }
  return ((code - 0xac00) % 28) !== 0;
}

function appendParticle(text, withBatchim, withoutBatchim) {
  return `${text}${hasFinalConsonant(text) ? withBatchim : withoutBatchim}`;
}

function validateObjectAgainstSchema(obj, schema, source) {
  for (const [key, rules] of Object.entries(schema)) {
    const value = obj[key];
    const sourceLabel = getSourceLabel(source);
    const fieldLabel = getFieldLabel(key);

    if (rules.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
      throw createValidationError(`${appendParticle(fieldLabel, '을', '를')} 입력해 주세요.`);
    }

    if (value !== undefined && value !== null && value !== '') {
      const valueStr = String(value);

      if (rules.type === 'number' && Number.isNaN(Number(value))) {
        throw createValidationError(`${appendParticle(fieldLabel, '은', '는')} 숫자로 입력해 주세요.`);
      }

      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          throw createValidationError(`${appendParticle(fieldLabel, '은', '는')} ${rules.minLength}자 이상이어야 합니다.`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          throw createValidationError(`${appendParticle(fieldLabel, '은', '는')} ${rules.maxLength}자 이하여야 합니다.`);
        }
      }

      if (Array.isArray(rules.enum) && !rules.enum.includes(value)) {
        throw createValidationError(`${appendParticle(fieldLabel, '은', '는')} 다음 값 중 하나여야 합니다: ${rules.enum.join(', ')}.`);
      }

      if (rules.pattern && !rules.pattern.test(valueStr)) {
        throw createValidationError(`${fieldLabel} 형식이 올바르지 않습니다.`);
      }

      if (typeof rules.custom === 'function') {
        const result = rules.custom(value, obj);
        if (result === false) {
          throw createValidationError(`${sourceLabel}의 ${fieldLabel} 값이 올바르지 않습니다.`);
        }
      }
    }
  }
}

function validateRequestSchema(requestUrl, body, schema) {
  if (schema.body && body) {
    validateObjectAgainstSchema(body, schema.body, 'body');
  }
  if (schema.query) {
    const query = Object.fromEntries(requestUrl.searchParams.entries());
    validateObjectAgainstSchema(query, schema.query, 'query');
  }
}

module.exports = {
  validateObjectAgainstSchema,
  validateRequestSchema
};
