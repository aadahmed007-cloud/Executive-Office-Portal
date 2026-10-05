import { describe, it, expect, beforeAll } from 'vitest';
import { analyzeOverdue } from '../domain/rules/overdueLogic.js';
import { detectMeetingConflict } from '../domain/rules/conflictDetector.js';
import { generateSerialNumber, parseSerialNumber } from '../domain/rules/serialGenerator.js';
import { canAccessItem, maskConfidentialCorrespondence } from '../domain/rules/confidentiality.js';
import { verifyAuditLogIntegrity, computeAuditEntryHash, sha256Hex } from '../domain/security/cryptoUtils.js';
import { CommandService } from '../domain/services/commandService.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';
import { meetingRepo, correspondenceRepo, directiveRepo, matterRepo, auditRepo } from '../data/sqlite/repositories.js';
import { User, Correspondence, Meeting, AuditLogEntry } from '../domain/types/index.js';

describe('Domain Rules & Security Test Suites (Legacy converted to Expect)', () => {
  beforeAll(async () => {
    await sqliteEngine.init();
  });

  // --- Overdue Logic Suite ---
  describe('Overdue Directive Logic', () => {
    const simulatedNow = new Date('2026-10-02T12:00:00Z');

    it('calculates past due date as overdue', () => {
      const pastResult = analyzeOverdue('2026-09-28', 'in_progress', simulatedNow);
      expect(pastResult.isOverdue).toBe(true);
    });

    it('calculates soon due date as due_soon', () => {
      const soonResult = analyzeOverdue('2026-10-03', 'in_progress', simulatedNow);
      expect(soonResult.urgencyLevel).toBe('due_soon');
    });

    it('calculates future due date as normal', () => {
      const normalResult = analyzeOverdue('2026-10-20', 'in_progress', simulatedNow);
      expect(normalResult.urgencyLevel).toBe('normal');
    });

    it('completed items are never overdue', () => {
      const completedResult = analyzeOverdue('2026-09-01', 'completed', simulatedNow);
      expect(completedResult.isOverdue).toBe(false);
    });

    it('mutation check: deliberately fails if we expect completed past item to be overdue', () => {
      const completedResult = analyzeOverdue('2026-09-01', 'completed', simulatedNow);
      // To prove the assertion can fail, we show that expecting true will fail
      expect(() => {
        expect(completedResult.isOverdue).toBe(true);
      }).toThrow();
    });
  });

  // --- Calendar Conflict Suite ---
  describe('Calendar Conflict Detection', () => {
    const existingMeetings: Meeting[] = [
      {
        id: 'm1',
        title: 'جلسة مجلس الإدارة',
        location: 'قاعة مجلس الإدارة الكبرى',
        start_time: '2026-10-10T10:00:00',
        end_time: '2026-10-10T12:00:00',
        meeting_type: 'board',
        status: 'confirmed',
        confidentiality: 'normal',
        created_at: '2026-10-01',
        updated_at: '2026-10-01',
        created_by: 'Secretary'
      }
    ];

    it('detects overlap in same location', () => {
      const test = detectMeetingConflict(
        {
          location: 'قاعة مجلس الإدارة الكبرى',
          start_time: '2026-10-10T11:00:00',
          end_time: '2026-10-10T13:00:00'
        },
        existingMeetings
      );
      expect(test.hasConflict).toBe(true);
    });

    it('does not conflict when non-overlapping', () => {
      const test = detectMeetingConflict(
        {
          location: 'قاعة مجلس الإدارة الكبرى',
          start_time: '2026-10-10T13:00:00',
          end_time: '2026-10-10T14:00:00'
        },
        existingMeetings
      );
      expect(test.hasConflict).toBe(false);
    });

    it('mutation check: deliberately fails if we expect non-overlapping time to have conflict', () => {
      const test = detectMeetingConflict(
        {
          location: 'قاعة مجلس الإدارة الكبرى',
          start_time: '2026-10-10T13:00:00',
          end_time: '2026-10-10T14:00:00'
        },
        existingMeetings
      );
      expect(() => {
        expect(test.hasConflict).toBe(true);
      }).toThrow();
    });
  });

  // --- Serial Generator Suite ---
  describe('Serial Number Generation', () => {
    it('generates correct serial for incoming correspondence', () => {
      const serialIn = generateSerialNumber('IN', 0, 2026);
      expect(serialIn).toBe('IN-2026-0001');
    });

    it('increments sequence sequence correctly', () => {
      const serialInNext = generateSerialNumber('IN', 24, 2026);
      expect(serialInNext).toBe('IN-2026-0025');
    });

    it('parses valid serial numbers', () => {
      const parsed = parseSerialNumber('IN-2026-0015');
      expect(parsed?.prefix).toBe('IN');
      expect(parsed?.sequence).toBe(15);
    });

    it('mutation check: deliberately fails if we expect invalid year format to parse successfully', () => {
      expect(() => {
        const parsed = parseSerialNumber('IN-ABCD-0015');
        expect(parsed?.prefix).toBe('IN');
      }).toThrow();
    });
  });

  // --- Confidentiality & Access Control Suite ---
  describe('Access Control Rules', () => {
    const chairmanWithoutFlag: User = {
      id: 'test-chairman-noflag',
      username: 'chairman_restricted',
      name: 'رئيس مجلس الإدارة (بدون تصريح)',
      title: 'رئيس مجلس الإدارة',
      department_id: 'dept-exec',
      email: 'chairman_noflag@postal.local',
      role: 'CHAIRMAN',
      can_view_confidential: false,
      created_at: '2026-01-01'
    };

    const secretaryWithFlag: User = {
      id: 'test-sec-authorized',
      username: 'sec_authorized',
      name: 'سكرتير تنفيذي مصرح',
      title: 'سكرتير تنفيذي مصرح',
      department_id: 'dept-sec',
      email: 'sec_auth@postal.local',
      role: 'SECRETARY',
      can_view_confidential: true,
      created_at: '2026-01-01'
    };

    it('allows normal items for anyone', () => {
      expect(canAccessItem(chairmanWithoutFlag, 'normal')).toBe(true);
    });

    it('blocks confidential items for users without flag', () => {
      expect(canAccessItem(chairmanWithoutFlag, 'confidential')).toBe(false);
    });

    it('allows confidential items for users with flag', () => {
      expect(canAccessItem(secretaryWithFlag, 'confidential')).toBe(true);
    });

    it('masks confidential subject and summary correctly', () => {
      const sampleCorr: Correspondence = {
        id: 'c-test',
        serial_number: 'CORR-TEST-001',
        type: 'incoming',
        date: '2026-10-01',
        source_or_dest_entity: 'جهة عليا حساسة',
        subject: 'ملف استراتيجي سري للغاية',
        priority: 'top_urgent',
        confidentiality: 'top_secret',
        summary: 'معلومات حساسة جداً تتعلق بالأمن القومي البريدي',
        status: 'registered',
        created_by: 'Secretary',
        created_at: '2026-10-01',
        updated_at: '2026-10-01'
      };
      const masked = maskConfidentialCorrespondence(sampleCorr, chairmanWithoutFlag);
      expect(masked.subject).toContain('محجوبة');
      expect(masked.summary).not.toContain('حساسة جداً');
    });

    it('mutation check: deliberately fails if we expect uncleared user to read unmasked confidential subject', () => {
      const sampleCorr: Correspondence = {
        id: 'c-test',
        serial_number: 'CORR-TEST-001',
        type: 'incoming',
        date: '2026-10-01',
        source_or_dest_entity: 'جهة عليا حساسة',
        subject: 'ملف استراتيجي سري للغاية',
        priority: 'top_urgent',
        confidentiality: 'top_secret',
        summary: 'معلومات حساسة جداً تتعلق بالأمن القومي البريدي',
        status: 'registered',
        created_by: 'Secretary',
        created_at: '2026-10-01',
        updated_at: '2026-10-01'
      };
      expect(() => {
        const masked = maskConfidentialCorrespondence(sampleCorr, chairmanWithoutFlag);
        expect(masked.subject).toBe(sampleCorr.subject);
      }).toThrow();
    });
  });

  // --- Audit Integrity Chaining Suite ---
  describe('Audit Log Chaining & Tamper Resistance', () => {
    const entries: AuditLogEntry[] = [
      {
        id: 'test-audit-001',
        user_id: 'usr-secretary',
        user_name: 'السكرتير التنفيذي',
        user_role: 'SECRETARY',
        action_type: 'CREATE',
        entity_type: 'CORRESPONDENCE',
        entity_id: 'corr-001',
        before_value: null,
        after_value: 'تسجيل معاملة رسمية جديدة',
        timestamp: '2026-10-01T08:00:00Z',
        ip_address: '10.120.4.22',
        prev_hash: 'GENESIS-BLOCK-00000000000000000000000000000000'
      },
      {
        id: 'test-audit-002',
        user_id: 'usr-chairman',
        user_name: 'رئيس مجلس الإدارة',
        user_role: 'CHAIRMAN',
        action_type: 'DECIDE',
        entity_type: 'CORRESPONDENCE',
        entity_id: 'corr-001',
        before_value: 'الحالة: معروض',
        after_value: 'تأشيرة اعتماد: موافق مع سرعة التنفيذ',
        timestamp: '2026-10-01T09:00:00Z',
        ip_address: '10.120.4.10',
        prev_hash: ''
      }
    ];

    it('verifies a valid hash chain successfully', async () => {
      let prevHash = 'GENESIS-BLOCK-00000000000000000000000000000000';
      for (let i = 0; i < entries.length; i++) {
        entries[i].prev_hash = prevHash;
        entries[i].entry_hash = await computeAuditEntryHash(entries[i]);
        prevHash = entries[i].entry_hash!;
      }
      const result = await verifyAuditLogIntegrity(entries);
      expect(result.isValid).toBe(true);
    });

    it('detects tampered content', async () => {
      const tampered = JSON.parse(JSON.stringify(entries));
      tampered[1].after_value = 'تعديل مزور غير مصرح به';
      const result = await verifyAuditLogIntegrity(tampered);
      expect(result.isValid).toBe(false);
    });

    it('mutation check: deliberately fails if we expect tampered chain to verify successfully', async () => {
      const tampered = JSON.parse(JSON.stringify(entries));
      tampered[1].after_value = 'تعديل مزور غير مصرح به';
      await expect(async () => {
        const result = await verifyAuditLogIntegrity(tampered);
        expect(result.isValid).toBe(true);
      }).rejects.toThrow();
    });
  });

  // --- Command Service Suite ---
  describe('Command Service Mutators', () => {
    const guestUser: User = {
      id: 'guest',
      username: 'unauthenticated',
      name: 'مستخدم غير مسجل',
      title: 'غير مصرح',
      department_id: '',
      email: '',
      role: 'SECRETARY',
      can_view_confidential: false,
      created_at: ''
    };

    it('blocks unauthenticated guest user', async () => {
      await expect(CommandService.createCorrespondence({
        serial_number: 'CORR-GUEST-001',
        type: 'incoming',
        date: '2026-10-04',
        source_or_dest_entity: 'جهة مجهولة',
        subject: 'محاولة غير مصرح بها',
        priority: 'normal',
        confidentiality: 'normal',
        summary: 'محاولة اختراق أو استدعاء مباشر',
        status: 'registered',
        category: 'operations',
        tags: [],
        created_by: 'guest'
      }, guestUser)).rejects.toThrow();
    });

    it('mutation check: deliberately fails if we expect guest user to create correspondence successfully', async () => {
      await expect(async () => {
        const res = await CommandService.createCorrespondence({
          serial_number: 'CORR-GUEST-001',
          type: 'incoming',
          date: '2026-10-04',
          source_or_dest_entity: 'جهة مجهولة',
          subject: 'محاولة غير مصرح بها',
          priority: 'normal',
          confidentiality: 'normal',
          summary: 'محاولة اختراق',
          status: 'registered',
          category: 'operations',
          tags: [],
          created_by: 'guest'
        }, guestUser);
        expect(res).toBeDefined();
      }).rejects.toThrow();
    });
  });
});
