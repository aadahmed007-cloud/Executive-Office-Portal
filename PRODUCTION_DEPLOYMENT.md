# دليل النشر والتشغيل في بيئة الإنتاج — PRODUCTION_DEPLOYMENT.md
## Egyptian National Postal Authority — Internal LAN / On-Premise Air-Gapped Deployment
### وثيقة إجراءات التشغيل والنشر المؤسسي لبوابة مكتب رئيس مجلس الإدارة

---

> ⚠️ **إشعار أمني هام:** النظام مصمم للعمل في شبكة داخلية معزولة تماماً (Air-Gapped). **لم يخضع النظام بعد لمراجعة أمنية واختبار اختراق مستقل.** لا يُعتبر معتمداً للإنتاج العام دون مصادقة إدارة الأمن السيبراني.

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
                            │  HTTP (127.0.0.1:3000)
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

يتم ضبط المتغيرات في ملف `.env` المحمي (`chmod 600`):

```bash
# بيئة التشغيل
NODE_ENV=production
PORT=3000

# أمان تشفير النسخ الاحتياطي (AES-256-GCM مع اشتقاق scrypt)
BACKUP_PASSPHRASE=""
BACKUP_PASSPHRASE_FILE="/etc/executive_portal/backup.secret"
BACKUP_RETENTION=7
BACKUP_ALLOW_PLAINTEXT=false

# مسارات البيانات المنفصلة خارج مجلد التطبيق البرمجي
DATA_DIR=/var/lib/executive_portal/data
BACKUP_DIR=/var/backups/executive_portal

# الضوابط الأمنية
COOKIE_SECURE=true
TRUST_PROXY=true
ALLOWED_ORIGINS=https://portal.local,https://192.168.10.50
SESSION_IDLE_MINUTES=30
SESSION_ABSOLUTE_HOURS=12

```

---

## 3. تهيئة محرك SQLite الإنتاجي (SQLite Production Engine)

