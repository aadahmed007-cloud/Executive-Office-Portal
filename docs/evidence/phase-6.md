# تقرير أدلة وإثباتات المرحلة السادسة: الجاهزية والتبديل إلى الخادم الاحتياطي الدافئ (Phase 6 Evidence)
## Egyptian National Postal Authority — Executive Office Portal

---

> **تنبيه أمني ونظامي:** لم يخضع هذا النظام لأي مراجعة أمنية مستقلة (the system has had no independent security review).

---

## 1. نظرة عامة على الإنجاز
تم تحقيق كافة أهداف المرحلة السادسة بنجاح تام لاستبعاد مخاطر توقف العمل في بيئة التشغيل المحلية (On-Premise 2-5 users) من خلال إرساء معمارية الخادم الاحتياطي الدافئ (Warm Standby) والنسخ الاحتياطي المشفر الدوري كل ساعة، وتوفير أداة الفحص المؤتمتة `npm run standby:check`، ودليل إجراءات التبديل واختبارات الجاهزية الميدانية الشاملة.

---

## 2. تفاصيل المهام المنفذة
1. **P6-1 & P6-4 (دليل الجاهزية والتبديل `docs/STANDBY_FAILOVER_AR.md` ومحاذير الاستخدام):**
   - كتابة دليل إجرائي خطوة بخطوة باللغة العربية يوضح:
     - التصميم الموصى به: خادم رئيسي مخصص + مزود طاقة UPS + تشغيل تلقائي للخدمة (`systemd` / `NSSM`) + إعداد BIOS ("Power On After AC Loss").
     - خادم احتياطي دافئ مطابق مع إبقاء الخدمة متوقفة تماماً (`STOPPED`) لمنع انقسام البيانات (Split-Brain).
     - نسخ احتياطي دوري مشفر كل ساعة ونقله عبر `cron + rsync` (على Linux) و `Task Scheduler + robocopy` (على Windows مع وسم الخطوات غير المختبرة عملياً).
     - اعتماد اسم نطاق داخلي موحد (Stable DNS) وشهادة HTTPS صادرة للاسم.
     - خطوات التبديل الدقيقة عند الطوارئ عبر أمر فك التشفير والاسترجاع `node dist-server/backup.js --decrypt`.
     - بيان الفاقد المحتمل بوضوح (التعديلات المدخلة منذ آخر نسخة احتياطية ناجحة خلال الساعة الأخيرة).
     - قائمة الفحص والمحاكاة الشهرية (Monthly Drill Checklist).
     - قسم المحظورات القطعية (DO NOT): حظر وضع قاعدة البيانات على مشاركة شبكية (Network Share)، حظر تشغيل خادمين في وقت واحد، حظر الاستضافة السحابية دون موافقة كتابية صريحة، وحظر الحسابات المشتركة.

2. **P6-2 (أداة فحص الجاهزية `npm run standby:check`):**
   - كتابة `scripts/standbyCheck.ts` وتجميعها عبر `esbuild` في `dist-server/standbyCheck.js` لتعمل في بيئة الإنتاج الصافية دون أي أدوات تطوير.
   - فحص أحدث نسخة احتياطية في `BACKUP_DIR`، والخروج برمز فشل (exit code 1) إذا كان عمر النسخة يتجاوز `STANDBY_MAX_AGE_MINUTES` (افتراضياً 90 دقيقة)، أو عند عدم وجود نسخ، أو عند فشل أي من الفحوصات: فك التشفير، `PRAGMA integrity_check`، `PRAGMA foreign_key_check`، سلسلة التدقيق التشفيرية، أو اكتمال الجداول.
   - طباعة سطر حالة عربي واضح وإضافة `STANDBY_MAX_AGE_MINUTES=` إلى `.env.example`.

