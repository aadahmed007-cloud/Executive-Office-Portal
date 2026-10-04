import { sqliteEngine } from '../../data/database/sqliteEngine';
import { User, AuditLogEntry, Directive, RoleType, ActionType } from '../types';
import { computeAuditEntryHash, verifyAuditLogIntegrity } from './cryptoUtils';

export interface AuditContextInfo {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Secure Local Audit Logging Utility for closed on-premises / offline operations
 */
export class AuditLogger {
  private static defaultIp = '10.120.4.10 (المكتب الرئاسي)';

  /**
   * Core logging method with tamper-resistant cryptographic chaining
   */
  public static async log(
    user: Pick<User, 'id' | 'name' | 'role'>,
    actionType: ActionType,
    entityType: string,
    entityId: string,
    details: {
      beforeValue?: string | null;
      afterValue?: string | null;
      ipAddress?: string;
    }
  ): Promise<AuditLogEntry> {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = new Date().toISOString();
    const ip = details.ipAddress || (user.role === 'CHAIRMAN' ? '10.120.4.10 (المكتب الرئاسي)' : '10.120.4.22 (السكرتارية التنفيذية)');

    // Get previous entry hash from SQLite for cryptographic linkage
    const latestRows = sqliteEngine.query<{ entry_hash: string }>('SELECT entry_hash FROM audit_log ORDER BY timestamp DESC, id DESC LIMIT 1');
    const prevHash = latestRows[0]?.entry_hash || 'GENESIS-BLOCK-00000000000000000000000000000000';

    const entryHash = await computeAuditEntryHash({
      id,
      timestamp,
      user_id: user.id,
      user_role: user.role,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      before_value: details.beforeValue || null,
      after_value: details.afterValue || null,
      ip_address: ip,
      prev_hash: prevHash
    });

    const entry: AuditLogEntry = {
      id,
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      before_value: details.beforeValue || null,
      after_value: details.afterValue || null,
      timestamp,
      ip_address: ip,
      prev_hash: prevHash,
      entry_hash: entryHash
    };

    // Insert into SQLite
    sqliteEngine.run(
      `INSERT INTO audit_log (id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address, prev_hash, entry_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.user_id,
        entry.user_name,
        entry.user_role,
        entry.action_type,
        entry.entity_type,
        entry.entity_id,
        entry.before_value,
        entry.after_value,
        entry.timestamp,
        entry.ip_address,
        entry.prev_hash,
        entry.entry_hash
      ]
    );

    // Save to IndexedDB
    await sqliteEngine.saveImmediate();

    return entry;
  }

  // --- Specific Directive Audit Methods ---

  /**
   * Track Creation of a Presidential Directive
   */
  public static async logDirectiveCreation(
    user: Pick<User, 'id' | 'name' | 'role'>,
    directive: Directive,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'CREATE', 'DIRECTIVE', directive.id, {
      beforeValue: null,
      afterValue: `إصدار تكليف رئاسي جديد [${directive.code}]: "${directive.title}" — المكلف: ${directive.assigned_department} (${directive.assigned_person}) — الاستحقاق: ${directive.due_date}`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Updates or modifications to a Directive
   */
  public static async logDirectiveUpdate(
    user: Pick<User, 'id' | 'name' | 'role'>,
    directiveId: string,
    before: { status?: string; progress?: number; title?: string },
    after: { status?: string; progress?: number; title?: string; reason?: string },
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    const beforeSummary = `الحالة: ${before.status || '-'} | الإنجاز: ${before.progress ?? '-'}%`;
    const afterSummary = `الحالة: ${after.status || '-'} | الإنجاز: ${after.progress ?? '-'}% ${after.reason ? `(${after.reason})` : ''}`;

    return this.log(user, 'UPDATE', 'DIRECTIVE', directiveId, {
      beforeValue: beforeSummary,
      afterValue: afterSummary,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Progress Update Log on a Directive
   */
  public static async logDirectiveProgress(
    user: Pick<User, 'id' | 'name' | 'role'>,
    directive: Directive,
    newProgress: number,
    notes: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'UPDATE', 'DIRECTIVE', directive.id, {
      beforeValue: `نسبة الإنجاز السابقة: ${directive.progress_percent}%`,
      afterValue: `تسجيل تقرير متابعة دوري: ${newProgress}% — بيان الإنجاز: ${notes}`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Official Completion & Signoff Closure of a Directive
   */
  public static async logDirectiveClosure(
    user: Pick<User, 'id' | 'name' | 'role'>,
    directive: Directive,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'UPDATE', 'DIRECTIVE', directive.id, {
      beforeValue: `الحالة: ${directive.status} (${directive.progress_percent}%)`,
      afterValue: `إغلاق واعتماد استيفاء التكليف الرئاسي نهائياً [${directive.code}] بنسبة إنجاز 100%`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Soft Deletion of a Directive
   */
  public static async logDirectiveDeletion(
    user: Pick<User, 'id' | 'name' | 'role'>,
    directive: Directive,
    reason?: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'DELETE', 'DIRECTIVE', directive.id, {
      beforeValue: `التكليف [${directive.code}]: "${directive.title}" — المكلف: ${directive.assigned_department}`,
      afterValue: `حذف وأرشفة التكليف الرئاسي ${reason ? `(السبب: ${reason})` : ''}`,
      ipAddress: context?.ipAddress
    });
  }

  // --- Meetings & Decisions Audit Methods ---

  /**
   * Track Scheduling of a Meeting / Board Session
   */
  public static async logMeetingScheduled(
    user: Pick<User, 'id' | 'name' | 'role'>,
    meeting: { id: string; title: string; start_time: string; location: string; meeting_type: string },
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'CREATE', 'MEETING', meeting.id, {
      beforeValue: null,
      afterValue: `جدولة جلسة اجتماع: "${meeting.title}" — القاعة: ${meeting.location} — الموعد: ${meeting.start_time}`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Meeting Status Transitions
   */
  public static async logMeetingStatus(
    user: Pick<User, 'id' | 'name' | 'role'>,
    meetingId: string,
    meetingTitle: string,
    beforeStatus: string,
    afterStatus: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'UPDATE', 'MEETING', meetingId, {
      beforeValue: `الحالة السابقة: ${beforeStatus}`,
      afterValue: `تغيير حالة الاجتماع "${meetingTitle}" إلى: ${afterStatus}`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Minutes Drafting
   */
  public static async logMinutesDrafted(
    user: Pick<User, 'id' | 'name' | 'role'>,
    meetingId: string,
    meetingTitle: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'UPDATE', 'MEETING_MINUTES', meetingId, {
      beforeValue: 'مسودة قيد الإعداد',
      afterValue: `صياغة وحفظ مسودة محضر جلسة: "${meetingTitle}"`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Official Approval of Meeting Minutes
   */
  public static async logMinutesApproved(
    user: Pick<User, 'id' | 'name' | 'role'>,
    meetingId: string,
    meetingTitle: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'DECIDE', 'MEETING_MINUTES', meetingId, {
      beforeValue: 'مسودة محضر معروضة للاعتماد',
      afterValue: `اعتماد وتوقيع محضر اجتماع رسمي: "${meetingTitle}" بواسطة رئيس مجلس الإدارة`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Executive Board Decisions
   */
  public static async logDecisionRecorded(
    user: Pick<User, 'id' | 'name' | 'role'>,
    decision: { id: string; meeting_id: string; content: string; assigned_to_name: string },
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'DECIDE', 'MEETING_DECISION', decision.id, {
      beforeValue: null,
      afterValue: `إصدار وتوثيق قرار مجلس إدارة: "${decision.content}" — المكلف: ${decision.assigned_to_name}`,
      ipAddress: context?.ipAddress
    });
  }

  // --- Correspondence & Briefing Audit Methods ---

  /**
   * Track Registration of Incoming / Outgoing Correspondence
   */
  public static async logCorrespondenceRegistered(
    user: Pick<User, 'id' | 'name' | 'role'>,
    corr: { id: string; serial_number: string; type: string; source_or_dest_entity: string; subject: string },
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    const typeLabel = corr.type === 'incoming' ? 'وارد رسمي' : 'صادر رسمي';
    return this.log(user, 'CREATE', 'CORRESPONDENCE', corr.id, {
      beforeValue: null,
      afterValue: `تسجيل ${typeLabel} [${corr.serial_number}]: "${corr.subject}" — الجهة: ${corr.source_or_dest_entity}`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Briefing Note Saved or Presented
   */
  public static async logBriefingNoteSaved(
    user: Pick<User, 'id' | 'name' | 'role'>,
    corrId: string,
    serialNumber: string,
    isPresented: boolean,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'UPDATE', 'BRIEFING_NOTE', corrId, {
      beforeValue: isPresented ? 'مسودة قيد الإعداد' : null,
      afterValue: isPresented
        ? `تقديم مذكرة العرض الخاصة بالمعاملة [${serialNumber}] رسمياً لشاشة رئيس مجلس الإدارة`
        : `حفظ وتحديث مسودة مذكرة العرض الخاصة بالمعاملة [${serialNumber}]`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Presidential Approval / Endorsement on Correspondence
   */
  public static async logCorrespondenceApproved(
    user: Pick<User, 'id' | 'name' | 'role'>,
    corrId: string,
    serialNumber: string,
    decisionType: string,
    standardPhrase: string,
    customDirective?: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    const customPart = customDirective ? ` | التوجيه الخطي: "${customDirective}"` : '';
    return this.log(user, 'DECIDE', 'CORRESPONDENCE', corrId, {
      beforeValue: 'معروض على الرئيس',
      afterValue: `تثبيت تأشيرة رئيس مجلس الإدارة على [${serialNumber}]: (${standardPhrase})${customPart}`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Correspondence Routing to Departments
   */
  public static async logCorrespondenceRouted(
    user: Pick<User, 'id' | 'name' | 'role'>,
    corrId: string,
    serialNumber: string,
    toDept: string,
    actionRequired: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'ROUTING', 'CORRESPONDENCE', corrId, {
      beforeValue: null,
      afterValue: `إحالة المعاملة [${serialNumber}] إلى ${toDept} — الإجراء المطلوب: "${actionRequired}"`,
      ipAddress: context?.ipAddress
    });
  }

  // --- Strategic Matters & Contacts Audit Methods ---

  /**
   * Track Creation of Strategic Matters
   */
  public static async logMatterCreated(
    user: Pick<User, 'id' | 'name' | 'role'>,
    matter: { id: string; code: string; title: string; lead_entity: string },
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'CREATE', 'MATTER', matter.id, {
      beforeValue: null,
      afterValue: `فتح ملف موضوع استراتيجي [${matter.code}]: "${matter.title}" — الجهة القائدة: ${matter.lead_entity}`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Creation of VIP Contacts & Interactions
   */
  public static async logContactCreated(
    user: Pick<User, 'id' | 'name' | 'role'>,
    contact: { id: string; name: string; entity: string; position: string },
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'CREATE', 'CONTACT', contact.id, {
      beforeValue: null,
      afterValue: `تسجيل جهة اتصال رفيعة المستوى: ${contact.name} (${contact.position} - ${contact.entity})`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Logging of Official Interactions / Calls
   */
  public static async logInteractionRecorded(
    user: Pick<User, 'id' | 'name' | 'role'>,
    contactName: string,
    type: string,
    summary: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'CREATE', 'INTERACTION', `interact-${Date.now()}`, {
      beforeValue: null,
      afterValue: `توثيق تفاعل رسمي مع (${contactName}) — النوع: ${type} — الملخص: "${summary}"`,
      ipAddress: context?.ipAddress
    });
  }

  /**
   * Track Authentication and Session Events
   */
  public static async logAuthEvent(
    user: Pick<User, 'id' | 'name' | 'role'>,
    eventType: 'LOGIN' | 'LOGOUT' | 'LOCK' | 'UNLOCK' | 'ROLE_SWITCH',
    details: string,
    context?: AuditContextInfo
  ): Promise<AuditLogEntry> {
    return this.log(user, 'AUTH', 'SESSION', user.id, {
      beforeValue: null,
      afterValue: `[${eventType}] ${details}`,
      ipAddress: context?.ipAddress
    });
  }

  // --- Export utilities ---

  /**
   * Export all audit logs as a structured CSV string including cryptographic signatures
   */
  public static async exportToCsv(): Promise<string> {
    const rows = sqliteEngine.query<AuditLogEntry>('SELECT * FROM audit_log ORDER BY timestamp DESC');
    const header = [
      'المعرف',
      'رقم المستخدم',
      'اسم المستخدم',
      'الصفة',
      'نوع الإجراء',
      'نوع الكيان',
      'معرف الكيان',
      'القيمة السابقة',
      'القيمة بعد التعديل',
      'التوقيت',
      'عنوان IP',
      'هاش السجل السابق (prev_hash)',
      'توقيع SHA-256 (entry_hash)'
    ];
    
    const csvLines = [header.join(',')];

    for (const r of rows) {
      const line = [
        `"${r.id}"`,
        `"${r.user_id}"`,
        `"${r.user_name}"`,
        `"${r.user_role}"`,
        `"${r.action_type}"`,
        `"${r.entity_type}"`,
        `"${r.entity_id}"`,
        `"${(r.before_value || '').replace(/"/g, '""')}"`,
        `"${(r.after_value || '').replace(/"/g, '""')}"`,
        `"${r.timestamp}"`,
        `"${r.ip_address}"`,
        `"${r.prev_hash || ''}"`,
        `"${r.entry_hash || ''}"`
      ];
      csvLines.push(line.join(','));
    }

    return '\uFEFF' + csvLines.join('\n'); // Add BOM for Excel Arabic support
  }
}
