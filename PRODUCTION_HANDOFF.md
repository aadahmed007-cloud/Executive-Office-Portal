# وثيقة التسليم والتشغيل والإنتاج (Production Handoff Document)
## منظومة «مساعد مكتب رئيس مجلس الإدارة» — الهيئة القومية للبريد المصري
**النسخة:** 1.0.0 (نواة سيادية مغلقة)  
**تاريخ الإعداد:** أكتوبر 2026  
**الجهة المطورة:** الفريق الاستشاري لتطوير نظم المكاتب الرئاسية  
**مستوى التصنيف الأمني:** سري داخلي (مخصص لمسؤولي النظم والبنية التحتية IT)

---

## 1. الملخص التنفيذي والهندسة المعمارية للنظام (Architecture Overview)

صُممت المنظومة لتعمل وفق أعلى معايير السيادة الرقمية والأمن المعلوماتي للمكاتب العليا في جمهورية مصر العربية:
- **صفر اعتمادات خارجية (Zero External Calls / No CDN):** النظام لا يستدعي أي حزم أو خطوط أو خوادم خارجية عبر الإنترنت.
- **طبقة وصول للبيانات مفصولة بالكامل (Repository Pattern):** تم بناء كافة وحدات الواجهة الأمامية بالاعتماد على واجهات برمجية صارمة (`Contracts`)، مما يتيح التبديل الفوري بين محرك التخزين المحلي في المتصفح (`SQLite WASM + IndexedDB`) وخادم خلفي حقيقي على الشبكة المغلقة (`REST API Backend`) دون الحاجة لتعديل سطر واحد في كود الواجهات.
- **دعم كامل للغة العربية (Arabic-First RTL):** تدويل شامل من خلال ملف مركزي (`ar.json`) مع دعم الأرقام المشرقية/الغربية والتقويم الميلادي والهجري بتوقيت القاهرة.

```
+-----------------------------------------------------------------------------------+
|                           طبقة واجهة المستخدم (UI Layer)                         |
|   - لوحة الرئيس الهادئة (Mobile/Tablet First)                                     |
|   - مركز السكرتارية التنفيذي الغني بالبيانات                                     |
|   - المفكرة والاجتماعات | الوارد والصادر | التكليفات | سجل الرقابة | الملخص الأسبوعي   |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        طبقة قواعد الأعمال والنطاق (Domain Rules)                  |
|   - محرك فحص التعارض الزمني والقاعات (conflictDetector)                           |
|   - محرك الترقيم السنوي للوارد والصادر والتكليفات (serialGenerator)                |
|   - محرك حساب فترات التأخير والتنبيهات (overdueLogic)                             |
|   - مصفوفة الصلاحيات وحجب المعاملات السرية (confidentiality)                      |
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
| الخيار الحالي (Standalone Mode) |       |  الخيار المستقبلي (LAN Server Mode)     |
| - محرك SQLite WASM المحلي       |       |  - خادم محلي Express.js / Fastify       |
| - تخزين مستمر في IndexedDB      |       |  - قاعدة بيانات PostgreSQL أو SQLite WAL|
| - يعمل داخل المتصفح 100%        |       |  - ربط شبكي مشفر mTLS داخل مبنى الهيئة   |
+─────────────────────────────────+       +─────────────────────────────────────────+
```

---

## 2. خطة الانتقال لخادم محلي (Backend Migration Plan)

للانتقال من التخزين المحلي في المتصفح إلى خادم محلي على الشبكة المغلقة لمكتب رئيس مجلس الإدارة (On-Premises / Air-gapped LAN):

### الخطوة 1: إنشاء مستودعات برمجية تتصل بـ API (`HttpRepository`)
يتم استبدال الفئات الحالية بإنشاء ملف `/src/data/http/httpRepositories.ts` يطبق نفس واجهات `src/data/contracts/index.ts`:

