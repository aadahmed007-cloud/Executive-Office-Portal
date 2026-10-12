# Phase 1 Evidence: Documentation Truth and Repository Hygiene

## 1. Execution Metadata
- **Phase**: Phase 1 (Documentation Truth and Repository Hygiene)
- **Branch**: `hardening/rc1`
- **Date**: 2026-10-11T18:13:00Z
- **Platform**: linux x64
- **Node**: v22.23.2
- **npm**: 10.9.8
- **git**: 2.34.1

---

## 2. P1-1: Repository Hygiene & .gitignore Anchoring

### 2.1 Tracked Leftovers Verification & Anchored .gitignore
Tracked leftovers (`.temp_pkg_verify_*/` and `.test_smoke_pkg_*/`) were confirmed absent from git index.
`.gitignore` was updated to anchor runtime-only paths to the root:
```gitignore
/data/
/var/
/backups/
/dist/
/dist-server/
/dist-temp/
/release/
/.test_*/
/.temp_*/
/.stage/
/coverage/
/build/
```

### 2.2 Root Directory Listing (`ls -a`)
```bash
$ ls -a
.
..
ARCHITECTURE.md
dist
dist-server
docs
.env.example
.git
.github
.gitignore
index.html
LICENSE
metadata.json
node_modules
.npmrc
package.json
package-lock.json
PRODUCTION_DEPLOYMENT.md
PRODUCTION_HANDOFF.md
README.md
release
scripts
SECURITY.md
server.ts
src
tsconfig.json
var
vite.config.ts
vitest.config.ts
```

### 2.3 Tracked Files Count per Top-Level Folder (`git ls-files | awk -F/ '{print $1}' | sort | uniq -c`)
```bash
$ git ls-files | awk -F/ '{print $1}' | sort | uniq -c
      1 ARCHITECTURE.md
      4 docs
      1 .env.example
      1 .github
      1 .gitignore
      1 index.html
      1 metadata.json
      1 .npmrc
      1 package.json
      1 PRODUCTION_DEPLOYMENT.md
      1 PRODUCTION_HANDOFF.md
      1 README.md
      5 scripts
      1 SECURITY.md
      1 server.ts
     90 src
      1 tsconfig.json
      1 vite.config.ts
      1 vitest.config.ts
```

---

## 3. P1-2: Reality Sync & WASM / IndexedDB Grep

### 3.1 Documentation and UI Sync
- **README.md**: Updated to describe central Express server + `better-sqlite3` in WAL mode on the server, server-side data storage, and multi-device browser connection over LAN.
- **PRODUCTION_HANDOFF.md**: Replaced client-side prototype claims with server-side Express architecture, SQLite WAL storage, and operational considerations.
- **SECURITY.md**: Updated storage matrix entry to reflect server-side transactions (`better-sqlite3` WAL) and removed IndexedDB client references.
- **src/i18n/ar.json**: Updated `version` to `"1.0.0 Release Candidate (pending independent security review and IT approval)"` and `db_ready` to `"قاعدة بيانات الخادم (better-sqlite3 WAL) جاهزة ومتصلة"`.
- **src/ui/components/Sidebar.tsx** & **SettingsModal.tsx**: Updated status indicators to reflect server SQLite WAL.

