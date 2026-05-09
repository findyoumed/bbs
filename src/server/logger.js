'use strict';

/**
 * [LOG: 20260425_2247] Improved Logger with better error serialization in meta objects
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 99
};

const currentLogLevelName = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLogLevel = LOG_LEVELS[currentLogLevelName] !== undefined 
  ? LOG_LEVELS[currentLogLevelName] 
  : LOG_LEVELS.info;

/**
 * Serializes an object, handling Error objects specifically
 */
function serializeValue(val) {
  if (val instanceof Error) {
    return {
      name: val.name,
      message: val.message,
      stack: val.stack,
      ...(val.code ? { code: val.code } : {}),
      ...(val.status ? { status: val.status } : {})
    };
  }
  return val;
}

/**
 * Structured logger that outputs JSON
 */
function log(level, message, meta) {
  if (LOG_LEVELS[level] < currentLogLevel) {
    return;
  }

  const entry = { 
    ts: new Date().toISOString(), 
    level, 
    msg: typeof message === 'string' ? message : String(message) 
  };

  if (meta !== undefined && meta !== null) {
    if (meta instanceof Error) {
      entry.error = serializeValue(meta);
    } else if (typeof meta === 'object') {
      for (const [key, value] of Object.entries(meta)) {
        if (value instanceof Error && (key === 'error' || key === 'err')) {
             entry[key] = serializeValue(value);
        } else if (value instanceof Error) {
             entry[key] = serializeValue(value);
        } else {
             entry[key] = value;
        }
      }
    } else {
      entry.meta = meta;
    }
  }

  const line = JSON.stringify(entry) + '\n';
  
  if (LOG_LEVELS[level] >= LOG_LEVELS.error) {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  LOG_LEVELS,
  // Helper for structured logging with multiple context items
  withContext: (context) => {
    const serializedContext = {};
    if (context && typeof context === 'object') {
      for (const [k, v] of Object.entries(context)) {
        serializedContext[k] = serializeValue(v);
      }
    }
    return {
      debug: (msg, meta) => log('debug', msg, { ...serializedContext, ...serializeMeta(meta) }),
      info: (msg, meta) => log('info', msg, { ...serializedContext, ...serializeMeta(meta) }),
      warn: (msg, meta) => log('warn', msg, { ...serializedContext, ...serializeMeta(meta) }),
      error: (msg, meta) => log('error', msg, { ...serializedContext, ...serializeMeta(meta) })
    };
  }
};

function serializeMeta(meta) {
    if (meta === undefined || meta === null) return {};
    if (meta instanceof Error) return { error: serializeValue(meta) };
    if (typeof meta !== 'object') return { meta: meta };
    
    const serialized = {};
    for (const [k, v] of Object.entries(meta)) {
      serialized[k] = serializeValue(v);
    }
    return serialized;
}

module.exports = logger;