```typescript
// مثال: مستودع الاجتماعات المتصل بالخادم المحلي
import { IMeetingRepository } from '../contracts';
import { Meeting } from '../../domain/types';

export class HttpMeetingRepository implements IMeetingRepository {
  private baseUrl = '/api/v1/meetings';

  async getAll(filter?: { status?: string; matterId?: string; date?: string }): Promise<Meeting[]> {
    const params = new URLSearchParams(filter as any).toString();
    const res = await fetch(`${this.baseUrl}?${params}`, {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('lan_auth_token')}` }
    });
    return res.json();
  }

  async getById(id: string): Promise<Meeting | null> {
    const res = await fetch(`${this.baseUrl}/${id}`);
    if (res.status === 404) return null;
    return res.json();
  }

  async create(data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>): Promise<Meeting> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }
  // ... باقي الدوال تطبق بنفس النسق
}
```

### الخطوة 2: تبديل نقطة التصدير في الحاوية (`Dependency Injection`)
في ملف `src/data/sqlite/repositories.ts`، يكفي تغيير المصدر:
```typescript
// للتبديل للوضع الشبكي:
export const meetingRepo = new HttpMeetingRepository();
export const correspondenceRepo = new HttpCorrespondenceRepository();
export const directiveRepo = new HttpDirectiveRepository();
```

---

## 3. عقد وتوثيق واجهات برمجة التطبيقات (REST API Contract)

كافة مسارات الـ API تعمل بنسق JSON وبتوقيت القاهرة (`Africa/Cairo` / ISO 8601):

### 3.1. المصادقة والصلاحيات (Authentication & RBAC)
- `GET /api/v1/auth/me`
  - **الوصف:** استرجاع بيانات المستخدم النشط وتصريحه الأمني.
  - **الاستجابة:** `{ id, name, title, role, can_view_confidential, avatar }`
- `POST /api/v1/auth/switch-role`
  - **الطلب:** `{ role: "CHAIRMAN" | "SECRETARY" | "ADMIN", pinCode: "1234" }`
  - **الاستجابة:** `{ token: "jwt-token-string", user: { ... } }`

### 3.2. المفكرة والاجتماعات (Meetings API)
- `GET /api/v1/meetings`
  - **المعلمات (Query):** `status`, `matter_id`, `date`, `type`
  - **الاستجابة:** `Meeting[]`
- `POST /api/v1/meetings`
  - **الطلب:** `{ title, location, start_time, end_time, meeting_type, matter_id, confidentiality, notes }`
- `GET /api/v1/meetings/:id/agenda` & `POST /api/v1/meetings/:id/agenda`
- `GET /api/v1/meetings/:id/attendees` & `POST /api/v1/meetings/:id/attendees`
- `GET /api/v1/meetings/:id/minutes` & `POST /api/v1/meetings/:id/minutes`
- `POST /api/v1/meetings/:id/decisions` (تسجيل القرارات وتحويلها لتكليفات)

### 3.3. الوارد والصادر ومذكرات العرض (Correspondence & Briefings API)
- `GET /api/v1/correspondence`
  - **المعلمات:** `type: "incoming" | "outgoing"`, `status`, `priority`, `confidentiality`
- `POST /api/v1/correspondence` (تسجيل قيد وارد جديد وتوليد رقم `IN-2026-XXXX`)
- `GET /api/v1/correspondence/:id/briefing` & `POST /api/v1/correspondence/:id/briefing`
- `POST /api/v1/correspondence/:id/approve` (تسجيل تأشيرة رئيس مجلس الإدارة)
- `POST /api/v1/correspondence/:id/routing` (تسجيل إحالة للقطاع بمهلة زمنية)

### 3.4. التكليفات الرئاسية (Directives API)
- `GET /api/v1/directives`
- `POST /api/v1/directives` (إصدار تكليف جديد بكود `DIR-2026-XXXX`)
- `POST /api/v1/directives/:id/updates` (إضافة تقرير متابعة مرحلي وتحديث نسبة الإنجاز)
- `PUT /api/v1/directives/:id/close` (إغلاق واعتماد التكليف نهائياً)

### 3.5. سجل الرقابة والمراجعة (Audit Log API)
- `GET /api/v1/audit` (استرجاع سجل العمليات غير القابل للتعديل)
- `POST /api/v1/audit` (تسجيل قيد رقابي محمي)

---

## 4. دليل التثبيت والنشر على الشبكة المغلقة (LAN On-Premises Deployment)

### 4.1. متطلبات الخادم المحلي (Server Requirements):
- **نظام التشغيل:** Ubuntu Server 24.04 LTS أو RHEL 9 Enterprise.
- **المعالج:** 4 Cores فما فوق.
- **الذاكرة العشوائية:** 8 GB RAM.
- **التخزين:** 100 GB NVMe SSD (مع تفعيل RAID 1 للحماية من تلف الأقراص).
- **الشبكة:** بطاقة شبكة محلية مخصصة بدون بوابة إنترنت (Air-gapped Local Subnet: `10.120.4.0/24`).

### 4.2. خطوات تثبيت خادم التطبيق (Node.js + NGINX):

```bash
# 1. تثبيت بيئة التشغيل المحلية
sudo apt update && sudo apt install -y nginx nodejs npm

