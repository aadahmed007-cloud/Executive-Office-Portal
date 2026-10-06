# وثيقة التسليم الفني ومتطلبات النشر (Technical Handoff & Deployment Document)
## منظومة «مكتب مساعد رئيس مجلس الإدارة» — نموذج أولي استعراضي (Prototype)

- **الحالة الحالية:** Advanced Prototype / Pre-Production Alpha. Pending final security audit and load testing.
- **التاريخ:** أكتوبر 2026
- **المستهدف:** فريق هندسة النظم وتكنولوجيا المعلومات والفرق الأمنية المعنية بمراجعة التصميم

---

## 1. الملخص المعماري للنموذج الأولي (Architecture Overview)

صُمم النموذج الأولي الحالي للتحقق من متطلبات واجهة المستخدم ومسارات العمل الإدارية لمكتب رئيس مجلس الإدارة:
- **تشغيل محلي في المتصفح:** يعتمد النموذج على محرك `SQLite WASM` مع طبقة تخزين مستمرة في `IndexedDB`.
- **فصل طبقة البيانات (Repository Pattern):** كافة مكوّنات الواجهة ترتبط بعقود برمجية محددة (`src/data/contracts/index.ts`)، مما يسمح باستبدال المحرك المحلي بمستودعات تتصل بخادم حقيقي (`REST API Backend`) دون تغيير منطق الواجهات.
- **واجهة عربية كاملة (Arabic-First RTL):** تدويل مركزي عبر ملف الموارد (`ar.json`) مع دعم أرقام وتقويم متوافق مع بيئة العمل.

```
+-----------------------------------------------------------------------------------+
|                           طبقة واجهة المستخدم (UI Layer)                         |
|   - لوحة رئيس مجلس الإدارة (Desktop / Tablet / Mobile UI)                         |
|   - لوحة السكرتارية التنفيذية الغنية بالبيانات                                     |
|   - المفكرة والاجتماعات | الوارد والصادر | التكليفات | سجل الرقابة | الملخص الأسبوعي   |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        طبقة قواعد الأعمال والنطاق (Domain Rules)                  |
|   - محرك فحص التعارض الزمني لمواعيد الاجتماعات (conflictDetector)                 |
|   - محرك الترقيم السنوي للوارد والصادر والتكليفات (serialGenerator)                |
|   - محرك حساب فترات التأخير والتنبيهات (overdueLogic)                             |
|   - مصفوفة صلاحيات درجات السرية (confidentiality)                                 |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        طبقة المستودعات (Repository Contracts)                     |
|   IMeetingRepository | ICorrespondenceRepository | IDirectiveRepository | ...     |
+-----------------------------------------------------------------------------------+
                                         │
            ┌────────────────────────────┴────────────────────────────┐
            ▼                                                         ▼
+─────────────────────────────────+       +─────────────────────────────────────────+
| النموذج الحالي (Browser Only)   |       |  الهدف الإنتاجي (Server Backend)        |
| - محرك SQLite WASM بالمتصفح     |       |  - خادم واجهة برمجية API محمي          |
| - تخزين في IndexedDB محلياً     |       |  - قاعدة بيانات SQLite WAL على الخادم    |
| - حصر البيانات بجهاز واحد       |       |  - مصادقة عبر كوكيز HttpOnly مشفرة       |
+─────────────────────────────────+       +─────────────────────────────────────────+
```

---

## 2. القيود الجوهرية للنموذج الأولي للمتصفح (Known Limitations of the Browser Prototype)

يجب مراعاة هذه الحدود التقنية بصراحة ووضوح قبل أي استخدام ميداني:
1. **انعزال البيانات محلياً (Single-Device Storage):**
   - تعيش البيانات داخل `IndexedDB` الخاص بمتصفح المستخدم الحالي فقط.
   - لا توجد مزامنة تلقائية بين جهاز السكرتير وجهاز رئيس مجلس الإدارة في هذا النموذج الأولي. مشاركة البيانات تتطلب مستودعاً خادمياً مشتركاً.
2. **عدم إمكانية فرض حجب السرية قطعياً داخل العميل (Confidentiality is Not Enforceable Client-Side):**
   - قناع الحجب على مستوى الواجهة أو المستودع المحلي يمنع العرض العادي، لكن البيانات غير المحجوبة المخزنة بملف SQLite في ذاكرة المتصفح يمكن استخراجها عبر أدوات فحص المطورين (`Browser DevTools / Storage Inspection`).
   - الفرض القطعي للسرية يتطلب خادماً خلفياً (`Server-side API`) يرفض إرسال السجلات السرية في الاستجابة لمن لا يملك التصريح.
