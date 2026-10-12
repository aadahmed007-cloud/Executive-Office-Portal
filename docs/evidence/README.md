# Evidence Files Format & Guidelines

This directory contains the verified execution logs and proof of validation for each hardening phase (`docs/evidence/phase-N.md`).

## Purpose
Every phase must generate an evidence file recording actual command output from execution in the target environment. This ensures complete transparency, reproducibility, and auditability without simulations.

## File Naming Convention
- `docs/evidence/phase-0.md`
- `docs/evidence/phase-1.md`
- `docs/evidence/phase-N.md`

## Structure Requirements for Each Evidence File

1. **Header Metadata**:
   - Phase identifier and title
   - Timestamp (ISO 8601 or local with timezone)
   - Environment summary (`node`, `npm`, `git`, OS, architecture, active git branch)
2. **Commands Executed & Raw Real Output**:
   - Exact command line invocations (e.g., `npm run check`, specific test runs, git status/diff).
   - Verbatim console output enclosed in code blocks.
   - Never replace output with summaries like "passed" or "done".
   - If a step was not executed, mark it explicitly as `NOT DONE`.
3. **Redaction Policy (Rule 3)**:
   - Any sensitive values—including one-time passwords, password hashes, encryption passphrases, session cookies, and security tokens—MUST be redacted as `[REDACTED]`.
4. **Failure and Warning Logs**:
   - Any runtime warnings (e.g., bundle size warnings, deprecation notices) and execution failures must be reported verbatim with exact exit codes and error messages.
5. **Phase Sign-off**:
   - Status of `npm run check`.
   - Commit hash and message on the active hardening branch.
