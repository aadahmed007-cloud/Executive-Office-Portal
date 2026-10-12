# Phase 2 Evidence: Cross-Platform Scripts and Safe Restore Procedure

## 1. Execution Metadata
- **Phase**: Phase 2 (Cross-Platform Scripts and Safe Restore Procedure)
- **Branch**: `hardening/rc1`
- **Date**: 2026-10-12T07:57:00Z
- **Platform**: linux x64 (GNU/Linux 4.19.0-gvisor)
- **Node**: v22.23.2
- **npm**: 10.9.8
- **git**: 2.34.1

---

## 2. P2-1: NODE_ENV Default in Entry Bundles

`dist-server/server.js` and `dist-server/backup.js` set `NODE_ENV` to `'production'` when unset at the very top of the entry files before anything reads it, using an esbuild banner:
```javascript
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
```

### Verification of Top Lines (`head -n 2 dist-server/server.js dist-server/backup.js`)
```bash
$ head -n 2 dist-server/server.js
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
var __defProp = Object.defineProperty;

$ head -n 2 dist-server/backup.js
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
// scripts/backup.ts
```

In `package.json`, `npm start` is now directly:
```json
"start": "node dist-server/server.js"
```

---

## 3. P2-2: Cross-Platform Scripts Block and scripts/clean.mjs

### 3.1 Final "scripts" Block in package.json
```json
  "scripts": {
    "dev": "tsx server.ts",
    "dev:local": "tsx server.ts",
    "server": "tsx server.ts",
    "start": "node dist-server/server.js",
    "build:server": "esbuild server.ts --platform=node --bundle --format=esm --packages=external --banner:js=\"if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';\" --outfile=dist-server/server.js && esbuild scripts/verifyNative.ts --platform=node --bundle --format=esm --packages=external --outfile=dist-server/verifyNative.js && esbuild scripts/backup.ts --platform=node --bundle --format=esm --packages=external --banner:js=\"if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';\" --outfile=dist-server/backup.js && esbuild scripts/verifyPackage.ts --platform=node --bundle --format=esm --packages=external --outfile=dist-server/verifyPackage.js",
    "verify:native": "node dist-server/verifyNative.js",
    "verify:native:dev": "tsx scripts/verifyNative.ts",
    "package:offline": "tsx scripts/packageOffline.ts",
    "verify:package": "node dist-server/verifyPackage.js",
    "verify:package:dev": "tsx scripts/verifyPackage.ts",
    "backup": "node dist-server/backup.js",
    "backup:verify": "node dist-server/backup.js --verify",
    "backup:restore-test": "node dist-server/backup.js --restore-test",
    "backup:decrypt": "node dist-server/backup.js --decrypt",
    "backup:dev": "tsx scripts/backup.ts",
    "backup:verify:dev": "tsx scripts/backup.ts --verify",
    "backup:restore-test:dev": "tsx scripts/backup.ts --restore-test",
    "backup:decrypt:dev": "tsx scripts/backup.ts --decrypt",
    "smoke:package": "tsx scripts/smokePackage.ts",
    "build": "vite build && npm run build:server",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "check": "npm run typecheck && npm run test && npm run build && npm run smoke:package",
    "clean": "node scripts/clean.mjs"
  }
```

### 3.2 scripts/clean.mjs Implementation
```javascript
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const staticTargets = ['dist', 'dist-server', 'release', '.test_offline_sandbox'];

for (const target of staticTargets) {
  const targetPath = path.join(rootDir, target);
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

try {
  const entries = fs.readdirSync(rootDir);
  for (const entry of entries) {
    if (
      entry.startsWith('.test_smoke_pkg') ||
      entry.startsWith('.test_pkg_') ||
      entry.startsWith('.temp_pkg_') ||
      entry.startsWith('.temp_') ||
      entry.startsWith('.test_')
    ) {
      const fullPath = path.join(rootDir, entry);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
} catch {
  // Ignore error if readdir fails
}

console.log('Clean complete.');
```

### 3.3 Verification of No Dev Dependencies in Production Dependencies
```json
  "dependencies": {
    "better-sqlite3": "13.0.3",
    "cookie-parser": "1.4.7",
    "dotenv": "17.2.3",
    "express": "4.21.2",
    "helmet": "8.3.0",
    "zod": "4.6.5"
  }
```
No dev dependencies (vite, tsx, vitest, esbuild) exist in production `dependencies`.

