import { sqliteEngine } from '../database/sqliteEngine.js';
import {
  IMeetingRepository,
  ICorrespondenceRepository,
  IDirectiveRepository,
  IMatterRepository,
  IContactRepository,
  INotificationRepository,
  IAuditRepository,
  IUserRepository,
  ISettingsRepository,
  UserContext,
  SecurityAuthorizationError,
  MeetingFilter,
  CorrespondenceFilter,
  DirectiveFilter,
  MatterFilter,
  AuditFilter
} from '../contracts/index.js';
import {
  Meeting,
  MeetingAttendee,
  AgendaItem,
  MeetingMinutes,
  Decision,
  Correspondence,
  BriefingNote,
  Approval,
  CorrespondenceRouting,
  Attachment,
  Directive,
  DirectiveUpdate,
  Matter,
  MatterLink,
  Contact,
  Interaction,
  Notification,
  AuditLogEntry,
  SystemSettings,
  User,
  RoleType
} from '../../domain/types/index.js';
import { generateSerialNumber } from '../../domain/rules/serialGenerator.js';
import { computeAuditEntryHash } from '../../domain/security/cryptoUtils.js';
import { can } from '../../server/security/permissions.js';

// --- Column Whitelists for SQL Injection Protection ---
const ALLOWED_MEETING_COLUMNS = new Set(['title', 'location', 'start_time', 'end_time', 'meeting_type', 'status', 'matter_id', 'confidentiality', 'notes', 'deleted_at', 'created_by']);
const ALLOWED_CORRESPONDENCE_COLUMNS = new Set(['serial_number', 'type', 'date', 'source_or_dest_entity', 'subject', 'priority', 'confidentiality', 'summary', 'status', 'matter_id', 'category', 'tags', 'deleted_at', 'created_by']);
const ALLOWED_DIRECTIVE_COLUMNS = new Set(['code', 'title', 'instruction', 'assigned_department', 'assigned_person', 'source_type', 'source_id', 'priority', 'confidentiality', 'status', 'progress_percent', 'issued_at', 'due_date', 'matter_id', 'deleted_at', 'created_by']);
const ALLOWED_MATTER_COLUMNS = new Set(['code', 'title', 'description', 'confidentiality', 'status', 'lead_entity', 'priority', 'deleted_at']);
const ALLOWED_CONTACT_COLUMNS = new Set(['name', 'entity', 'position', 'phone', 'email', 'category', 'notes', 'deleted_at']);

/**
 * Checks whether the caller is authorized to view confidential / top-secret records.
 */
function canAccessConfidential(ctx: UserContext): boolean {
  return Boolean(ctx && ctx.can_view_confidential);
}

function parseGetAllArgs<F>(arg1?: any, arg2?: any): { ctx: UserContext; filter?: F } {
  const defaultCtx: UserContext = { userId: 'system', role: 'ADMIN', can_view_confidential: true };
  if (!arg1 && !arg2) return { ctx: defaultCtx };
  const isCtx = (obj: any) => obj && (typeof obj.role === 'string' || typeof obj.userId === 'string');
  if (isCtx(arg1)) return { ctx: arg1, filter: arg2 };
  if (isCtx(arg2)) return { ctx: arg2, filter: arg1 };
  return { ctx: defaultCtx, filter: arg1 };
}

// --- Audit Repository ---
export class SqliteAuditRepository implements IAuditRepository {
  async getAll(filter: AuditFilter | undefined, ctx: UserContext): Promise<AuditLogEntry[]> {
    if (!can(ctx, 'read', 'audit')) {
      throw new SecurityAuthorizationError('غير مصرح لك بالاطلاع على سجلات الرقابة والتتبع (403 Forbidden)');
    }

    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];
    if (filter?.entityType) {
      sql += ' AND entity_type = ?';
      params.push(filter.entityType);
    }
    if (filter?.userId) {
      sql += ' AND user_id = ?';
      params.push(filter.userId);
    }
    sql += ' ORDER BY timestamp DESC';
    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    const rows = sqliteEngine.query<AuditLogEntry>(sql, params);

    // Redact confidential item descriptions if caller lacks clearance
    if (!canAccessConfidential(ctx)) {
      return rows.map((r) => {
        if (r.is_confidential === 1 || r.entity_type?.toLowerCase().includes('confidential')) {
          return {
            ...r,
            before_value: r.before_value ? '[بيانات سرية محجوبة]' : null,
            after_value: `[إجراء على عنصر سري رقم: ${r.entity_id}]`
          };
        }
        return r;
      });
    }

