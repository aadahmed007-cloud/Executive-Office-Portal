# Phase 3 Evidence: Regression Guard Tests

## 1. Execution Metadata
- **Phase**: Phase 3 (Regression Guard Tests)
- **Branch**: `hardening/rc1`
- **Date**: 2026-10-12T08:10:00Z
- **Platform**: linux x64 (Node.js v22)
- **Test Runner**: Vitest v5.0.3
- **Primary Suite**: `src/tests/regressionGuards.spec.ts`

---

## 2. Guard Tests Implementation Summary

All regression guard tests were implemented in `src/tests/regressionGuards.spec.ts` with real, robust assertions protecting all historical bug fixes and security standards:

| Task | Test Name | Description & Invariants Protected |
| :--- | :--- | :--- |
| **P3-1** | `creates exactly 3 users (chairman, secretary, admin) with non-empty credentials, must_change_password=1 and rejects known passwords` | Verifies that a clean database init provisions exactly 3 users (`admin`, `chairman`, `secretary`), each having non-empty username, password hash, and salt with `must_change_password=1`. Verifies that none of the forbidden passwords (`InitPass@2026`, `1234`, `admin123`, `Pass#Secr2026`, `admin1234567`) or usernames match any user hash. |
| **P3-2** | `fails if AuthContext.tsx defaults isAuthenticated or currentUser to truthy values or imports INITIAL_USERS` | Statically parses `src/features/auth/AuthContext.tsx` and asserts that `isAuthenticated` defaults strictly to `false`, `currentUser` defaults to `GUEST_USER` (unauthenticated), and `INITIAL_USERS` is never imported. |
| **P3-3** | `verifies src contains no console.assert, no pinCode, no switch-role, and no demo passwords` | Recursively scans all non-test TypeScript and JavaScript source files under `src/` to ensure no `console.assert`, no `pinCode`, no `switch-role` route, and no hardcoded demo passwords exist in the production source. |
| **P3-4** | `starts production server with only DATA_DIR and PORT set and verifies /api/health returns {"status":"ok"}` | Spawns `node dist-server/server.js` in an isolated environment where only `DATA_DIR` and `PORT` are provided (no JWT secrets, no database passwords). Verifies that server boots cleanly and `/api/health` responds with HTTP 200 `{"status":"ok"}`. |
| **P3-5** | `verifies markdown documentation contains no exaggerated or forbidden claims` | Lints `README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `PRODUCTION_HANDOFF.md`, `PRODUCTION_DEPLOYMENT.md`, and `docs/*.md` (excluding `docs/ENGINEERING_RULES.md` which defines the forbidden words). Strictly fails on `سيادي`, `sovereign`, `Air-Gapped` (unless explicitly negated), `100%`, `zero-trust`, `production-ready`, `جاهز للإنتاج`, `Production Release`, `اعتماد الوثيقة`, immutable audit claims, or approval tables containing individual person names. |
| **P3-6** | `fails if docs/OFFLINE_INSTALL_AR.md contains || true or 2>/dev/null on a move or delete command` | Lints `docs/OFFLINE_INSTALL_AR.md` to ensure no destructive operations (`mv`, `rm`, `Move-Item`, `Remove-Item`) mask failures with `|| true` or `2>/dev/null`. |
| **P3-7** | `fails if any package.json script contains rm -rf, NODE_ENV=, cp, mv or other POSIX-only syntax` | Inspects `package.json` scripts to verify cross-platform compliance (no `rm -rf`, inline `NODE_ENV=`, `cp`, or `mv`). |
| **P3-8** | Existing Guard Suites | Kept and passed all existing guard suites: `gitignoreGuard.spec.ts`, `requiredFiles.spec.ts`, `bundleGuard.spec.ts`, and `environmentAndDocsValidation.spec.ts`. |

---

## 3. P3-9 Proof of Guard Failure and Revert (Mutation Testing)

To prove that each guard can genuinely catch regressions and fails loudly, 4 tests were temporarily broken, executed to capture real failing test outputs, and then reverted to verify clean passing state:

### Proof 1: P3-1 (Fresh DB must_change_password Guard)
#### Broken Mutation:
Temporarily set `must_change_password` to `0` during database bootstrapping in `src/data/database/sqliteEngine.ts`.
#### Real Failing Output:
```text
 FAIL  src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-1: Fresh database initialization guards > creates exactly 3 users (chairman, secretary, admin) with non-empty credentials, must_change_password=1 and rejects known passwords
AssertionError: expected +0 to be 1 // Object.is equality
- Expected
+ Received
- 1
+ 0
 ❯ src/tests/regressionGuards.spec.ts:46:42
     44|           expect(typeof u.password_salt).toBe('string');
     45|           expect(u.password_salt.length).toBeGreaterThan(0);
     46|           expect(u.must_change_password).toBe(1);
       |                                          ^
     47|     
     48|           // None of the forbidden passwords or the username itself mu…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 6 skipped (7)
```
#### Reverted Passing Output:
```text
 RUN  v5.0.3 /app/applet
 ✓ src/tests/regressionGuards.spec.ts (7 tests | 6 skipped) 2265ms
   ✓ Phase 3: Regression Guard Tests (7)
     ✓ P3-1: Fresh database initialization guards (1)
       ✓ creates exactly 3 users (chairman, secretary, admin) with non-empty credentials, must_change_password=1 and rejects known passwords 2263ms
 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
```

---

### Proof 2: P3-2 (Client Unauthenticated Start Guard)
#### Broken Mutation:
Temporarily changed `useState<boolean>(false)` to `useState<boolean>(true)` for `isAuthenticated` in `src/features/auth/AuthContext.tsx`.
#### Real Failing Output:
```text
 FAIL  src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-2: Client unauthenticated start guard > fails if AuthContext.tsx defaults isAuthenticated or currentUser to truthy values or imports INITIAL_USERS
AssertionError: expected 'true' to be 'false' // Object.is equality
Expected: "false"
Received: "true"
 ❯ src/tests/regressionGuards.spec.ts:81:29
     79|       expect(isAuthHookMatch).toBeTruthy();
     80|       const isAuthDefault = isAuthHookMatch![1].trim();
     81|       expect(isAuthDefault).toBe('false');
       |                              ^
     82|     
     83|       // Specifically check currentUser hook: must default to GUEST_US…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 6 skipped (7)
```
#### Reverted Passing Output:
```text
 RUN  v5.0.3 /app/applet
 ✓ src/tests/regressionGuards.spec.ts (7 tests | 6 skipped) 9ms
 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
```

---

### Proof 3: P3-3 (Forbidden Keywords and console.assert Guard)
#### Broken Mutation:
Temporarily appended `console.assert(1 === 1);` to `src/server/app.ts`.
#### Real Failing Output:
```text
 FAIL  src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-3: Prohibited keywords and insecure constructs guard > verifies src contains no console.assert, no pinCode, no switch-role, and no demo passwords
AssertionError: expected [ { file: 'src/server/app.ts', …(1) } ] to deeply equal []
- Expected
+ Received
- []
+ [
+   {
+     "file": "src/server/app.ts",
+     "match": "console.assert",
+   },
+ ]
 ❯ src/tests/regressionGuards.spec.ts:135:31
    133|     
    134|       scan(srcDir);
    135|       expect(foundViolations).toEqual([]);
       |                               ^
    136|     });
    137|   });
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 6 skipped (7)
```
#### Reverted Passing Output:
```text
 RUN  v5.0.3 /app/applet
 ✓ src/tests/regressionGuards.spec.ts (7 tests | 6 skipped) 24ms
 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
```

---

### Proof 4: P3-5 (Docs Claims Lint Guard)
#### Broken Mutation:
Temporarily appended `"نظام سيادي وموثوق بنسبة 100%"` to `README.md`.
#### Real Failing Output:
```text
 FAIL  src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-5: Documentation claims lint guard > verifies markdown documentation contains no exaggerated or forbidden claims
AssertionError: expected [ { file: 'README.md', …(3) }, …(1) ] to deeply equal []
- Expected
+ Received
- []
+ [
+   {
+     "content": "نظام سيادي وموثوق بنسبة 100%",
+     "file": "README.md",
+     "line": 64,
+     "rule": "سيادي",
+   },
+   {
+     "content": "نظام سيادي وموثوق بنسبة 100%",
+     "file": "README.md",
+     "line": 64,
+     "rule": "100%",
+   },
+ ]
 ❯ src/tests/regressionGuards.spec.ts:285:26
    283|         }
    284|       }
    285|       expect(violations).toEqual([]);
       |                           ^
    286|     });
    287|   });
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 6 skipped (7)
```
#### Reverted Passing Output:
```text
 RUN  v5.0.3 /app/applet
 ✓ src/tests/regressionGuards.spec.ts (7 tests | 6 skipped) 11ms
 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
```

---

### Proof 5: P3-7 (Package Scripts Cross-Platform Lint Guard)
#### Broken Mutation:
Temporarily injected `"bad:script": "rm -rf dist-server"` into `package.json`.
#### Real Failing Output:
```text
 FAIL  src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-7: Package scripts cross-platform lint guard > fails if any package.json script contains rm -rf, NODE_ENV=, cp, mv or other POSIX-only syntax
AssertionError: expected [ { script: 'bad:script', …(2) } ] to deeply equal []
- Expected
+ Received
- []
+ [
+   {
+     "command": "rm -rf dist-server",
+     "pattern": "rm -rf",
+     "script": "bad:script",
+   },
+ ]
 ❯ src/tests/regressionGuards.spec.ts:337:26
    335|         }
    336|       }
    337|       expect(violations).toEqual([]);
       |                           ^
    338|     });
    339|   });
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 6 skipped (7)
```
#### Reverted Passing Output:
```text
 RUN  v5.0.3 /app/applet
 ✓ src/tests/regressionGuards.spec.ts (7 tests | 6 skipped) 6ms
 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
```

---

## 4. Full Clean Test Suite & Check Results

Running `npx vitest run --reporter=verbose`:
```text
 RUN  v5.0.3 /app/applet

 ✓ src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-1: Fresh database initialization guards > creates exactly 3 users (chairman, secretary, admin) with non-empty credentials, must_change_password=1 and rejects known passwords 2304ms
 ✓ src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-2: Client unauthenticated start guard > fails if AuthContext.tsx defaults isAuthenticated or currentUser to truthy values or imports INITIAL_USERS 2ms
 ✓ src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-3: Prohibited keywords and insecure constructs guard > verifies src contains no console.assert, no pinCode, no switch-role, and no demo passwords 13ms
 ✓ src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-4: Production start minimal env guard > starts production server with only DATA_DIR and PORT set and verifies /api/health returns {"status":"ok"} 843ms
 ✓ src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-5: Documentation claims lint guard > verifies markdown documentation contains no exaggerated or forbidden claims 12ms
 ✓ src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-6: Destructive-command lint guard > fails if docs/OFFLINE_INSTALL_AR.md contains || true or 2>/dev/null on a move or delete command 2ms
 ✓ src/tests/regressionGuards.spec.ts > Phase 3: Regression Guard Tests > P3-7: Package scripts cross-platform lint guard > fails if any package.json script contains rm -rf, NODE_ENV=, cp, mv or other POSIX-only syntax 1ms
 ✓ src/tests/bundleGuard.spec.ts (2 tests)
 ✓ src/tests/gitignoreGuard.spec.ts (2 tests)
 ✓ src/tests/environmentAndDocsValidation.spec.ts (3 tests)
 ✓ src/tests/requiredFiles.spec.ts (2 tests)
 ...
 Test Files  18 passed (18)
      Tests  133 passed (133)
```

Running `npm run check`:
```text
> executive-office-portal@1.0.0 check
> npm run typecheck && npm run test && npm run build && npm run smoke:package

> executive-office-portal@1.0.0 typecheck
> tsc --noEmit

> executive-office-portal@1.0.0 test
> vitest run
 Test Files  18 passed (18)
      Tests  133 passed (133)

> executive-office-portal@1.0.0 build
> vite build && npm run build:server

> executive-office-portal@1.0.0 smoke:package
> tsx scripts/smokePackage.ts
======================================================================
🎉 نجح اختبار الجاهزية الميدانية الشامل للحزمة (Smoke Test Passed)
======================================================================
```
