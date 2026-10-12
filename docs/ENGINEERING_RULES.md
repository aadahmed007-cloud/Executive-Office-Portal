# Engineering Rules

This document establishes the binding engineering rules that govern every hardening and refactoring phase in this repository.

1. **Fictional data only.** Never ask for or store real data.
2. **Evidence = real command output.** Never simulate, summarize as "done", or label anything "simulation". If something is not done, write NOT DONE.
3. **Never print, log, commit or paste one-time passwords, passphrases, session cookies or secrets.** Redact them in every report and evidence file.
4. **Never weaken a security setting.** Keep credentials 'same-origin' (the app and API share one origin; the session cookie is HttpOnly, Secure, SameSite=Strict).
5. **No scope creep.** If a requirement is ambiguous or needs a product decision (for example a new role), stop and ask.
6. **Cross-platform:** commands and npm scripts must work on Windows PowerShell and POSIX shells. No POSIX-only syntax in package.json scripts.
7. **Tests must be able to fail.** No console.assert. New guard tests are proven by temporarily breaking the condition and pasting the failing output.
8. **Temp files live under os.tmpdir() and are removed in finally/afterAll, even on failure.**
9. **Every state change and its audit entry happen in ONE transaction.** Confidential content never appears in audit text or in API responses for uncleared users.
10. **Wording:** never claim "sovereign", "air-gapped", "zero-trust", "100% secure", "production-ready" or "immutable". State that the system has had no independent security review.
11. **End of every phase:** run `npm run check`, commit on the branch as `phase-N: <summary>`, write docs/evidence/phase-N.md (commands + real redacted output), then STOP and wait for approval.
