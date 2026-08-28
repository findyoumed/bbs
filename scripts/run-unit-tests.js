// [LOG_ID: 20260828_1600] Run the repository's available unit-test layout
// while retaining compatibility with the archived dev-only layout.
'use strict';

const fs = require('fs');
const path = require('path');

async function runTests() {
  const archivedUnitDir = path.resolve(__dirname, '..', 'archive', 'dev-only', 'tests', 'unit');
  // The archived test tree is optional in the working repository. When it is
  // absent, use the checked-in scripts/*.test.js files instead of failing
  // before any test can run.
  const unitDir = fs.existsSync(archivedUnitDir) ? archivedUnitDir : path.resolve(__dirname);
  if (!fs.existsSync(unitDir)) {
    throw new Error(`Unit test directory not found: ${unitDir}`);
  }

  const files = fs.readdirSync(unitDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join(unitDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    console.error(`No unit test files found in ${unitDir}.`);
    process.exit(1);
  }

  console.log(`Using unit test directory: ${unitDir}`);
  console.log(`Found ${files.length} test files.\n`);

  for (const file of files) {
    const fileName = path.basename(file);
    console.log(`[Running] ${fileName}`);
    try {
      // Use require for CJS tests, but handle if they return a promise
      const result = require(file);
      if (result instanceof Promise) {
        await result;
      }
      console.log(`[Passed] ${fileName}\n`);
    } catch (error) {
      console.error(`[Failed] ${fileName}`);
      console.error(error);
      process.exit(1);
    }
  }

  console.log('All tests passed!');
}

runTests().catch((error) => {
  console.error('Fatal test runner error:', error);
  process.exit(1);
});