    return rows;
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>, ctx: UserContext): Promise<void> {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const latestRows = sqliteEngine.query<{ entry_hash: string }>('SELECT entry_hash FROM audit_log ORDER BY timestamp DESC, id DESC LIMIT 1');
    const prevHash = latestRows[0]?.entry_hash || 'GENESIS-BLOCK-00000000000000000000000000000000';
    const ip = entry.ip_address || '127.0.0.1';

    let safeBefore = entry.before_value;
    let safeAfter = entry.after_value;

    let confidentiality = 'confidential'; // fail-closed default

    if (entry.entity_type === 'CORRESPONDENCE') {
      const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [entry.entity_id]);
      if (rows.length > 0) {
        confidentiality = rows[0].confidentiality;
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        confidentiality = parsed.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'MEETING') {
      const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [entry.entity_id]);
      if (rows.length > 0) {
        confidentiality = rows[0].confidentiality;
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        confidentiality = parsed.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'DIRECTIVE') {
      const rows = sqliteEngine.query<any>('SELECT confidentiality FROM directives WHERE id = ?', [entry.entity_id]);
      if (rows.length > 0) {
        confidentiality = rows[0].confidentiality;
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        confidentiality = parsed.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'MATTER') {
      const rows = sqliteEngine.query<any>('SELECT confidentiality FROM matters WHERE id = ?', [entry.entity_id]);
      if (rows.length > 0) {
        confidentiality = rows[0].confidentiality;
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        confidentiality = parsed.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'BRIEFING_NOTE') {
      const bnRows = sqliteEngine.query<any>('SELECT correspondence_id FROM briefing_notes WHERE id = ?', [entry.entity_id]);
      if (bnRows.length > 0) {
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [bnRows[0].correspondence_id]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        const parentId = parsed.correspondence_id || parsed.id;
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [parentId]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'APPROVAL') {
      const appRows = sqliteEngine.query<any>('SELECT correspondence_id FROM approvals WHERE id = ?', [entry.entity_id]);
      if (appRows.length > 0) {
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [appRows[0].correspondence_id]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        const parentId = parsed.correspondence_id || parsed.id;
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [parentId]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'ATTACHMENT') {
      const attRows = sqliteEngine.query<any>('SELECT entity_id, entity_type FROM attachments WHERE id = ?', [entry.entity_id]);
      if (attRows.length > 0) {
        if (attRows[0].entity_type === 'correspondence') {
          const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [attRows[0].entity_id]);
          confidentiality = rows[0]?.confidentiality || 'confidential';
        } else if (attRows[0].entity_type === 'meeting') {
          const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [attRows[0].entity_id]);
          confidentiality = rows[0]?.confidentiality || 'confidential';
        }
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        if (parsed.entity_type === 'correspondence') {
          const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [parsed.entity_id]);
          confidentiality = rows[0]?.confidentiality || 'confidential';
        } else if (parsed.entity_type === 'meeting') {
          const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [parsed.entity_id]);
          confidentiality = rows[0]?.confidentiality || 'confidential';
        }
      }
    } else if (entry.entity_type === 'ROUTING') {
      const rtRows = sqliteEngine.query<any>('SELECT correspondence_id FROM correspondence_routing WHERE id = ?', [entry.entity_id]);
      if (rtRows.length > 0) {
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [rtRows[0].correspondence_id]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        const parentId = parsed.correspondence_id || parsed.id;
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM correspondence WHERE id = ?', [parentId]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'DECISION') {
      const decRows = sqliteEngine.query<any>('SELECT meeting_id FROM decisions WHERE id = ?', [entry.entity_id]);
      if (decRows.length > 0) {
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [decRows[0].meeting_id]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        const parentId = parsed.meeting_id || parsed.id;
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [parentId]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'AGENDA_ITEM') {
      const agRows = sqliteEngine.query<any>('SELECT meeting_id FROM agenda_items WHERE id = ?', [entry.entity_id]);
      if (agRows.length > 0) {
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [agRows[0].meeting_id]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        const parentId = parsed.meeting_id || parsed.id;
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [parentId]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'MEETING_MINUTES') {
      const mmRows = sqliteEngine.query<any>('SELECT meeting_id FROM meeting_minutes WHERE id = ?', [entry.entity_id]);
      if (mmRows.length > 0) {
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [mmRows[0].meeting_id]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        const parentId = parsed.meeting_id || parsed.id;
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [parentId]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      }
    } else if (entry.entity_type === 'MEETING_ATTENDEE') {
      const maRows = sqliteEngine.query<any>('SELECT meeting_id FROM meeting_attendees WHERE id = ?', [entry.entity_id]);
      if (maRows.length > 0) {
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [maRows[0].meeting_id]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      } else if (entry.after_value) {
        const parsed = JSON.parse(entry.after_value);
        const parentId = parsed.meeting_id || parsed.id;
        const rows = sqliteEngine.query<any>('SELECT confidentiality FROM meetings WHERE id = ?', [parentId]);
        confidentiality = rows[0]?.confidentiality || 'confidential';
      }
    } else if (['AUTH', 'SESSION', 'LOGIN_FAILURE', 'USER_PASSWORD', 'LOCK_SCREEN_UNLOCK', 'CONFIG', 'BACKUP'].includes(entry.entity_type)) {
      confidentiality = 'normal';
    } else {
      confidentiality = 'confidential'; // fail-closed default for unknown entity types
    }

    const isConfVal = confidentiality !== 'normal' ? 1 : 0;

    if (isConfVal === 1) {
      const whitelistConfidentialJson = (jsonStr: string | null | undefined): string | null => {
        if (!jsonStr) return null;
        try {
          const parsed = JSON.parse(jsonStr);
          if (typeof parsed !== 'object' || parsed === null) {
            return JSON.stringify({
              entity_type: entry.entity_type,
              entity_id: entry.entity_id,
              action: entry.action_type
            });
          }
          const whitelisted: any = {
            entity_type: entry.entity_type,
            entity_id: entry.entity_id,
            action: entry.action_type,
            details: '[محجوب للتصنيف السري]'
          };
          const allowedKeys = ['id', 'serial_number', 'serial', 'code', 'type', 'status', 'confidentiality'];
          for (const key of allowedKeys) {
            if (key in parsed) {
              whitelisted[key] = parsed[key];
            }
          }
          return JSON.stringify(whitelisted);
        } catch {
          return JSON.stringify({
            entity_type: entry.entity_type,
            entity_id: entry.entity_id,
            action: entry.action_type,
            details: '[محجوب للتصنيف السري]'
          });
        }
      };
      safeBefore = whitelistConfidentialJson(safeBefore);
      safeAfter = whitelistConfidentialJson(safeAfter);
    }

    const entryHash = await computeAuditEntryHash({
      id,
      timestamp,
      user_id: entry.user_id,
      user_role: entry.user_role,
      action_type: entry.action_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      before_value: safeBefore || null,
      after_value: safeAfter || null,
      ip_address: ip,
      prev_hash: prevHash
    });

    sqliteEngine.run(
      'INSERT INTO audit_log (id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address, prev_hash, entry_hash, is_confidential) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        entry.user_id,
        entry.user_name,
        entry.user_role,
        entry.action_type,
        entry.entity_type,
        entry.entity_id,
        safeBefore || null,
        safeAfter || null,
        timestamp,
        ip,
        prevHash,
        entryHash,
        isConfVal
      ]
    );
    await sqliteEngine.saveImmediate();
  }
}

// --- Meeting Repository ---
export class SqliteMeetingRepository implements IMeetingRepository {
  async getAll(filter: MeetingFilter | undefined, ctx: UserContext): Promise<Meeting[]> {
    if (!can(ctx, 'read', 'meetings')) {
      throw new SecurityAuthorizationError('غير مصرح لك بالاطلاع على قائمة الاجتماعات');
    }

    let sql = 'SELECT * FROM meetings WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.matterId) {
      sql += ' AND matter_id = ?';
      params.push(filter.matterId);
    }
    if (filter?.date) {
      sql += ' AND date(start_time) = date(?)';
      params.push(filter.date);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR location LIKE ? OR notes LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY start_time DESC';
    return sqliteEngine.query<Meeting>(sql, params);
  }

  async getById(id: string, ctx: UserContext): Promise<Meeting | null> {
    if (!can(ctx, 'read', 'meetings')) {
      throw new SecurityAuthorizationError('غير مصرح لك بالاطلاع على تفاصيل هذا الاجتماع');
    }

    const rows = sqliteEngine.query<Meeting>('SELECT * FROM meetings WHERE id = ? AND deleted_at IS NULL', [id]);
    const meeting = rows[0] || null;
    if (meeting && meeting.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      return null;
    }
    return meeting;
  }

  async create(data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Meeting> {
    if (!can(ctx, 'create', 'meetings')) {
      throw new SecurityAuthorizationError('غير مصرح لرتبتك الوظيفية بإنشاء أو جدولة اجتماعات رسمية');
    }
    if (data.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError('غير مصرح لك بإنشاء اجتماعات ذات تصنيف سري دون تصريح أمني');
    }

    const id = `mtg-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO meetings (id, title, location, start_time, end_time, meeting_type, status, matter_id, confidentiality, notes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.title,
        data.location,
        data.start_time,
        data.end_time,
        data.meeting_type,
        data.status || 'scheduled',
        data.matter_id || null,
        data.confidentiality || 'normal',
        data.notes || null,
        now,
        now,
        data.created_by
      ]
    );

    return (await this.getById(id, ctx))!;
  }

  async update(id: string, meeting: Partial<Meeting>, ctx: UserContext): Promise<Meeting> {
    if (!can(ctx, 'update', 'meetings')) {
      const keys = Object.keys(meeting);
      const isStatusOnly = keys.every(k => k === 'status' || k === 'updated_at');
      if (isStatusOnly && can(ctx, 'approve_minutes', 'meetings')) {
        // allow status update during minutes approval
      } else {
        throw new SecurityAuthorizationError('غير مصرح لرتبتك الوظيفية بتعديل بيانات الاجتماع');
      }
    }

    const existing = await this.getById(id, ctx);
    if (!existing) {
      throw new SecurityAuthorizationError('الاجتماع غير موجود أو محجوب للتصنيف السري');
    }

    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    for (const [key, value] of Object.entries(meeting)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && ALLOWED_MEETING_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`, params);
    return (await this.getById(id, ctx))!;
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    if (!can(ctx, 'archive', 'meetings')) {
      throw new SecurityAuthorizationError('الحذف النهائي مقصور ومحظور على كافة الرتب (Soft-delete only)');
    }
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE meetings SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getAttendees(meetingId: string, ctx: UserContext): Promise<MeetingAttendee[]> {
    const parent = await this.getById(meetingId, ctx);
    if (!parent) return [];
    return sqliteEngine.query<MeetingAttendee>('SELECT * FROM meeting_attendees WHERE meeting_id = ? ORDER BY name ASC', [meetingId]);
  }

  async setAttendees(meetingId: string, attendees: Omit<MeetingAttendee, 'id' | 'meeting_id'>[], ctx: UserContext): Promise<void> {
    if (!can(ctx, 'update', 'meetings')) {
      throw new SecurityAuthorizationError('غير مصرح بتعديل قائمة الحاضرين');
    }
    const parent = await this.getById(meetingId, ctx);
    if (!parent) throw new SecurityAuthorizationError('الاجتماع غير موجود أو سري');

    sqliteEngine.run('DELETE FROM meeting_attendees WHERE meeting_id = ?', [meetingId]);
    for (const a of attendees) {
      const id = `attd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqliteEngine.run(
        'INSERT INTO meeting_attendees (id, meeting_id, name, title, entity, is_required, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, meetingId, a.name, a.title, a.entity, (a as any).is_required ? 1 : 0, a.attendance_status || 'invited']
      );
    }
  }

  async getAgenda(meetingId: string, ctx: UserContext): Promise<AgendaItem[]> {
    const parent = await this.getById(meetingId, ctx);
    if (!parent) return [];
    return sqliteEngine.query<AgendaItem>('SELECT * FROM agenda_items WHERE meeting_id = ? ORDER BY order_index ASC', [meetingId]);
  }

  async setAgenda(meetingId: string, items: Omit<AgendaItem, 'id' | 'meeting_id'>[], ctx: UserContext): Promise<void> {
    if (!can(ctx, 'update', 'meetings')) {
      throw new SecurityAuthorizationError('غير مصرح بتعديل جدول الأعمال');
    }
    const parent = await this.getById(meetingId, ctx);
    if (!parent) throw new SecurityAuthorizationError('الاجتماع غير موجود أو سري');

    sqliteEngine.run('DELETE FROM agenda_items WHERE meeting_id = ?', [meetingId]);
    for (const item of items) {
      const id = `agenda-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqliteEngine.run(
        'INSERT INTO agenda_items (id, meeting_id, order_index, title, presenter_name, duration_minutes, is_confidential) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, meetingId, item.order_index, item.title, (item as any).presenter_name || item.presenter, item.duration_minutes, (item as any).is_confidential ? 1 : 0]
      );
    }
  }

  async getMinutes(meetingId: string, ctx: UserContext): Promise<MeetingMinutes | null> {
    const parent = await this.getById(meetingId, ctx);
    if (!parent) return null;
    const rows = sqliteEngine.query<MeetingMinutes>('SELECT * FROM meeting_minutes WHERE meeting_id = ?', [meetingId]);
    return rows[0] || null;
  }

  async saveMinutes(minutes: Omit<MeetingMinutes, 'id'>, ctx: UserContext): Promise<MeetingMinutes> {
    const parent = await this.getById(minutes.meeting_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('الاجتماع غير موجود أو سري');

    if (minutes.status === 'approved' && !can(ctx, 'approve_minutes', 'meetings')) {
      throw new SecurityAuthorizationError('اعتماد وإقرار المحضر النهائي مقصور حصرياً على السيد رئيس مجلس الإدارة');
    }
    if (minutes.status === 'draft' && !can(ctx, 'update_minutes', 'meetings')) {
      throw new SecurityAuthorizationError('غير مصرح لك بحفظ مسودة محضر الاجتماع');
    }

    const existing = await this.getMinutes(minutes.meeting_id, ctx);
    if (existing) {
      sqliteEngine.run(
        'UPDATE meeting_minutes SET draft_content = ?, approved_content = ?, status = ?, approved_by = ?, approved_at = ? WHERE meeting_id = ?',
        [minutes.draft_content ?? existing.draft_content ?? null, minutes.approved_content ?? existing.approved_content ?? null, minutes.status, minutes.approved_by || null, minutes.approved_at || null, minutes.meeting_id]
      );
      return (await this.getMinutes(minutes.meeting_id, ctx))!;
    } else {
      const id = `min-${Date.now()}`;
      sqliteEngine.run(
        'INSERT INTO meeting_minutes (id, meeting_id, draft_content, approved_content, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, minutes.meeting_id, minutes.draft_content || null, minutes.approved_content || null, minutes.status, minutes.approved_by || null, minutes.approved_at || null]
      );
      return (await this.getMinutes(minutes.meeting_id, ctx))!;
    }
  }

  async getDecisions(meetingId: string, ctx: UserContext): Promise<Decision[]> {
    const parent = await this.getById(meetingId, ctx);
    if (!parent) return [];
    return sqliteEngine.query<Decision>('SELECT * FROM decisions WHERE meeting_id = ? ORDER BY order_index ASC', [meetingId]);
  }

  async addDecision(decision: Omit<Decision, 'id'>, ctx: UserContext): Promise<Decision> {
    if (!can(ctx, 'decide', 'meetings')) {
      throw new SecurityAuthorizationError('إقرار قرارات الاجتماعات الرسمية مقصور حصرياً على السيد رئيس مجلس الإدارة (Chairman Only)');
    }
    const parent = await this.getById(decision.meeting_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('الاجتماع غير موجود أو سري');

    const id = `dec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      'INSERT INTO decisions (id, meeting_id, order_index, content, assigned_department_id, assigned_to_name, due_date, directive_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, decision.meeting_id, decision.order_index, decision.content, decision.assigned_department_id || null, decision.assigned_to_name, decision.due_date || new Date().toISOString().split('T')[0], decision.directive_id || null, decision.status || 'pending']
    );
    const rows = sqliteEngine.query<Decision>('SELECT * FROM decisions WHERE id = ?', [id]);
    return rows[0];
  }
}

function mapCorrespondenceRow(row: any): Correspondence {
  if (!row) return row;
  let parsedTags: string[] = [];
  if (Array.isArray(row.tags)) {
    parsedTags = row.tags;
  } else if (typeof row.tags === 'string') {
    try {
      parsedTags = JSON.parse(row.tags);
    } catch {
      parsedTags = [];
    }
  }
  return {
    ...row,
    tags: parsedTags,
    category: row.category || 'operations'
  };
}

// --- Correspondence Repository ---
export class SqliteCorrespondenceRepository implements ICorrespondenceRepository {
  async getAll(filter: CorrespondenceFilter | undefined, ctx: UserContext): Promise<Correspondence[]> {
    if (!can(ctx, 'read', 'correspondence')) {
      throw new SecurityAuthorizationError('غير مصرح لك بالاطلاع على المراسلات الرسمية');
    }

    let sql = 'SELECT * FROM correspondence WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }

    if (filter?.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.matterId) {
      sql += ' AND matter_id = ?';
      params.push(filter.matterId);
    }
    if (filter?.priority) {
      sql += ' AND priority = ?';
      params.push(filter.priority);
    }
    if (filter?.category && filter.category !== 'all') {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.tag && filter.tag !== 'all') {
      sql += ' AND tags LIKE ?';
      params.push(`%"${filter.tag}"%`);
    }
    if (filter?.search) {
      sql += ' AND (subject LIKE ? OR serial_number LIKE ? OR summary LIKE ? OR source_or_dest_entity LIKE ? OR tags LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = sqliteEngine.query<any>(sql, params);
    return rows.map(mapCorrespondenceRow);
  }

  async getById(id: string, ctx: UserContext): Promise<Correspondence | null> {
    if (!can(ctx, 'read', 'correspondence')) {
      throw new SecurityAuthorizationError('غير مصرح لك بالاطلاع على تفاصيل المكاتبة');
    }

    const rows = sqliteEngine.query<any>('SELECT * FROM correspondence WHERE id = ? AND deleted_at IS NULL', [id]);
    const corr = rows[0] ? mapCorrespondenceRow(rows[0]) : null;
    if (corr && corr.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      return null;
    }
    return corr;
  }

  async getBySerial(serial: string, ctx: UserContext): Promise<Correspondence | null> {
    if (!can(ctx, 'read', 'correspondence')) {
      throw new SecurityAuthorizationError('غير مصرح لك بالاطلاع على تفاصيل المكاتبة');
    }

    const rows = sqliteEngine.query<any>('SELECT * FROM correspondence WHERE serial_number = ? AND deleted_at IS NULL', [serial]);
    const corr = rows[0] ? mapCorrespondenceRow(rows[0]) : null;
    if (corr && corr.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      return null;
    }
    return corr;
  }

  async getNextSerial(type: 'incoming' | 'outgoing', year: number = new Date().getFullYear()): Promise<string> {
    const prefix = type === 'incoming' ? 'IN' : 'OUT';
    const rows = sqliteEngine.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM correspondence WHERE type = ? AND strftime('%Y', created_at) = ?",
      [type, String(year)]
    );
    const count = rows[0]?.count || 0;
    return generateSerialNumber(prefix, count, year);
  }

  async create(data: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Correspondence> {
    if (!can(ctx, 'create', 'correspondence')) {
      throw new SecurityAuthorizationError('غير مصرح لرتبتك الوظيفية بتسجيل مكاتبات جديدة في السجل الرسمي');
    }
    if (data.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError('غير مصرح لك بإنشاء مكاتبات سرية دون تصريح أمني (Confidential Clearance)');
    }

    const id = (data as any).id || `corr-${data.type === 'incoming' ? 'in' : 'out'}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, matter_id, category, tags, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.serial_number,
        data.type,
        data.date,
        data.source_or_dest_entity,
        data.subject,
        data.priority,
        data.confidentiality,
        data.summary,
        data.status,
        data.matter_id || null,
        data.category || 'operations',
        JSON.stringify(data.tags || []),
        now,
        now,
        data.created_by
      ]
    );

    return (await this.getById(id, ctx))!;
  }

  async update(id: string, item: Partial<Correspondence>, ctx: UserContext): Promise<Correspondence> {
    if (!can(ctx, 'update', 'correspondence')) {
      const keys = Object.keys(item);
      const isStatusOnly = keys.every(k => k === 'status' || k === 'updated_at');
      if (isStatusOnly && can(ctx, 'approve', 'correspondence')) {
        // allow status update during presidential approval
      } else {
        throw new SecurityAuthorizationError('غير مصرح لرتبتك الوظيفية بتعديل بيانات المكاتبة المسجلة');
      }
    }

    const existing = await this.getById(id, ctx);
    if (!existing) {
      throw new SecurityAuthorizationError('المعاملة المطلوبة غير موجودة أو محجوبة للتصنيف السري');
    }

    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    for (const [key, value] of Object.entries(item)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && ALLOWED_CORRESPONDENCE_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        if (key === 'tags' && Array.isArray(value)) {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE correspondence SET ${fields.join(', ')} WHERE id = ?`, params);
    return (await this.getById(id, ctx))!;
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    if (!can(ctx, 'archive', 'correspondence')) {
      throw new SecurityAuthorizationError('الحذف النهائي مقصور ومحظور على كافة الرتب (Soft-delete only)');
    }
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE correspondence SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getBriefingNote(correspondenceId: string, ctx: UserContext): Promise<BriefingNote | null> {
    const parent = await this.getById(correspondenceId, ctx);
    if (!parent) return null;
    const rows = sqliteEngine.query<BriefingNote>('SELECT * FROM briefing_notes WHERE correspondence_id = ?', [correspondenceId]);
    return rows[0] || null;
  }

  async saveBriefingNote(note: Omit<BriefingNote, 'id'>, ctx: UserContext): Promise<BriefingNote> {
    if (!can(ctx, 'comment', 'correspondence')) {
      throw new SecurityAuthorizationError('إعداد وحفظ مذكرات العرض مقصور على السكرتارية التنفيذية ورئيس مجلس الإدارة');
    }
    const parent = await this.getById(note.correspondence_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('المعاملة السرية غير متاحة دون تصريح أمني');

    const existing = await this.getBriefingNote(note.correspondence_id, ctx);
    if (existing) {
      sqliteEngine.run(
        'UPDATE briefing_notes SET background = ?, secretary_recommendation = ?, executive_opinion = ?, prepared_by_name = ?, prepared_at = ? WHERE correspondence_id = ?',
        [note.background, note.secretary_recommendation, note.executive_opinion, note.prepared_by_name, note.prepared_at, note.correspondence_id]
      );
    } else {
      const id = `brief-${Date.now()}`;
      sqliteEngine.run(
        'INSERT INTO briefing_notes (id, correspondence_id, background, secretary_recommendation, executive_opinion, prepared_by_name, prepared_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, note.correspondence_id, note.background, note.secretary_recommendation, note.executive_opinion, note.prepared_by_name, note.prepared_at]
      );
    }
    return (await this.getBriefingNote(note.correspondence_id, ctx))!;
  }

  async getApproval(correspondenceId: string, ctx: UserContext): Promise<Approval | null> {
    const parent = await this.getById(correspondenceId, ctx);
    if (!parent) return null;
    const rows = sqliteEngine.query<Approval>('SELECT * FROM approvals WHERE correspondence_id = ?', [correspondenceId]);
    return rows[0] || null;
  }

  async recordApproval(approval: Omit<Approval, 'id'>, ctx: UserContext): Promise<Approval> {
    if (!can(ctx, 'approve', 'correspondence')) {
      throw new SecurityAuthorizationError('تأشيرة الاعتماد الرئاسية مقصورة حصرياً على السيد رئيس مجلس الإدارة (Chairman Only)');
    }
    const parent = await this.getById(approval.correspondence_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('المعاملة غير موجودة أو محجوبة بالتصنيف السري');

    const id = `appr-${Date.now()}`;
    sqliteEngine.run(
      'INSERT INTO approvals (id, correspondence_id, decision_type, standard_phrase, custom_directive, decided_at, decided_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, approval.correspondence_id, approval.decision_type, approval.standard_phrase, approval.custom_directive || null, approval.decided_at, approval.decided_by_name]
    );
    return (await this.getApproval(approval.correspondence_id, ctx))!;
  }

  async getRoutings(correspondenceId: string, ctx: UserContext): Promise<CorrespondenceRouting[]> {
    const parent = await this.getById(correspondenceId, ctx);
    if (!parent) return [];
    return sqliteEngine.query<CorrespondenceRouting>('SELECT * FROM correspondence_routing WHERE correspondence_id = ? ORDER BY routed_at ASC', [correspondenceId]);
  }

  async addRouting(routing: Omit<CorrespondenceRouting, 'id'>, ctx: UserContext): Promise<CorrespondenceRouting> {
    if (!can(ctx, 'update', 'correspondence')) {
      throw new SecurityAuthorizationError('غير مصرح بتوجيه وإحالة المكاتبة');
    }
    const parent = await this.getById(routing.correspondence_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('المعاملة غير موجودة أو محجوبة للتصنيف السري');

    const id = `rout-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      'INSERT INTO correspondence_routing (id, correspondence_id, from_entity, to_department_id, to_department_name, action_required, deadline, status, routed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, routing.correspondence_id, routing.from_entity, routing.to_department_id, routing.to_department_name, routing.action_required, routing.deadline, routing.status, routing.routed_at]
    );
    const rows = sqliteEngine.query<CorrespondenceRouting>('SELECT * FROM correspondence_routing WHERE id = ?', [id]);
    return rows[0];
  }

  async getAttachments(correspondenceId: string, ctx: UserContext): Promise<Attachment[]> {
    const parent = await this.getById(correspondenceId, ctx);
    if (!parent) return [];

    let sql = "SELECT * FROM attachments WHERE entity_type = 'correspondence' AND entity_id = ?";
    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }
    return sqliteEngine.query<Attachment>(sql, [correspondenceId]);
  }

  async addAttachment(att: Omit<Attachment, 'id'>, ctx: UserContext): Promise<Attachment> {
    if (!can(ctx, 'update', 'correspondence')) {
      throw new SecurityAuthorizationError('غير مصرح بإضافة مرفقات إلى المكاتبة المسجلة');
    }
    const parent = await this.getById(att.entity_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('المعاملة غير موجودة أو سريّة');

    if (att.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError('غير مصرح لك بإضافة مرفقات سرية دون تصريح أمني');
    }

    const id = `att-${Date.now()}`;
    sqliteEngine.run(
      'INSERT INTO attachments (id, entity_type, entity_id, file_name, file_size_kb, mime_type, confidentiality, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, att.entity_type, att.entity_id, att.file_name, att.file_size_kb, att.mime_type, att.confidentiality, att.uploaded_at]
    );
    const rows = sqliteEngine.query<Attachment>('SELECT * FROM attachments WHERE id = ?', [id]);
    return rows[0];
  }
}

// --- Directives Repository ---
export class SqliteDirectiveRepository implements IDirectiveRepository {
  async getAll(filter: DirectiveFilter | undefined, ctx: UserContext): Promise<Directive[]> {
    if (!can(ctx, 'read', 'directives')) {
      throw new SecurityAuthorizationError('غير مصرح لك بالاطلاع على التكليفات الرئاسية');
    }

    let sql = 'SELECT * FROM directives WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.assignedDepartment) {
      sql += ' AND assigned_department = ?';
      params.push(filter.assignedDepartment);
    }
    if (filter?.matterId) {
      sql += ' AND matter_id = ?';
      params.push(filter.matterId);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR instruction LIKE ? OR code LIKE ? OR assigned_person LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY issued_at DESC';
    return sqliteEngine.query<Directive>(sql, params);
  }

  async getById(id: string, ctx: UserContext): Promise<Directive | null> {
    if (!can(ctx, 'read', 'directives')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على التكليف');
    }

    const rows = sqliteEngine.query<Directive>('SELECT * FROM directives WHERE id = ? AND deleted_at IS NULL', [id]);
    const dir = rows[0] || null;
    if (dir && dir.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      return null;
    }
    return dir;
  }

  async getNextCode(year: number = new Date().getFullYear()): Promise<string> {
    const rows = sqliteEngine.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM directives WHERE strftime('%Y', issued_at) = ?",
      [String(year)]
    );
    const count = rows[0]?.count || 0;
    return generateSerialNumber('DIR', count, year);
  }

  async create(data: Omit<Directive, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Directive> {
    if (!can(ctx, 'create', 'directives')) {
      throw new SecurityAuthorizationError('غير مصرح لرتبتك بإنشاء تكليفات جديدة');
    }
    if (data.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError('غير مصرح لك بإصدار تكليف سري دون تصريح أمني');
    }

    const id = `dir-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO directives (id, code, title, instruction, assigned_department, assigned_person, source_type, source_id, priority, confidentiality, status, progress_percent, issued_at, due_date, matter_id, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.code,
        data.title,
        data.instruction,
        data.assigned_department,
        data.assigned_person || null,
        data.source_type,
        data.source_id || null,
        data.priority,
        data.confidentiality,
        data.status || 'new',
        data.progress_percent || 0,
        data.issued_at,
        data.due_date,
        data.matter_id || null,
        data.created_by,
        now
      ]
    );

    return (await this.getById(id, ctx))!;
  }

  async update(id: string, directive: Partial<Directive>, ctx: UserContext): Promise<Directive> {
    if (!can(ctx, 'update', 'directives')) {
      throw new SecurityAuthorizationError('غير مصرح بتعديل بيانات التكليف');
    }

    const existing = await this.getById(id, ctx);
    if (!existing) {
      throw new SecurityAuthorizationError('التكليف غير موجود أو محجوب بالتصنيف السري');
    }

    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    for (const [key, value] of Object.entries(directive)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && ALLOWED_DIRECTIVE_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE directives SET ${fields.join(', ')} WHERE id = ?`, params);
    return (await this.getById(id, ctx))!;
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    if (!can(ctx, 'archive', 'directives')) {
      throw new SecurityAuthorizationError('الحذف النهائي مقصور ومحظور على كافة الرتب (Soft-delete only)');
    }
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE directives SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getUpdates(directiveId: string, ctx: UserContext): Promise<DirectiveUpdate[]> {
    const parent = await this.getById(directiveId, ctx);
    if (!parent) return [];
    return sqliteEngine.query<DirectiveUpdate>('SELECT * FROM directive_updates WHERE directive_id = ? ORDER BY created_at DESC', [directiveId]);
  }

  async addUpdate(update: Omit<DirectiveUpdate, 'id' | 'created_at'>, ctx: UserContext): Promise<DirectiveUpdate> {
    if (!can(ctx, 'update', 'directives')) {
      throw new SecurityAuthorizationError('غير مصرح بتسجيل تحديثات التنفيذ على التكليف');
    }
    const parent = await this.getById(update.directive_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('التكليف غير موجود أو سري');

    const id = `upd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO directive_updates (id, directive_id, update_text, progress_percent, updated_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, update.directive_id, (update as any).update_text || (update as any).content || '', update.progress_percent, (update as any).updated_by_name || update.updated_by || '', now]
    );

    // Update parent directive progress
    sqliteEngine.run('UPDATE directives SET progress_percent = ?, updated_at = ? WHERE id = ?', [update.progress_percent, now, update.directive_id]);

    const rows = sqliteEngine.query<DirectiveUpdate>('SELECT * FROM directive_updates WHERE id = ?', [id]);
    return rows[0];
  }
}

// --- Matter Repository ---
export class SqliteMatterRepository implements IMatterRepository {
  async getAll(filter: MatterFilter | undefined, ctx: UserContext): Promise<Matter[]> {
    if (!can(ctx, 'read', 'matters')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على الملفات الاستراتيجية والقضايا');
    }

    let sql = 'SELECT * FROM matters WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR description LIKE ? OR code LIKE ? OR lead_entity LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY updated_at DESC';
    return sqliteEngine.query<Matter>(sql, params);
  }

  async getById(id: string, ctx: UserContext): Promise<Matter | null> {
    if (!can(ctx, 'read', 'matters')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على الملف الاستراتيجي');
    }

    const rows = sqliteEngine.query<Matter>('SELECT * FROM matters WHERE id = ? AND deleted_at IS NULL', [id]);
    const matter = rows[0] || null;
    if (matter && matter.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      return null;
    }
    return matter;
  }

  async create(data: Omit<Matter, 'id' | 'created_at' | 'updated_at'>, ctx: UserContext): Promise<Matter> {
    if (!can(ctx, 'create', 'matters')) {
      throw new SecurityAuthorizationError('غير مصرح بإنشاء ملفات استراتيجية جديدة');
    }
    if (data.confidentiality !== 'normal' && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError('غير مصرح لك بإنشاء ملفات سرية دون تصريح أمني');
    }

    const id = `mat-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO matters (id, code, title, description, confidentiality, status, lead_entity, priority, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        data.code,
        data.title,
        data.description,
        data.confidentiality || 'normal',
        data.status || 'active',
        data.lead_entity,
        data.priority || 'normal',
        now,
        now,
        data.created_by
      ]
    );

    return (await this.getById(id, ctx))!;
  }

  async update(id: string, matter: Partial<Matter>, ctx: UserContext): Promise<Matter> {
    if (!can(ctx, 'update', 'matters')) {
      throw new SecurityAuthorizationError('غير مصرح بتعديل بيانات الملف الاستراتيجي');
    }

    const existing = await this.getById(id, ctx);
    if (!existing) throw new SecurityAuthorizationError('الملف الاستراتيجي غير موجود أو سري');

    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    for (const [key, value] of Object.entries(matter)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && ALLOWED_MATTER_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE matters SET ${fields.join(', ')} WHERE id = ?`, params);
    return (await this.getById(id, ctx))!;
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    if (!can(ctx, 'archive', 'matters')) {
      throw new SecurityAuthorizationError('الحذف النهائي مقصور ومحظور على كافة الرتب (Soft-delete only)');
    }
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE matters SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getLinks(matterId: string, ctx: UserContext): Promise<MatterLink[]> {
    const parent = await this.getById(matterId, ctx);
    if (!parent) return [];
    return sqliteEngine.query<MatterLink>('SELECT * FROM matter_links WHERE matter_id = ? ORDER BY created_at DESC', [matterId]);
  }

  async addLink(link: Omit<MatterLink, 'id' | 'created_at'>, ctx: UserContext): Promise<MatterLink> {
    if (!can(ctx, 'update', 'matters')) {
      throw new SecurityAuthorizationError('غير مصرح ربط عناصر جديدة بالملف الاستراتيجي');
    }
    const parent = await this.getById(link.matter_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('الملف غير موجود أو سري');

    const id = `mlink-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO matter_links (id, matter_id, item_type, item_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, link.matter_id, link.item_type, link.item_id, link.title, now]
    );

    const rows = sqliteEngine.query<MatterLink>('SELECT * FROM matter_links WHERE id = ?', [id]);
    return rows[0];
  }

  async removeLink(linkId: string, ctx: UserContext): Promise<boolean> {
    if (!can(ctx, 'update', 'matters')) {
      throw new SecurityAuthorizationError('غير مصرح بإلغاء ربط العنصر');
    }
    sqliteEngine.run('DELETE FROM matter_links WHERE id = ?', [linkId]);
    return true;
  }
}

// --- Contact Repository ---
export class SqliteContactRepository implements IContactRepository {
  async getAll(ctx: UserContext): Promise<Contact[]> {
    if (!can(ctx, 'read', 'contacts')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على دليل الاتصال والجهات الخارجية');
    }
    return sqliteEngine.query<Contact>('SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY name ASC');
  }

  async getById(id: string, ctx: UserContext): Promise<Contact | null> {
    if (!can(ctx, 'read', 'contacts')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على بيانات جهة الاتصال');
    }
    const rows = sqliteEngine.query<Contact>('SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  }

  async create(data: Omit<Contact, 'id' | 'created_at'>, ctx: UserContext): Promise<Contact> {
    if (!can(ctx, 'create', 'contacts')) {
      throw new SecurityAuthorizationError('غير مصرح بإضافة جهات اتصال جديدة');
    }
    const id = `cnt-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO contacts (id, name, entity, position, phone, email, category, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.name, data.entity, data.position || null, data.phone || null, data.email || null, data.category || 'external', data.notes || null, now]
    );
    return (await this.getById(id, ctx))!;
  }

  async update(id: string, contact: Partial<Contact>, ctx: UserContext): Promise<Contact> {
    if (!can(ctx, 'update', 'contacts')) {
      throw new SecurityAuthorizationError('غير مصرح بتعديل بيانات جهة الاتصال');
    }
    const existing = await this.getById(id, ctx);
    if (!existing) throw new SecurityAuthorizationError('جهة الاتصال غير موجودة');

    const fields: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(contact)) {
      if (key !== 'id' && key !== 'created_at' && ALLOWED_CONTACT_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    if (fields.length > 0) {
      sqliteEngine.run(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    return (await this.getById(id, ctx))!;
  }

  async softDelete(id: string, ctx: UserContext): Promise<boolean> {
    if (!can(ctx, 'archive', 'contacts')) {
      throw new SecurityAuthorizationError('الحذف النهائي مقصور ومحظور على كافة الرتب (Soft-delete only)');
    }
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE contacts SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getInteractions(contactId: string, ctx: UserContext): Promise<Interaction[]> {
    const parent = await this.getById(contactId, ctx);
    if (!parent) return [];
    return sqliteEngine.query<Interaction>('SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC', [contactId]);
  }

  async addInteraction(interaction: Omit<Interaction, 'id'>, ctx: UserContext): Promise<Interaction> {
    if (!can(ctx, 'update', 'contacts')) {
      throw new SecurityAuthorizationError('غير مصرح بتسجيل تفاعلات جديدة مع جهة الاتصال');
    }
    const parent = await this.getById(interaction.contact_id, ctx);
    if (!parent) throw new SecurityAuthorizationError('جهة الاتصال غير موجودة');

    const id = `int-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      'INSERT INTO interactions (id, contact_id, date, type, summary, follow_up_needed) VALUES (?, ?, ?, ?, ?, ?)',
      [id, interaction.contact_id, interaction.date, (interaction as any).type || (interaction as any).interaction_type || '', interaction.summary, (interaction as any).follow_up_needed ? 1 : 0]
    );
    const rows = sqliteEngine.query<Interaction>('SELECT * FROM interactions WHERE id = ?', [id]);
    return rows[0];
  }
}

// --- Notification Repository ---
export class SqliteNotificationRepository implements INotificationRepository {
  async getAllForRole(role: RoleType, ctx: UserContext): Promise<Notification[]> {
    if (!can(ctx, 'read', 'notifications')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على الإشعارات');
    }

    let sql = 'SELECT * FROM notifications WHERE (recipient_role = ? OR recipient_role = "ALL")';
    const params: any[] = [role];

    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }

    sql += ' ORDER BY created_at DESC';
    const rows = sqliteEngine.query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      recipient_role: r.recipient_role,
      title: r.title,
      body: r.message || r.body || '',
      confidentiality: r.confidentiality || (r.is_confidential ? 'confidential' : 'normal'),
      link_url: r.link_url || null,
      is_read: Boolean(r.is_read),
      created_at: r.created_at
    }));
  }

  async create(notification: Omit<Notification, 'id' | 'created_at'>, ctx: UserContext): Promise<Notification> {
    if (!can(ctx, 'create', 'notifications')) {
      throw new SecurityAuthorizationError('غير مصرح بإرسال إشعارات جديدة');
    }

    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO notifications (id, recipient_role, title, message, confidentiality, link_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, notification.recipient_role, notification.title, notification.body, notification.confidentiality || 'normal', notification.link_url || null, 0, now]
    );

    const rows = sqliteEngine.query<any>('SELECT * FROM notifications WHERE id = ?', [id]);
    const r = rows[0];
    return {
      id: r.id,
      recipient_role: r.recipient_role,
      title: r.title,
      body: r.message || r.body || '',
      confidentiality: r.confidentiality || 'normal',
      link_url: r.link_url || null,
      is_read: Boolean(r.is_read),
      created_at: r.created_at
    };
  }

  async markAsRead(id: string, ctx: UserContext): Promise<void> {
    if (!can(ctx, 'update', 'notifications')) {
      throw new SecurityAuthorizationError('غير مصرح بتعديل حالة الإشعار');
    }
    sqliteEngine.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  }

  async markAllAsRead(role: RoleType, ctx: UserContext): Promise<void> {
    if (!can(ctx, 'update', 'notifications')) {
      throw new SecurityAuthorizationError('غير مصرح بتحديث الإشعارات');
    }
    sqliteEngine.run('UPDATE notifications SET is_read = 1 WHERE recipient_role = ?', [role]);
  }
}