يتم ضبط خصائص SQLite التالية في خادم الإنتاج:
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000; -- 64MB Cache
```

- **نمط WAL:** يسمح بالقراءة المتزامنة دون إعاقة عمليات الكتابة.
- **مهلة الانتظار (busy_timeout):** تمنع أخطاء `database is locked`.
- **سلامة المفاتيح الأجنبية (foreign_keys):** تضمن عدم وجود سجلات يتيمة.

---

## 4. دليل التثبيت والتشغيل الميداني للمكتب المعزول (Air-Gapped Installation Sections A–L)

> **ملاحظة:** تتوفر النسخة العربية المطبوعة الكاملة في `docs/OFFLINE_INSTALL_AR.md`.

### أ. المتطلبات الفنية (Requirements):
- جهاز كمبيوتر مكتبي صغير (Mini PC / Small Server) مزود بمعالج 4-Core وذاكرة 4GB RAM وقرص SSD وجهاز UPS وعنوان IP ثابت.
- مثبت Node.js LTS منسوخ مسبقاً عبر USB (نفس الإصدار الرئيسي للحزمة، مثل v22.x). لا يلزم وجود مترجم C++ أو Python.

### ب. تجهيز الحزمة على جهاز متصل (Package Preparation):
```bash
npm ci
npm run check
npm run package:offline
node dist-server/verifyPackage.js release/executive-office-portal-*.tar.gz
```
انسخ ملف الأرشيف وملف `.sha256` إلى وحدة تخزين USB.

### ج. التثبيت على جهاز المكتب (Installation):
1. التحقق من البصمة الرقمية: `sha256sum -c *.sha256`.
2. استخراج الحزمة إلى `/opt/executive-portal` (أو `C:\ExecutivePortal` على Windows).
3. إنشاء حساب مستخدم نظام مخصص بدون صلاحيات جذر (`portal_svc`).
4. إنشاء مجلدات `DATA_DIR` و `BACKUP_DIR` خارج مجلد التطبيق بصلاحية `700`.
5. نسخ `.env.example` إلى `.env` وضبط الصلاحيات `chmod 600`.

### د. فحص محرك البيانات والإقلاع الأول (First Start):
1. تنفيذ فحص المحرك: `node dist-server/verifyNative.js`.
2. تشغيل أولي يدوي: `node dist-server/server.js`.
3. التقاط كلمات المرور الأولية وتدوينها في مظاريف مختومة تسلم للمستخدمين.
4. التأكيد على إجبار تغيير كلمة المرور عند أول تسجيل دخول، وعدم إعادة توليدها في مرات التشغيل اللاحقة.

### هـ. تأمين HTTPS على الشبكة المحلية (HTTPS LAN):
- استخدام شهادة TLS صادرة من هيئة تصديق داخلية (Internal CA).
- إنهاء التشفير عبر NGINX أو خادم Node.js الداخلي.
- إبقاء `COOKIE_SECURE=true` لمنع سرقة الجلسات (الاتصال عبر HTTP لن يحفظ كوكيز الجلسة).

### و. الجدار الناري والشبكة (Firewall & Network):
- تقييد الاستماع على المنفذ المحلي وفتح منفذ 443 فقط للشبكة الفرعية لمكتب الرئيس.
- اتصال VPN لرئيس المجلس هو قرار منفصل يتطلب اعتماد إدارة الأمن السيبراني.

### ز. التشغيل كخدمة نظام (Service Management):
- استخدام ملف خدمة `systemd` في Linux مع ضبط `Restart=on-failure`, `ProtectSystem=strict`, `PrivateTmp=true`.
- استخدام `NSSM` كخدمة مدارة على نظام Windows.

### ح. النسخ الاحتياطي والاسترجاع اليدوي الدقيق (Backups & Manual Restore):
- **النسخ اليومي:** جدولة تشغيل يومي لأمر النسخ المشفر بكلمة سر قوية (`cron` أو `Task Scheduler`).
- **الفحص الدوري:** إجراء اختبار استرجاع شهري دوري في بيئة معزولة للتأكد من سلامة البيانات: `node dist-server/backup.js --restore-test <backup_file>`.
- **خطوات الاسترجاع اليدوي عند الطوارئ (Manual Disaster Recovery Procedure):**
  1. إيقاف خدمة التطبيق فوراً لمنع أي كتابة (`systemctl stop executive-portal`).
  2. الاحتفاظ بالنسخة الحالية من ملف `app.db` كإجراء وقائي احترازي.
  3. فك تشفير وفحص سلامة النسخة المراد استرجاعها في بيئة مؤقتة معزولة (`node dist-server/backup.js --restore-test <backup_file>`).
  4. استبدال ملف `app.db` بالملف المسترجع وضبط الصلاحيات الصارمة (0600).
  5. حذف ملفات `app.db-wal` و `app.db-shm` السابقة لضمان عدم التعارض.
  6. إعادة تشغيل الخدمة (`systemctl start executive-portal`).
  7. التحقق التشفيري من سلامة سلسلة سجل الرقابة (`node dist-server/backup.js --verify <backup_file>`).
  8. إجراء اختبار الجاهزية التشغيلية (Smoke test على `/api/health` وتجربة الدخول).


### ط. قائمة الفحص بعد التثبيت (Smoke Test Checklist):
- فحص `/api/health`.
- تسجيل دخول المستخدمين وإجبار تغيير كلمة المرور.
- إنشاء مراسلات بملخص وبدون ملخص والتأكد من عدم حدوث أخطاء 500.
- اعتماد المعاملات من رئيس المجلس وتدقيق سلسلة سجلات الأمان.
- إعادة تشغيل الخادم والتأكد من بقاء البيانات وعدم ظهور حسابات جديدة.
- فحص شبكة المتصفح والتأكد من عدم وجود أي طلب خارجي (0 requests to internet).

### ي. التحديث دون اتصال (Offline Updates):
- بناء حزمة جديدة، أخذ نسخة احتياطية، إيقاف الخدمة، استخراج الحزمة في مجلد جديد، تطبيق التحديثات وإعادة التشغيل.

### ك. استكشاف الأخطاء وإصلاحها (Troubleshooting Table):
- معالجة مشاكل عدم تطابق معمارية Node، وانشغال المنفذ، وفقدان كوكيز الجلسة عبر HTTP، وأخطاء صلاحيات الملفات.

### ل. مصفوفة القرارات المعلقة لإدارة تكنولوجيا وأمن المعلومات:
- توثيق قرارات موقع الخادم، وتصاريح الـ VPN، ومصدر شهادات TLS، ومكان تخزين النسخ الاحتياطي الخارجي، والمراجعة الأمنية المستقلة.

---

## 5. خط الإنتاج والتحقق التلقائي (CI Quality Gate)

```bash
# 1. فحص الأنواع البرمجية
npm run typecheck

# 2. تشغيل حزمة الاختبارات الشاملة (15 جناح اختبار)
npm test

# 3. بناء خادم الإنتاج والواجهة الأمامية
npm run build
```
