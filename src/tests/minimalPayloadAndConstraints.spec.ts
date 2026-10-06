import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';
import { hashPasswordServer } from '../server/utils/crypto.js';

describe('Minimal Payload, Constraint Handling & Password Policy Verification', () => {
  let app: any;
  let chairmanCookie: string;
  let secretaryCookie: string;
  let testCorrId: string;
  let testMeetingId: string;
  let testDirectiveId: string;
  let testContactId: string;
  const commonPass = 'SuperSecurePass2026!#';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await sqliteEngine.init();
    app = createApp();

    const pass = hashPasswordServer(commonPass);
    const ts = Date.now();

    // 1. Create Chairman User
    const chairmanUsername = `chm_test_${ts}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-chm-${ts}`, chairmanUsername, 'السيد رئيس المجلس', 'رئيس مجلس الإدارة', 'dept-chm', `${chairmanUsername}@mail.test`, 'CHAIRMAN', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    // 2. Create Secretary User
    const secretaryUsername = `sec_test_${ts}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-sec-${ts}`, secretaryUsername, 'السكرتير التنفيذي', 'سكرتير', 'dept-sec', `${secretaryUsername}@mail.test`, 'SECRETARY', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    // Authenticate
    const resChm = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: chairmanUsername, password: commonPass });
    chairmanCookie = resChm.headers['set-cookie'];

    const resSec = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: secretaryUsername, password: commonPass });
    secretaryCookie = resSec.headers['set-cookie'];

    // Pre-create parent entities for sub-resource testing
    const now = new Date().toISOString();
    testCorrId = `corr-test-${ts}`;
    sqliteEngine.run(
      `INSERT INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, category, tags, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testCorrId, `SER-${ts}`, 'incoming', '2026-10-06', 'الجهة العامة', 'موضوع تجريبي', 'normal', 'normal', 'ملخص تجريبي', 'registered', 'operations', '[]', now, now, 'usr-sec']
    );

    testMeetingId = `mtg-test-${ts}`;
    sqliteEngine.run(
      `INSERT INTO meetings (id, title, location, start_time, end_time, meeting_type, status, confidentiality, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testMeetingId, 'اجتماع تجريبي', 'القاعة الرئيسية', '2026-10-06 10:00', '2026-10-06 11:00', 'internal', 'scheduled', 'normal', now, now, 'usr-chm']
    );

    testDirectiveId = `dir-test-${ts}`;
    sqliteEngine.run(
      `INSERT INTO directives (id, code, title, instruction, assigned_department, assigned_person, source_type, priority, confidentiality, status, progress_percent, issued_at, due_date, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testDirectiveId, `DIR-${ts}`, 'تكليف تجريبي', 'تعليمات', 'dept-ops', 'المسؤول', 'manual', 'normal', 'normal', 'new', 0, now, '2026-10-20', 'usr-chm', now]
    );

    testContactId = `cnt-test-${ts}`;
    sqliteEngine.run(
      `INSERT INTO contacts (id, name, entity, position, phone, email, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [testContactId, 'جهة اتصال تجريبية', 'الهيئة العامة', 'مستشار', '0100000000', 'contact@mail.test', 'external', now]
    );
  });

  describe('1. Minimal Payload Tests Across All Create Endpoints (No HTTP 500)', () => {
    it('reads real PRAGMA table_info for tables with create endpoints', () => {
      const tables = ['correspondence', 'directives', 'meetings', 'matters', 'contacts', 'interactions', 'briefing_notes', 'correspondence_routing', 'attachments', 'directive_updates', 'meeting_minutes', 'decisions'];
      for (const t of tables) {
        const columns = sqliteEngine.query<{ name: string; notnull: number; dflt_value: any }>(`PRAGMA table_info(${t})`);
        expect(columns.length).toBeGreaterThan(0);
      }
    });

    it('POST /api/correspondence with minimal valid payload (required keys only: omitted summary) returns 201/200, never 500', async () => {
      const minimalPayload = {
        type: 'incoming',
        date: '2026-10-06',
        source_or_dest_entity: 'وزارة الاتصالات',
        subject: 'مخاطبة عاجلة بالحد الأدنى',
        priority: 'normal'
      };
      const res = await request(app)
        .post('/api/correspondence')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(minimalPayload);

      expect(res.status).toBe(201);
      expect(res.body.summary).toBe('');
    });

    it('POST /api/correspondence with nullable optional keys set to null returns 201/200, never 500', async () => {
      const payloadWithNulls = {
        type: 'outgoing',
        date: '2026-10-06',
        source_or_dest_entity: 'الجهاز المركزي',
        subject: 'مخاطبة مع حقول null',
        priority: 'urgent',
        summary: null,
        matter_id: null
      };
      const res = await request(app)
        .post('/api/correspondence')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(payloadWithNulls);

      expect(res.status).toBe(201);
      expect(res.body.summary).toBe('');
    });

    it('POST /api/directives with minimal valid payload (omitted assigned_person & due_date) returns 201/200', async () => {
      const minimalDirective = {
        title: 'تكليف رئاسي بالحد الأدنى',
        instruction: 'تنفيذ الأعمال الفنية',
        assigned_department: 'الإدارة الهندسية',
        source_type: 'presidential',
        priority: 'urgent'
      };
      const res = await request(app)
        .post('/api/directives')
        .set('Cookie', chairmanCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(minimalDirective);

      expect(res.status).toBe(201);
      expect(res.body.assigned_person).toBe('غير محدد');
    });

    it('POST /api/directives with optional nullable keys set to null returns 201/200', async () => {
      const directiveWithNulls = {
        title: 'تكليف رئاسي بحقول null',
        instruction: 'متابعة المشروعات',
        assigned_department: 'العمليات البريدية',
        source_type: 'manual',
        priority: 'normal',
        assigned_person: null,
        due_date: null,
        matter_id: null,
        source_id: null
      };
      const res = await request(app)
        .post('/api/directives')
        .set('Cookie', chairmanCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(directiveWithNulls);

      expect(res.status).toBe(201);
      expect(res.body.assigned_person).toBe('غير محدد');
    });

    it('POST /api/meetings with minimal valid payload returns 201/200', async () => {
      const minimalMeeting = {
        title: 'اجتماع تنسيقي مبسط',
        location: 'قاعة المؤتمرات',
        start_time: '2026-10-07 10:00',
        end_time: '2026-10-07 11:30',
        meeting_type: 'internal'
      };
      const res = await request(app)
        .post('/api/meetings')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(minimalMeeting);

      expect(res.status).toBe(201);
    });

    it('POST /api/meetings with optional nullable keys set to null returns 201/200', async () => {
      const meetingWithNulls = {
        title: 'اجتماع تنسيقي بحقول null',
        location: 'قاعة مجلس الإدارة',
        start_time: '2026-10-07 12:00',
        end_time: '2026-10-07 13:00',
        meeting_type: 'board',
        matter_id: null,
        notes: null
      };
      const res = await request(app)
        .post('/api/meetings')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(meetingWithNulls);

      expect(res.status).toBe(201);
    });

    it('POST /api/matters with minimal valid payload (omitted description) returns 201/200', async () => {
      const minimalMatter = {
        title: 'ملف استراتيجي بالحد الأدنى',
        lead_entity: 'قطاع التطوير المؤسسي'
      };
      const res = await request(app)
        .post('/api/matters')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(minimalMatter);

      expect(res.status).toBe(201);
      expect(res.body.description).toBe('');
    });

    it('POST /api/matters with description set to null returns 201/200', async () => {
      const matterWithNull = {
        title: 'ملف استراتيجي بحقل null',
        lead_entity: 'قطاع الشؤون البريدية',
        description: null
      };
      const res = await request(app)
        .post('/api/matters')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(matterWithNull);

      expect(res.status).toBe(201);
      expect(res.body.description).toBe('');
    });

    it('POST /api/contacts with minimal valid payload returns 201/200', async () => {
      const minimalContact = {
        name: 'م. أحمد كمال',
        entity: 'هيئة البريد',
        position: 'مدير تنفيذي',
        phone: '0122222222',
        email: 'ahmed.kamal@mail.test',
        category: 'government'
      };
      const res = await request(app)
        .post('/api/contacts')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(minimalContact);

      expect(res.status).toBe(201);
    });

    it('POST /api/contacts with notes set to null returns 201/200', async () => {
      const contactWithNull = {
        name: 'د. منى سليم',
        entity: 'وزارة المالية',
        position: 'مستشار',
        phone: '0133333333',
        email: 'mona.salim@mail.test',
        category: 'external',
        notes: null
      };
      const res = await request(app)
        .post('/api/contacts')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(contactWithNull);

      expect(res.status).toBe(201);
    });

    it('POST /api/contacts/:id/interactions with minimal valid payload returns 201/200', async () => {
      const res = await request(app)
        .post(`/api/contacts/${testContactId}/interactions`)
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          date: '2026-10-06',
          summary: 'مكالمة هاتفية تمهيدية'
        });

      expect(res.status).toBe(201);
    });

    it('POST /api/correspondence/:id/briefing with minimal valid payload returns 200', async () => {
      const res = await request(app)
        .post(`/api/correspondence/${testCorrId}/briefing`)
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          summary: 'موجز المذكرة'
        });

      expect(res.status).toBe(200);
    });

    it('POST /api/correspondence/:id/routings with minimal valid payload returns 201', async () => {
      const res = await request(app)
        .post(`/api/correspondence/${testCorrId}/routings`)
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          from_entity: 'مكتب الرئيس',
          action_required: 'للدراسة وإعداد التقرير'
        });

      expect(res.status).toBe(201);
    });

    it('POST /api/correspondence/:id/attachments with minimal valid payload returns 201', async () => {
      const res = await request(app)
        .post(`/api/correspondence/${testCorrId}/attachments`)
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          file_name: 'document.pdf'
        });

      expect(res.status).toBe(201);
    });

    it('POST /api/directives/:id/updates with minimal valid payload returns 201', async () => {
      const res = await request(app)
        .post(`/api/directives/${testDirectiveId}/updates`)
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          progress_percent: 25
        });

      expect(res.status).toBe(201);
    });

    it('POST /api/meetings/:id/minutes with minimal valid payload returns 200', async () => {
      const res = await request(app)
        .post(`/api/meetings/${testMeetingId}/minutes`)
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          meeting_id: testMeetingId
        });

      expect(res.status).toBe(200);
    });

    it('POST /api/meetings/:id/decisions with minimal valid payload returns 201', async () => {
      const res = await request(app)
        .post(`/api/meetings/${testMeetingId}/decisions`)
        .set('Cookie', chairmanCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          content: 'اعتماد الموازنة التشغيلية'
        });

      expect(res.status).toBe(201);
    });
  });

  describe('2. Error Mapping: SQLite Constraints Never Return HTTP 500', () => {
    it('NOT NULL violation maps to HTTP 400 with VALIDATION_ERROR and Arabic message', async () => {
      // Simulate raw constraint violation through an Express route or handler
      const err = new Error('NOT NULL constraint failed: correspondence.subject');
      (err as any).code = 'SQLITE_CONSTRAINT_NOTNULL';

      const mockReq: any = { method: 'POST', path: '/api/correspondence' };
      let capturedStatus = 0;
      let capturedBody: any = null;
      const mockRes: any = {
        status: (s: number) => { capturedStatus = s; return mockRes; },
        json: (b: any) => { capturedBody = b; return mockRes; }
      };

      const { errorHandler } = await import('../server/middleware/error.middleware.js');
      errorHandler(err, mockReq, mockRes, () => {});

      expect(capturedStatus).toBe(400);
      expect(capturedBody.code).toBe('VALIDATION_ERROR');
      expect(capturedBody.error).toContain('التحقق من صحة البيانات');
      expect(capturedBody).not.toHaveProperty('code', 'SQLITE_CONSTRAINT_NOTNULL');
    });

    it('CHECK constraint violation maps to HTTP 400 with VALIDATION_ERROR and Arabic message', async () => {
      const err = new Error('CHECK constraint failed: directives');
      (err as any).code = 'SQLITE_CONSTRAINT_CHECK';

      const mockReq: any = { method: 'POST', path: '/api/directives' };
      let capturedStatus = 0;
      let capturedBody: any = null;
      const mockRes: any = {
        status: (s: number) => { capturedStatus = s; return mockRes; },
        json: (b: any) => { capturedBody = b; return mockRes; }
      };

      const { errorHandler } = await import('../server/middleware/error.middleware.js');
      errorHandler(err, mockReq, mockRes, () => {});

      expect(capturedStatus).toBe(400);
      expect(capturedBody.code).toBe('VALIDATION_ERROR');
      expect(capturedBody.error).toContain('التحقق من صحة البيانات');
    });

    it('UNIQUE constraint violation maps to HTTP 409 with CONFLICT and Arabic message', async () => {
      const err = new Error('UNIQUE constraint failed: users.username');
      (err as any).code = 'SQLITE_CONSTRAINT_UNIQUE';

      const mockReq: any = { method: 'POST', path: '/api/users' };
      let capturedStatus = 0;
      let capturedBody: any = null;
      const mockRes: any = {
        status: (s: number) => { capturedStatus = s; return mockRes; },
        json: (b: any) => { capturedBody = b; return mockRes; }
      };

      const { errorHandler } = await import('../server/middleware/error.middleware.js');
      errorHandler(err, mockReq, mockRes, () => {});

      expect(capturedStatus).toBe(409);
      expect(capturedBody.code).toBe('CONFLICT');
      expect(capturedBody.error).toContain('تعارض في البيانات');
    });

    it('FOREIGN KEY constraint violation maps to HTTP 409 with CONFLICT and Arabic message', async () => {
      const err = new Error('FOREIGN KEY constraint failed');
      (err as any).code = 'SQLITE_CONSTRAINT_FOREIGNKEY';

      const mockReq: any = { method: 'POST', path: '/api/decisions' };
      let capturedStatus = 0;
      let capturedBody: any = null;
      const mockRes: any = {
        status: (s: number) => { capturedStatus = s; return mockRes; },
        json: (b: any) => { capturedBody = b; return mockRes; }
      };

      const { errorHandler } = await import('../server/middleware/error.middleware.js');
      errorHandler(err, mockReq, mockRes, () => {});

      expect(capturedStatus).toBe(409);
      expect(capturedBody.code).toBe('CONFLICT');
      expect(capturedBody.error).toContain('تعارض في العلاقات');
    });
  });

  describe('3. Password Policy: Specific Arabic Rejection Reasons', () => {
    it('rejects password when too short with explicit reason in Arabic', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          current_password: commonPass,
          new_password: 'short'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('قصيرة جداً');
    });

    it('rejects password when it contains the username with explicit reason in Arabic', async () => {
      // Find current secretary username
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      const username = meRes.body.user.username;
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          current_password: commonPass,
          new_password: `P@ss_${username}_2026!`
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('اسم المستخدم');
    });

    it('rejects password when it is a common weak password with explicit reason in Arabic', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          current_password: commonPass,
          new_password: 'password123456'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('شائعة وسهلة التخمين');
    });

    it('rejects password when identical to the current password with explicit reason in Arabic', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', secretaryCookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          current_password: commonPass,
          new_password: commonPass
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('مطابقة لكلمة المرور الحالية');
    });
  });
});