3. **محدودية حماية سجل الرقابة محلياً (Audit Immutability Limitations):**
   - إضافة محفزات منع الحذف (`DB Triggers`) وسلاسل الهاش (`Hash Chain`) تكشف وتمنع التلاعب العرضي فقط، ولكنها لا تمنع مستخدماً يملك السيطرة على المتصفح من تعديل الذاكرة المحلية.
   - عدم القابلية للتغيير قانونياً ورقابياً تتطلب خادماً خلفياً بمستخدم قاعدة بيانات ذي صلاحية `INSERT-only` مع ترحيل السجلات لحظياً إلى خادم مراجعة مستقل (`Offsite Log Shipping`).

---

## 3. خيارات وأنماط النشر المعمارية (Deployment Modes)

لحسم التعارض بين متطلبات الشبكة المعزولة واحتياج الوصول المتنقل، يتوفر خياران معتمدان للنشر الإنتاجي (Pending IT/Information Security Decision):

### الخيار الأول: شبكة محلية داخل المبنى فقط (Inside-Building LAN Only)
- **طبيعة النشر:** خادم محلي متصل بشبكة سلكية/لاسلكية معزولة تماماً وغير متصلة بالإنترنت داخل الجناح الرئاسي.
- **الأجهزة:** حواسب مكتبية وأجهزة لوحية متصلة بنقطة وصول لاسلكية داخلية مخصصة ومحمية عبر شبكة VLAN مفصولة (`<LAN_SUBNET>`).
- **المزايا:** عزل شبكي فيزيائي وتام ضد أي هجمات من خارج المبنى.

### الخيار الثاني: شبكة محلية مع نفق VPN معتمد (LAN + Organization-Approved VPN)
- **طبيعة النشر:** تشغيل الخادم على الشبكة المغلقة، مع إتاحة الوصول لجهاز رئيس مجلس الإدارة عند التنقل خارج المكتب عبر بوابة VPN رسمية معتمدة من إدارة أمن المعلومات بالمؤسسة مع شهادات مصادقة طرفية (`mTLS / Hardware Tokens`).
- **المزايا:** توفير المرونة لرئيس مجلس الإدارة مع الحفاظ على التشفير والانعزال المؤسسي.
- **ملاحظة:** يظل اختيار أحد هذين النمطين رهناً بقرار لجنة أمن المعلومات والسياسات المؤسسية.

---

## 4. خطة النشر وقاعدة البيانات في الإنتاج (Production Backend & Database Plan)

### 4.1. محرك البيانات المعتمد (SQLite in WAL Mode)
- نظراً لأن النظام يخدم مستخدمين رئيسيين (رئيس مجلس الإدارة والسكرتارية التنفيذية)، فإن الخيار الإنتاجي الأبسط والأكثر أماناً وموثوقية هو استخدام **محرك SQLite مع تفعيل نمط الكتابة المسبقة (WAL - Write-Ahead Logging)** على الخادم المحلي.
- يُدار النسخ الاحتياطي عبر أداة `Litestream` للنسخ المتزامن أو عبر الأمر الرسمي `.backup` المجدول في نظام التشغيل.
- يُقترح النظر في محركات أخرى (مثل PostgreSQL) كخيار مستقبلي اختياري فقط في حال توسع المنظومة لتشمل عدداً كبيراً من الإدارات والمستخدمين المتزامنين.

### 4.2. نموذج الاتصال عبر مغلف مركزي موحد (`apiFetch Wrapper`)
عند بناء المستودعات المتصلة بالخادم (`src/data/http/httpRepositories.ts`)، يجب الامتناع عن وضع هيدرز منفصلة في كل دالة، واستخدام مغلف موحد:

