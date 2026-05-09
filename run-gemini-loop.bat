@echo off
rem [LOG: 20260428_1555] Pure ASCII Batch file to avoid encoding issues.
rem Pointing to gemini-repl-loop.js which now automatically reads .gemini-repl-task.txt
node scripts/gemini-repl-loop.js --verify "npm run smoke:full-traversal" --evolve --commit