### 3.2 Real Output of Grep for WASM / IndexedDB / sql.js
```bash
$ grep -rniE "IndexedDB|WASM|sql\.js" README.md PRODUCTION_HANDOFF.md ARCHITECTURE.md SECURITY.md PRODUCTION_DEPLOYMENT.md docs src
src/tests/bundleGuard.spec.ts:110:  it('(b) & (c) build to temp outDir must succeed and contain no SQL DDL, wasm or password hashes', () => {
src/tests/bundleGuard.spec.ts:129:            // Fail on any .wasm file
src/tests/bundleGuard.spec.ts:130:            if (entry.name.endsWith('.wasm')) {
src/tests/bundleGuard.spec.ts:131:              expect.fail(`Found forbidden .wasm file in build output: ${entry.name}`);
src/tests/bundleGuard.spec.ts:136:            // Fail on strings: "CREATE TABLE", "password_hash", "PBKDF2", "sql-wasm"
src/tests/bundleGuard.spec.ts:137:            const forbiddenStrings = ['CREATE TABLE', 'password_hash', 'PBKDF2', 'sql-wasm'];
src/server/app.ts:61:            ? ["'self'", "'wasm-unsafe-eval'"]
src/server/app.ts:62:            : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
src/data/database/sqliteEngine.ts:11:import { SCHEMA_SQL } from './schema.sql.js';
```

**Justification for Remaining Hits:**
1. Zero matches in any documentation files (`README.md`, `PRODUCTION_HANDOFF.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PRODUCTION_DEPLOYMENT.md`, `docs/`).
2. `src/tests/bundleGuard.spec.ts`: Negative guard tests that explicitly verify that client production bundles do NOT contain any `.wasm` binaries or SQL DDL strings.
3. `src/server/app.ts`: Permissive CSP script-src directive token `'wasm-unsafe-eval'`.
4. `src/data/database/sqliteEngine.ts`: Import path `./schema.sql.js` matched by `sql\.js` pattern.

---

## 4. P1-3 & P1-6: Honest Wording and Grep for Overstated Claims

### 4.1 Changes Made
- Removed "سيادي" / "سيادة" / "sovereign" across documentation, UI titles, navigation, and banners (replaced with governmental/official terms).
- Replaced "Air-Gapped" in document titles and headings with "التثبيت دون اتصال بالإنترنت" (Offline Installation).
- Removed "100%" claims from banners, badges, and test logs.
- Replaced "zero-trust" with "حدود الثقة في جانب العميل" (Client Trust Boundary).
- Replaced "Production Release" and "جاهز للإنتاج" with "1.0.0 Release Candidate (pending independent security review and IT approval)".
- Described audit logs strictly as tamper-evident ("يكشف التلاعب"), never immutable ("غير قابل للتعديل").
- Preserved explicit disclosures: no independent security review conducted yet, no two-factor authentication (2FA) support.

### 4.2 Real Output of Grep for Overstated Wording
```bash
$ grep -rniE "سيادي|سيادة|sovereign|air-gapped|100%|zero-trust|production-ready|جاهز للإنتاج|Production Release|immutable|غير قابل للتعديل" README.md SECURITY.md ARCHITECTURE.md PRODUCTION_HANDOFF.md PRODUCTION_DEPLOYMENT.md docs src/i18n
docs/ENGINEERING_RULES.md:14:10. **Wording:** never claim "sovereign", "air-gapped", "zero-trust", "100% secure", "production-ready" or "immutable". State that the system has had no independent security review.
src/i18n/ar.json:194:    "category_sovereign": "علاقات حكومية ومؤسسية",
```

**Justification for Remaining Hits:**
1. `docs/ENGINEERING_RULES.md:14`: Rule 10 explicitly forbidding overstated claims.
2. `src/i18n/ar.json:194`: Translation key identifier `category_sovereign` whose user-facing text was translated honestly to `"علاقات حكومية ومؤسسية"`.

---

## 5. P1-4: Architecture Same-Origin One-Liner

Added to `ARCHITECTURE.md` (Section 1):
> `The app and API share one origin and the session cookie is SameSite=Strict (so fetch uses credentials 'same-origin').`

---

## 6. P1-5: Proprietary LICENSE & Go-Live Legal Checklist

### 6.1 LICENSE File Content
Created `/LICENSE` with exact content:
```
Copyright (c) 2026 <OWNER TO BE CONFIRMED BY EGYPTIAN NATIONAL POSTAL AUTHORITY LEGAL>. All rights reserved. Proprietary and confidential. No license is granted until ownership and terms are confirmed.
```

