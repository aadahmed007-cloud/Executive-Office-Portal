# دليل النشر والتشغيل في بيئة الإنتاج — PRODUCTION_DEPLOYMENT.md
## Egyptian National Postal Authority — Internal LAN / On-Premise Deployment

---

## 1. طوبولوجيا النشر في الشبكة الداخلية (Deployment Topology)

```
[ أجهزة المستخدمين المصرح لهم - مكتب الرئيس ]
                    │
                    │  HTTPS (TLS 1.3 - Internal CA)
                    ▼
┌────────────────────────────────────────────────────────┐
│     خادم البوابة والبروكسي العكسي (NGINX Reverse Proxy)  │
│  - إنهاء التشفير TLS Termination                       │
│  - الترويسات الأمنية (CSP, HSTS, X-Frame-Options)      │
│  - كبح الطلبات المتكررة (Rate Limiting)                │
└───────────────────────────┬────────────────────────────┘
                            │  HTTP (Localhost / Unix Socket)
                            ▼
┌────────────────────────────────────────────────────────┐
│           خادم التطبيق (Node.js Express API)           │
│  - إدارة الجلسات بجلسات HttpOnly Secure Cookies        │
│  - التحقق من الصلاحيات والمطابقة (RBAC + Clearance)    │
│  - تسجيل الأنشطة والمراقبة المنظمة (Structured Logging)│
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         قاعدة بيانات SQLite الإنتاجية (Server-Side)     │
│  - نمط التسجيل المسبق WAL Mode (Write-Ahead Logging)   │
│  - تفعيل القيود: PRAGMA foreign_keys = ON;            │
│  - مهلة الانتظار: PRAGMA busy_timeout = 5000;         │
│  - النسخ الاحتياطي اللحظي: SQLite Backup API           │
└────────────────────────────────────────────────────────┘
```

---

## 2. إعدادات البيئة (Environment Variables)

يتم ضبط المتغيرات في ملف `.env` غير المتصل بالإنترنت:

```bash
# بيئة التشغيل
NODE_ENV=production
PORT=3000

# أمان الجلسات
SESSION_SECRET=REPLACE_WITH_STRONG_RANDOM_64_CHAR_SECRET
SESSION_TIMEOUT_MINUTES=15

# مسار قاعدة البيانات المحلي
DATABASE_PATH=/var/lib/executive_portal/data/postal_executive.sqlite

# مسار تخزين المرفقات المشفرة
ATTACHMENTS_DIR=/var/lib/executive_portal/attachments

# القيود الأمنية
MAX_UPLOAD_SIZE_MB=25
ENABLE_SECURE_COOKIES=true
TRUST_PROXY=true
```

---

## 3. تهيئة محرك SQLite الإنتاجي (SQLite Production Configuration)

عند إقلاع خادم الإنتاج، يتم تنفيذ الأوامر التالية على الاتصال الرئيسي:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000; -- 64MB Cache
```

### فوائد هذا التكوين:
- **نمط WAL:** يسمح بالقراءة المتزامنة دون إعاقة عمليات الكتابة.
- **مهلة الانتظار (busy_timeout):** تمنع أخطاء `database is locked` عند حدوث عمليات متزامنة.
- **سلامة المفاتيح الأجنبية (foreign_keys):** تضمن عدم وجود سجلات يتيمة في المراسلات والاجتماعات والتكليفات.

---

## 4. استراتيجية النسخ الاحتياطي المشفر والتعافي من الكوارث (Encrypted Backup & DR)

### ⚠️ المبادئ الإلزامية للأمان المؤسسي:
1. **RAID ليس نسخة احتياطية (RAID is NOT a backup):** منظومات RAID تحمي من تلف الأقراص المادية فقط ولكنها لا تحمي من الحذف الخاطئ أو الهجمات التخريبية أو تلف البيانات المنطقي.
2. **النسخ إلى جهاز أو مسار شبكي مستقل (Separate Device / Remote Share):** يجب نسخ ملفات النسخ الاحتياطي فور إنشائها إلى جهاز تخزين منفصل تماماً أو وحدة تخزين شبكية معزولة (Air-Gapped / Isolated Storage).
3. **حفظ كلمة مرور التشفير في مكان آمن مغلق (Offline Sealed Passphrase):** يجب توليد `BACKUP_PASSPHRASE` قوية وتدوينها وحفظها في ظرف مغلق ومختوم داخل خزينة الإدارة (Safe Deposit) بعيداً عن ملفات النظام والخوادم.
4. **اختبار استرجاع شهري دوري (Monthly Restore Drill):** إجراء تجربة استرجاع دورية كل شهر في بيئة معزولة للتأكد من سلامة النسخ وصلاحية كلمة المرور.

### أوامر إدارة وفحص النسخ الاحتياطي:
```bash
# 1. إنشاء نسخة احتياطية مشفرة مشتقة بمفتاح AES-256-GCM والتحقق التلقائي منها
BACKUP_PASSPHRASE="YOUR_OFFLINE_SECRET" npm run backup

# 2. التحقق الشامل من سلامة وتشفير أي ملف نسخة احتياطية وفحص سجل العمليات التشفيري
BACKUP_PASSPHRASE="YOUR_OFFLINE_SECRET" npm run backup:verify -- var/backups/backup-20261005120000.db.enc

# 3. اختبار استرجاع تجريبي معزول في دليل مؤقت ومقارنة عدد السجلات دون المساس بقاعدة البيانات الحية
BACKUP_PASSPHRASE="YOUR_OFFLINE_SECRET" npm run backup:restore-test -- var/backups/backup-20261005120000.db.enc
```

---

## 5. خط الإنتاج والتحقق التلقائي (CI & Quality Gate)

لضمان سلامة الكود قبل أي نشر:
```bash
# 1. تدقيق الشفرة وفحص TypeScript
npm run lint

# 2. تشغيل حزمة الاختبارات الشاملة (7 أجنحة اختبار)
npm test

# 3. بناء حزمة الإنتاج
npm run build
```
أي فشل في الاختبارات أو فحص الأنواع يوقف عملية النشر تلقائياً.
