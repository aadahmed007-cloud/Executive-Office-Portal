# دليل التثبيت والتشغيل الشامل دون اتصال بالإنترنت (Offline Air-Gapped Installation Guide)
## بوابة مكتب رئيس مجلس الإدارة — الهيئة القومية للبريد المصري
### وثيقة إجراءات التشغيل القياسية لمسؤولي تكنولوجيا المعلومات وأمن المعلومات (IT & Security Operations)

---

> ⚠️ **حدود وضوابط النظام وإخلاء المسؤولية الأمني (System Limitations & Disclaimer):**
> - **أصل النظام:** نموذج تطبيقي داخلي خضع لتطوير واختبارات معمارية موسعة.
> - **المراجعة المستقلة:** **لم يخضع النظام بعد لمراجعة أمنية واختبار اختراق مستقل (Independent Penetration Testing / Third-Party Security Audit).**
> - **الاعتماد التشغيلي:** **موافقة واعتماد إدارة تكنولوجيا وأمن المعلومات معلقة (IT & Cybersecurity Approval Pending).** لا يُعتبر النظام مصرحاً باستقبال بيانات سرية حية في بيئة الإنتاج النهائي حتى استكمال إجراءات الاعتماد الرسمية.

---

## فهرس الأقسام (Table of Contents)
- [القسم أ: المتطلبات الفنية والمادية للأجهزة والشبكة (Hardware & System Requirements)](#القسم-أ-المتطلبات-الفنية-والمادية-للأجهزة-والشبكة)
- [القسم ب: تجهيز وبناء الحزمة على جهاز متصل بالإنترنت (Preparing the Package)](#القسم-ب-تجهيز-وبناء-الحزمة-على-جهاز-متصل-بالإنترنت)
- [القسم ج: نقل الحزمة وتثبيتها على خادم المكتب المعزول (Installation on Office Machine)](#القسم-ج-نقل-الحزمة-وتثبيتها-على-خادم-المكتب-المعزول)
- [القسم د: فحص محرك البيانات والإقلاع الأولي وتدوين بيانات الدخول (First Start & Credentials)](#القسم-د-فحص-محرك-البيانات-والإقلاع-الأولي-وتدوين-بيانات-الدخول)
- [القسم هـ: تأمين الاتصال عبر بروتوكول HTTPS في الشبكة المحلية (LAN HTTPS & TLS)](#القسم-هـ-تأمين-الاتصال-عبر-بروتوكول-https-في-الشبكة-المحلية)
- [القسم و: قواعد الشبكة والجدار الناري وسياسات الوصول (Network & Firewall Policies)](#القسم-و-قواعد-الشبكة-والجدار-الناري-وسياسات-الوصول)
- [القسم ز: التشغيل المستمر كخدمة نظام مدارة (Run as a Managed Service)](#القسم-ز-التشغيل-المستمر-كخدمة-نظام-مدارة)
- [القسم ح: استراتيجية النسخ الاحتياطي المشفر والاسترجاع على Linux و Windows](#القسم-ح-استراتيجية-النسخ-الاحتياطي-المشفر-والاسترجاع)
- [القسم ط: قائمة الفحص والتحقق بعد التثبيت (Post-Installation Smoke Test Checklist)](#القسم-ط-قائمة-الفحص-والتحقق-بعد-التثبيت)
- [القسم ي: إجراءات التحديث دون اتصال بالإنترنت (Offline Update & Rollback)](#القسم-ي-إجراءات-التحديث-دون-اتصال-بالإنترنت)
- [القسم ك: جدول استكشاف الأخطاء وحلولها المباشرة (Troubleshooting Table)](#القسم-ك-جدول-استكشاف-الأخطاء-وحلولها-المباشرة)
- [القسم ل: مصفوفة القرارات المعلقة لمسؤولي تكنولوجيا وأمن المعلومات (Pending IT/Security Decisions)](#القسم-ل-مصفوفة-القرارات-المعلقة-لمسؤولي-تكنولوجيا-وأمن-المعلومات)

---

## القسم أ: المتطلبات الفنية والمادية للأجهزة والشبكة

### 1. مواصفات الخادم الموصى بها (Recommended Hardware):
- **نوع الجهاز:** جهاز حاسوب مكتبي صغير مخصص (Dedicated Mini PC / Small Form-Factor Server) موضوع في غرفة آمنة أو خزانة مقفلة بمكتب الرئيس.
- **المعالج (CPU):** معالج 64-bit رباعي الأنوية فما فوق (Intel Core i3/i5/i7 الجيل العاشر فما فوق، أو AMD Ryzen، أو Intel Xeon).
- **الذاكرة العشوائية (RAM):** 4 جيجابايت كحد أدنى (الموصى به 8 جيجابايت).
- **وحدة التخزين:** قرص تخزين سريع SSD بسعة خالية لا تقل عن 50 جيجابايت (لتخزين قاعدة بيانات SQLite المدمجة والمرفقات المشفرة وسجلات التدقيق).
- **مزود الطاقة غير المنقطع (UPS):** يُشترط ربط الخادم بجهاز مزود طاقة غير منقطع لحماية ملفات قاعدة البيانات ومجلدات التسجيل المسبق WAL من الانقطاع المفاجئ للتيار الكهربائي أثناء دورات الكتابة.
- **عنوان الشبكة:** عنوان IP ثابت (Static IPv4) على الشبكة الداخلية LAN لمكتب رئيس مجلس الإدارة (مثال: `192.168.10.50`).

### 2. أنظمة التشغيل المدعومة (Supported Operating Systems):
- **Linux:** Ubuntu Server 22.04 LTS / 24.04 LTS أو Debian 12 (معمارية x64 أو arm64). *(تم اختباره ميدانياً)*
- **Windows:** Windows Server 2019 / 2022، أو Windows 10/11 Pro/Enterprise (64-bit). *(ملاحظة: خطوات وتكوينات بيئة Windows موثقة معمارياً ولكن لم تخضع لاختبارات أجهزة فعلية من قِبل المطورين — يُرجى مراجعتها وتدقيقها من مهندس نظم Windows)*.

### 3. متطلبات البرمجيات (Node.js LTS Installer via USB):
- ملف تثبيت رسمي لـ Node.js LTS (إصدار مطابق للإصدار الرئيسي الذي بُنيت عليه الحزمة، مثل Node.js v22.x LTS).
- **لا يلزم تثبيت أي أدوات تجميع برمجية إطلاقاً (No C++ Compiler / Python / Visual Studio Build Tools required).** حيث تتضمن الحزمة ملفات الربط الثنائية المجمعة مسبقاً (Prebuilt native binaries) لمكتبة `better-sqlite3`.

---

## القسم ب: تجهيز وبناء الحزمة على جهاز متصل بالإنترنت

يتم تنفيذ هذه الخطوة على جهاز مهندس النظم المتصل بالإنترنت والذي يمتلك **نفس نظام التشغيل والمعمارية وإصدار Node الرئيسي** المستهدف لجهاز المكتب:

```bash
# 1. التحقق من تطابق البيئة والمعمارية
node -v
# مثال للخرج: v22.14.0
node -p "process.platform + ' ' + process.arch"
# مثال للخرج: linux x64 (أو win32 x64)

# 2. جلب الشفرة المصدرية وتثبيت الاعتماديات الصافية
git clone <repository_url> executive-office-portal
cd executive-office-portal
npm ci

# 3. تشغيل كافة الفحوصات الآلية واختبارات الجاهزية الشاملة
npm run check

# 4. بناء حزمة التثبيت دون اتصال
npm run package:offline
```

### 5. التحقق الرقمي من الحزمة قبل النقل:
```bash
node dist-server/verifyPackage.js release/executive-office-portal-1.0.0-linux-x64-node22.tar.gz
```
انسخ ملف الأرشيف وملف التجزئة `.sha256` ومثبت Node.js إلى وحدة تخزين USB آمنة.

---

## القسم ج: نقل الحزمة وتثبيتها على خادم المكتب المعزول

### 1. التحقق من البصمة الرقمية على جهاز المكتب:
**على نظام Linux:**
```bash
sha256sum -c executive-office-portal-1.0.0-linux-x64-node22.tar.gz.sha256
# النتيجة المتوقعة: executive-office-portal-1.0.0-linux-x64-node22.tar.gz: OK
```

**على نظام Windows (PowerShell):**
```powershell
Get-FileHash -Algorithm SHA256 .\executive-office-portal-1.0.0-win32-x64-node22.zip
# قارن البصمة المعروضة مع محتوى ملف .sha256
```

### 2. إنشاء حساب خدمة نظام مخصص غير متمتع بصلاحيات الجذر (Non-Admin Service Account):
**على Linux:**
```bash
sudo useradd -r -s /usr/sbin/nologin -d /opt/executive-portal portal_svc
```

**على Windows:**
أنشئ حساب مستخدم محلي مخصص باسم `svc_portal` بدون صلاحيات Administrators.

### 3. إنشاء مسارات التطبيق ومسارات البيانات المستقلة:
يجب إنشاء مجلدات البيانات والنسخ الاحتياطي **خارج** مجلد التطبيق البرمجي مع تقييد الصلاحيات تماماً (صلاحية 700 للمستخدم المالك فقط):

**على Linux:**
```bash
# دليل التطبيق
sudo mkdir -p /opt/executive-portal
sudo tar -xzf /media/usb/executive-office-portal-1.0.0-linux-x64-node22.tar.gz -C /opt/executive-portal
sudo chown -R portal_svc:portal_svc /opt/executive-portal

# دليل البيانات المنفصل خارج مجلد التطبيق
sudo mkdir -p /var/lib/executive_portal/data
sudo chown -R portal_svc:portal_svc /var/lib/executive_portal
sudo chmod 700 /var/lib/executive_portal /var/lib/executive_portal/data

# دليل النسخ الاحتياطي المنفصل
sudo mkdir -p /var/backups/executive_portal
sudo chown -R portal_svc:portal_svc /var/backups/executive_portal
sudo chmod 700 /var/backups/executive_portal
```

**على Windows (PowerShell كمسؤول):** *(لم يخضع لاختبارات أجهزة فعلية)*
```powershell
New-Item -ItemType Directory -Path "C:\ExecutivePortal"
Expand-Archive -Path "D:\executive-office-portal-1.0.0-win32-x64-node22.zip" -DestinationPath "C:\ExecutivePortal" -Force

New-Item -ItemType Directory -Path "D:\ExecutivePortalData\data"
New-Item -ItemType Directory -Path "D:\ExecutivePortalBackups"

# تعيين صلاحيات ACL حصرية لـ svc_portal و Administrators فقط
icacls "D:\ExecutivePortalData" /inheritance:r /grant:r "svc_portal:(OI)(CI)F" "Administrators:(OI)(CI)F"
icacls "D:\ExecutivePortalBackups" /inheritance:r /grant:r "svc_portal:(OI)(CI)F" "Administrators:(OI)(CI)F"
```

### 4. ضبط متغيرات البيئة والأمان في ملف محمي (`.env`):
يقوم خادم التطبيق (`dist-server/server.js`) تلقائياً بتحميل ملف `.env` من مجلد التشغيل الحالي عبر `dotenv`:

```bash
sudo cp /opt/executive-portal/.env.example /opt/executive-portal/.env
sudo chown portal_svc:portal_svc /opt/executive-portal/.env
sudo chmod 600 /opt/executive-portal/.env
```

#### جدول شرح متغيرات البيئة الأساسية:
| المتغير | القيمة الموصى بها | الشرح والتوجيه الأمني |
|---|---|---|
| `NODE_ENV` | `production` | يفرض تفعيل القيود الأمنية الصارمة وتعطيل أدوات التطوير وخرائط الكود. |
| `PORT` | `3000` | المنفذ الداخلي الذي يستمع عليه تطبيق Node.js (يرتبط فقط بـ `127.0.0.1`). |
| `DATA_DIR` | `/var/lib/executive_portal/data` | المسار الفعلي خارج مجلد التطبيق لقاعدة بيانات SQLite (`app.db`). |
| `BACKUP_DIR` | `/var/backups/executive_portal` | مسار حفظ ملفات النسخ الاحتياطي المشفرة دورياً. |
| `BACKUP_RETENTION` | `7` | عدد النسخ الاحتياطية المشفرة المحتفظ بها قبل التدوير. |
| `BACKUP_PASSPHRASE_FILE` | `/etc/executive_portal/backup.secret` | مسار ملف نصي محمي (0600) يحتوي على كلمة مرور النسخ الاحتياطي. |
| `COOKIE_SECURE` | `true` | إلزام إرسال كوكيز الجلسة عبر اتصالات HTTPS المشفرة فقط ومنع تسريبها عبر HTTP. |
| `TRUST_PROXY` | `true` | تمكين قراءة ترويسات البروكسي العكسي الموثوق (NGINX) مثل `X-Forwarded-For`. |
| `ALLOWED_ORIGINS` | `https://portal.local` | قائمة نطاقات الأصل المسموح بها لمنع هجمات CSRF و CORS غير المصرح بها. |
| `SESSION_IDLE_MINUTES` | `30` | مهلة انتهاء الجلسة عند عدم النشاط (30 دقيقة افتراضياً). |
| `SESSION_ABSOLUTE_HOURS`| `12` | أقصى مدة مسموحة للجلسة الواحدة بالساعات قبل إلزام تسجيل الدخول مجدداً. |

---

## القسم د: فحص محرك البيانات والإقلاع الأولي وتدوين بيانات الدخول

### 1. فحص توافق محرك البيانات الأصلي دون إنترنت:
```bash
cd /opt/executive-portal
node dist-server/verifyNative.js
```

### 2. تشغيل يدوي أولي لالتقاط بيانات الدخول الأولية لمرة واحدة:
```bash
cd /opt/executive-portal
node dist-server/server.js
```

### 3. الإجراء الأمني الميداني لتسليم الحسابات:
1. يقوم مسؤول تكنولوجيا المعلومات بنسخ كلمة المرور لكل مستخدم وتدوينها في بطاقة سرية توضع في **مظروف رسمي مختوم بالشمع أو لاصق أمني**.
2. يُسلم المظروف يداً بيد لكل صاحب حساب (السيد رئيس المجلس، السكرتير التنفيذي، مدير النظام).
3. **يفرض النظام تغيير كلمة المرور عند أول تسجيل دخول تلقائياً (`must_change_password = 1`).**
4. عند إعادة تشغيل الخادم لاحقاً، **لا تتم إعادة توليد كلمات المرور إطلاقاً**.
5. أوقف التشغيل اليدوي بالضغط على `Ctrl+C`.

---

## القسم هـ: تأمين الاتصال عبر بروتوكول HTTPS في الشبكة المحلية

> 🔒 **قاعدة حاسمة:** نظراً لأن متغير `COOKIE_SECURE=true` مفعل لحماية جلسات العمل ومكافحة التجسس على الشبكة، **فإن متصفحات الويب لن ترسل ملف تعريف الارتباط (Session Cookie) إطلاقاً عبر اتصالات HTTP غير المشفرة.** يلزم إنهاء تشفير TLS باستخدام شهادة معتمدة من هيئة التصديق الداخلي (Internal CA).

نموذج NGINX كبروكسي عكسي متوفر في القسم 5 من وثيقة `PRODUCTION_DEPLOYMENT.md`.

---

## القسم و: قواعد الشبكة والجدار الناري وسياسات الوصول

### 1. قيود الجدار الناري على الخادم (UFW على Linux):
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.10.0/24 to any port 443 proto tcp comment 'Executive Office HTTPS'
sudo ufw allow from 192.168.10.15 to any port 22 proto tcp comment 'IT Admin Management'
sudo ufw enable
```

---

## القسم ز: التشغيل المستمر كخدمة نظام مدارة

### 1. ملف خدمة systemd على Linux (`/etc/systemd/system/executive-portal.service`):
```ini
[Unit]
Description=Egypt Post Chairman Office Executive Portal Service
After=network.target

[Service]
Type=simple
User=portal_svc
Group=portal_svc
WorkingDirectory=/opt/executive-portal
EnvironmentFile=/opt/executive-portal/.env
ExecStart=/usr/bin/node /opt/executive-portal/dist-server/server.js

Restart=on-failure
RestartSec=5s

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
ReadWritePaths=/var/lib/executive_portal /var/backups/executive_portal

LimitNOFILE=65535
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

تفعيل وإدارة الخدمة:
```bash
sudo systemctl daemon-reload
sudo systemctl enable executive-portal.service
sudo systemctl start executive-portal.service
sudo systemctl status executive-portal.service
```

### 2. على نظام Windows (خدمة مدارة عبر NSSM): *(لم يخضع لاختبارات أجهزة فعلية)*
```powershell
nssm.exe install ExecutivePortalService "C:\Program Files\nodejs\node.exe" "C:\ExecutivePortal\dist-server\server.js"
nssm.exe set ExecutivePortalService AppDirectory "C:\ExecutivePortal"
nssm.exe set ExecutivePortalService ObjectName ".\svc_portal" "AccountPassword123"
nssm.exe set ExecutivePortalService AppRestartDelay 5000
nssm.exe set ExecutivePortalService AppStdout "C:\ExecutivePortal\logs\service.log"
nssm.exe set ExecutivePortalService AppStderr "C:\ExecutivePortal\logs\error.log"
nssm.exe start ExecutivePortalService
```

---

## القسم ح: استراتيجية النسخ الاحتياطي المشفر والاسترجاع

### 1. النسخ الاحتياطي اليومي المجدول على Linux (Cron):
أنشئ ملف كلمة المرور المحمي:
```bash
sudo mkdir -p /etc/executive_portal
echo "<PASSPHRASE>" | sudo tee /etc/executive_portal/backup.secret > /dev/null
sudo chown portal_svc:portal_svc /etc/executive_portal/backup.secret
sudo chmod 0600 /etc/executive_portal/backup.secret
```

أنشئ سكريبت النسخ اليومي `/opt/executive-portal/run-daily-backup.sh`:
```bash
#!/bin/bash
set -euo pipefail

export DATA_DIR="/var/lib/executive_portal/data"
export BACKUP_DIR="/var/backups/executive_portal"
export BACKUP_PASSPHRASE_FILE="/etc/executive_portal/backup.secret"

cd /opt/executive-portal
/usr/bin/node dist-server/backup.js
```

اضبط الصلاحيات وجدولتها في `crontab` لمستخدم `portal_svc`:
```bash
sudo chmod 700 /opt/executive-portal/run-daily-backup.sh
# 30 23 * * * /opt/executive-portal/run-daily-backup.sh >> /var/log/portal_backup.log 2>&1
```

### 2. النسخ الاحتياطي اليومي المجدول على Windows (Task Scheduler): *(لم يخضع لاختبارات أجهزة فعلية)*
أنشئ ملف كلمة المرور المحمي:
```powershell
New-Item -ItemType Directory -Path "C:\ExecutivePortal\secrets" -Force
Set-Content -Path "C:\ExecutivePortal\secrets\backup.secret" -Value "<PASSPHRASE>"
icacls "C:\ExecutivePortal\secrets\backup.secret" /inheritance:r /grant:r "svc_portal:R" "Administrators:F"
```

جدولة المهمة اليومية عبر `schtasks`:
```powershell
schtasks /create /tn "ExecutivePortal_DailyBackup" `
  /tr "cmd.exe /c set BACKUP_PASSPHRASE_FILE=C:\ExecutivePortal\secrets\backup.secret && set DATA_DIR=D:\ExecutivePortalData\data && set BACKUP_DIR=D:\ExecutivePortalBackups && cd /d C:\ExecutivePortal && node dist-server\backup.js >> C:\ExecutivePortal\logs\backup.log 2>&1" `
  /sc daily /st 23:30 /ru "svc_portal" /rp "<ACCOUNT_PASSWORD>" /rl HIGHEST
```

### 3. مهمة اختبار الاسترجاع الشهري الدوري (Monthly Restore Drill):
**على Linux:**
```bash
cd /opt/executive-portal
BACKUP_PASSPHRASE_FILE="/etc/executive_portal/backup.secret" node dist-server/backup.js --restore-test /var/backups/executive_portal/backup-20261006120000.db.enc
```

**على Windows (Task Scheduler - Monthly Drill):** *(لم يخضع لاختبارات أجهزة فعلية)*
```powershell
schtasks /create /tn "ExecutivePortal_MonthlyRestoreTest" `
  /tr "cmd.exe /c set BACKUP_PASSPHRASE_FILE=C:\ExecutivePortal\secrets\backup.secret && cd /d C:\ExecutivePortal && node dist-server\backup.js --restore-test D:\ExecutivePortalBackups\latest.db.enc >> C:\ExecutivePortal\logs\restore_test.log 2>&1" `
  /sc monthly /d 1 /st 01:00 /ru "svc_portal" /rp "<ACCOUNT_PASSWORD>" /rl HIGHEST
```

### 4. خطوات الاسترجاع اليدوي الدقيق لقاعدة البيانات عند الطوارئ (Manual Disaster Recovery Procedure):
في حال حدوث تلف في الخادم أو الحاجة للرجوع إلى نسخة احتياطية سابقة، يتم تنفيذ الخطوات اليدوية التالية بالترتيب الدقيق:
1. **إيقاف الخدمة فوراً لمنع أي عمليات كتابة:**
   ```bash
   sudo systemctl stop executive-portal
   # على Windows: nssm stop ExecutivePortalService
   ```
2. **الاحتفاظ بالنسخة الحالية كإجراء أمان احترازي:**
   ```bash
   sudo cp /var/lib/executive_portal/data/app.db /var/lib/executive_portal/data/app.db.bak.$(date +%Y%m%d%H%M)
   ```
3. **فك التشفير والتحقق من سلامة النسخة الاحتياطية المستهدفة في بيئة معزولة:**
   ```bash
   cd /opt/executive-portal
   BACKUP_PASSPHRASE_FILE="/etc/executive_portal/backup.secret" node dist-server/backup.js --restore-test /var/backups/executive_portal/backup-YYYYMMDDHHMMSS.db.enc
   ```
4. **استبدال ملف قاعدة البيانات `app.db` بالملف المسترجع:**
   ```bash
   # فك التشفير ووضع الملف مباشرة في مسار البيانات
   # (أو استخدام النسخة الناتجة بعد التحقق)
   sudo cp /tmp/restored_app.db /var/lib/executive_portal/data/app.db
   ```
5. **حذف ملفات التسجيل المسبق القديمة (WAL/SHM) لمنع التعارض:**
   ```bash
   sudo rm -f /var/lib/executive_portal/data/app.db-wal /var/lib/executive_portal/data/app.db-shm
   ```
6. **ضبط الصلاحيات الصارمة (0600) لحساب الخدمة:**
   ```bash
   sudo chown portal_svc:portal_svc /var/lib/executive_portal/data/app.db
   sudo chmod 0600 /var/lib/executive_portal/data/app.db
   ```
7. **إعادة تشغيل الخدمة والتحقق الميداني:**
   ```bash
   sudo systemctl start executive-portal
   sudo systemctl status executive-portal
   ```

---

## القسم ط: قائمة الفحص والتحقق بعد التثبيت (Smoke Test Checklist)

| # | بند الفحص (Test Item) | الإجراء المتخذ | النتيجة المتوقعة |
|---|---|---|---|
| 1 | **فحص صحة الخادم** | `curl -k https://127.0.0.1/api/health` | يعود بـ HTTP 200 مع `{"status":"ok"}`. |
| 2 | **تسجيل دخول الحسابات** | تسجيل الدخول بكل دور (Chairman, Secretary, Admin) | نجاح تسجيل الدخول وظهور جلسة العمل المخصصة. |
| 3 | **إجبار تغيير كلمة المرور** | تسجيل الدخول بالحساب الأولي | ظهور نافذة إجبارية لتغيير كلمة المرور. |
| 4 | **إنشاء معاملة وقيد وارد** | إضافة قيد وارد بدون ملخص وبملخص | نجاح التسجيل وحفظ القيود في قاعدة SQLite. |
| 5 | **التحقق من النسخ الاحتياطي** | `node dist-server/backup.js` | إنشاء ملف `.db.enc` واجتياز الفحص التلقائي. |
| 6 | **اختبار الاسترجاع التجريبي** | `node dist-server/backup.js --restore-test <file>` | نجاح فك التشفير وفحص سلامة الجداول في دليل معزول. |

---

## القسم ي: إجراءات التحديث دون اتصال بالإنترنت (Offline Update & Rollback)

```bash
# 1. إيقاف الخدمة
sudo systemctl stop executive-portal

# 2. أخذ نسخة احتياطية فورية
sudo BACKUP_PASSPHRASE_FILE="/etc/executive_portal/backup.secret" node /opt/executive-portal/dist-server/backup.js

# 3. نقل المجلد الحالي للاحتياط
sudo mv /opt/executive-portal /opt/executive-portal.bak.$(date +%Y%m%d%H%M)

# 4. استخراج الحزمة الجديدة
sudo mkdir -p /opt/executive-portal
sudo tar -xzf /media/usb/executive-office-portal-1.1.0-linux-x64-node22.tar.gz -C /opt/executive-portal
sudo cp /opt/executive-portal.bak.*/.env /opt/executive-portal/.env
sudo chown -R portal_svc:portal_svc /opt/executive-portal

# 5. تشغيل الخدمة
sudo systemctl start executive-portal
sudo systemctl status executive-portal
```

---

## القسم ك: جدول استكشاف الأخطاء وحلولها المباشرة (Troubleshooting Table)

| العَرَض / المشكلة | السبب الجذري المحتمل | الحل العملي الفوري المعتمد |
|---|---|---|
| **`Port in use (EADDRINUSE: 3000)`** | وجود عملية سابقة تعمل على نفس المنفذ | أوقف العملية السابقة أو اضبط المنفذ عبر `PORT=3001` في ملف `.env`. |
| **`Cookie not kept / Logout on every click`** | الاتصال عبر HTTP مع تفعيل `COOKIE_SECURE=true` | يجب تصفح النظام عبر `https://` حصراً ليقبل المتصفح تخزين الكوكي الآمن. |
| **`Backup fails: Passphrase error`** | عدم توفير `BACKUP_PASSPHRASE` أو `BACKUP_PASSPHRASE_FILE` | وفر كلمة المرور عبر متغير البيئة أو في ملف 0600 محمي. |
| **`File permission error on backup.secret`** | أذونات الملف أوسع من 0600 | اضبط أذونات الملف: `chmod 0600 /etc/executive_portal/backup.secret`. |

---

## القسم ل: قائمة التحقق الإلزامية قبل الإطلاق الحي الفعلي ومصفوفة القرارات

### 1. قائمة التحقق الإلزامية قبل الإطلاق الحي (Before Go-Live Mandatory Checklist):
- [ ] **1. المراجعة الأمنية المستقلة (Independent Security Review):** إتمام اختبار الاختراق والتدقيق الأمني المستقل للنظام وخلوه من الثغرات.
- [ ] **2. الاعتماد الأمني والمؤسسي (IT & Security Sign-off):** الحصول على المصادقة الرسمية المكتوبة من قطاع تكنولوجيا وأمن المعلومات بالهيئة.
- [ ] **3. الاختبار الميداني على الأجهزة الحقيقية (Physical Hardware Test):** اختبار جميع خطوات التثبيت والتشغيل على الجهاز الفعلي المخصص (Linux / Windows Server).
- [ ] **4. تمرين استرجاع النسخة الاحتياطية (Backup Restore Drill):** تنفيذ تجربة استرجاع كاملة لمرة واحدة على الأقل والتأكد من سلامة سلسلة سجل التدقيق.
- [ ] **5. تسليم بيانات الدخول الأولية (Credentials Handover):** تسليم بيانات الدخول في مظاريف سرية مختومة وفرض تغيير كلمات المرور عند أول تسجيل دخول.
- [ ] **6. تثبيت شهادات HTTPS (TLS Certificate Installed):** تثبيت شهادة TLS المعتمدة على الخادم والبروكسي وعلى أجهزة المستخدمين المصرح لهم بالمكتب.

### 2. مصفوفة القرارات التشغيلية المعلقة:
- [ ] **1. الموقع المادي للخادم:** تأمين الخادم داخل خزانة مقفلة في مكتب الرئيس.
- [ ] **2. سياسة الوصول عن بعد:** قصر الوصول على شبكة المكتب الداخلية أو اعتماد VPN بروتوكولي مؤمن.
- [ ] **3. هيئة الشهادات الرقمية:** توفير شهادة TLS داخلية معتمدة على الخادم والبروكسي.
- [ ] **4. وسيط النسخ الاحتياطي الخارجي:** توفير قرص تخزين مشفر مستقل للنسخ اليومي.
- [ ] **5. المراجعة الأمنية المستقلة:** الترتيب لإجراء تقييم أمني واختبار اختراق مستقل.

---
**تاريخ التوثيق:** أكتوبر 2026 | **الإصدار:** 1.0.0 Production Release | **الجهة:** قطاع تكنولوجيا المعلومات — الهيئة القومية للبريد المصري

