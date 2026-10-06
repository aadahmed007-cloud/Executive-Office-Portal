/**
 * Production SQLite Database Engine using better-sqlite3.
 * File-backed persistence at DATA_DIR/app.db (default ./data/app.db).
 * Hardened with WAL mode, foreign keys, busy timeout, and 0600 file permissions.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SCHEMA_SQL } from './schema.sql.js';
import {
  INITIAL_USERS,
  INITIAL_DEPARTMENTS,
  INITIAL_MATTERS,
  INITIAL_MEETINGS,
  INITIAL_MEETING_ATTENDEES,
  INITIAL_AGENDA_ITEMS,
  INITIAL_MEETING_MINUTES,
  INITIAL_DECISIONS,
  INITIAL_CORRESPONDENCE,
  INITIAL_BRIEFING_NOTES,
  INITIAL_APPROVALS,
  INITIAL_DIRECTIVES,
  INITIAL_CONTACTS,
  INITIAL_AUDIT_LOG,
  INITIAL_SETTINGS
} from './seedData.js';

export class SqliteEngine {
  private db: Database.Database | null = null;
  private dbPath: string = '';
  private initPromise: Promise<void> | null = null;
  private writeMutex = Promise.resolve();

  public getDbPath(): string {
    return this.dbPath;
  }

  public async runWithMutex<T>(fn: () => Promise<T> | T): Promise<T> {
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const wait = this.writeMutex;
    this.writeMutex = next;
    await wait;
    try {
      return await fn();
    } finally {
      release!();
    }
  }

  public async init(customPath?: string): Promise<void> {
    if (this.db && !customPath) return;
    if (this.initPromise && !customPath) return this.initPromise;

    this.initPromise = (async () => {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
      }

      this.dbPath = customPath || path.join(dataDir, 'app.db');
      const isNewDb = !fs.existsSync(this.dbPath);

      this.db = new Database(this.dbPath);

      // Secure file permissions (0600: read/write strictly by owner)
      try {
        if (fs.existsSync(this.dbPath)) {
          fs.chmodSync(this.dbPath, 0o600);
        }
      } catch {}

      // Hardening Pragmas
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('busy_timeout = 5000');

      // Run migrations and provisioning
      await this.runMigrationsAndSeed(isNewDb);
    })();

    return this.initPromise;
  }

  public getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('SQLite Engine is not initialized. Call init() first.');
    }
    return this.db;
  }

  private sanitizeParams(params: any[] = []): any[] {
    return params.map((p) => (p === undefined ? null : p));
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const db = this.getDatabase();
    const sanitized = this.sanitizeParams(params);
    const stmt = db.prepare(sql);
    return stmt.all(...sanitized) as T[];
  }

  public run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number | bigint } {
    const db = this.getDatabase();
    const sanitized = this.sanitizeParams(params);
    const stmt = db.prepare(sql);
    const result = stmt.run(...sanitized);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  public transaction<T>(fn: () => T): T {
    const db = this.getDatabase();
    const tx = db.transaction(fn);
    return tx();
  }

  public async saveImmediate(): Promise<void> {
    // In WAL mode with better-sqlite3, writes are flushed directly to disk
    return Promise.resolve();
  }

  public async backup(destPath: string): Promise<void> {
    const db = this.getDatabase();
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true, mode: 0o700 });
    }
    await db.backup(destPath);
    try {
      if (fs.existsSync(destPath)) {
        fs.chmodSync(destPath, 0o600);
      }
    } catch {}
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  public async reopen(customPath?: string): Promise<void> {
    this.close();
    await this.init(customPath);
  }

  private async runMigrationsAndSeed(isNewDb: boolean): Promise<void> {
    if (!this.db) return;

    // 1. Create schema_version table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const versions = this.query<{ version: number }>('SELECT version FROM schema_version ORDER BY version ASC');
    const appliedVersions = new Set(versions.map((v) => v.version));

    // Migration 1: Base Schema
    if (!appliedVersions.has(1)) {
      this.db.exec(SCHEMA_SQL);
      this.db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
    }

    // Seed data only on fresh empty database
    const userCountRows = this.query<{ count: number }>('SELECT count(*) as count FROM users');
    const existingUserCount = userCountRows[0]?.count || 0;

    if (existingUserCount === 0) {
      this.bootstrapFreshDatabase();
    }
  }

  private bootstrapFreshDatabase(): void {
    if (!this.db) return;

    this.transaction(() => {
      // 1. Seed Departments
      const deptStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO departments (id, name, code, head_title, is_active) VALUES (?, ?, ?, ?, ?)'
      );
      for (const d of INITIAL_DEPARTMENTS) {
        deptStmt.run(d.id, d.name, d.code, d.head_title, d.is_active);
      }

      // 2. Provision Users with Random One-Time Passwords
      const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
      if (!isTestEnv) {
        console.log('\n======================================================');
        console.log('🔑 INITIAL SECURITY PROVISIONING: CREATING USERS');
        console.log('======================================================');
      }

      const userStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      for (const u of INITIAL_USERS) {
        let passHash = u.password_hash;
        let passSalt = u.password_salt;
        let initPass = '';

        if (!isTestEnv) {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
          const bytes = crypto.randomBytes(16);
          for (let i = 0; i < 16; i++) initPass += chars[bytes[i] % chars.length];
          const salt = crypto.randomBytes(16);
          const hash = crypto.pbkdf2Sync(initPass, salt, 600000, 32, 'sha256');
          passHash = hash.toString('hex');
          passSalt = salt.toString('hex');
          console.log(`👤 User: [${u.username}] (${u.role}) -> Initial Password: ${initPass}`);
        }

        userStmt.run(
          u.id,
          u.username,
          u.name,
          u.title,
          u.department_id,
          u.email,
          u.role,
          u.can_view_confidential,
          passHash,
          passSalt,
          isTestEnv ? u.must_change_password : 1,
          u.avatar,
          u.created_at
        );
      }

      if (!isTestEnv) {
        console.log('======================================================\n');
      }

      // 3. Seed Matters
      const matterStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO matters (id, code, title, description, confidentiality, status, lead_entity, priority, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const m of INITIAL_MATTERS) {
        matterStmt.run(m.id, m.code, m.title, m.description, m.confidentiality, m.status, m.lead_entity, m.priority, m.created_at, m.updated_at, m.created_by);
      }

      // 4. Seed Meetings
      const meetingStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO meetings (id, title, location, start_time, end_time, meeting_type, status, matter_id, confidentiality, notes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const m of INITIAL_MEETINGS) {
        meetingStmt.run(m.id, m.title, m.location, m.start_time, m.end_time, m.meeting_type, m.status, m.matter_id, m.confidentiality, m.notes, m.created_at, m.updated_at, m.created_by);
      }

      // 5. Seed Meeting Attendees
      const attStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO meeting_attendees (id, meeting_id, name, title, entity, is_external, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const att of INITIAL_MEETING_ATTENDEES) {
        attStmt.run(att.id, att.meeting_id, att.name, att.title, att.entity, att.is_external, att.attendance_status);
      }

      // 6. Seed Agenda Items
      const agendaStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO agenda_items (id, meeting_id, order_index, title, description, duration_minutes, presenter) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const ag of INITIAL_AGENDA_ITEMS) {
        agendaStmt.run(ag.id, ag.meeting_id, ag.order_index, ag.title, ag.description, ag.duration_minutes, ag.presenter);
      }

      // 7. Seed Meeting Minutes
      const minStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO meeting_minutes (id, meeting_id, draft_content, approved_content, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const min of INITIAL_MEETING_MINUTES) {
        minStmt.run(min.id, min.meeting_id, min.draft_content, min.approved_content, min.status, min.approved_by, min.approved_at);
      }

      // 8. Seed Decisions
      const decStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO decisions (id, meeting_id, order_index, content, assigned_department_id, assigned_to_name, due_date, directive_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const dec of INITIAL_DECISIONS) {
        decStmt.run(dec.id, dec.meeting_id, dec.order_index, dec.content, dec.assigned_department_id, dec.assigned_to_name, dec.due_date, dec.directive_id, dec.status);
      }

      // 9. Seed Correspondence
      const corrStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, matter_id, category, tags, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const c of INITIAL_CORRESPONDENCE) {
        corrStmt.run(
          c.id,
          c.serial_number,
          c.type,
          c.date,
          c.source_or_dest_entity,
          c.subject,
          c.priority,
          c.confidentiality,
          c.summary,
          c.status,
          c.matter_id,
          (c as any).category || 'operations',
          JSON.stringify((c as any).tags || []),
          c.created_at,
          c.updated_at,
          c.created_by
        );
      }

      // 10. Seed Briefing Notes
      const bnStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO briefing_notes (id, correspondence_id, background, secretary_recommendation, executive_opinion, prepared_by_name, prepared_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const bn of INITIAL_BRIEFING_NOTES) {
        bnStmt.run(bn.id, bn.correspondence_id, bn.background, bn.secretary_recommendation, bn.executive_opinion, bn.prepared_by_name, bn.prepared_at);
      }

      // 11. Seed Approvals
      const appStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO approvals (id, correspondence_id, decision_type, standard_phrase, custom_directive, decided_at, decided_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const a of INITIAL_APPROVALS) {
        appStmt.run(a.id, a.correspondence_id, a.decision_type, a.standard_phrase, a.custom_directive || null, a.decided_at, a.decided_by_name);
      }

      // 12. Seed Directives
      const dirStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO directives (id, code, title, instruction, assigned_department, assigned_person, source_type, source_id, priority, confidentiality, status, progress_percent, issued_at, due_date, matter_id, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const dir of INITIAL_DIRECTIVES) {
        dirStmt.run(
          dir.id,
          dir.code,
          dir.title,
          dir.instruction,
          dir.assigned_department,
          dir.assigned_person,
          dir.source_type,
          dir.source_id,
          dir.priority,
          dir.confidentiality,
          dir.status,
          dir.progress_percent,
          dir.issued_at,
          dir.due_date,
          dir.matter_id,
          dir.created_by,
          dir.updated_at
        );
      }

      // 13. Seed Contacts
      const contactStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO contacts (id, name, entity, position, phone, email, category, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const con of INITIAL_CONTACTS) {
        contactStmt.run(con.id, con.name, con.entity, con.position, con.phone, con.email, con.category, con.notes, con.created_at);
      }

      // 14. Seed Audit Log with Sequence and Cryptographic Chain
      const auditStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO audit_log (id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address, prev_hash, entry_hash, is_confidential) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      let lastSeq = 0;
      let lastHash = 'GENESIS-BLOCK-00000000000000000000000000000000';
      let auditCount = 0;
      for (const a of INITIAL_AUDIT_LOG) {
        const nextSeq = lastSeq + 1;
        const prevHash = lastHash;
        const isConf = (a as any).is_confidential ? 1 : 0;
        const payload = [
          String(nextSeq),
          a.id,
          a.timestamp,
          a.user_id,
          a.user_role,
          a.action_type,
          a.entity_type,
          a.entity_id,
          a.before_value || '',
          a.after_value || '',
          a.ip_address || '',
          prevHash,
          isConf ? '1' : '0'
        ].join('||');
        const entryHash = crypto.createHash('sha256').update(payload).digest('hex');

        const res = auditStmt.run(
          a.id,
          a.user_id,
          a.user_name,
          a.user_role,
          a.action_type,
          a.entity_type,
          a.entity_id,
          a.before_value,
          a.after_value,
          a.timestamp,
          a.ip_address || null,
          prevHash,
          entryHash,
          isConf
        );
        lastSeq = Number(res.lastInsertRowid);
        lastHash = entryHash;
        auditCount++;
      }

      // 15. Seed Settings with Checkpoint
      const setStmt = this.db!.prepare(
        'INSERT OR IGNORE INTO settings (id, fiscal_year, session_timeout_minutes, default_digit_format, default_calendar_format, last_backup_date, audit_last_seq, audit_head_hash, audit_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const s = INITIAL_SETTINGS;
      setStmt.run(
        s.id,
        s.fiscal_year,
        s.session_timeout_minutes,
        s.default_digit_format,
        s.default_calendar_format,
        s.last_backup_date || null,
        lastSeq,
        lastHash,
        auditCount
      );
    });
  }
}

export const sqliteEngine = new SqliteEngine();
