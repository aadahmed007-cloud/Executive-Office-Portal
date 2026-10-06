# دليل التثبيت والتشغيل الشامل دون اتصال بالإنترنت (Offline Air-Gapped Installation Guide)
## بوابة مكتب رئيس مجلس الإدارة — الهيئة القومية للبريد المصري
### وثيقة إجراءات التشغيل القياسية لمسؤولي تكنولوجيا المعلومات وأمن المعلومات (IT & Security Operations)

---

> ⚠️ **إخلاء مسؤولية أمني وتنبيه تنظيمي:**
> هذا النظام برمجية داخلية مخصصة للعمل ضمن شبكة محلية مغلقة (Air-Gapped LAN). **لم يخضع النظام بعد لمراجعة أمنية واختبار اختراق مستقل (Independent Security Review / Penetration Testing).** لا يجوز اعتباره معتمداً للإنتاج العام دون موافقة الإدارة العامة للأمن السيبراني وبطاقة اعتماد بيئة التشغيل.

---

## فهرس الأقسام (Table of Contents)
- [القسم أ: المتطلبات الفنية والمادية للأجهزة والشبكة (Hardware & System Requirements)](#القسم-أ-المتطلبات-الفنية-والمادية-للأجهزة-والشبكة)
- [القسم ب: تجهيز وبناء الحزمة على جهاز متصل بالإنترنت (Preparing the Package)](#القسم-ب-تجهيز-وبناء-الحزمة-على-جهاز-متصل-بالإنترنت)
- [القسم ج: نقل الحزمة وتثبيتها على خادم المكتب المعزول (Installation on Office Machine)](#القسم-ج-نقل-الحزمة-وتثبيتها-على-خادم-المكتب-المعزول)
- [القسم د: فحص محرك البيانات والإقلاع الأولي وتدوين بيانات الدخول (First Start & Credentials)](#القسم-د-فحص-محرك-البيانات-والإقلاع-الأولي-وتدوين-بيانات-الدخول)
- [القسم هـ: تأمين الاتصال عبر بروتوكول HTTPS في الشبكة المحلية (LAN HTTPS & TLS)](#القسم-هـ-تأمين-الاتصال-عبر-بروتوكول-https-في-الشبكة-المحلية)
- [القسم و: قواعد الشبكة والجدار الناري وسياسات الوصول (Network & Firewall Policies)](#القسم-و-قواعد-الشبكة-والجدار-الناري-وسياسات-الوصول)
- [القسم ز: التشغيل المستمر كخدمة نظام مدارة (Run as a Managed Service)](#القسم-ز-التشغيل-المستمر-كخدمة-نظام-مدارة)
- [القسم ح: استراتيجية النسخ الاحتياطي المشفر والاسترجاع (Backups & Disaster Recovery)](#القسم-ح-استراتيجية-النسخ-الاحتياطي-المشفر-والاسترجاع)
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
- **Linux:** Ubuntu Server 22.04 LTS / 24.04 LTS أو Debian 12 (معمارية x64 أو arm64).
- **Windows:** Windows Server 2019 / 2022، أو Windows 10/11 Pro/Enterprise (64-bit).

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

# 3. تشغيل كافة الفحوصات الآلية واختبارات السلامة
npm run check

# 4. بناء حزمة التثبيت دون اتصال
npm run package:offline
```

### مخرجات البناء المتوقعة:
```
======================================================================
📦 بدء بناء حزمة التثبيت دون اتصال (Offline Package Builder)
======================================================================
📌 اسم الحزمة المستهدفة: executive-office-portal-1.0.0-linux-x64-node22.tar.gz
📌 نظام التشغيل: linux | المعمارية: x64 | إصدار Node.js: v22.14.0
🔨 جاري تجميع الواجهة الأمامية وخادم الإنتاج (Building dist & dist-server)...
📂 جاري نسخ ملفات التطبيق المصرح بها إلى دليل التجهيز...
📥 جاري تثبيت حزم الإنتاج الصافية (npm ci --omit=dev --ignore-scripts)...
🔒 فحص خلو الحزمة من أي ملفات حساسة أو بيانات تشغيل...
📝 إنشاء سجل المطابقة والنزاهة الرقمية MANIFEST.json...
🗜️  جاري ضغط الحزمة إلى release/executive-office-portal-1.0.0-linux-x64-node22.tar.gz...
======================================================================
✅ تم إنشاء حزمة التثبيت دون اتصال بنجاح تام!
📦 المسار: release/executive-office-portal-1.0.0-linux-x64-node22.tar.gz (XX.XX MB)
🔑 البصمة الرقمية (SHA-256): <SHA256_HASH>
📄 ملف التحقق: release/executive-office-portal-1.0.0-linux-x64-node22.tar.gz.sha256
======================================================================
```

### 5. التحقق الرقمي من الحزمة قبل النقل:
```bash
npm run verify:package -- release/executive-office-portal-1.0.0-linux-x64-node22.tar.gz
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
sudo mkdir -p /var/lib/executive_portal/attachments
sudo chown -R portal_svc:portal_svc /var/lib/executive_portal
sudo chmod 700 /var/lib/executive_portal /var/lib/executive_portal/data /var/lib/executive_portal/attachments

# دليل النسخ الاحتياطي المنفصل
sudo mkdir -p /var/backups/executive_portal
sudo chown -R portal_svc:portal_svc /var/backups/executive_portal
sudo chmod 700 /var/backups/executive_portal
```

**على Windows (PowerShell كمسؤول):**
```powershell
New-Item -ItemType Directory -Path "C:\ExecutivePortal"
Expand-Archive -Path "D:\executive-office-portal-1.0.0-win32-x64-node22.zip" -DestinationPath "C:\ExecutivePortal" -Force

New-Item -ItemType Directory -Path "D:\ExecutivePortalData\data"
New-Item -ItemType Directory -Path "D:\ExecutivePortalData\attachments"
New-Item -ItemType Directory -Path "D:\ExecutivePortalBackups"

# تعيين صلاحيات ACL حصرية لـ svc_portal و Administrators فقط
icacls "D:\ExecutivePortalData" /inheritance:r /grant:r "svc_portal:(OI)(CI)F" "Administrators:(OI)(CI)F"
icacls "D:\ExecutivePortalBackups" /inheritance:r /grant:r "svc_portal:(OI)(CI)F" "Administrators:(OI)(CI)F"
```

### 4. ضبط متغيرات البيئة والأمان في ملف محمي (`.env`):
انسخ ملف `.env.example` إلى `/opt/executive-portal/.env` واضبط الصلاحيات `chmod 600`:

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
| `ATTACHMENTS_DIR` | `/var/lib/executive_portal/attachments` | مسار تخزين المرفقات المشفرة. |
| `BACKUP_DIR` | `/var/backups/executive_portal` | مسار حفظ ملفات النسخ الاحتياطي المشفرة دورياً. |
| `COOKIE_SECURE` | `true` | إلزام إرسال كوكيز الجلسة عبر اتصالات HTTPS المشفرة فقط ومنع تسريبها عبر HTTP. |
| `TRUST_PROXY` | `true` | تمكين قراءة ترويسات البروكسي العكسي الموثوق (NGINX) مثل `X-Forwarded-For`. |
| `ALLOWED_ORIGINS` | `https://portal.local` | قائمة نطاقات الأصل المسموح بها لمنع هجمات CSRF و CORS غير المصرح بها. |
| `SESSION_IDLE_MINUTES` | `15` | مهلة انتهاء الجلسة عند عدم النشاط (15 دقيقة افتراضياً). |
| `SESSION_ABSOLUTE_HOURS`| `8` | أقصى مدة مسموحة للجلسة الواحدة قبل إجبار المستخدم على تسجيل الدخول مجدداً. |
| `RESTORE_ENABLED` | `false` | **مغلق دائماً (`false`)** أثناء العمل العادي. لا يُفعل إلا مؤقتاً أثناء عمليات الاسترجاع الطارئة ثم يُعاد إغلاقه فوراً. |
| `SESSION_SECRET` | *(64-hex string)* | مفتاح تشفير توقيع جلسات المستخدمين (يتم توليده عشوائياً بمولد تشفيري). |
| `BACKUP_PASSPHRASE` | *(Passphrase)* | **لا يُحفظ في ملف عام.** يُمرر فقط لمهمة النسخ الاحتياطي المجدولة ويُحفظ في خزينة ورقية. |

---

## القسم د: فحص محرك البيانات والإقلاع الأولي وتدوين بيانات الدخول

### 1. فحص توافق محرك البيانات الأصلي دون إنترنت:
```bash
cd /opt/executive-portal
node dist-server/verifyNative.js
```
المخرجات المتوقعة:
```
======================================================================
✅ فحص توافق محرك SQLite الأصلي (Native SQLite Verification)
======================================================================
📌 إصدار Node.js الحالي:   v22.14.0
📌 نظام التشغيل (Platform): linux
📌 معمارية المعالج (Arch):  x64
📌 إصدار محرك SQLite:       3.47.2
✨ حالة محرك البيانات:      جاهز للعمل بكفاءة تامة بدون إنترنت أو أدوات تجميع (Compiler-Free)
======================================================================
```

### 2. تشغيل يدوي أولي لالتقاط بيانات الدخول الأولية لمرة واحدة:
```bash
node dist-server/server.js
```
المخرجات الحقيقية للإقلاع الأول:
```
======================================================
🔑 INITIAL SECURITY PROVISIONING: CREATING USERS
======================================================
👤 User: [chairman] (CHAIRMAN) -> Initial Password: [Generated-Secure-Pass]
👤 User: [office_director] (DIRECTOR) -> Initial Password: [Generated-Secure-Pass]
👤 User: [exec_secretary] (SECRETARY) -> Initial Password: [Generated-Secure-Pass]
👤 User: [advisor_legal] (ADVISOR) -> Initial Password: [Generated-Secure-Pass]
👤 User: [followup_lead] (FOLLOW_UP) -> Initial Password: [Generated-Secure-Pass]
👤 User: [sysadmin] (ADMIN) -> Initial Password: [Generated-Secure-Pass]
======================================================

======================================================================
🏛️  EGYPT NATIONAL POST - CHAIRMAN OFFICE EXECUTIVE PORTAL
💾 Mode: File-Backed Persistent Database
📁 Database Path: /var/lib/executive_portal/data/app.db
⚙️  Journal Mode: WAL | Foreign Keys: ENABLED (ON) | Schema Version: 1
📦 Database Size: 32.0 KB (32768 bytes)
🆕 Status: First Start (Clean initialization - Credentials generated)
🔑 Initial credentials printed above. Keep this console private.
======================================================================
```

### 3. الإجراء الأمني الميداني لتسليم الحسابات:
1. يقوم مسؤول تكنولوجيا المعلومات بنسخ كلمة المرور لكل مستخدم وتدوينها في بطاقة سرية توضع في **مظروف رسمي مختوم بالشمع أو لاصق أمني**.
2. يُسلم المظروف يداً بيد لكل صاحب حساب (السيد رئيس المجلس، مدير المكتب، السكرتير التنفيذي).
3. **يفرض النظام تغيير كلمة المرور عند أول تسجيل دخول تلقائياً (`must_change_password = 1`).**
4. عند إعادة تشغيل الخادم لاحقاً، **لا تتم إعادة توليد كلمات المرور إطلاقاً**، ويظهر في السجل: `🔄 Status: Server Restart (Loaded 6 existing users from storage)`.
5. أوقف التشغيل اليدوي بالضغط على `Ctrl+C`.

---

## القسم هـ: تأمين الاتصال عبر بروتوكول HTTPS في الشبكة المحلية

> 🔒 **قاعدة حاسمة:** نظراً لأن متغير `COOKIE_SECURE=true` مفعل لحماية جلسات العمل ومكافحة التجسس على الشبكة، **فإن متصفحات الويب لن ترسل ملف تعريف الارتباط (Session Cookie) إطلاقاً عبر اتصالات HTTP غير المشفرة.** يلزم إنهاء تشفير TLS باستخدام شهادة معتمدة من هيئة التصديق الداخلي (Internal CA).

### 1. نموذج إعداد NGINX كبروكسي عكسي (Reverse Proxy) على الخادم:
أنشئ ملف التكوين `/etc/nginx/sites-available/executive-portal`:

```nginx
# إعادة توجيه كافة طلبات HTTP إلى HTTPS المشفر
server {
    listen 80;
    server_name portal.local 192.168.10.50;
    return 301 https://$host$request_uri;
}

# خادم HTTPS الآمن
server {
    listen 443 ssl http2;
    server_name portal.local 192.168.10.50;

    # مسار شهادة TLS الداخلية ومفتاحها الخاص المحمي
    ssl_certificate /etc/ssl/certs/egyptpost-ca-portal.crt;
    ssl_certificate_key /etc/ssl/private/egyptpost-ca-portal.key;

    # بروتوكولات وخوارزميات التشفير القوية
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # ترويسات الأمان المؤسسية
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
```

تفعيل الإعداد واختباره:
```bash
sudo ln -s /etc/nginx/sites-available/executive-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## القسم و: قواعد الشبكة والجدار الناري وسياسات الوصول

### 1. قيود الجدار الناري على الخادم (UFW على Linux):
```bash
# ضبط السياسة الافتراضية لحظر كافة المنافذ الواردة
sudo ufw default deny incoming
sudo ufw default allow outgoing

# السماح بمنفذ HTTPS (443) من نطاق الشبكة الفرعية الخاصة بمكتب الرئيس فقط
sudo ufw allow from 192.168.10.0/24 to any port 443 proto tcp comment 'Executive Office HTTPS'

# السماح بإدارة SSH من جهاز مسؤول النظم فقط
sudo ufw allow from 192.168.10.15 to any port 22 proto tcp comment 'IT Admin Management'

# تفعيل الجدار الناري
sudo ufw enable
```

### 2. سياسة الاتصال عن بعد والـ VPN (Remote Access Policy):
- **الوضع الافتراضي (Inside-Building Only):** النظام معزول بالكامل ولا يمكن الوصول إليه إلا عبر الأجهزة السلكية أو شبكة Wi-Fi المخصصة والمشفرة لمكتب الرئيس.
- **وصول هاتف/جهاز السيد رئيس المجلس عبر VPN:** قرار يتطلب موافقة رسمية من رئيس قطاع الأمن السيبراني. عند الموافقة، يتم إعداد خادم VPN مشفر (مثل WireGuard / IPsec) مع مطابقة ثنائية (2FA/Certificate-based Auth) يربط الجهاز حصرياً بشبكة الخادم الداخلي دون المرور بالإنترنت العام.

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

# خيارات إعادة التشغيل التلقائي عند التعطل
Restart=on-failure
RestartSec=5s

# خيارات التصليد الأمني للنظام (Systemd Security Hardening)
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
ReadWritePaths=/var/lib/executive_portal /var/backups/executive_portal

# حدود الموارد
LimitNOFILE=65535

# سجلات الخدمة
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

تفعيل وإدارة الخدمة:
```bash
# إعادة تحميل إعدادات النظام وتفعيل الخدمة
sudo systemctl daemon-reload
sudo systemctl enable executive-portal.service
sudo systemctl start executive-portal.service

# فحص الحالة وعرض السجلات الحية
sudo systemctl status executive-portal.service
sudo journalctl -u executive-portal.service -f
```

### 2. على نظام Windows (خدمة مدارة عبر NSSM):
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

### 1. مهمة النسخ الاحتياطي اليومي المجدول:
أنشئ ملفاً تنفيذياً للنسخ اليومي محمي الصلاحيات `/opt/executive-portal/scripts/run-daily-backup.sh`:
```bash
#!/bin/bash
set -euo pipefail

# قراءة كلمة المرور من متغير بيئة آمن فقط أثناء التشغيل
export BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-MyStrongPassphraseOffline2026!}"
export DATA_DIR="/var/lib/executive_portal/data"
export BACKUP_DIR="/var/backups/executive_portal"

/usr/bin/node /opt/executive-portal/dist-server/server.js --backup-only || \
/usr/bin/node /opt/executive-portal/scripts/backup.js

# نسخ الأرشيف المشفر إلى وحدة التخزين الشبكية المنفصلة أو القرص الصلب الخارجي
# rsync -avz /var/backups/executive_portal/*.enc /mnt/secure_backup_nas/
```

ضبط الصلاحيات وجدولتها في `crontab` لمستخدم `portal_svc`:
```bash
sudo chmod 700 /opt/executive-portal/scripts/run-daily-backup.sh
# إضافة المهمة (يومياً في تمام الساعة 11:30 مساءً)
# 30 23 * * * /opt/executive-portal/scripts/run-daily-backup.sh >> /var/log/portal_backup.log 2>&1
```

### 2. اختبار الاسترجاع الشهري الدوري (Monthly Restore Drill):
```bash
cd /opt/executive-portal
BACKUP_PASSPHRASE="MyStrongPassphraseOffline2026!" node scripts/backup.js --restore-test /var/backups/executive_portal/backup-2026-10-06.db.enc
```
المخرجات المتوقعة:
```
======================================================================
🔍 بدء اختبار استرجاع النسخة الاحتياطية في بيئة تجريبية معزولة
======================================================================
✅ تم فك تشفير وفحص سلامة الحزمة التشفيرية بنجاح.
✅ تم فتح قاعدة البيانات المسترجعة والتحقق من سلامة الجداول (PRAGMA integrity_check: ok).
📊 إحصائيات السجلات المسترجعة:
   - المراسلات: 14 سجل
   - التكليفات: 8 سجلات
   - الاجتماعات: 5 سجلات
   - سجلات التدقيق: 120 حدث تدقيقي موثق
✨ نتيجة الفحص: النسخة الاحتياطية سليمة تماماً وقابلة للاسترجاع الفوري.
======================================================================
```

---

## القسم ط: قائمة الفحص والتحقق بعد التثبيت (Smoke Test Checklist)

يجب على مهندس النظم تنفيذ وتوثيق بنود الفحص التالية قبل تسليم النظام:

| # | بند الفحص (Test Item) | الإجراء المتخذ | النتيجة المتوقعة | الحالة |
|---|---|---|---|---|
| 1 | **فحص صحة الخادم** | `curl -k https://127.0.0.1/api/health` | يعود بـ HTTP 200 مع `{"status":"ok"}` وحالة قاعدة البيانات متصلة. | [ ] تم |
| 2 | **تسجيل دخول الحسابات** | تسجيل الدخول بكل دور (Chairman, Secretary, Director, Admin) | نجاح تسجيل الدخول وظهور جلسة العمل المخصصة لكل دور. | [ ] تم |
| 3 | **إجبار تغيير كلمة المرور** | تسجيل الدخول بالحساب الأولي | ظهور نافذة إجبارية لتغيير كلمة المرور ومنع التجاوز حتى التغيير. | [ ] تم |
| 4 | **إنشاء مراسلة بدون ملخص** | إضافة قيد وارد مع ترك حقل الملخص فارغاً | نجاح العملية بنجاح (HTTP 201) وتخزين الملخص كنص فارغ `""`. | [ ] تم |
| 5 | **إنشاء مراسلة بملخص كامل** | إضافة قيد وارد مع تعبئة كافة الحقول | نجاح التسجيل وظهور الرقم الإشاري والتسلسلي التلقائي. | [ ] تم |
| 6 | **دورة اعتماد رئيس المجلس** | تسجيل دخول رئيس المجلس واعتماد معاملة | تسجيل الاعتماد الرقمي في سجل المراسلة وحفظ بصمة التوقيع. | [ ] تم |
| 7 | **فحص سلسلة سجل التدقيق** | استدعاء تدقيق السلسلة من لوحة المسؤول | `isValid: true` ومطابقة تامة لبصمات SHA-256 المتسلسلة (Blockchain-like Chain). | [ ] تم |
| 8 | **أخذ نسخة احتياطية وفحصها** | تنفيذ سكريبت النسخ الاحتياطي | توليد ملف `.db.enc` ونجاح أمر التحقق التلقائي. | [ ] تم |
| 9 | **إعادة تشغيل الخدمة والتحقق** | `sudo systemctl restart executive-portal` | استمرار عمل الخادم دون توليد حسابات جديدة وثبات كافة البيانات السابقة. | [ ] تم |
| 10| **فحص ترويسات الأمان** | `curl -I -k https://127.0.0.1` | وجود `Strict-Transport-Security` و `X-Frame-Options: DENY` و `HttpOnly; Secure`. | [ ] تم |
| 11| **فحص خلو الطلبات الخارجية** | فتح أدوات المطور (F12) تبويب Network | عدم وجود أي طلبات خارجية أو اتصالات بالإنترنت (Zero External Requests). | [ ] تم |

---

## القسم ي: إجراءات التحديث دون اتصال بالإنترنت (Offline Update & Rollback)

### 1. خطوات ترقية النظام إلى إصدار جديد:
```bash
# 1. بناء حزمة الإصدار الجديد والتحقق منها على جهاز البناء ثم نقلها عبر USB
# 2. إيقاف الخدمة الحالية مؤقتاً
sudo systemctl stop executive-portal

# 3. أخذ نسخة احتياطية فورية لقاعدة البيانات الحالية
sudo BACKUP_PASSPHRASE="MyStrongPassphraseOffline2026!" node /opt/executive-portal/scripts/backup.js

# 4. نقل المجلد الحالي إلى مجلد احتياطي للتراجع السريع
sudo mv /opt/executive-portal /opt/executive-portal.bak.$(date +%Y%m%d%H%M)

# 5. استخراج الحزمة الجديدة في مسار التشغيل
sudo mkdir -p /opt/executive-portal
sudo tar -xzf /media/usb/executive-office-portal-1.1.0-linux-x64-node22.tar.gz -C /opt/executive-portal

# 6. نقل ملف الإعدادات المحمي .env
sudo cp /opt/executive-portal.bak.*/.env /opt/executive-portal/.env
sudo chown -R portal_svc:portal_svc /opt/executive-portal

# 7. تشغيل الخدمة (تقوم تلقائياً بتطبيق هجرات قاعدة البيانات schema migrations)
sudo systemctl start executive-portal
sudo systemctl status executive-portal
```

### 2. خطة التراجع السريع في حال حدوث خطأ (Rollback Procedure):
```bash
sudo systemctl stop executive-portal
sudo rm -rf /opt/executive-portal
sudo mv /opt/executive-portal.bak.<TIMESTAMP> /opt/executive-portal
sudo systemctl start executive-portal
```

---

## القسم ك: جدول استكشاف الأخطاء وحلولها المباشرة (Troubleshooting Table)

| العَرَض / المشكلة | السبب الجذري المحتمل | الحل العملي الفوري المعتمد |
|---|---|---|
| **`npm ci fails / node-gyp error`** | محاولة تثبيت الحزم بدون أمر `--ignore-scripts` أو غياب بيئة البناء | الحزمة مجهزة بحزم جاهزة، استخدم دائماً: `npm ci --omit=dev --ignore-scripts` وتأكد من وجود ملف `.npmrc`. |
| **`better-sqlite3 cannot load / bindings mismatch`** | عدم تطابق إصدار Node.js أو معمارية المعالج بين جهاز البناء وجهاز المكتب | تأكد من أمر `node -v` على كلا الجهازين أو أعد بناء الحزمة على نفس نظام ومعمارية خادم المكتب. |
| **`Port in use (EADDRINUSE: 3000)`** | وجود عملية خادم سابقة لم يتم إنهاؤها أو تعارض منافذ | أوقف العملية عبر `sudo fuser -k 3000/tcp` أو اضبط المتغير `PORT=3001` في ملف `.env`. |
| **`Cookie not kept / Logout on every click`** | الاتصال عبر HTTP العادي مع تفعيل `COOKIE_SECURE=true` | يجب تشغيل خادم NGINX وتصفح النظام عبر `https://` حصراً ليقبل المتصفح تخزين الكوكي الآمن. |
| **`Cannot log in / Account lockout`** | إدخال كلمة المرور بشكل خاطئ 5 مرات متتالية | انتظر انتهاء مدة الحظر المؤقت (15 دقيقة) أو قم بإلغاء القفل من حساب مسؤول النظام (Admin). |
| **`Backup fails: Passphrase error`** | عدم تمرير متغير `BACKUP_PASSPHRASE` أو استخدام عبارة غير مطابقة | تأكد من كتابة عبارة المرور بشكل صحيح والمطابقة لما تم حفظه في المظروف المغلق. |
| **`Disk full / Database locked`** | امتلاء مساحة القرص أو تعليق ملفات التسجيل WAL | تحقق من مساحة القرص `df -h`، وتأكد من صلاحيات المجلد `sudo chown -R portal_svc /var/lib/executive_portal`. |

---

## القسم ل: مصفوفة القرارات المعلقة لمسؤولي تكنولوجيا وأمن المعلومات

يجب على لجنة أمن وتكنولوجيا المعلومات البت في القرارات التالية وتوثيقها قبل إطلاق النظام الفعلي:

- [ ] **1. الموقع المادي للخادم (Physical Location & Physical Security):**
  تحديد موقع الخادم المكتبي داخل خزانة مقفلة بمفتاح تحت عهدة السكرتارية التنفيذية مع سجل وصول مادي (Physical Access Log).
- [ ] **2. سياسة الوصول عن بعد (VPN vs Air-Gapped LAN):**
  حسم قرار السماح باتصال رئيس المجلس عبر VPN خارجي أو قصر النظام تماماً على الشبكة السلكية المغلقة لمكتب الرئيس.
- [ ] **3. هيئة الشهادات الرقمية (Internal Certificate Authority):**
  إصدار شهادة TLS موقعة من الـ Root CA التابع للهيئة وتثبيت الشهادة الجذرية في متصفحات أجهزة مكتب الرئيس.
- [ ] **4. وسيط النسخ الاحتياطي الخارجي (Secondary Backup Storage Device):**
  توفير قرص تخزين مشفر خارجي أو وحدة NAS معزولة لحفظ النسخ الاحتياطية اليومية خارج جهاز الخادم.
- [ ] **5. دورة حياة الحسابات وكلمات المرور (Account Lifecycle & Offboarding):**
  اعتماد سياسة تدوير كلمات المرور وإلغاء صلاحيات الموظفين فور نقلهم أو تغيير وظائفهم.
- [ ] **6. الموافقة الرسمية على التشغيل بالبنية التحتية (Infrastructure Operation Approval):**
  استخراج خطاب تفويض تشغيل النظام على الشبكة الداخلية من رئيس قطاع تكنولوجيا المعلومات.
- [ ] **7. المراجعة الأمنية المستقلة (Independent Security Assessment):**
  الترتيب لإجراء تقييم أمني شامل واختبار اختراق مستقل قبل انتقال النظام إلى المرحلة التشغيلية النهائية.

---
**تاريخ التوثيق:** أكتوبر 2026 | **الإصدار:** 1.0.0 Production Release | **الجهة:** قطاع تكنولوجيا المعلومات — الهيئة القومية للبريد المصري
