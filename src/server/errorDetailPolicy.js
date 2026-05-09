'use strict';

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function shouldHideErrorDetail(env = process.env, status = 500) {
  const numericStatus = Number(status || 500);
  if (numericStatus < 500) {
    return false;
  }

  return isTruthy(env.HIDE_ERROR_DETAIL)
    || String(env.NODE_ENV || '').trim().toLowerCase() === 'production'
    || Boolean(env.VERCEL);
}

function toClientErrorMessage(error, status = 500, env = process.env) {
  if (shouldHideErrorDetail(env, status)) {
    return 'Internal Server Error';
  }

  return error?.message || 'Internal Server Error';
}

module.exports = {
  isTruthy,
  shouldHideErrorDetail,
  toClientErrorMessage
};