---

## 4. P2-3: Safe Disaster-Recovery Linux Procedure (No Silenced Errors)

In `docs/OFFLINE_INSTALL_AR.md`, Section ح.4 Step 2 was rewritten to calculate `$TS` once, enforce `set -e`, move `app.db`, `app.db-wal`, and `app.db-shm` without error suppression, and output `ls -la` of the quarantined directory:

```bash
set -e
DATA_DIR="/var/lib/executive_portal/data"
TS=$(date +%Y%m%d%H%M%S)
DAMAGED_DIR="$DATA_DIR/damaged_$TS"

sudo mkdir -p "$DAMAGED_DIR"
for f in app.db app.db-wal app.db-shm; do
  if [ -f "$DATA_DIR/$f" ]; then
    sudo mv "$DATA_DIR/$f" "$DAMAGED_DIR/"
  fi
done

# إثبات النقل وعرض الملفات المعزولة كدليل
ls -la "$DAMAGED_DIR"
```

### Verification Grep for Silenced Errors in Documentation
```bash
$ grep -rnE "2>/dev/null|\|\| true" README.md PRODUCTION_DEPLOYMENT.md PRODUCTION_HANDOFF.md SECURITY.md ARCHITECTURE.md docs/
(Exit code 1 - 0 matches found)
```

---

## 5. P2-4: Windows PowerShell Equivalent Disaster Recovery Block

Documented in `docs/OFFLINE_INSTALL_AR.md` Section ح.4 Step 2:
```powershell
# على نظام Windows (PowerShell) (لم يخضع لاختبارات أجهزة فعلية من قِبل المطورين - not yet tested by the authors):
$ErrorActionPreference = "Stop"
$DATA_DIR = "D:\ExecutivePortalData\data"
$TS = Get-Date -Format "yyyyMMddHHmmss"
$DAMAGED_DIR = Join-Path $DATA_DIR "damaged_$TS"

Stop-Service -Name "ExecutivePortalService"
New-Item -ItemType Directory -Path $DAMAGED_DIR -Force
Get-ChildItem -Path $DATA_DIR -Filter "app.db*" | Move-Item -Destination $DAMAGED_DIR -ErrorAction Stop

# إثبات النقل وعرض الملفات المعزولة كدليل
Get-ChildItem -Path $DAMAGED_DIR
```

**Platform status note**: This development machine is Linux x64 (`Linux localhost 4.19.0-gvisor #1 SMP Sun Jan 10 15:06:54 PST 2016 x86_64 GNU/Linux`). As instructed by P2-4, the PowerShell block is explicitly marked `(لم يخضع لاختبارات أجهزة فعلية من قِبل المطورين - not yet tested by the authors)`.

---

## 6. P2-5: Offline Package Extraction and Full Verification on THIS Machine

Real execution in an isolated temporary directory created under `/tmp` with `unset NODE_ENV`:

