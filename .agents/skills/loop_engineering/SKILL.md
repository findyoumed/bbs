---
name: loop-engineering
description: Run an autonomous development loop that iteratively plans, implements, verifies, and polishes changes based on a test harness until all exit criteria are met.
---

# Loop Engineering Skill

Use this skill when you need to autonomously build, debug, or refine a feature in a loop of planning, execution, and verification.

## 4-Phase Loop Engineering Workflow

### Phase 1: Planning (Plan Mode)
1. **Analyze Requirements**: Research the task, codebase, and dependencies. Do not make code edits.
2. **Setup Checklist**: Create/update the `task.md` checklist in the artifacts directory.
3. **Define Exit Criteria**: Specify concrete tests (e.g., `npm run loop:verify` or a custom smoke test) that must pass to terminate the loop.
4. **Cap Iterations**: Limit the loop to 5-10 iterations to prevent infinite token consumption.
5. **Formulate Plan**: Write the `implementation_plan.md` in the artifacts directory.

### Phase 2: Execution (YOLO Mode)
1. **Write Full Code**: Never omit code. Always output complete file contents.
2. **Work Log**: Log every change in `WORK_LOG.md` with timestamps and `LOG_ID` annotations.
3. **Incremental Progress**: Implement one logical change at a time and move to verification.

### Phase 3: Verification (Harness)
1. **Execute Tests**: Run the specified harness commands (e.g., `npm run loop:verify`).
2. **Collect Evidence**: Capture test output (exit codes, failures, build logs).
3. **Self-Correct**: If tests fail, analyze the failure evidence, adjust the implementation plan if necessary, and repeat Phase 2.

### Phase 4: Reporting
1. **Document Accomplishments**: Create `walkthrough.md` with changes made, test results, and screenshots.
2. **Close Checklist**: Ensure all items in `task.md` are marked completed.
