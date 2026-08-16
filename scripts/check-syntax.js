'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const roots = ['public', 'src', 'scripts'];

function collectJavaScriptFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectJavaScriptFiles(absolutePath));
    else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(absolutePath);
  }
  return files;
}

const files = roots.map((root) => collectJavaScriptFiles(path.join(projectRoot, root))).flat().sort();
const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: projectRoot, encoding: 'utf8' });
  if (result.status !== 0 || result.error) {
    failures.push({
      file: path.relative(projectRoot, file),
      output: String(result.stderr || result.stdout || result.error?.message || '').trim()
    });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, checked: files.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, checked: files.length }));
}