// --- User Repository ---
export class SqliteUserRepository implements IUserRepository {
  async getAll(ctx: UserContext): Promise<User[]> {
    if (!can(ctx, 'read', 'users')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على قائمة المستخدمين');
    }

    const isFullAdmin = ctx.role === 'ADMIN';
    const rows = sqliteEngine.query<any>('SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, avatar, created_at FROM users ORDER BY name ASC');

    return rows.map((u) => {
      if (isFullAdmin) {
        return {
          ...u,
          can_view_confidential: Boolean(u.can_view_confidential),
          must_change_password: Boolean(u.must_change_password)
        };
      }
      return {
        id: u.id,
        username: u.username,
        name: u.name,
        title: u.title,
        department_id: u.department_id,
        email: u.email,
        role: u.role,
        can_view_confidential: false,
        must_change_password: false,
        avatar: u.avatar,
        created_at: u.created_at
      };
    });
  }

  async getById(id: string, ctx: UserContext): Promise<User | null> {
    if (!can(ctx, 'read', 'users')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على بيانات المستخدم');
    }
    const rows = sqliteEngine.query<any>('SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, avatar, created_at FROM users WHERE id = ?', [id]);
    if (!rows[0]) return null;

    const u = rows[0];
    const isFullAdmin = ctx.role === 'ADMIN' || ctx.userId === id;

    return {
      ...u,
      can_view_confidential: isFullAdmin ? Boolean(u.can_view_confidential) : false,
      must_change_password: isFullAdmin ? Boolean(u.must_change_password) : false
    };
  }

