/**
 * SQLite DDL Schema for Chairman's Office Assistant
 * Portable to PostgreSQL.
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  head_title TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  department_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  can_view_confidential INTEGER DEFAULT 0,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  must_change_password INTEGER DEFAULT 0,
  avatar TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_security (
  username TEXT PRIMARY KEY,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  last_failed_at TEXT,
  last_success_at TEXT
);

CREATE TABLE IF NOT EXISTS matters (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidentiality TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'active',
  lead_entity TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS matter_links (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  meeting_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  matter_id TEXT,
  confidentiality TEXT NOT NULL DEFAULT 'normal',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (matter_id) REFERENCES matters(id)
);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  entity TEXT NOT NULL,
  is_external INTEGER DEFAULT 0,
  attendance_status TEXT NOT NULL DEFAULT 'invited',
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agenda_items (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  presenter TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id TEXT PRIMARY KEY,
  meeting_id TEXT UNIQUE NOT NULL,
  draft_content TEXT NOT NULL,
  approved_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by TEXT,
  approved_at TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  assigned_department_id TEXT,
  assigned_to_name TEXT NOT NULL,
  due_date TEXT NOT NULL,
  directive_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS correspondence (
  id TEXT PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  source_or_dest_entity TEXT NOT NULL,
  subject TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  confidentiality TEXT NOT NULL DEFAULT 'normal',
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered',
  matter_id TEXT,
  category TEXT NOT NULL DEFAULT 'operations',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (matter_id) REFERENCES matters(id)
);

CREATE TABLE IF NOT EXISTS briefing_notes (
  id TEXT PRIMARY KEY,
  correspondence_id TEXT UNIQUE NOT NULL,
  background TEXT NOT NULL,
  secretary_recommendation TEXT NOT NULL,
  executive_opinion TEXT NOT NULL,
  prepared_by_name TEXT NOT NULL,
  prepared_at TEXT NOT NULL,
  FOREIGN KEY (correspondence_id) REFERENCES correspondence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  correspondence_id TEXT UNIQUE NOT NULL,
  decision_type TEXT NOT NULL,
  standard_phrase TEXT NOT NULL,
  custom_directive TEXT,
  decided_at TEXT NOT NULL,
  decided_by_name TEXT NOT NULL,
  FOREIGN KEY (correspondence_id) REFERENCES correspondence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS correspondence_routing (
  id TEXT PRIMARY KEY,
  correspondence_id TEXT NOT NULL,
  from_entity TEXT NOT NULL,
  to_department_id TEXT NOT NULL,
  to_department_name TEXT NOT NULL,
  action_required TEXT NOT NULL,
  deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  routed_at TEXT NOT NULL,
  FOREIGN KEY (correspondence_id) REFERENCES correspondence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_kb INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  confidentiality TEXT NOT NULL DEFAULT 'normal',
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS directives (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  assigned_department TEXT NOT NULL,
  assigned_person TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  confidentiality TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'new',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL,
  due_date TEXT NOT NULL,
  matter_id TEXT,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (matter_id) REFERENCES matters(id)
);

CREATE TABLE IF NOT EXISTS directive_updates (
  id TEXT PRIMARY KEY,
  directive_id TEXT NOT NULL,
  notes TEXT NOT NULL,
  progress_percent INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (directive_id) REFERENCES directives(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entity TEXT NOT NULL,
  position TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  date TEXT NOT NULL,
  summary TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_role TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  confidentiality TEXT NOT NULL DEFAULT 'normal',
  link_url TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT,
  timestamp TEXT NOT NULL,
  ip_address TEXT,
  prev_hash TEXT,
  entry_hash TEXT NOT NULL,
  is_confidential INTEGER DEFAULT 0
);

-- Audit log immutability triggers: Append-Only
CREATE TRIGGER IF NOT EXISTS trg_audit_log_prevent_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'سجل الرقابة والتدقيق غير قابل للتعديل نهائياً');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_log_prevent_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'سجل الرقابة والتدقيق غير قابل للحذف نهائياً');
END;

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  fiscal_year TEXT NOT NULL,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 15,
  default_digit_format TEXT NOT NULL DEFAULT 'western',
  default_calendar_format TEXT NOT NULL DEFAULT 'gregorian',
  last_backup_date TEXT,
  audit_last_seq INTEGER DEFAULT 0,
  audit_head_hash TEXT DEFAULT 'GENESIS-BLOCK-00000000000000000000000000000000',
  audit_count INTEGER DEFAULT 0
);

-- Performance and lookup Indexes
CREATE INDEX IF NOT EXISTS idx_corr_serial ON correspondence(serial_number);
CREATE INDEX IF NOT EXISTS idx_corr_status ON correspondence(status);
CREATE INDEX IF NOT EXISTS idx_corr_matter ON correspondence(matter_id);
CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_directives_status ON directives(status);
CREATE INDEX IF NOT EXISTS idx_directives_due ON directives(due_date);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_matter_links ON matter_links(matter_id);
`;
