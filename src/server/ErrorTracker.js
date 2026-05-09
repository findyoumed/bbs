'use strict';

/**
 * [LOG: 20260425_2248] Refactored ErrorTracker with better stack parsing and automatic breadcrumb integration
 */

const crypto = require('crypto');
const os = require('os');
const logger = require('./logger');

let processHandlersRegistered = false;

function parseSentryDsn(dsn) {
  const raw = String(dsn || '').trim();
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    const publicKey = decodeURIComponent(url.username || '');
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const projectId = pathSegments.pop();
    if (!publicKey || !projectId) {
      return null;
    }

    const basePath = pathSegments.length ? `/${pathSegments.join('/')}` : '';
    return {
      publicDsn: `${url.protocol}//${publicKey}@${url.host}${basePath}/${projectId}`,
      envelopeUrl: `${url.protocol}//${url.host}${basePath}/api/${projectId}/envelope/?sentry_key=${encodeURIComponent(publicKey)}&sentry_version=7&sentry_client=www-bbs%2F1.0`,
      host: url.host
    };
  } catch (error) {
    return null;
  }
}

function resolveError(errorLike) {
  if (errorLike instanceof Error) {
    return errorLike;
  }

  const message = typeof errorLike === 'string'
    ? errorLike
    : (errorLike && typeof errorLike === 'object' && errorLike.message)
      ? String(errorLike.message)
      : 'Unknown error';

  const error = new Error(message);
  if (errorLike && typeof errorLike === 'object') {
    Object.assign(error, errorLike);
  }
  return error;
}

function sanitizeContext(context = {}) {
  const next = {};
  if (!context || typeof context !== 'object') return next;
  
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value;
    } else if (value && typeof value === 'object') {
      try {
        if (value instanceof Error) {
          next[key] = { message: value.message, name: value.name };
        } else {
          next[key] = JSON.stringify(value).slice(0, 1000);
        }
      } catch (e) {
        next[key] = '[Circular or Unserializable]';
      }
    }
  }
  return next;
}

function parseStackTrace(stack) {
  if (!stack || typeof stack !== 'string') return undefined;
  
  const frames = [];
  const lines = stack.split('\n').slice(1);
  
  for (const line of lines) {
    const match = line.match(/^\s*at (?:(.+)\s+\()?(.+?)(?::(\d+))?(?::(\d+))?\)?$/);
    if (match) {
      frames.push({
        function: match[1] || '<anonymous>',
        filename: match[2],
        lineno: match[3] ? parseInt(match[3], 10) : undefined,
        colno: match[4] ? parseInt(match[4], 10) : undefined
      });
    } else {
      frames.push({ raw_function: line.trim() });
    }
  }
  
  return { frames: frames.reverse() };
}

function createEnvelopeTransport(dsn) {
  const parsed = parseSentryDsn(dsn);
  if (!parsed || typeof fetch !== 'function') {
    return {
      enabled: false,
      publicDsn: '',
      async sendEvent() {
        return false;
      }
    };
  }

  return {
    enabled: true,
    publicDsn: parsed.publicDsn,
    async sendEvent(event) {
      try {
        const envelope = [
          JSON.stringify({
            event_id: event.event_id,
            sent_at: new Date().toISOString(),
            sdk: {
              name: 'www-bbs.manual-tracker',
              version: '1.2.0'
            }
          }),
          JSON.stringify({ type: 'event' }),
          JSON.stringify(event)
        ].join('\n');

        const response = await fetch(parsed.envelopeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-sentry-envelope'
          },
          body: envelope
        });

        if (!response.ok) {
          logger.warn('Error tracker request failed', {
            component: 'ErrorTracker',
            status: response.status,
            host: parsed.host
          });
          return false;
        }

        return true;
      } catch (error) {
        logger.warn('Error tracker transport error', {
          component: 'ErrorTracker',
          error: error.message,
          host: parsed.host
        });
        return false;
      }
    }
  };
}

function createErrorTrackerFromEnv(env = process.env) {
  const environment = String(env.SENTRY_ENVIRONMENT || env.VERCEL_ENV || env.NODE_ENV || 'development').trim();
  const release = String(env.SENTRY_RELEASE || env.VERCEL_GIT_COMMIT_SHA || '').trim();
  const dsn = String(env.SENTRY_DSN || env.BBS_SENTRY_DSN || '').trim();
  const transport = createEnvelopeTransport(dsn);
  
  const breadcrumbs = [];
  const MAX_BREADCRUMBS = 30;

  const tracker = {
    enabled: transport.enabled,
    
    addBreadcrumb(breadcrumb) {
      const entry = {
        timestamp: Date.now() / 1000,
        type: breadcrumb.type || 'default',
        category: breadcrumb.category || 'log',
        level: breadcrumb.level || 'info',
        message: breadcrumb.message,
        data: breadcrumb.data ? sanitizeContext(breadcrumb.data) : undefined
      };
      
      breadcrumbs.push(entry);
      if (breadcrumbs.length > MAX_BREADCRUMBS) {
        breadcrumbs.shift();
      }
    },

    async captureException(errorLike, context = {}) {
      const error = resolveError(errorLike);
      
      // Auto-add breadcrumb for exceptions
      this.addBreadcrumb({
        category: 'exception',
        level: 'error',
        message: error.message,
        data: { name: error.name }
      });

      if (!transport.enabled) {
        if (context.critical || context.level === 'fatal') {
          logger.error('Critical exception (No Sentry):', { error, context });
        }
        return false;
      }

      const event = {
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: Date.now() / 1000,
        platform: 'node',
        level: context.level || 'error',
        environment,
        release: release || undefined,
        server_name: os.hostname(),
        tags: {
          runtime: 'server',
          ...(context.tags || {})
        },
        exception: {
          values: [{
            type: error.name || 'Error',
            value: error.message || 'Unknown error',
            stacktrace: parseStackTrace(error.stack)
          }]
        },
        breadcrumbs: breadcrumbs.length > 0 ? [...breadcrumbs] : undefined,
        extra: sanitizeContext({ ...(context.extra || context), _original_msg: context.message })
      };

      return transport.sendEvent(event);
    },

    async captureMessage(message, context = {}) {
      this.addBreadcrumb({
        category: 'message',
        level: context.level || 'info',
        message: String(message)
      });

      if (!transport.enabled) {
        return false;
      }

      return transport.sendEvent({
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: Date.now() / 1000,
        platform: 'node',
        level: context.level || 'info',
        environment,
        release: release || undefined,
        server_name: os.hostname(),
        tags: {
          runtime: 'server',
          ...(context.tags || {})
        },
        message: {
          message: String(message || 'Unknown error')
        },
        breadcrumbs: breadcrumbs.length > 0 ? [...breadcrumbs] : undefined,
        extra: sanitizeContext(context.extra || context)
      });
    },

    getClientConfig() {
      return {
        enabled: transport.enabled,
        dsn: transport.publicDsn,
        environment,
        release
      };
    },

    registerProcessErrorHandlers() {
      if (processHandlersRegistered || !transport.enabled) {
        return;
      }

      processHandlersRegistered = true;
      
      const handleFatal = async (error, source) => {
        logger.error(`Fatal ${source}:`, error);
        await this.captureException(error, { 
          level: 'fatal',
          tags: { source },
          critical: true 
        });
      };

      process.on('uncaughtException', (error) => handleFatal(error, 'uncaughtException'));
      process.on('unhandledRejection', (reason) => handleFatal(reason, 'unhandledRejection'));
    }
  };

  return tracker;
}

module.exports = {
  createErrorTrackerFromEnv
};