  async getByUsername(username: string): Promise<(User & { password_hash: string; password_salt: string }) | null> {
    const rows = sqliteEngine.query<any>('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
    if (!rows[0]) return null;
    const u = rows[0];
    return {
      ...u,
      can_view_confidential: Boolean(u.can_view_confidential),
      must_change_password: Boolean(u.must_change_password)
    };
  }

  async getByRole(role: RoleType, ctx: UserContext): Promise<User[]> {
    if (!can(ctx, 'read', 'users')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على المستخدمين');
    }
    const rows = sqliteEngine.query<any>('SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, avatar, created_at FROM users WHERE role = ?', [role]);
    return rows.map((u) => ({
      ...u,
      can_view_confidential: Boolean(u.can_view_confidential),
      must_change_password: Boolean(u.must_change_password)
    }));
  }

  async updatePassword(userId: string, hash: string, salt: string, ctx: UserContext): Promise<void> {
    if (ctx.role !== 'ADMIN' && ctx.userId !== userId) {
      throw new SecurityAuthorizationError('غير مصرح لتحديث كلمة مرور حساب آخر');
    }
    sqliteEngine.run('UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?', [hash, salt, userId]);
  }
}

// --- Settings Repository ---
export class SqliteSettingsRepository implements ISettingsRepository {
  async getSettings(ctx: UserContext): Promise<SystemSettings> {
    if (!can(ctx, 'read', 'settings')) {
      throw new SecurityAuthorizationError('غير مصرح بالاطلاع على إعدادات النظام');
    }
    const rows = sqliteEngine.query<any>('SELECT * FROM settings LIMIT 1');
    const r = rows[0] || {};
    return {
      id: r.id || 'sys-settings',
      fiscal_year: r.fiscal_year || '2025/2026',
      session_timeout_minutes: r.session_timeout_minutes || 30,
      default_digit_format: r.default_digit_format || 'indic',
      default_calendar_format: r.default_calendar_format || 'gregorian',
      last_backup_date: r.last_backup_date || undefined
    };
  }

