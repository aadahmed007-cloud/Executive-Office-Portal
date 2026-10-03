import { sqliteEngine } from '../database/sqliteEngine';
import {
  IMeetingRepository,
  ICorrespondenceRepository,
  IDirectiveRepository,
  IMatterRepository,
  IContactRepository,
  INotificationRepository,
  IAuditRepository,
  IUserRepository,
  ISettingsRepository
} from '../contracts';
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
} from '../../domain/types';
import { generateSerialNumber } from '../../domain/rules/serialGenerator';

// --- Column Whitelists for SQL Injection Protection ---
const ALLOWED_MEETING_COLUMNS = new Set(['title', 'location', 'start_time', 'end_time', 'meeting_type', 'status', 'matter_id', 'confidentiality', 'notes', 'deleted_at', 'created_by']);
const ALLOWED_CORRESPONDENCE_COLUMNS = new Set(['serial_number', 'type', 'date', 'source_or_dest_entity', 'subject', 'priority', 'confidentiality', 'summary', 'status', 'matter_id', 'deleted_at', 'created_by']);
const ALLOWED_DIRECTIVE_COLUMNS = new Set(['code', 'title', 'instruction', 'assigned_department', 'assigned_person', 'source_type', 'source_id', 'priority', 'confidentiality', 'status', 'progress_percent', 'issued_at', 'due_date', 'matter_id', 'deleted_at', 'created_by']);
const ALLOWED_MATTER_COLUMNS = new Set(['code', 'title', 'description', 'confidentiality', 'status', 'lead_entity', 'priority', 'deleted_at']);
const ALLOWED_CONTACT_COLUMNS = new Set(['name', 'entity', 'position', 'phone', 'email', 'category', 'notes', 'deleted_at']);
const ALLOWED_USER_COLUMNS = new Set(['name', 'title', 'role', 'can_view_confidential', 'avatar', 'pin_code', 'is_active']);

// --- Audit Repository ---
export class SqliteAuditRepository implements IAuditRepository {
  async getAll(filter?: { entityType?: string; userId?: string; limit?: number }): Promise<AuditLogEntry[]> {
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
    return sqliteEngine.query<AuditLogEntry>(sql, params);
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO audit_log (id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        entry.user_id,
        entry.user_name,
        entry.user_role,
        entry.action_type,
        entry.entity_type,
        entry.entity_id,
        entry.before_value || null,
        entry.after_value || null,
        timestamp,
        entry.ip_address || '10.120.4.x (LAN)'
      ]
    );
  }
}

export const auditRepo = new SqliteAuditRepository();

// --- Meetings Repository ---
export class SqliteMeetingRepository implements IMeetingRepository {
  async getAll(filter?: { status?: string; matterId?: string; date?: string }): Promise<Meeting[]> {
    let sql = 'SELECT * FROM meetings WHERE deleted_at IS NULL';
    const params: any[] = [];
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
    sql += ' ORDER BY start_time ASC';
    return sqliteEngine.query<Meeting>(sql, params);
  }

