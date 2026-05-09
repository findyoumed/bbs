'use strict';

const logger = require('../src/server/logger');
const { createErrorTrackerFromEnv } = require('../src/server/ErrorTracker');

async function testLogger() {
  console.log('--- Testing Logger ---');
  
  // Test levels
  logger.info('This is an info message');
  logger.warn('This is a warning');
  logger.error('This is an error');
  logger.debug('This debug should NOT show by default');

  // Test with Error object
  const testError = new Error('Test error object');
  logger.error('Logging an error object', testError);

  // Test with meta containing Error
  logger.warn('Warning with nested error', { 
    context: 'testing',
    error: new TypeError('Type mismatch')
  });

  process.env.LOG_LEVEL = 'debug';
  // Re-requiring wouldn't work easily due to cache, but we can check if it's dynamic 
  // (In our implementation it's captured at module load, so this test might not show debug 
  // unless we clear cache or run in separate process. That's fine for now.)
  logger.debug('Debug message (if LOG_LEVEL was set before)');
}

async function testErrorTracker() {
  console.log('\n--- Testing ErrorTracker ---');
  
  // Mock env with DSN to enable transport (even if it fails to send)
  const mockEnv = {
    SENTRY_DSN: 'https://public@sentry.example.com/1',
    NODE_ENV: 'test'
  };
  
  const tracker = createErrorTrackerFromEnv(mockEnv);
  console.log('Tracker enabled:', tracker.enabled);

  if (tracker.enabled) {
    tracker.addBreadcrumb({
      message: 'Initial test breadcrumb',
      category: 'test'
    });

    tracker.addBreadcrumb({
      message: 'User clicked something',
      category: 'ui',
      data: { button: 'test-btn' }
    });

    console.log('Capturing exception with breadcrumbs...');
    // We don't actually await fetch in this test to avoid network delay/failure noise
    // but we check if the function exists and runs
    try {
      await tracker.captureException(new Error('Tracker test error'), {
        extra: { foo: 'bar' }
      });
      console.log('Capture call completed');
    } catch (e) {
      console.error('Capture call failed unexpectedly:', e);
    }
  }
}

async function run() {
  await testLogger();
  await testErrorTracker();
  console.log('\nEvolution test completed.');
}

run();
