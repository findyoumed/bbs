'use strict';

function createBridgeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

module.exports = {
  createBridgeError,
  normalizeAuthEmail
};