```bash
=== Step 1: Extract package ===
Extracting to: /tmp/p2_verify_jh0PKa
tar -xzf /app/applet/release/executive-office-portal-1.0.0-linux-x64-node22.tar.gz -C "$EXTRACT_DIR"

=== Step 2: Test npm start with clean env (unset NODE_ENV) ===
Server started with PID: 994
Server is ready after 1 checks.

=== Step 3: Check /api/health ===
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self' data:;form-action 'self';frame-ancestors 'self' https://aistudio.google.com;img-src 'self' data: blob:;object-src 'none';script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval';script-src-attr 'none';style-src 'self' 'unsafe-inline';connect-src 'self' ws: wss:
Cross-Origin-Resource-Policy: cross-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Content-Type: application/json; charset=utf-8
Content-Length: 15
ETag: W/"f-VaSQ4oDUiZblZNAEkkN+sX+q3Sg"
Date: Mon, 12 Oct 2026 07:55:48 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"status":"ok"}

Server stopped.

=== Step 4: Run backup command from inside extracted package ===
$ BACKUP_PASSPHRASE="[REDACTED]" DATA_DIR="$TEMP_DATA" BACKUP_DIR="$EXTRACT_DIR/backups" node dist-server/backup.js
📦 جاري إنشاء نسخة احتياطية مشفرة ومؤمنة لقاعدة البيانات...
======================================================
🔑 INITIAL SECURITY PROVISIONING: CREATING USERS
======================================================
👤 User: [chairman] (CHAIRMAN) -> Initial Password: [REDACTED]
👤 User: [secretary] (SECRETARY) -> Initial Password: [REDACTED]
👤 User: [admin] (ADMIN) -> Initial Password: [REDACTED]
======================================================
✅ تم إنشاء والتحقق من النسخة الاحتياطية بنجاح: /tmp/p2_verify_jh0PKa/backups/backup-20261012075548.db.enc (مشفرة: true)
Generated backup file: /tmp/p2_verify_jh0PKa/backups/backup-20261012075548.db.enc

=== Step 5: Run backup --decrypt command from inside extracted package ===
$ BACKUP_PASSPHRASE="[REDACTED]" node dist-server/backup.js --decrypt "$BACKUP_FILE" --out "$EXTRACT_DIR/restored.db"
🔓 بدء فك تشفير والتحقق من النسخة الاحتياطية: /tmp/p2_verify_jh0PKa/backups/backup-20261012075548.db.enc -> /tmp/p2_verify_jh0PKa/restored.db
✅ تم فك تشفير النسخة بنجاح والتحقق من سلامتها وهيكلها التشفيري: /tmp/p2_verify_jh0PKa/restored.db
┌────────────────┬────────┐
│ (index)        │ Values │
├────────────────┼────────┤
│ users          │ 3      │
│ correspondence │ 20     │
│ directives     │ 15     │
│ meetings       │ 10     │
│ matters        │ 5      │
│ contacts       │ 8      │
│ audit_log      │ 4      │
│ settings       │ 1      │
└────────────────┴────────┘

=== Step 6: Verifying restored database ===
-rw------- 1 root root 331776 Oct 12 07:55 /tmp/p2_verify_jh0PKa/restored.db
Restored users count: 3
=== Done & Cleaned up ===
```

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

 ✓ src/tests/massAssignment.spec.ts (8 tests) 700ms
 ✓ src/tests/phase5AuditChain.spec.ts (6 tests) 545ms
 ✓ src/tests/offlinePackaging.spec.ts (3 tests) 143ms
 ✓ src/tests/frontendServing.spec.ts (5 tests) 103ms
 ✓ src/tests/phase4Persistence.spec.ts (3 tests) 83ms
 ✓ src/tests/securityHeaders.spec.ts (3 tests) 78ms
 ✓ src/tests/legacySuites.spec.ts (22 tests) 58ms
 ✓ src/tests/environmentAndDocsValidation.spec.ts (3 tests) 28ms
 ✓ src/tests/gitignoreGuard.spec.ts (2 tests) 27ms
 ✓ src/tests/requiredFiles.spec.ts (2 tests) 8ms
 ✓ src/tests/ctxGuard.spec.ts (2 tests) 8ms
 ✓ src/tests/startupBanner.spec.ts (3 tests) 10ms
 ✓ src/tests/authPhase2.spec.ts (10 tests)
 ✓ src/tests/authPhase3.spec.ts (27 tests)
 ✓ src/tests/minimalPayloadAndConstraints.spec.ts (15 tests)
 ✓ src/tests/phase4EncryptedBackup.spec.ts (10 tests)
 ✓ src/tests/bundleGuard.spec.ts (2 tests)

 Test Files  17 passed (17)
      Tests  126 passed (126)
   Duration  4.16s

> executive-office-portal@1.0.0 build
> vite build && npm run build:server

vite v8.3.0 building client environment for production...
transforming...
✓ 1696 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.43 kB │ gzip:   0.59 kB
dist/assets/index-Bfs3s06d.css   68.23 kB │ gzip:  10.97 kB
dist/assets/index-D2La0uJh.js   764.37 kB │ gzip: 181.20 kB
✓ built in 998ms

> executive-office-portal@1.0.0 build:server
> esbuild server.ts ...

  dist-server/server.js  330.1kb
  dist-server/verifyNative.js  4.1kb
  dist-server/backup.js  168.2kb
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
✅ اكتمل الفحص بنجاح تام! تم تدقيق ومطابقة 1595 ملف بنجاح.
4️⃣  جاري فك ضغط الحزمة في بيئة معزولة
5️⃣  التحقق الصارم من خلو الحزمة من أدوات التطوير (No Dev Tooling in Production)...
   ✅ تم التحقق: لا توجد أي أدوات تطوير (vite / tsx / vitest / esbuild).
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
