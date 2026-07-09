'use strict';

/**
 * [LOG: 20260426_1545] Evolution: Standardized BBS API response builder.
 * Provides a consistent structure for all API responses and better chaining.
 */
class BbsResponse {
  constructor(res) {
    this.res = res;
    this._statusCode = 200;
    this._success = true;
    this._message = 'Success';
    this._data = null;
    this._error = null;
    this._headers = {
      'Content-Type': 'application/json; charset=utf-8'
    };
  }

  status(code) {
    this._statusCode = code;
    this._success = code >= 200 && code < 300;
    return this;
  }

  message(msg) {
    this._message = msg;
    return this;
  }

  data(payload) {
    this._data = payload;
    return this;
  }

  error(err) {
    this._error = err;
    this._success = false;
    if (this._statusCode === 200) {
      this._statusCode = err.status || 500;
    }
    return this;
  }

  header(name, value) {
    this._headers[name] = value;
    return this;
  }

  send() {
    // [LOG: 20260618_1710] Prevent ERR_HTTP_HEADERS_SENT crash if response was already started
    if (this.res.headersSent) {
      this.res.end();
      return;
    }

    const payload = {
      success: this._success,
      status: this._statusCode,
      message: this._message,
      timestamp: new Date().toISOString()
    };

    if (this._data !== null) {
      payload.data = this._data;
    }

    if (this._error && process.env.NODE_ENV !== 'production') {
      payload.error = {
        name: this._error.name,
        message: this._error.message,
        stack: this._error.stack
      };
    }

    this.res.writeHead(this._statusCode, this._headers);
    this.res.end(JSON.stringify(payload).normalize('NFC'));
  }

  static success(res, data, message = 'Success') {
    return new BbsResponse(res).status(200).data(data).message(message).send();
  }

  static created(res, data, message = 'Created') {
    return new BbsResponse(res).status(201).data(data).message(message).send();
  }

  static error(res, statusCode, message, error = null) {
    const response = new BbsResponse(res).status(statusCode).message(message);
    if (error) response.error(error);
    return response.send();
  }
}

module.exports = BbsResponse;