# 2. بناء ملفات الواجهة الإنتاجية
npm run build

# 3. نقل الملفات لمجلد الويب السيادي
sudo mkdir -p /var/www/chairmans-office
sudo cp -r dist/* /var/www/chairmans-office/

# 4. تهيئة خادم NGINX المحلي مع تفعيل شهادة SSL ذاتية التوقيع للشبكة المغلقة
sudo nano /etc/nginx/sites-available/chairmans-office
```

**ملف إعداد NGINX المقترح (`/etc/nginx/sites-available/chairmans-office`):**
```nginx
server {
    listen 443 ssl http2;
    server_name chairman.postal.local;

    ssl_certificate /etc/ssl/certs/postal_local.crt;
    ssl_certificate_key /etc/ssl/private/postal_local.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/chairmans-office;
    index index.html;

    # حماية الهيدرز الأمنية
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' blob: data:;";

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 5. خطة نقل البيانات والنسخ الاحتياطي والطوارئ (Backup & Disaster Recovery)

### 5.1. تصدير واستيراد قاعدة بيانات SQLite الحالية
- يمكن للمسؤول في أي وقت النقر على **«تصدير نسخة احتياطية من ملف قاعدة البيانات (.sqlite)»** من شاشة الإعدادات.
- لتحويل ملف `.sqlite` المصدّر إلى قاعدة بيانات PostgreSQL على الخادم:
```bash
# باستخدام أداة pgloader المحلية
pgloader chairmans_office_backup.sqlite postgresql://postal_admin:SecretPass@localhost:5432/chairmans_office_db
```

### 5.2. سكريبت النسخ الاحتياطي التلقائي المجدول (`cron job`):
يتم جدولة نسخ احتياطي محلي كل ساعة على الخادم:
```bash
# /etc/cron.hourly/backup_postal_db.sh
#!/bin/bash
BACKUP_DIR="/var/backups/chairmans_office"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p $BACKUP_DIR

# إنشاء نسخة مشفرة
sqlite3 /var/data/chairmans_office.db ".backup $BACKUP_DIR/db_$TIMESTAMP.sqlite"
gzip $BACKUP_DIR/db_$TIMESTAMP.sqlite

# الاحتفاظ بآخر 30 يوماً وحذف ما هو أقدم
find $BACKUP_DIR -type f -mtime +30 -delete
```

---

## 6. إرشادات الأمان والحماية الرئاسية (Security Hardening Guidelines)

1. **عزل الشبكة (Air-Gapping):** عدم ربط خادم مكتب رئيس مجلس الإدارة بأي خط إنترنت خارجي.
2. **التحكم بالوصول المبني على الدور (RBAC):** عزل صلاحية قراءة المعاملات المصنفة `سري` و `سري للغاية` وفق جدول الصلاحيات.
3. **قفل الجلسات غير النشطة:** تم ضبط مهلة إغلاق الشاشة تلقائياً على 15 دقيقة من عدم النشاط لحماية المكتب الرئاسي.
4. **سجل رقابة غير قابل للإلغاء:** سجل الـ `audit_log` مخصص لعمليات الإضافة فقط (`Append-Only`) ولا يحوي أي أمر حذف (`DELETE`).

---
**اعتماد وثيقة التسليم والجاهزية للإنتاج:**  
- **مسؤول النظم والشبكات:** م. إسلام فؤاد النجار  
- **سكرتير أول مكتب رئيس مجلس الإدارة:** الأستاذة / ميادة أحمد رضوان  
- **رئيس مجلس إدارة الهيئة القومية للبريد:** السيد الأستاذ / طارق محمود الشناوي
