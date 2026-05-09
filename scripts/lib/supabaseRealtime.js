'use strict';

const { createClient } = require('@supabase/supabase-js');

function resolveRealtimeTransport() {
  if (typeof globalThis.WebSocket !== 'undefined') {
    return null;
  }

  try {
    return require('ws');
  } catch (error) {
    return null;
  }
}

function createRealtimeCapableClient(url, key, options = {}) {
  const realtime = { ...(options.realtime || {}) };

  if (!realtime.transport) {
    const transport = resolveRealtimeTransport();
    if (transport) {
      realtime.transport = transport;
    }
  }

  if (typeof globalThis.WebSocket === 'undefined' && !realtime.transport) {
    throw new Error(`Node ${process.version} does not provide WebSocket and the ws transport is unavailable.`);
  }

  return createClient(url, key, { ...options, realtime });
}

function formatStatusTrace(statusTrace) {
  if (!Array.isArray(statusTrace) || statusTrace.length === 0) {
    return 'none';
  }

  return statusTrace
    .map((entry) => `${entry.status}@${entry.elapsedMs}ms`)
    .join(' -> ');
}

function buildRealtimeHint(status) {
  if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'SUBSCRIBE_TIMEOUT') {
    return 'Check Supabase Realtime project logs for UnableToConnectToProject or other DB connectivity errors. This is often a project-side Realtime issue, not a browser/UI regression.';
  }

  if (status === 'CLOSED') {
    return 'Channel closed before subscription completed. Check project URL, publishable key, and transient Realtime availability.';
  }

  return 'Check Supabase Realtime connectivity, credentials, and project logs.';
}

function createRealtimeSubscriptionError(reason, context = {}) {
  const details = {
    reason,
    status: context.status || null,
    attempt: Number(context.attemptNo || 1),
    totalAttempts: Number(context.totalAttempts || 1),
    channelName: String(context.channelName || ''),
    timeoutMs: Number(context.timeoutMs || 0),
    durationMs: Number(context.durationMs || 0),
    statusTrace: Array.isArray(context.statusTrace) ? context.statusTrace : [],
    hint: buildRealtimeHint(context.status || reason)
  };

  const label = details.status || (reason === 'SUBSCRIBE_TIMEOUT' ? 'timeout' : reason);
  const message = `Realtime subscribe failed: ${label} (attempt ${details.attempt}/${details.totalAttempts}, channel=${details.channelName || 'unknown'}, timeout=${details.timeoutMs}ms, duration=${details.durationMs}ms, statuses=${formatStatusTrace(details.statusTrace)}). Hint: ${details.hint}`;
  const error = new Error(message);
  error.realtime = details;
  return error;
}

async function waitForRealtimeSubscription(channel, timeoutMs, context = {}) {
  const startedAt = Date.now();
  const statusTrace = [];

  return new Promise((resolve, reject) => {
    let settled = false;

    function finish(callback) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      callback();
    }

    const timer = setTimeout(() => {
      finish(() => reject(createRealtimeSubscriptionError('SUBSCRIBE_TIMEOUT', {
        ...context,
        timeoutMs,
        durationMs: Date.now() - startedAt,
        statusTrace
      })));
    }, timeoutMs);

    channel.subscribe((status) => {
      statusTrace.push({
        status,
        elapsedMs: Date.now() - startedAt
      });

      if (status === 'SUBSCRIBED') {
        finish(() => resolve({
          durationMs: Date.now() - startedAt,
          statusTrace
        }));
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        finish(() => reject(createRealtimeSubscriptionError('SUBSCRIBE_STATUS', {
          ...context,
          status,
          timeoutMs,
          durationMs: Date.now() - startedAt,
          statusTrace
        })));
      }
    });
  });
}

async function waitFor(check, timeoutMs, errorMessage) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(errorMessage);
}

async function runRealtimeProbe(options) {
  const attempts = Math.max(1, Number(options?.attempts || 4));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await runRealtimeProbeAttempt(options, attempt, attempts);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }

  if (lastError && lastError.realtime) {
    lastError.realtime.totalAttempts = attempts;
  }

  throw lastError || new Error('Realtime probe failed');
}

async function runRealtimeProbeAttempt(options, attemptNo = 1, totalAttempts = 1) {
  const timeoutMs = Number(options?.timeoutMs || 20000);
  const client = createRealtimeCapableClient(options.url, options.key, {
    auth: { persistSession: false }
  });

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channelName = `${String(options?.channelPrefix || 'smoke-realtime')}-${stamp}`;
  const channel = client.channel(channelName, {
    config: {
      broadcast: { self: true, ack: true },
      presence: { key: `smoke-${stamp}` }
    }
  });

  const received = [];
  let presenceCount = 0;

  channel.on('broadcast', { event: 'message' }, ({ payload }) => {
    received.push(payload);
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    presenceCount = Object.values(state || {}).reduce((total, entries) => total + (entries || []).length, 0);
  });

  try {
    const subscription = await waitForRealtimeSubscription(channel, timeoutMs, {
      attemptNo,
      totalAttempts,
      channelName
    });
    await channel.track({ userId: 'smoke-user', nickName: 'smoke' });

    const payload = { text: 'realtime smoke', createdAt: new Date().toISOString() };
    const sendResult = await channel.send({ type: 'broadcast', event: 'message', payload });

    await waitFor(() => received.length > 0, 5000, 'Realtime broadcast was not received');

    return {
      ok: true,
      channelName,
      sendResult,
      presenceCount,
      receivedText: received[0]?.text || null,
      attempt: attemptNo,
      attempts: totalAttempts,
      subscriptionMs: subscription.durationMs,
      statusTrace: subscription.statusTrace
    };
  } finally {
    try {
      if (typeof channel.untrack === 'function') {
        await channel.untrack();
      }
    } catch (error) {
      // Ignore cleanup failures in smoke probes.
    }

    try {
      await client.removeChannel(channel);
    } catch (error) {
      // Ignore cleanup failures in smoke probes.
    }
  }
}

module.exports = {
  createRealtimeCapableClient,
  createRealtimeSubscriptionError,
  formatStatusTrace,
  resolveRealtimeTransport,
  runRealtimeProbe
};