  async getById(id: string): Promise<Meeting | null> {
    const rows = sqliteEngine.query<Meeting>('SELECT * FROM meetings WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  }

  async create(data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>): Promise<Meeting> {
    const id = `meet-${Date.now()}`;
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
    const created = await this.getById(id);
    return created!;
  }

  async update(id: string, meeting: Partial<Meeting>): Promise<Meeting> {
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
    const updated = await this.getById(id);
    return updated!;
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE meetings SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getAttendees(meetingId: string): Promise<MeetingAttendee[]> {
    return sqliteEngine.query<MeetingAttendee>('SELECT * FROM meeting_attendees WHERE meeting_id = ?', [meetingId]);
  }

  async setAttendees(meetingId: string, attendees: Omit<MeetingAttendee, 'id' | 'meeting_id'>[]): Promise<void> {
    sqliteEngine.run('DELETE FROM meeting_attendees WHERE meeting_id = ?', [meetingId]);
    for (const att of attendees) {
      const id = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqliteEngine.run(
        'INSERT INTO meeting_attendees (id, meeting_id, name, title, entity, is_external, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, meetingId, att.name, att.title, att.entity, att.is_external ? 1 : 0, att.attendance_status]
      );
    }
  }

  async getAgenda(meetingId: string): Promise<AgendaItem[]> {
    return sqliteEngine.query<AgendaItem>('SELECT * FROM agenda_items WHERE meeting_id = ? ORDER BY order_index ASC', [meetingId]);
  }

  async setAgenda(meetingId: string, items: Omit<AgendaItem, 'id' | 'meeting_id'>[]): Promise<void> {
    sqliteEngine.run('DELETE FROM agenda_items WHERE meeting_id = ?', [meetingId]);
    for (const item of items) {
      const id = `agenda-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqliteEngine.run(
        'INSERT INTO agenda_items (id, meeting_id, order_index, title, description, duration_minutes, presenter) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, meetingId, item.order_index, item.title, item.description || null, item.duration_minutes || 15, item.presenter]
      );
    }
  }

  async getMinutes(meetingId: string): Promise<MeetingMinutes | null> {
    const rows = sqliteEngine.query<MeetingMinutes>('SELECT * FROM meeting_minutes WHERE meeting_id = ?', [meetingId]);
    return rows[0] || null;
  }

  async saveMinutes(minutes: Omit<MeetingMinutes, 'id'>): Promise<MeetingMinutes> {
    const existing = await this.getMinutes(minutes.meeting_id);
    if (existing) {
      sqliteEngine.run(
        'UPDATE meeting_minutes SET draft_content = ?, approved_content = ?, status = ?, approved_by = ?, approved_at = ? WHERE meeting_id = ?',
        [minutes.draft_content, minutes.approved_content || null, minutes.status, minutes.approved_by || null, minutes.approved_at || null, minutes.meeting_id]
      );
      return (await this.getMinutes(minutes.meeting_id))!;
    } else {
      const id = `min-${Date.now()}`;
      sqliteEngine.run(
        'INSERT INTO meeting_minutes (id, meeting_id, draft_content, approved_content, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, minutes.meeting_id, minutes.draft_content, minutes.approved_content || null, minutes.status, minutes.approved_by || null, minutes.approved_at || null]
      );
      return (await this.getMinutes(minutes.meeting_id))!;
    }
  }

  async getDecisions(meetingId: string): Promise<Decision[]> {
    return sqliteEngine.query<Decision>('SELECT * FROM decisions WHERE meeting_id = ? ORDER BY order_index ASC', [meetingId]);
  }

  async addDecision(decision: Omit<Decision, 'id'>): Promise<Decision> {
    const id = `dec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      'INSERT INTO decisions (id, meeting_id, order_index, content, assigned_department_id, assigned_to_name, due_date, directive_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, decision.meeting_id, decision.order_index, decision.content, decision.assigned_department_id || null, decision.assigned_to_name, decision.due_date, decision.directive_id || null, decision.status || 'pending']
    );
    const rows = sqliteEngine.query<Decision>('SELECT * FROM decisions WHERE id = ?', [id]);
    return rows[0];
  }
}

// --- Correspondence Repository ---
export class SqliteCorrespondenceRepository implements ICorrespondenceRepository {
  async getAll(filter?: { type?: 'incoming' | 'outgoing'; status?: string; matterId?: string; priority?: string }): Promise<Correspondence[]> {
    let sql = 'SELECT * FROM correspondence WHERE deleted_at IS NULL';
    const params: any[] = [];
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
    sql += ' ORDER BY created_at DESC';
    return sqliteEngine.query<Correspondence>(sql, params);
  }

  async getById(id: string): Promise<Correspondence | null> {
    const rows = sqliteEngine.query<Correspondence>('SELECT * FROM correspondence WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  }

  async getBySerial(serial: string): Promise<Correspondence | null> {
    const rows = sqliteEngine.query<Correspondence>('SELECT * FROM correspondence WHERE serial_number = ? AND deleted_at IS NULL', [serial]);
    return rows[0] || null;
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

  async create(data: Omit<Correspondence, 'id' | 'created_at' | 'updated_at'>): Promise<Correspondence> {
    const id = `corr-${data.type === 'incoming' ? 'in' : 'out'}-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, matter_id, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        now,
        now,
        data.created_by
      ]
    );
    const created = await this.getById(id);
    return created!;
  }

  async update(id: string, item: Partial<Correspondence>): Promise<Correspondence> {
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    for (const [key, value] of Object.entries(item)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && ALLOWED_CORRESPONDENCE_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE correspondence SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await this.getById(id);
    return updated!;
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE correspondence SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getBriefingNote(correspondenceId: string): Promise<BriefingNote | null> {
    const rows = sqliteEngine.query<BriefingNote>('SELECT * FROM briefing_notes WHERE correspondence_id = ?', [correspondenceId]);
    return rows[0] || null;
  }

  async saveBriefingNote(note: Omit<BriefingNote, 'id'>): Promise<BriefingNote> {
    const existing = await this.getBriefingNote(note.correspondence_id);
    if (existing) {
      sqliteEngine.run(
        'UPDATE briefing_notes SET background = ?, secretary_recommendation = ?, executive_opinion = ?, prepared_by_name = ?, prepared_at = ? WHERE correspondence_id = ?',
        [note.background, note.secretary_recommendation, note.executive_opinion, note.prepared_by_name, note.prepared_at, note.correspondence_id]
      );
      return (await this.getBriefingNote(note.correspondence_id))!;
    } else {
      const id = `brief-${Date.now()}`;
      sqliteEngine.run(
        'INSERT INTO briefing_notes (id, correspondence_id, background, secretary_recommendation, executive_opinion, prepared_by_name, prepared_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, note.correspondence_id, note.background, note.secretary_recommendation, note.executive_opinion, note.prepared_by_name, note.prepared_at]
      );
      return (await this.getBriefingNote(note.correspondence_id))!;
    }
  }

  async getApproval(correspondenceId: string): Promise<Approval | null> {
    const rows = sqliteEngine.query<Approval>('SELECT * FROM approvals WHERE correspondence_id = ?', [correspondenceId]);
    return rows[0] || null;
  }

  async recordApproval(approval: Omit<Approval, 'id'>): Promise<Approval> {
    const id = `appr-${Date.now()}`;
    sqliteEngine.run(
      'INSERT INTO approvals (id, correspondence_id, decision_type, standard_phrase, custom_directive, decided_at, decided_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, approval.correspondence_id, approval.decision_type, approval.standard_phrase, approval.custom_directive || null, approval.decided_at, approval.decided_by_name]
    );
    return (await this.getApproval(approval.correspondence_id))!;
  }

  async getRoutings(correspondenceId: string): Promise<CorrespondenceRouting[]> {
    return sqliteEngine.query<CorrespondenceRouting>('SELECT * FROM correspondence_routing WHERE correspondence_id = ? ORDER BY routed_at ASC', [correspondenceId]);
  }

  async addRouting(routing: Omit<CorrespondenceRouting, 'id'>): Promise<CorrespondenceRouting> {
    const id = `rout-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      'INSERT INTO correspondence_routing (id, correspondence_id, from_entity, to_department_id, to_department_name, action_required, deadline, status, routed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, routing.correspondence_id, routing.from_entity, routing.to_department_id, routing.to_department_name, routing.action_required, routing.deadline, routing.status, routing.routed_at]
    );
    const rows = sqliteEngine.query<CorrespondenceRouting>('SELECT * FROM correspondence_routing WHERE id = ?', [id]);
    return rows[0];
  }

  async getAttachments(correspondenceId: string): Promise<Attachment[]> {
    return sqliteEngine.query<Attachment>("SELECT * FROM attachments WHERE entity_type = 'correspondence' AND entity_id = ?", [correspondenceId]);
  }

  async addAttachment(att: Omit<Attachment, 'id'>): Promise<Attachment> {
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
  async getAll(filter?: { status?: string; assignedDepartment?: string; matterId?: string }): Promise<Directive[]> {
    let sql = 'SELECT * FROM directives WHERE deleted_at IS NULL';
    const params: any[] = [];
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
    sql += ' ORDER BY due_date ASC';
    return sqliteEngine.query<Directive>(sql, params);
  }

  async getById(id: string): Promise<Directive | null> {
    const rows = sqliteEngine.query<Directive>('SELECT * FROM directives WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  }

  async getNextCode(year: number = new Date().getFullYear()): Promise<string> {
    const rows = sqliteEngine.query<{ count: number }>("SELECT COUNT(*) as count FROM directives WHERE strftime('%Y', issued_at) = ?", [String(year)]);
    const count = rows[0]?.count || 0;
    return generateSerialNumber('DIR', count, year);
  }

  async create(data: Omit<Directive, 'id' | 'created_at' | 'updated_at'>): Promise<Directive> {
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
        data.assigned_person,
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
    const created = await this.getById(id);
    return created!;
  }

  async update(id: string, directive: Partial<Directive>): Promise<Directive> {
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    for (const [key, value] of Object.entries(directive)) {
      if (key !== 'id' && key !== 'updated_at' && ALLOWED_DIRECTIVE_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE directives SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await this.getById(id);
    return updated!;
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE directives SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getUpdates(directiveId: string): Promise<DirectiveUpdate[]> {
    return sqliteEngine.query<DirectiveUpdate>('SELECT * FROM directive_updates WHERE directive_id = ? ORDER BY created_at DESC', [directiveId]);
  }

  async addUpdate(update: Omit<DirectiveUpdate, 'id' | 'created_at'>): Promise<DirectiveUpdate> {
    const id = `dirup-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO directive_updates (id, directive_id, notes, progress_percent, updated_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, update.directive_id, update.notes, update.progress_percent, update.updated_by, now]
    );
    // Also update directive progress
    sqliteEngine.run('UPDATE directives SET progress_percent = ?, updated_at = ? WHERE id = ?', [update.progress_percent, now, update.directive_id]);
    const rows = sqliteEngine.query<DirectiveUpdate>('SELECT * FROM directive_updates WHERE id = ?', [id]);
    return rows[0];
  }
}

// --- Matter Repository ---
export class SqliteMatterRepository implements IMatterRepository {
  async getAll(filter?: { status?: string }): Promise<Matter[]> {
    let sql = 'SELECT * FROM matters WHERE deleted_at IS NULL';
    const params: any[] = [];
    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    sql += ' ORDER BY created_at DESC';
    return sqliteEngine.query<Matter>(sql, params);
  }

  async getById(id: string): Promise<Matter | null> {
    const rows = sqliteEngine.query<Matter>('SELECT * FROM matters WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  }

  async create(data: Omit<Matter, 'id' | 'created_at' | 'updated_at'>): Promise<Matter> {
    const id = `matter-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO matters (id, code, title, description, confidentiality, status, lead_entity, priority, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.code, data.title, data.description, data.confidentiality, data.status, data.lead_entity, data.priority, now, now, data.created_by]
    );
    const created = await this.getById(id);
    return created!;
  }

  async update(id: string, matter: Partial<Matter>): Promise<Matter> {
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
    const updated = await this.getById(id);
    return updated!;
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE matters SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getLinks(matterId: string): Promise<MatterLink[]> {
    return sqliteEngine.query<MatterLink>('SELECT * FROM matter_links WHERE matter_id = ? ORDER BY created_at DESC', [matterId]);
  }

  async addLink(link: Omit<MatterLink, 'id' | 'created_at'>): Promise<MatterLink> {
    const id = `mlink-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO matter_links (id, matter_id, item_type, item_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, link.matter_id, link.item_type, link.item_id, link.title, now]
    );
    const rows = sqliteEngine.query<MatterLink>('SELECT * FROM matter_links WHERE id = ?', [id]);
    return rows[0];
  }

  async removeLink(linkId: string): Promise<boolean> {
    sqliteEngine.run('DELETE FROM matter_links WHERE id = ?', [linkId]);
    return true;
  }
}

// --- Contact Repository ---
export class SqliteContactRepository implements IContactRepository {
  async getAll(): Promise<Contact[]> {
    return sqliteEngine.query<Contact>('SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY name ASC');
  }

  async getById(id: string): Promise<Contact | null> {
    const rows = sqliteEngine.query<Contact>('SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  }

  async create(data: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
    const id = `cont-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO contacts (id, name, entity, position, phone, email, category, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.name, data.entity, data.position, data.phone, data.email, data.category, data.notes || null, now]
    );
    const created = await this.getById(id);
    return created!;
  }

  async update(id: string, contact: Partial<Contact>): Promise<Contact> {
    const fields: string[] = [];
    const params: any[] = [];
    for (const [key, value] of Object.entries(contact)) {
      if (key !== 'id' && key !== 'created_at' && ALLOWED_CONTACT_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await this.getById(id);
    return updated!;
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    sqliteEngine.run('UPDATE contacts SET deleted_at = ? WHERE id = ?', [now, id]);
    return true;
  }

  async getInteractions(contactId: string): Promise<Interaction[]> {
    return sqliteEngine.query<Interaction>('SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC', [contactId]);
  }

  async addInteraction(interaction: Omit<Interaction, 'id'>): Promise<Interaction> {
    const id = `inter-${Date.now()}`;
    sqliteEngine.run(
      'INSERT INTO interactions (id, contact_id, interaction_type, date, summary, recorded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, interaction.contact_id, interaction.interaction_type, interaction.date, interaction.summary, interaction.recorded_by]
    );
    const rows = sqliteEngine.query<Interaction>('SELECT * FROM interactions WHERE id = ?', [id]);
    return rows[0];
  }
}

// --- Notification Repository ---
export class SqliteNotificationRepository implements INotificationRepository {
  async getAllForRole(role: RoleType): Promise<Notification[]> {
    return sqliteEngine.query<Notification>('SELECT * FROM notifications WHERE recipient_role = ? ORDER BY created_at DESC', [role]);
  }

  async create(data: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> {
    const id = `notif-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      'INSERT INTO notifications (id, recipient_role, title, body, confidentiality, link_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.recipient_role, data.title, data.body, data.confidentiality || 'normal', data.link_url || null, data.is_read ? 1 : 0, now]
    );
    const rows = sqliteEngine.query<Notification>('SELECT * FROM notifications WHERE id = ?', [id]);
    return rows[0];
  }

  async markAsRead(id: string): Promise<void> {
    sqliteEngine.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  }

  async markAllAsRead(role: RoleType): Promise<void> {
    sqliteEngine.run('UPDATE notifications SET is_read = 1 WHERE recipient_role = ?', [role]);
  }
}

// --- User Repository ---
export class SqliteUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    const rows = sqliteEngine.query<any>('SELECT * FROM users ORDER BY name ASC');
    return rows.map((r) => ({
      ...r,
      can_view_confidential: Boolean(r.can_view_confidential)
    }));
  }

  async getById(id: string): Promise<User | null> {
    const rows = sqliteEngine.query<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      can_view_confidential: Boolean(rows[0].can_view_confidential)
    };
  }

  async getByRole(role: RoleType): Promise<User[]> {
    const rows = sqliteEngine.query<any>('SELECT * FROM users WHERE role = ?', [role]);
    return rows.map((r) => ({
      ...r,
      can_view_confidential: Boolean(r.can_view_confidential)
    }));
  }
}

// --- Settings Repository ---
export class SqliteSettingsRepository implements ISettingsRepository {
  async getSettings(): Promise<SystemSettings> {
    const rows = sqliteEngine.query<SystemSettings>('SELECT * FROM settings LIMIT 1');
    return (
      rows[0] || {
        id: 'settings-global',
        fiscal_year: '2026/2027',
        session_timeout_minutes: 15,
        default_digit_format: 'western',
        default_calendar_format: 'gregorian',
        last_backup_date: undefined
      }
    );
  }

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSettings();
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
    return this.getSettings();
  }
}

// Export singletons
export const meetingRepo = new SqliteMeetingRepository();
export const correspondenceRepo = new SqliteCorrespondenceRepository();
export const directiveRepo = new SqliteDirectiveRepository();
export const matterRepo = new SqliteMatterRepository();
export const contactRepo = new SqliteContactRepository();
export const notificationRepo = new SqliteNotificationRepository();
export const userRepo = new SqliteUserRepository();
export const settingsRepo = new SqliteSettingsRepository();