```typescript
// Shared centralized fetch wrapper
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${endpoint}`, {
    ...options,
    credentials: 'include', // HttpOnly Secure cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Centralized session expiry / unauthorized handling
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'حدث خطأ في معالجة الطلب');
  }

  return response.json();
}
```

### 4.3. معمارية التحكم في الوصول وسرية البيانات (Access Control: RBAC + ABAC)
تم في المرحلة (ج) الفصل المعماري التام بين الأدوار والتصاريح الأمنية:
1. **النموذج الهجين (Role-Based + Attribute-Based):**
   - الدور (`role`: `CHAIRMAN` أو `SECRETARY`) يحدد الوظائف التشغيلية المتاحة (مثل اعتماد المعاملات، إنشاء التكليفات، إدارة الأجندة).
   - سمة التصريح الأمني (`can_view_confidential`: boolean) تمثل خاصية ABAC مستقلة عن الدور؛ فلا يُفترض تلقائياً أن أي مستخدم بمجرد كونه رئيساً أو سكرتيراً يحق له فك حجب السجلات المصنفة (`confidential` أو `top_secret`) دون وجود هذا التصريح صراحة في ملفه الأمني.
2. **الفرض على مستوى حدود البيانات (Data-Access Layer Enforcement):**
   - تم تحديث عقود المستودعات (`contracts/index.ts`) ومحرك الاستعلامات (`repositories.ts`) لطلب كائن السياق الأمني `UserContext`.
   - الاستعلامات تستبعد آلياً السجلات السرية على مستوى استعلام SQL (`WHERE (confidentiality = 'normal' OR confidentiality IS NULL)`).
   - جلب السجلات الفردية بالمعرف (`getById`) يُرجع `null` / 403 لمن لا يملك التصريح.
   - الكيانات التابعة (المرفقات، المذكرات الإيضاحية، التأشيرات، خطط التوجيه، التحديثات) ترتبط بجواز اطلاع السجل الرئيسي، ولا تُسلَّم للمستخدم إلا إذا كان مصرحاً له بالسجل الأصل.
3. **طبقات الحماية الميدانية (Defense-in-Depth):**
   - حجب واجهة المستخدم (`maskConfidentialCorrespondence`, `maskConfidentialDirective`, إلخ) وشاشات الحجب التحذيرية (`Unauthorized Shields`) في النوافذ المنبثقة تعمل كطبقة حماية بصرية ثانوية لمنع التسريب بالنظر، وليست خط الدفاع الأول.
   - في الخادم الخلفي الإنتاجي، يُمنع إرسال أي بايت من السجلات السرية عبر الشبكة لأي عميل غير مصرح له.

### 4.4. معمارية سجل التدقيق ومنع التلاعب والنسخ الاحتياطي (Audit Tamper-Resistance & Backups)
تم في المرحلة (د) تعزيز الحماية التشفيرية لسجل الرقابة والنسخ الاحتياطي:
1. **سلسلة التشفير المتسلسلة (SHA-256 Hash Chaining):**
   - كل قيد رقابي جديد يُحسب له توقيع تشفيري `entry_hash` باستخدام خوارزمية SHA-256 يشمل: المعرف، التوقيت، المستخدم، الصفة، الإجراء، الكيان، القيمة السابقة، القيمة بعد التعديل، عنوان IP، مع ربطه بهاش القيد السابق `prev_hash`.
   - توفر المنظومة دالة فحص وتدقيق رياضي `verifyAuditLogIntegrity()` للتحقق الفوري من تسلسل كافة الحلقات وعدم انقطاعها أو تعديل أي قيد.
2. **محفزات المنع المباشر بقاعدة البيانات (SQLite Immutability Triggers):**
   - تم تفعيل محفزين (`trg_audit_log_prevent_update` و `trg_audit_log_prevent_delete`) يجهضان بقوة (`RAISE(ABORT)`) أي محاولة برمجية لتعديل أو حذف أي صف داخل جدول `audit_log`.
3. **حزم النسخ الاحتياطي الموثقة تشفيرياً (Backup Manifests with SHA-256 Checksums):**
   - تدعم المنظومة تصدير حزمة JSON موثقة ببصمة تشفيرية `checksum_sha256` يتم فحصها رياضياً قبل قبول أي استعادة للبيانات لضمان عدم تلف أو التلاعب بملف النسخة الاحتياطية.
4. **التوصية الإنتاجية لسجل الرقابة (Production Recommendation):**
   - على الخادم الإنتاجي، يُوصى بترحيل سجلات الرقابة لحظياً عبر شبكة معزولة إلى خادم تدقيق خارجي مستقل غير قابل للتعديل (`WORM - Write Once Read Many / Syslog`) مع منح مستخدم تطبيق الويب صلاحية `INSERT-only` على جدول الرقابة.

---

## 5. عقد واجهات برمجة التطبيقات المقترح (Proposed REST API Contract)

كافة المسارات تعتمد نسق JSON وتوقيت القاهرة المحلي:

### 5.1. المصادقة والجلسات (Authentication & Session)
- `POST /api/v1/auth/login`
  - **الطلب:** `{ username: string, password: string }`
  - **الاستجابة:** كوكيز جلسة آمنة `Set-Cookie: session_id=...; HttpOnly; Secure; SameSite=Strict` + بيانات المستخدم `{ id, name, title, role, can_view_confidential }`.
- `POST /api/v1/auth/logout`
  - **الوصف:** إبطال الجلسة ومسح الكوكيز.
- `GET /api/v1/auth/me`
  - **الوصف:** استرجاع هوية وصلاحيات المستخدم صاحب الجلسة الحالية.
- **ملاحظة أمنية حول الجلسات:** تُدار الجلسات عبر كوكيز مشفرة ومحمية (`HttpOnly; Secure; SameSite=Strict`) بدلاً من تخزين التوكن في `localStorage` أو `sessionStorage`. الدور (`role`) والتصريح الأمني يُحددان بناءً على سجل المستخدم بالخادم حصراً، ولا يُقبل أي دور مرسل من العميل.
- **المصادقة الثنائية (Recommended 2FA in Production):** يُوصى بشدة في بيئة الإنتاج بتفعيل المصادقة متعددة العوامل (مثل مفاتيح الأمان العتادية FIDO2 / YubiKey أو تطبيقات TOTP المؤسسية) لحساب رئيس مجلس الإدارة والسكرتارية التنفيذية قبل إنشاء الجلسة.

### 5.2. العمليات التشغيلية (Domain Endpoints)
- **الاجتماعات:** `GET/POST /api/v1/meetings`, `POST /api/v1/meetings/:id/decisions`
- **الوارد والصادر:** `GET/POST /api/v1/correspondence`, `POST /api/v1/correspondence/:id/approve`
- **التكليفات:** `GET/POST /api/v1/directives`, `POST /api/v1/directives/:id/updates`
- **سجل الرقابة:** `GET /api/v1/audit` (متاح للمصرح لهم، مع صلاحية `INSERT-only` لمستخدم خادم التطبيق).

---

## 6. نموذج إعداد خادم الويب المحلي (Sample NGINX Configuration)

```nginx
# Sample hardened NGINX configuration for LAN on-premises
server {
    listen 443 ssl http2;
    server_name <INTERNAL_HOSTNAME>;

    ssl_certificate /etc/ssl/certs/internal_office.crt;
    ssl_certificate_key /etc/ssl/private/internal_office.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/chairmans-office;
    index index.html;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;

    client_max_body_size 10M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy to local Node.js service
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 7. سكريبت وإجراءات النسخ الاحتياطي المشفر (Encrypted Backup Procedure)

```bash
#!/usr/bin/env bash
# /etc/cron.hourly/backup_chairmans_office.sh
set -euo pipefail

BACKUP_LOCAL_DIR="/var/backups/chairmans_office"
REMOTE_SHARE="/mnt/secure_backup_storage"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RECIPIENT_KEY_ID="office-backup-public-key"

mkdir -p "$BACKUP_LOCAL_DIR"

# 1. إنشاء نسخة متسقة عبر أمر SQLite الرسمي
sqlite3 /var/data/chairmans_office.db ".backup $BACKUP_LOCAL_DIR/db_$TIMESTAMP.sqlite"

# 2. تشفير النسخة باستخدام مفتاح عام غير قابل لفك التشفير على الخادم ذاته
gpg --batch --yes --encrypt --recipient "$RECIPIENT_KEY_ID" "$BACKUP_LOCAL_DIR/db_$TIMESTAMP.sqlite"
rm -f "$BACKUP_LOCAL_DIR/db_$TIMESTAMP.sqlite"

# 3. نقل النسخة المشفرة إلى جهاز / وسيط تخزين منفصل فيزيائياً
if [ -d "$REMOTE_SHARE" ]; then
    cp "$BACKUP_LOCAL_DIR/db_$TIMESTAMP.sqlite.gpg" "$REMOTE_SHARE/"
fi

# 4. تدوير النسخ المحلية وحذف ما تجاوز 30 يوماً
find "$BACKUP_LOCAL_DIR" -type f -name "*.gpg" -mtime +30 -delete
```

> **ملاحظة أمنية جوهرية:** تقنية الأقراص المزدوجة (RAID) تحمي من تلف القرص الصلب فقط، وليست بديلاً بأي حال عن النسخ الاحتياطي المشفر والمنقول خارجياً. ويجب جدولة تجربة استعادة واختبار دورية (`Monthly Restore Test`) شهرياً.

---

## 8. قرارات معلقة بانتظار اعتماد مسؤولي تكنولوجيا المعلومات وأمن المعلومات
- [ ] تحديد موقع الخادم الفيزيائي وخزانة الخوادم المؤمنة.
- [ ] اعتماد نمط النشر: شبكة LAN مغلقة داخل المبنى فقط أم مع بوابة VPN للمتنقلين.
- [ ] إصدار وتثبيت شهادات التشفير الرقمية الصادرة عن المرجع المعتمد للمؤسسة (Internal CA).
- [ ] تخصيص جهاز/وسيط النسخ الاحتياطي المنفصل ومفاتيح التشفير اللاتماثلية.
- [ ] مراجعة واعتماد سياسة دورة حياة الحسابات وكلمات المرور.