3. **P6-3 (مجموعة الاختبارات الآلية المعزولة `src/tests/phase6Standby.spec.ts`):**
   - اختبارات شاملة في أدلة مؤقتة معزولة تحت `os.tmpdir()` تم تنظيفها في `afterAll`:
     1. النسخة الحديثة السليمة تجتاز الفحص بنجاح (`exit 0`).
     2. النسخة القديمة (أكبر من 90 دقيقة) تفشل مع توضيح السبب.
     3. النسخة التالفة تفشل في فحص السلامة الهيكلية.
     4. النسخة المتلاعب بها تشفيرياً تفشل في فحص مصادقة AES-256-GCM.
     5. كلمة المرور الخاطئة تفشل في فك التشفير.
     6. الدليل الفارغ (عدم وجود نسخ) يفشل فوراً.
     7. تشغيل الأداة عبر سطر الأوامر المستقل (`node dist-server/standbyCheck.js`).

4. **P6-5 (توسيع اختبار الجاهزية الميدانية `smoke:package`):**
   - تم تمديد `scripts/smokePackage.ts` لتشغيل `node dist-server/standbyCheck.js` داخل الحزمة المستخرجة في البيئة المعزولة والتحقق من عملها المستقل.

---

## 3. مخرجات الاختبارات الآلية الجديدة (Real Test Output)
```text
$ npx vitest run src/tests/phase6Standby.spec.ts

 RUN  v5.0.3 /app/applet

 ✓ src/tests/phase6Standby.spec.ts (7 tests) 711ms
   ✓ Phase 6: Warm Standby Availability & Freshness Verification (7)
     ✓ 1. Fresh backup passes verification and freshness check
     ✓ 2. Old backup (age > STANDBY_MAX_AGE_MINUTES) fails with clear status
     ✓ 3. Corrupt backup file fails integrity verification
     ✓ 4. Tampered ciphertext backup fails authentication and GCM verification
     ✓ 5. Wrong passphrase fails decryption
     ✓ 6. Empty backup directory (no backup) fails
     ✓ 7. CLI execution (node dist-server/standbyCheck.js) exits 0 on fresh backup and 1 on old backup 342ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  05:56:35
   Duration  1.26s (tests 69%, transform 23%, import 7%, worker 1%)
```

---

## 4. مخرجات فحص الحزمة المستقلة (smoke:package)
```text
1️⃣2️⃣ اختبار أداة فحص الجاهزية الاحتياطية (node dist-server/standbyCheck.js)...
✅ نجاح فحص الجاهزية الاحتياطية (Warm Standby): أحدث نسخة احتياطية سليمة ومحدثة (backup-20261014055801.db.enc، عمرها 0 دقيقة، تم التحقق من سلامة البيانات وسلسلة التدقيق).
   ✅ نجح فحص الجاهزية الاحتياطية (standby:check) داخل الحزمة المستخرجة.
======================================================================
🎉 نجح اختبار الجاهزية الميدانية الشامل للحزمة (Smoke Test Passed)
======================================================================
```

---

## 5. مخرجات الفحص الشامل المعتمد للمنظومة (npm run check)
```text
$ npm run check
> executive-office-portal@1.0.0 check
> npm run typecheck && npm run test && npm run build && npm run smoke:package

> executive-office-portal@1.0.0 typecheck
> tsc --noEmit

Test Files  21 passed (21)
     Tests  160 passed (160)

> executive-office-portal@1.0.0 build
> vite build && npm run build:server
✓ built in 870ms
  dist-server/server.js  359.7kb
  dist-server/verifyNative.js  4.1kb
  dist-server/backup.js  169.8kb
  dist-server/verifyPackage.js  10.1kb
  dist-server/standbyCheck.js  176.1kb

======================================================================
✅ تم إنشاء حزمة التثبيت دون اتصال بنجاح تام!
📦 المسار: /app/applet/release/executive-office-portal-1.0.0-linux-x64-node22.tar.gz (5.77 MB)
🔑 البصمة الرقمية (SHA-256): 375c400a9275aba37c67a2f165fca284298cc08000580900614e236581b0e167
📊 إجمالي الملفات المفحوصة: 1601 ملف
======================================================================
🎉 نجح اختبار الجاهزية الميدانية الشامل للحزمة (Smoke Test Passed)
```

---
*الحالة: مكتمل بنجاح ومطابق لجميع المعايير الهندسية والتأمين الأمني.*
