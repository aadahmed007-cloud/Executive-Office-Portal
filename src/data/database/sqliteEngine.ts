/**
 * In-browser SQLite WASM Engine powered by sql.js
 * Persisted locally in IndexedDB (no external server, no network calls).
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { SCHEMA_SQL } from './schema.sql';
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
} from './seedData';

const IDB_NAME = 'chairmans_office_idb';
const IDB_STORE = 'sqlite_storage';
const IDB_KEY = 'chairmans_office_sqlite_binary';

class SqliteEngine {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private initPromise: Promise<void> | null = null;
  private isPersisting: boolean = false;
  private isDirty: boolean = false;
  private persistTimer: any = null;

  public async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // 1. Initialize WASM locally without any external CDN (supports both browser and Node.js test runner)
      let locateFile: (() => string) | undefined = undefined;
      if (typeof window !== 'undefined') {
        try {
          // @ts-ignore
          const wasmMod = await import('sql.js/dist/sql-wasm.wasm?url');
          if (wasmMod && wasmMod.default) {
            locateFile = () => wasmMod.default;
          }
        } catch {}
      }

      this.SQL = await initSqlJs(locateFile ? { locateFile } : undefined);

      // 2. Try loading persisted binary from IndexedDB
      const savedBinary = await this.loadFromIndexedDB();

      if (savedBinary && savedBinary.length > 0) {
        try {
          this.db = new this.SQL.Database(savedBinary);
          try {
            this.db.run("ALTER TABLE correspondence ADD COLUMN category TEXT DEFAULT 'operations'");
          } catch {}
          try {
            this.db.run("ALTER TABLE correspondence ADD COLUMN tags TEXT DEFAULT '[]'");
          } catch {}
          return;
        } catch {
          // If corrupted, fallback to clean seed
        }
      }

      // 3. Otherwise create fresh database and seed
      this.db = new this.SQL.Database();
      await this.bootstrapSchemaAndSeed();
      await this.persist();
    })();

    return this.initPromise;
  }

  public getDatabase(): Database {
    if (!this.db) {
      throw new Error('SQLite Engine is not initialized. Call init() first.');
    }
    return this.db;
  }

  private sanitizeParams(params: any[] = []): any[] {
    return params.map((p) => (p === undefined ? null : p));
  }

  /**
   * Run a SELECT query and return array of objects
   */
  public query<T = any>(sql: string, params: any[] = []): T[] {
    const db = this.getDatabase();
    const sanitized = this.sanitizeParams(params);
    const stmt = db.prepare(sql);
    stmt.bind(sanitized);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return results;
  }

  /**
   * Run an INSERT/UPDATE/DELETE query and trigger auto-persist
   */
  public run(sql: string, params: any[] = []): { changes: number } {
    const db = this.getDatabase();
    const sanitized = this.sanitizeParams(params);
    db.run(sql, sanitized);
    const changes = db.getRowsModified();
    // Mark dirty and schedule asynchronous serialized persistence
    this.isDirty = true;
    this.schedulePersist();
    return { changes };
  }

  /**
   * Schedule debounced save to IndexedDB with serialized dirty-queue
   */
  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(async () => {
      this.persistTimer = null;
      await this.drainPersistQueue();
    }, 150);
  }

  /**
   * Drains the persistence queue in a serialized loop.
   * Ensures that no writes occurring during in-flight persistence can be silently lost.
   */
  private async drainPersistQueue(): Promise<void> {
    if (this.isPersisting) {
      // An operation is already in-flight. isDirty remains true, so it will loop again.
      return;
    }

    while (this.isDirty) {
      this.isDirty = false;
      this.isPersisting = true;
      try {
        await this.persist();
      } finally {
        this.isPersisting = false;
      }
    }
  }

  /**
   * Export binary and save to IndexedDB
   */
  public async persist(): Promise<void> {
    if (!this.db) return;
    const binary = this.db.export();
    await this.saveToIndexedDB(binary);
  }

  /**
   * Immediate synchronous export and persist for critical presidential transactions
   */
  public async saveImmediate(): Promise<void> {
    this.isDirty = true;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.drainPersistQueue();
  }

  /**
   * Reset database to initial seed data
   */
  public async resetToSeed(): Promise<void> {
    if (!this.SQL) return;
    this.db = new this.SQL.Database();
    await this.bootstrapSchemaAndSeed();
    await this.persist();
  }

  /**
   * Export raw binary Uint8Array
   */
  public exportBinary(): Uint8Array | null {
    if (!this.db) return null;
    return this.db.export();
  }

  /**
   * Export the SQLite file as a downloadable binary blob
   */
  public exportBlob(): Blob | null {
    if (!this.db) return null;
    const binary = this.db.export();
    return new Blob([binary as any], { type: 'application/x-sqlite3' });
  }

  /**
   * Restore database from imported binary blob with integrity and structure verification
   */
  public async restoreFromBinary(binaryData: Uint8Array): Promise<{ success: boolean; error?: string; tablesCount?: number }> {
    if (!this.SQL) return { success: false, error: 'محرك SQLite غير مهيأ' };
    try {
      const testDb = new this.SQL.Database(binaryData);
      // Validate structure
      const tablesResult = testDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'correspondence', 'directives', 'meetings', 'audit_log')");
      const foundTables = tablesResult[0]?.values?.length || 0;
      if (foundTables < 4) {
        return { success: false, error: 'الملف لا يمثل قاعدة بيانات صالحة لمنظومة مكتب رئيس مجلس الإدارة' };
      }

      // If valid, swap active database and persist
      this.db?.close();
      this.db = testDb;
      await this.persist();
      return { success: true, tablesCount: foundTables };
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل في استعادة قاعدة البيانات من الملف المحدد' };
    }
  }

  private async bootstrapSchemaAndSeed(): Promise<void> {
    if (!this.db) return;
    // Execute DDL
    this.db.run(SCHEMA_SQL);

    // Seed Departments
    for (const d of INITIAL_DEPARTMENTS) {
      this.db.run(
        'INSERT OR IGNORE INTO departments (id, name, code, head_title, is_active) VALUES (?, ?, ?, ?, ?)',
        this.sanitizeParams([d.id, d.name, d.code, d.head_title, d.is_active])
      );
    }

    // Seed Users
    for (const u of INITIAL_USERS) {
      this.db.run(
        'INSERT OR IGNORE INTO users (id, name, title, department_id, email, role, can_view_confidential, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([u.id, u.name, u.title, u.department_id, u.email, u.role, u.can_view_confidential, u.avatar, u.created_at])
      );
    }

    // Seed Matters
    for (const m of INITIAL_MATTERS) {
      this.db.run(
        'INSERT OR IGNORE INTO matters (id, code, title, description, confidentiality, status, lead_entity, priority, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([m.id, m.code, m.title, m.description, m.confidentiality, m.status, m.lead_entity, m.priority, m.created_at, m.updated_at, m.created_by])
      );
    }

    // Seed Meetings
    for (const m of INITIAL_MEETINGS) {
      this.db.run(
        'INSERT OR IGNORE INTO meetings (id, title, location, start_time, end_time, meeting_type, status, matter_id, confidentiality, notes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([m.id, m.title, m.location, m.start_time, m.end_time, m.meeting_type, m.status, m.matter_id, m.confidentiality, m.notes, m.created_at, m.updated_at, m.created_by])
      );
    }

    // Seed Meeting Attendees
    for (const att of INITIAL_MEETING_ATTENDEES) {
      this.db.run(
        'INSERT OR IGNORE INTO meeting_attendees (id, meeting_id, name, title, entity, is_external, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([att.id, att.meeting_id, att.name, att.title, att.entity, att.is_external, att.attendance_status])
      );
    }

    // Seed Agenda Items
    for (const ag of INITIAL_AGENDA_ITEMS) {
      this.db.run(
        'INSERT OR IGNORE INTO agenda_items (id, meeting_id, order_index, title, description, duration_minutes, presenter) VALUES (?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([ag.id, ag.meeting_id, ag.order_index, ag.title, ag.description, ag.duration_minutes, ag.presenter])
      );
    }

    // Seed Meeting Minutes
    for (const min of INITIAL_MEETING_MINUTES) {
      this.db.run(
        'INSERT OR IGNORE INTO meeting_minutes (id, meeting_id, draft_content, approved_content, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([min.id, min.meeting_id, min.draft_content, min.approved_content, min.status, min.approved_by, min.approved_at])
      );
    }

    // Seed Decisions
    for (const dec of INITIAL_DECISIONS) {
      this.db.run(
        'INSERT OR IGNORE INTO decisions (id, meeting_id, order_index, content, assigned_department_id, assigned_to_name, due_date, directive_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([dec.id, dec.meeting_id, dec.order_index, dec.content, dec.assigned_department_id, dec.assigned_to_name, dec.due_date, dec.directive_id, dec.status])
      );
    }

    // Seed Correspondence
    for (const c of INITIAL_CORRESPONDENCE) {
      this.db.run(
        'INSERT OR IGNORE INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, matter_id, category, tags, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([
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
        ])
      );
    }

    // Seed Briefing Notes
    for (const b of INITIAL_BRIEFING_NOTES) {
      this.db.run(
        'INSERT OR IGNORE INTO briefing_notes (id, correspondence_id, background, secretary_recommendation, executive_opinion, prepared_by_name, prepared_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([b.id, b.correspondence_id, b.background, b.secretary_recommendation, b.executive_opinion, b.prepared_by_name, b.prepared_at])
      );
    }

    // Seed Approvals
    for (const a of INITIAL_APPROVALS) {
      this.db.run(
        'INSERT OR IGNORE INTO approvals (id, correspondence_id, decision_type, standard_phrase, custom_directive, decided_at, decided_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([a.id, a.correspondence_id, a.decision_type, a.standard_phrase, a.custom_directive, a.decided_at, a.decided_by_name])
      );
    }

    // Seed Directives
    for (const d of INITIAL_DIRECTIVES) {
      this.db.run(
        'INSERT OR IGNORE INTO directives (id, code, title, instruction, assigned_department, assigned_person, source_type, source_id, priority, confidentiality, status, progress_percent, issued_at, due_date, matter_id, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([d.id, d.code, d.title, d.instruction, d.assigned_department, d.assigned_person, d.source_type, d.source_id, d.priority, d.confidentiality, d.status, d.progress_percent, d.issued_at, d.due_date, d.matter_id, d.created_by, d.updated_at])
      );
    }

    // Seed Contacts
    for (const c of INITIAL_CONTACTS) {
      this.db.run(
        'INSERT OR IGNORE INTO contacts (id, name, entity, position, phone, email, category, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([c.id, c.name, c.entity, c.position, c.phone, c.email, c.category, c.notes, c.created_at])
      );
    }

    // Seed Audit Log
    for (const a of INITIAL_AUDIT_LOG) {
      this.db.run(
        'INSERT OR IGNORE INTO audit_log (id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address, prev_hash, entry_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        this.sanitizeParams([a.id, a.user_id, a.user_name, a.user_role, a.action_type, a.entity_type, a.entity_id, a.before_value, a.after_value, a.timestamp, a.ip_address, a.prev_hash, a.entry_hash])
      );
    }

    // Seed Settings
    this.db.run(
      'INSERT OR IGNORE INTO settings (id, fiscal_year, session_timeout_minutes, default_digit_format, default_calendar_format, last_backup_date) VALUES (?, ?, ?, ?, ?, ?)',
      this.sanitizeParams([
        INITIAL_SETTINGS.id,
        INITIAL_SETTINGS.fiscal_year,
        INITIAL_SETTINGS.session_timeout_minutes,
        INITIAL_SETTINGS.default_digit_format,
        INITIAL_SETTINGS.default_calendar_format,
        INITIAL_SETTINGS.last_backup_date
      ])
    );
  }

  // --- IndexedDB Storage Helpers ---
  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveToIndexedDB(data: Uint8Array): Promise<void> {
    try {
      const idb = await this.openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.put(data, IDB_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback silently if IDB unavailable
    }
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    try {
      const idb = await this.openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(IDB_KEY);
        req.onsuccess = () => {
          resolve(req.result ? new Uint8Array(req.result) : null);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }
}

export const sqliteEngine = new SqliteEngine();
