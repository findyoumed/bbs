---
name: loop-engineering
description: Run a bounded plan, implementation, verification, and refinement loop for BBS changes.
---

# Loop Engineering

Use this skill for multi-step development or bug-fixing work that has a repeatable test harness.

## Workflow

1. Inspect the requirements, current code, dependencies, and relevant tests before editing.
2. Define a small checklist and concrete exit criteria in the conversation or a temporary workspace file.
3. Implement one logical change at a time and keep the iteration limit between 5 and 10.
4. Run the relevant smoke tests after each change; use `npm run loop:verify` as the deterministic completion gate.
5. If a test fails, use its output to correct the implementation and rerun the affected checks.
6. Report changed files, test results, skipped checks, and remaining environment limitations.

## Rules

- Do not invent APIs, paths, or test results.
- Do not add packages or broaden the feature without user approval.
- Keep changes small and preserve existing behavior outside the requested scope.
- Do not treat a passing static check as proof of browser or Supabase behavior; distinguish those results explicitly.
