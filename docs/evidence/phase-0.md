# Phase 0 Evidence: Baseline and Engineering Rules

## 1. Execution Metadata
- **Phase**: Phase 0 (Baseline and Engineering Rules)
- **Branch**: `hardening/rc1`
- **Date**: 2026-10-11T17:57:00Z
- **Platform**: linux x64
- **Node**: v22.23.2
- **npm**: 10.9.8
- **git**: 2.34.1

## 2. Environment Report (P0-1)

```bash
$ node -p "process.platform+' '+process.arch+' node '+process.version"
linux x64 node v22.23.2

$ npm -v
10.9.8

$ git --version
git version 2.34.1

$ git branch --show-current
main

$ git status --short
(empty)
```

## 3. Branch Creation (P0-2)

```bash
$ git checkout -b hardening/rc1
Switched to a new branch 'hardening/rc1'
```

## 4. Baseline Execution (P0-3)

### 4.1 npm ci Command Output

```bash
$ npm ci
npm error code EUSAGE
npm error 
npm error The `npm ci` command can only install with an existing package-lock.json or
npm error npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or
npm error later to generate a package-lock.json file, then try again.
npm error 
npm error Clean install a project
npm error 
npm error Usage:
npm error npm ci
...
```

*Note: `package-lock.json` was absent from the base repository commit `3f904b5`, causing `npm ci` to fail with code 1 (EUSAGE).*

### 4.2 npm run check Command Output

```bash
$ npm run check
> executive-office-portal@1.0.0 check
> npm run typecheck && npm run test && npm run build && npm run smoke:package

> executive-office-portal@1.0.0 typecheck
> tsc --noEmit

> executive-office-portal@1.0.0 test
> vitest run

 RUN  v5.0.3 /app/applet

 ✓ src/tests/massAssignment.spec.ts (8 tests) 659ms
 ✓ src/tests/phase5AuditChain.spec.ts (6 tests) 519ms
 ✓ src/tests/offlinePackaging.spec.ts (3 tests) 145ms
 ✓ src/tests/frontendServing.spec.ts (5 tests) 102ms
 ✓ src/tests/phase4Persistence.spec.ts (3 tests) 80ms
 ✓ src/tests/securityHeaders.spec.ts (3 tests) 78ms
 ✓ src/tests/legacySuites.spec.ts (22 tests) 56ms
 ✓ src/tests/environmentAndDocsValidation.spec.ts (3 tests) 27ms
 ✓ src/tests/gitignoreGuard.spec.ts (2 tests) 26ms
 ✓ src/tests/requiredFiles.spec.ts (2 tests) 7ms
 ✓ src/tests/ctxGuard.spec.ts (2 tests) 8ms
 ✓ src/tests/startupBanner.spec.ts (3 tests) 10ms
 ✓ src/tests/authPhase2.spec.ts (10 tests)
 ✓ src/tests/authPhase3.spec.ts (27 tests)
 ✓ src/tests/minimalPayloadAndConstraints.spec.ts (15 tests)
 ✓ src/tests/phase4EncryptedBackup.spec.ts (10 tests)
 ✓ src/tests/bundleGuard.spec.ts (2 tests)

 Test Files  17 passed (17)
      Tests  126 passed (126)
   Start at  17:56:49
   Duration  16.94s

> executive-office-portal@1.0.0 build
> vite build && npm run build:server

vite v8.3.0 building client environment for production...
transforming...
✓ 1696 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.43 kB │ gzip:   0.59 kB
dist/assets/index-Bfs3s06d.css   68.23 kB │ gzip:  10.97 kB
dist/assets/index-BEZk_1ao.js   764.42 kB │ gzip: 181.24 kB
✓ built in 803ms
[plugin builtin:vite-reporter] (!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

> executive-office-portal@1.0.0 build:server
> esbuild server.ts --platform=node --bundle --format=esm --packages=external --outfile=dist-server/server.js && esbuild scripts/verifyNative.ts --platform=node --bundle --format=esm --packages=external --outfile=dist-server/verifyNative.js && esbuild scripts/backup.ts --platform=node --bundle --format=esm --packages=external --outfile=dist-server/backup.js && esbuild scripts/verifyPackage.ts --platform=node --bundle --format=esm --packages=external --outfile=dist-server/verifyPackage.js

  dist-server/server.js  329.9kb
⚡ Done in 26ms
  dist-server/verifyNative.js  4.1kb
⚡ Done in 5ms
  dist-server/backup.js  168.0kb
⚡ Done in 15ms
  dist-server/verifyPackage.js  10.1kb
⚡ Done in 6ms

> executive-office-portal@1.0.0 smoke:package
> tsx scripts/smokePackage.ts

======================================================================
🧪 بدء اختبار الجاهزية الميدانية الشامل للحزمة (Package Smoke Test)
======================================================================
1️⃣  جاري بناء حزمة التثبيت دون اتصال...

> executive-office-portal@1.0.0 package:offline
> tsx scripts/packageOffline.ts

======================================================================
📦 بدء بناء حزمة التثبيت دون اتصال (Offline Package Builder)
======================================================================
📌 اسم الحزمة المستهدفة: executive-office-portal-1.0.0-linux-x64-node22.tar.gz
📌 نظام التشغيل: linux | المعمارية: x64 | إصدار Node.js: v22.23.2
🔨 جاري تجميع الواجهة الأمامية وخادم الإنتاج (Building dist & dist-server)...

...
📂 جاري نسخ ملفات التطبيق المصرح بها إلى دليل التجهيز...
❌ خطأ أثناء بناء الحزمة: Error: ENOENT: no such file or directory, copyfile '/app/applet/package-lock.json' -> '/app/applet/release/.stage/package-lock.json'
    at Object.copyFileSync (node:fs:3090:11)
    at buildOfflinePackage (/app/applet/scripts/packageOffline.ts:97:6)
    at <anonymous> (/app/applet/scripts/packageOffline.ts:266:1)

❌ فشل اختبار الجاهزية الميدانية للحزمة: Error: Command failed: npm run package:offline
```

### Baseline Summary Metrics
- **Typecheck (`npm run typecheck`)**: PASSED (0 errors).
- **Unit & Integration Tests (`npm run test`)**: PASSED (17 test files, 126 tests).
- **Build (`npm run build`)**: PASSED (Client bundle 764 kB JS + 68 kB CSS; server bundled to `dist-server/server.js`).
- **Build Warning**: Vite warning for client bundle size exceeding 500 kB limit.
- **Smoke Test (`npm run smoke:package`)**: FAILED due to `package-lock.json` missing on disk during `copyFileSync`.
- **Clean Install (`npm ci`)**: FAILED (EUSAGE due to missing `package-lock.json`).