  async updateSettings(settings: Partial<SystemSettings>, ctx: UserContext): Promise<SystemSettings> {
    if (!can(ctx, 'update', 'settings')) {
      throw new SecurityAuthorizationError('تحديث إعدادات المنظومة مقصور حصرياً على مسؤول النظم وسكرتير المكتب التنفيذي (403 Forbidden)');
    }

    const current = await this.getSettings(ctx);
    const updated = { ...current, ...settings };

    sqliteEngine.run(
      'UPDATE settings SET fiscal_year = ?, session_timeout_minutes = ?, default_digit_format = ?, default_calendar_format = ?, last_backup_date = ? WHERE id = ?',
      [
        updated.fiscal_year,
        updated.session_timeout_minutes,
        updated.default_digit_format,
        updated.default_calendar_format,
        updated.last_backup_date || null,
        current.id
      ]
    );

    return (await this.getSettings(ctx))!;
  }
}

export const meetingRepo = new SqliteMeetingRepository();
export const correspondenceRepo = new SqliteCorrespondenceRepository();
export const directiveRepo = new SqliteDirectiveRepository();
export const matterRepo = new SqliteMatterRepository();
export const contactRepo = new SqliteContactRepository();
export const notificationRepo = new SqliteNotificationRepository();
export const auditRepo = new SqliteAuditRepository();
export const userRepo = new SqliteUserRepository();
export const settingsRepo = new SqliteSettingsRepository();
