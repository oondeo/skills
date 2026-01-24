## [2026-01-24] Task: Fix sync-skills workflow exit code handling

**Root Cause**: Conditional commands in GitHub Actions workflows fail the entire step when any command returns non-zero exit code.

**Problem**: In sync-skills.yml, lines 87 and 94 had:
```bash
[ "$ANTHROPICS_COUNT" -gt 0 ] && cat /tmp/anthropics_new.txt
```
When `ANTHROPICS_COUNT=0`, the test fails (exit 1), causing entire workflow step to fail.

**Solution**: Added `|| true` to ensure commands always return exit code 0:
```bash
[ "$ANTHROPICS_COUNT" -gt 0 ] && cat /tmp/anthropics_new.txt || true
```
Even when test fails, `true` runs successfully and returns exit 0.

**Key Learning**: GitHub Actions workflow `run:` blocks exit immediately on any non-zero return code. Use `|| true` pattern to handle conditional operations that might fail without breaking the workflow.