### 6.2 Go-Live Checklists Updated
Added to pending decisions in `PRODUCTION_DEPLOYMENT.md` (Section 4.ل) and `PRODUCTION_HANDOFF.md` (Section 8):
> `confirm code ownership and license terms with the Authority's legal department` (تأكيد ملكية الكود وشروط الترخيص مع الإدارة القانونية للهيئة).

---

## 7. Baseline Check: npm run check

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

> executive-office-portal@1.0.0 build
> vite build && npm run build:server

vite v8.3.0 building client environment for production...
transforming...
✓ 1696 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.43 kB │ gzip:   0.59 kB
dist/assets/index-*.css          68.23 kB │ gzip:  10.97 kB
dist/assets/index-*.js          764.42 kB │ gzip: 181.24 kB
✓ built in 810ms

> executive-office-portal@1.0.0 build:server
> esbuild server.ts ...

  dist-server/server.js  329.9kb
  dist-server/verifyNative.js  4.1kb
  dist-server/backup.js  168.0kb
  dist-server/verifyPackage.js  10.1kb

> executive-office-portal@1.0.0 smoke:package
> tsx scripts/smokePackage.ts

======================================================================
🧪 بدء اختبار الجاهزية الميدانية الشامل للحزمة (Package Smoke Test)
======================================================================
1️⃣  جاري بناء حزمة التثبيت دون اتصال...
✅ تم إنشاء حزمة التثبيت دون اتصال بنجاح تام!
2️⃣  تم العثور على الأرشيف: /app/applet/release/executive-office-portal-1.0.0-linux-x64-node22.tar.gz
3️⃣  جاري التحقق الرقمي والتشفيري من الأرشيف...
✅ اكتمل الفحص بنجاح تام! تم تدقيق ومطابقة 1594 ملف بنجاح.
4️⃣  جاري فك ضغط الحزمة في بيئة معزولة
5️⃣  التحقق الصارم من خلو الحزمة من أدوات التطوير (No Dev Tooling in Production)...
   ✅ تم التحقق: لا توجد أي ملفات شفرة مصدرية غير مترجمة (.ts / .tsx).
6️⃣  جاري تشغيل خادم الإنتاج المعزول: node dist-server/server.js
   ✅ خادم الإنتاج يعمل بنجاح (HTTP 200 on /api/health).
   ✅ تم التحقق من تقديم واجهة المستخدم React SPA بنجاح (HTTP 200).
   ✅ تم إنشاء والتحقق من إضافة قيد جديد في قاعدة البيانات.
7️⃣  اختبار أداة النسخ الاحتياطي المشفر من داخل الحزمة (node dist-server/backup.js)...
   ✅ تم إنشاء النسخة الاحتياطية بنجاح
8️⃣  اختبار التحقق من النسخة الاحتياطية (node dist-server/backup.js --verify)...
   ✅ تم التحقق التشفيري والهيكلي من ملف النسخة الاحتياطية بنجاح.
9️⃣  اختبار الاسترجاع التجريبي المعزول (node dist-server/backup.js --restore-test)...
   ✅ نجح اختبار الاسترجاع التجريبي في البيئة المعزولة.
🔟 اختبار تمرير كلمة المرور عبر ملف آمن (BACKUP_PASSPHRASE_FILE 0600)...
   ✅ تم إنشاء نسخة احتياطية بنجاح باستخدام BACKUP_PASSPHRASE_FILE.
1️⃣1️⃣ اختبار فك التشفير والتحقق لاسترجاع الطوارئ (node dist-server/backup.js --decrypt)...
   ✅ تم فك تشفير والتحقق من قاعدة البيانات بنجاح في مسار مستقل بأذونات 0600.
======================================================================
🎉 نجح اختبار الجاهزية الميدانية الشامل للحزمة (Smoke Test Passed)
======================================================================
```
