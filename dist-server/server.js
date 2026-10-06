var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/domain/security/cryptoUtils.ts
var cryptoUtils_exports = {};
__export(cryptoUtils_exports, {
  GENESIS_BLOCK_HASH: () => GENESIS_BLOCK_HASH,
  buildAuditPayload: () => buildAuditPayload,
  computeAuditEntryHash: () => computeAuditEntryHash,
  sha256Hex: () => sha256Hex,
  verifyAuditLogIntegrity: () => verifyAuditLogIntegrity
});
function bytesToHex(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
async function sha256Hex(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuffer));
}
function buildAuditPayload(entry) {
  return [
    entry.seq !== void 0 ? String(entry.seq) : "",
    entry.id,
    entry.timestamp,
    entry.user_id,
    entry.user_role,
    entry.action_type,
    entry.entity_type,
    entry.entity_id,
    entry.before_value || "",
    entry.after_value || "",
    entry.ip_address || "",
    entry.prev_hash || "GENESIS",
    entry.is_confidential ? "1" : "0"
  ].join("||");
}
async function computeAuditEntryHash(entry) {
  const payload = buildAuditPayload(entry);
  return sha256Hex(payload);
}
async function verifyAuditLogIntegrity(entries, checkpoint) {
  if (entries.length === 0) {
    if (checkpoint && checkpoint.count > 0) {
      return {
        isValid: false,
        totalEntries: 0,
        verifiedEntries: 0,
        brokenReason: "\u0639\u062F\u0645 \u062A\u0637\u0627\u0628\u0642 \u0645\u0639 \u0646\u0642\u0637\u0629 \u0627\u0644\u062A\u062D\u0642\u0642: \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0644\u0627 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0633\u062C\u0644\u0627\u062A \u062A\u062F\u0642\u064A\u0642 \u0628\u0627\u0644\u0631\u063A\u0645 \u0645\u0646 \u062A\u0633\u062C\u064A\u0644 \u0646\u0642\u0637\u0629 \u062A\u062D\u0642\u0642"
      };
    }
    return { isValid: true, totalEntries: 0, verifiedEntries: 0 };
  }
  const sorted = [...entries].sort((a, b) => {
    if (a.seq !== void 0 && b.seq !== void 0) {
      return a.seq - b.seq;
    }
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  if (checkpoint && checkpoint.count !== void 0 && checkpoint.count !== sorted.length) {
    return {
      isValid: false,
      totalEntries: sorted.length,
      verifiedEntries: 0,
      brokenReason: `\u0639\u062F\u0645 \u062A\u0637\u0627\u0628\u0642 \u0641\u064A \u0625\u062C\u0645\u0627\u0644\u064A \u0639\u062F\u062F \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u0645\u0639 \u0646\u0642\u0637\u0629 \u0627\u0644\u062A\u062D\u0642\u0642: \u0627\u0644\u0645\u062A\u0648\u0642\u0639 ${checkpoint.count}\u060C \u0627\u0644\u0641\u0639\u0644\u064A ${sorted.length} (\u062A\u0645 \u0627\u0643\u062A\u0634\u0627\u0641 \u062D\u0630\u0641 \u0633\u062C\u0644\u0627\u062A)`
    };
  }
  if (checkpoint && checkpoint.count > 0 && sorted[0].seq !== void 0 && sorted[0].seq !== 1) {
    return {
      isValid: false,
      totalEntries: sorted.length,
      verifiedEntries: 0,
      brokenEntryId: sorted[0].id,
      brokenReason: `\u062A\u0645 \u0627\u0643\u062A\u0634\u0627\u0641 \u062D\u0630\u0641 \u0623\u0642\u062F\u0645 \u0627\u0644\u0633\u062C\u0644\u0627\u062A: \u0627\u0644\u062A\u0633\u0644\u0633\u0644 \u064A\u0628\u062F\u0623 \u0645\u0646 ${sorted[0].seq} \u0628\u062F\u0644\u0627\u064B \u0645\u0646 1`
    };
  }
  let expectedPrevHash = GENESIS_BLOCK_HASH;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (!entry.entry_hash || entry.entry_hash.trim() === "") {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: i,
        brokenEntryId: entry.id,
        brokenReason: `\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0633\u062C\u0644 [${entry.id}] \u0645\u0641\u0642\u0648\u062F \u0623\u0648 \u0641\u0627\u0631\u063A`
      };
    }
    if (i === 0) {
      if (entry.prev_hash !== GENESIS_BLOCK_HASH) {
        return {
          isValid: false,
          totalEntries: sorted.length,
          verifiedEntries: 0,
          brokenEntryId: entry.id,
          brokenReason: `\u0627\u0646\u0642\u0637\u0627\u0639 \u0641\u064A \u0623\u0635\u0644 \u0627\u0644\u0633\u062C\u0644: \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0623\u0648\u0644 [${entry.id}] \u0644\u0627 \u064A\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u0647\u0627\u0634 \u0627\u0644\u0623\u0648\u0644\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F`
        };
      }
    } else {
      if (entry.prev_hash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntries: sorted.length,
          verifiedEntries: i,
          brokenEntryId: entry.id,
          brokenReason: `\u0627\u0646\u0642\u0637\u0627\u0639 \u0641\u064A \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0647\u0627\u0634: \u0627\u0644\u0633\u062C\u0644 [${entry.id}] \u0644\u0627 \u064A\u0631\u062A\u0628\u0637 \u0628\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0633\u0627\u0628\u0642 [${sorted[i - 1].id}]`
        };
      }
    }
    const computedHash = await computeAuditEntryHash(entry);
    if (entry.entry_hash !== computedHash) {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: i,
        brokenEntryId: entry.id,
        brokenReason: `\u062A\u0644\u0627\u0639\u0628 \u0641\u064A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u062C\u0644 [${entry.id}]: \u0627\u0644\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u062D\u0641\u0648\u0638 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0641\u0639\u0644\u064A \u0627\u0644\u0645\u062D\u0633\u0648\u0628`
      };
    }
    expectedPrevHash = entry.entry_hash;
  }
  if (checkpoint && sorted.length > 0) {
    const lastEntry = sorted[sorted.length - 1];
    if (checkpoint.last_seq !== void 0 && lastEntry.seq !== void 0 && checkpoint.last_seq !== lastEntry.seq) {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: sorted.length - 1,
        brokenReason: `\u0639\u062F\u0645 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u062A\u0633\u0644\u0633\u0644 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u0639 \u0646\u0642\u0637\u0629 \u0627\u0644\u062A\u062D\u0642\u0642: \u0627\u0644\u0645\u062A\u0648\u0642\u0639 ${checkpoint.last_seq}\u060C \u0627\u0644\u0641\u0639\u0644\u064A ${lastEntry.seq} (\u062A\u0645 \u0627\u0643\u062A\u0634\u0627\u0641 \u062D\u0630\u0641 \u0623\u062D\u062F\u062B \u0627\u0644\u0633\u062C\u0644\u0627\u062A)`
      };
    }
    if (checkpoint.head_hash && checkpoint.head_hash !== lastEntry.entry_hash) {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: sorted.length - 1,
        brokenReason: `\u0639\u062F\u0645 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u0647\u0627\u0634 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u0639 \u0646\u0642\u0637\u0629 \u0627\u0644\u062A\u062D\u0642\u0642: \u0627\u0644\u0645\u062A\u0648\u0642\u0639 ${checkpoint.head_hash}\u060C \u0627\u0644\u0641\u0639\u0644\u064A ${lastEntry.entry_hash} (\u062A\u0645 \u0627\u0643\u062A\u0634\u0627\u0641 \u062D\u0630\u0641 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0623\u062D\u062F\u062B \u0627\u0644\u0633\u062C\u0644\u0627\u062A)`
      };
    }
  }
  return {
    isValid: true,
    totalEntries: sorted.length,
    verifiedEntries: sorted.length
  };
}
var GENESIS_BLOCK_HASH;
var init_cryptoUtils = __esm({
  "src/domain/security/cryptoUtils.ts"() {
    GENESIS_BLOCK_HASH = "GENESIS-BLOCK-00000000000000000000000000000000";
  }
});

// src/server/start.ts
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath } from "url";

// src/server/app.ts
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// src/server/services/session.service.ts
import crypto3 from "crypto";

// src/data/database/sqliteEngine.ts
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as crypto2 from "crypto";

// src/data/database/schema.sql.ts
var SCHEMA_SQL = `
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
  SELECT RAISE(ABORT, '\u0633\u062C\u0644 \u0627\u0644\u0631\u0642\u0627\u0628\u0629 \u0648\u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u063A\u064A\u0631 \u0642\u0627\u0628\u0644 \u0644\u0644\u062A\u0639\u062F\u064A\u0644 \u0646\u0647\u0627\u0626\u064A\u0627\u064B');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_log_prevent_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, '\u0633\u062C\u0644 \u0627\u0644\u0631\u0642\u0627\u0628\u0629 \u0648\u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u063A\u064A\u0631 \u0642\u0627\u0628\u0644 \u0644\u0644\u062D\u0630\u0641 \u0646\u0647\u0627\u0626\u064A\u0627\u064B');
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

// src/data/database/seedData.ts
var INITIAL_USERS = [
  {
    id: "usr-chairman",
    username: "chairman",
    name: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    title: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0642\u0648\u0645\u064A\u0629 \u0644\u0644\u0628\u0631\u064A\u062F",
    department_id: "dept-exec",
    email: "chairman@postal.internal",
    role: "CHAIRMAN",
    can_view_confidential: 1,
    password_hash: "6b496f7140d1cb0e808921d990d78bdf17dc74da9261d8a83bea08e342ba281b",
    password_salt: "a1b2c3d4e5f6789012345678abcdef01",
    must_change_password: 0,
    avatar: "chairman_avatar",
    created_at: "2026-01-01T08:00:00Z"
  },
  {
    id: "usr-secretary",
    username: "secretary",
    name: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644",
    title: "\u0633\u0643\u0631\u062A\u064A\u0631 \u0623\u0648\u0644 \u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    department_id: "dept-exec",
    email: "secretary@postal.internal",
    role: "SECRETARY",
    can_view_confidential: 1,
    password_hash: "d618d4152dae85a40139d99b28f12c8fa84734dfc5f41a23f0e03cfc96fd4246",
    password_salt: "b2c3d4e5f6a1789012345678abcdef02",
    must_change_password: 1,
    avatar: "secretary_avatar",
    created_at: "2026-01-01T08:00:00Z"
  },
  {
    id: "usr-admin",
    username: "admin",
    name: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0645 \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    title: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0645 \u0648\u0627\u0644\u0634\u0628\u0643\u0627\u062A",
    department_id: "dept-it",
    email: "admin@postal.internal",
    role: "ADMIN",
    can_view_confidential: 0,
    password_hash: "f7e71e6b4a9d5a0c0d397f9949d1d35398a8930d3a30cb9f801047e6ddd4c1e3",
    password_salt: "c3d4e5f6a1b2789012345678abcdef03",
    must_change_password: 0,
    avatar: "admin_avatar",
    created_at: "2026-01-01T08:00:00Z"
  }
];
var INITIAL_DEPARTMENTS = [
  { id: "dept-exec", name: "\u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629", code: "EXC", head_title: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629", is_active: 1 },
  { id: "dept-ops", name: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629", code: "OPS", head_title: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A", is_active: 1 },
  { id: "dept-fin", name: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u0648\u0641\u064A\u0631 \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629", code: "FIN", head_title: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062A\u0648\u0641\u064A\u0631", is_active: 1 },
  { id: "dept-tech", name: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u062D\u0648\u0644 \u0627\u0644\u0631\u0642\u0645\u064A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A", code: "ICT", head_title: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A", is_active: 1 },
  { id: "dept-legal", name: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u062A\u062D\u0642\u064A\u0642\u0627\u062A", code: "LEG", head_title: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", is_active: 1 },
  { id: "dept-sec", name: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0623\u0645\u0646 \u0648\u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u0623\u0635\u0648\u0644", code: "SEC", head_title: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0623\u0645\u0646", is_active: 1 },
  { id: "dept-prop", name: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0648\u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629", code: "ENG", head_title: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0648\u0627\u0644\u0647\u0646\u062F\u0633\u064A", is_active: 1 }
];
var INITIAL_MATTERS = [
  {
    id: "matter-001",
    code: "MATTER-2026-001",
    title: "\u062A\u0637\u0648\u064A\u0631 \u0634\u0628\u0643\u0629 \u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0631\u064A\u0641\u064A\u0629 \u0636\u0645\u0646 \u0645\u0628\u0627\u062F\u0631\u0629 \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629",
    description: "\u062E\u0637\u0629 \u0634\u0627\u0645\u0644\u0629 \u0644\u0631\u0641\u0639 \u0643\u0641\u0627\u0621\u0629 450 \u0645\u0643\u062A\u0628 \u0628\u0631\u064A\u062F \u0628\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0627\u062A \u0648\u062A\u062C\u0647\u064A\u0632\u0647\u0627 \u0628\u0623\u062D\u062F\u062B \u0627\u0644\u062A\u0642\u0646\u064A\u0627\u062A \u0648\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A \u0648\u0634\u0628\u0643\u0627\u062A \u0627\u0644\u0623\u0644\u064A\u0627\u0641 \u0627\u0644\u0636\u0648\u0626\u064A\u0629.",
    confidentiality: "normal",
    status: "active",
    lead_entity: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629 \u0648\u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A",
    priority: "top_urgent",
    created_at: "2026-01-10T09:00:00Z",
    updated_at: "2026-09-20T11:00:00Z",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  },
  {
    id: "matter-002",
    code: "MATTER-2026-002",
    title: "\u0645\u0646\u0638\u0648\u0645\u0629 \u0627\u0644\u062F\u0641\u0639 \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0627\u0644\u062C\u0647\u0627\u062A \u0627\u0644\u062D\u0643\u0648\u0645\u064A\u0629",
    description: "\u062A\u0648\u0633\u064A\u0639 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0644\u0645\u0646\u0638\u0648\u0645\u0629 \u0645\u064A\u0643\u0646\u0629 \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A \u0645\u0639 \u0645\u0635\u0644\u062D\u0629 \u0627\u0644\u0636\u0631\u0627\u0626\u0628 \u0648\u0627\u0644\u062C\u0645\u0627\u0631\u0643 \u0648\u0627\u0644\u062A\u0648\u0633\u0639 \u0641\u064A \u0628\u0648\u0627\u0628\u0629 \u062F\u0641\u0639 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0635\u0631\u064A.",
    confidentiality: "normal",
    status: "active",
    lead_entity: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u0648\u0641\u064A\u0631 \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    priority: "urgent",
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-09-15T14:30:00Z",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  },
  {
    id: "matter-003",
    code: "MATTER-2026-003",
    title: "\u0645\u0634\u0631\u0648\u0639 \u0623\u062A\u0645\u062A\u0629 \u0645\u0643\u0627\u062A\u0628 \u0635\u0631\u0641 \u0627\u0644\u0645\u0639\u0627\u0634\u0627\u062A \u0648\u0627\u0644\u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0631\u0642\u0645\u064A\u0629 (\u064A\u0644\u0627 \u0643\u0627\u0631\u062F)",
    description: "\u0625\u0637\u0644\u0627\u0642 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0645\u0637\u0648\u0631\u0629 \u0645\u0646 \u062A\u0637\u0628\u064A\u0642 \u064A\u0644\u0627 \u0643\u0627\u0631\u062F \u0648\u062D\u0644\u0648\u0644 \u0627\u0644\u0635\u0631\u0641 \u0627\u0644\u0644\u0627\u062A\u0644\u0627\u0645\u0633\u064A \u0644\u0643\u0628\u0627\u0631 \u0627\u0644\u0633\u0646 \u0648\u062A\u0633\u0647\u064A\u0644 \u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062A\u0648\u0643\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0641\u064A\u0629.",
    confidentiality: "normal",
    status: "active",
    lead_entity: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u062D\u0648\u0644 \u0627\u0644\u0631\u0642\u0645\u064A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    priority: "urgent",
    created_at: "2026-03-05T08:30:00Z",
    updated_at: "2026-09-28T16:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "matter-004",
    code: "MATTER-2026-004",
    title: "\u062A\u0637\u0648\u064A\u0631 \u0627\u0644\u0628\u0646\u064A\u0629 \u0627\u0644\u0623\u0645\u0646\u064A\u0629 \u0627\u0644\u0645\u0634\u062F\u062F\u0629 \u0644\u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u062A\u0628\u0627\u062F\u0644 \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A \u0648\u0627\u0644\u0637\u0631\u0648\u062F \u0627\u0644\u0633\u0631\u064A\u0639\u0629",
    description: "\u062A\u0631\u0643\u064A\u0628 \u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u0645\u062A\u0642\u062F\u0645\u0629 \u0628\u0623\u0634\u0639\u0629 \u0625\u0643\u0633 \u0648\u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0623\u0645\u0646\u064A \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0648\u062A\u0623\u0645\u064A\u0646 \u0634\u062D\u0646\u0627\u062A \u0627\u0644\u062A\u062C\u0627\u0631\u0629 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0627\u0644\u0639\u0627\u0628\u0631\u0629.",
    confidentiality: "confidential",
    status: "active",
    lead_entity: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0623\u0645\u0646 \u0648\u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u0623\u0635\u0648\u0644",
    priority: "top_urgent",
    created_at: "2026-04-12T11:00:00Z",
    updated_at: "2026-09-29T10:15:00Z",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  },
  {
    id: "matter-005",
    code: "MATTER-2026-005",
    title: "\u0645\u0634\u0631\u0648\u0639 \u0623\u0631\u0634\u0641\u0629 \u0648\u0631\u0642\u0645\u0646\u0629 \u0627\u0644\u0648\u062B\u0627\u0626\u0642 \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629 \u0648\u0645\u062A\u062D\u0641 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0635\u0631\u064A \u0628\u0645\u064A\u062F\u0627\u0646 \u0627\u0644\u0639\u062A\u0628\u0629",
    description: "\u062A\u0631\u0645\u064A\u0645 \u0648\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0637\u0648\u0627\u0628\u0639 \u0627\u0644\u062A\u0630\u0643\u0627\u0631\u064A\u0629 \u0648\u0627\u0644\u0645\u0631\u0627\u0633\u0644\u0627\u062A \u0627\u0644\u062E\u062F\u064A\u0648\u064A\u0629 \u0648\u0627\u0644\u0648\u062B\u0627\u0626\u0642 \u0627\u0644\u0646\u0627\u062F\u0631\u0629 \u0644\u0625\u0646\u0634\u0627\u0621 \u0623\u0631\u0634\u064A\u0641 \u0631\u0642\u0645\u064A \u0645\u062A\u0627\u062D \u0644\u0644\u0628\u0627\u062D\u062B\u064A\u0646.",
    confidentiality: "normal",
    status: "under_review",
    lead_entity: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0639\u0644\u0627\u0642\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u062A\u0648\u062B\u064A\u0642",
    priority: "normal",
    created_at: "2026-05-18T12:00:00Z",
    updated_at: "2026-08-30T13:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  }
];
var INITIAL_MEETINGS = [
  {
    id: "meet-001",
    title: "\u062C\u0644\u0633\u0629 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062F\u0648\u0631\u064A\u0629 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u062B\u0627\u0644\u062B 2026",
    location: "\u0642\u0627\u0639\u0629 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 - \u0645\u0628\u0646\u0649 \u0627\u0644\u0647\u064A\u0626\u0629 \u0628\u0627\u0644\u0642\u0631\u064A\u0629 \u0627\u0644\u0630\u0643\u064A\u0629",
    start_time: "2026-10-05T10:00:00",
    end_time: "2026-10-05T13:00:00",
    meeting_type: "board",
    status: "confirmed",
    matter_id: "matter-001",
    confidentiality: "normal",
    notes: "\u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062E\u062A\u0627\u0645\u064A \u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629 \u0648\u0645\u0639\u062F\u0644\u0627\u062A \u0625\u0646\u062C\u0627\u0632 \u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062B\u0627\u0646\u064A\u0629.",
    created_at: "2026-09-25T08:00:00Z",
    updated_at: "2026-09-25T08:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "meet-002",
    title: "\u0627\u062C\u062A\u0645\u0627\u0639 \u062A\u0646\u0633\u064A\u0642\u064A \u0645\u0639 \u0642\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A \u062D\u0648\u0644 \u0645\u0646\u0638\u0648\u0645\u0629 \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A \u0627\u0644\u0644\u062D\u0638\u064A\u0629",
    location: "\u0645\u0642\u0631 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A - \u0634\u0627\u0631\u0639 \u0627\u0644\u062C\u0645\u0647\u0648\u0631\u064A\u0629\u060C \u0627\u0644\u0642\u0627\u0647\u0631\u0629",
    start_time: "2026-10-06T11:00:00",
    end_time: "2026-10-06T12:30:00",
    meeting_type: "external_entity",
    status: "confirmed",
    matter_id: "matter-002",
    confidentiality: "confidential",
    notes: "\u0645\u0646\u0627\u0642\u0634\u0629 \u062A\u0641\u0639\u064A\u0644 \u062A\u062D\u0648\u064A\u0644\u0627\u062A \u0625\u0646\u0633\u062A\u0627\u0628\u0627\u064A \u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u062A\u0648\u0641\u064A\u0631 \u0627\u0644\u062C\u0627\u0631\u064A\u0629 \u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0628\u0631\u064A\u062F.",
    created_at: "2026-09-26T09:30:00Z",
    updated_at: "2026-09-26T09:30:00Z",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  },
  {
    id: "meet-003",
    title: "\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0635\u0631\u0641 \u0645\u0639\u0627\u0634\u0627\u062A \u0634\u0647\u0631 \u0646\u0648\u0641\u0645\u0628\u0631 \u0648\u0645\u0648\u0642\u0641 \u0645\u0627\u0643\u064A\u0646\u0627\u062A \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A",
    location: "\u0642\u0627\u0639\u0629 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0643\u0648\u0646\u0641\u0631\u0627\u0646\u0633 - \u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0631\u0627\u0628\u0639",
    start_time: "2026-10-07T09:00:00",
    end_time: "2026-10-07T10:30:00",
    meeting_type: "internal",
    status: "scheduled",
    matter_id: "matter-003",
    confidentiality: "normal",
    notes: "\u062D\u0636\u0648\u0631 \u0645\u062F\u064A\u0631\u064A \u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0628\u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0627\u0644\u0643\u0628\u0631\u0649 \u0648\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629.",
    created_at: "2026-09-28T10:00:00Z",
    updated_at: "2026-09-28T10:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "meet-004",
    title: "\u0627\u062C\u062A\u0645\u0627\u0639 \u0645\u063A\u0644\u0642 \u0645\u0639 \u0642\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0645\u0646 \u0627\u0644\u0642\u0648\u0645\u064A \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u062C\u0646\u0627\u0626\u064A \u0644\u0644\u0645\u0631\u0627\u0633\u0644\u0627\u062A",
    location: "\u0627\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u0631\u0626\u0627\u0633\u064A \u0627\u0644\u0645\u063A\u0644\u0642 - \u0645\u0642\u0631 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629",
    start_time: "2026-10-08T13:00:00",
    end_time: "2026-10-08T14:30:00",
    meeting_type: "ministerial",
    status: "confirmed",
    matter_id: "matter-004",
    confidentiality: "top_secret",
    notes: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0625\u062C\u0631\u0627\u0621\u0627\u062A \u062A\u062A\u0628\u0639 \u0627\u0644\u0634\u062D\u0646\u0627\u062A \u0627\u0644\u062F\u0648\u0644\u064A\u0629 \u0648\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u062E\u0627\u0636\u0639\u0629 \u0644\u0644\u0631\u0642\u0627\u0628\u0629 \u0627\u0644\u0646\u0648\u0639\u064A\u0629.",
    created_at: "2026-09-29T14:00:00Z",
    updated_at: "2026-09-29T14:00:00Z",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  },
  {
    id: "meet-005",
    title: "\u0639\u0631\u0636 \u0627\u0644\u0645\u0642\u062A\u0631\u062D\u0627\u062A \u0627\u0644\u0645\u0639\u0645\u0627\u0631\u064A\u0629 \u0644\u062A\u0631\u0645\u064A\u0645 \u0645\u0628\u0646\u0649 \u0628\u0631\u064A\u062F \u0627\u0644\u0639\u062A\u0628\u0629 \u0648\u0645\u062A\u062D\u0641 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A",
    location: "\u0642\u0627\u0639\u0629 \u0627\u0644\u0634\u0631\u0641 - \u0645\u0628\u0646\u0649 \u0628\u0631\u064A\u062F \u0627\u0644\u0639\u062A\u0628\u0629 \u0627\u0644\u062A\u0631\u0627\u062B\u064A",
    start_time: "2026-10-11T11:00:00",
    end_time: "2026-10-11T13:00:00",
    meeting_type: "internal",
    status: "scheduled",
    matter_id: "matter-005",
    confidentiality: "normal",
    notes: "\u0628\u062D\u0636\u0648\u0631 \u0627\u0633\u062A\u0634\u0627\u0631\u064A\u064A \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0642\u0648\u0645\u064A \u0644\u0644\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u062D\u0636\u0627\u0631\u064A \u0648\u0623\u0633\u0627\u062A\u0630\u0629 \u0627\u0644\u0622\u062B\u0627\u0631 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A\u0629.",
    created_at: "2026-09-30T11:00:00Z",
    updated_at: "2026-09-30T11:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "meet-006",
    title: "\u0627\u062C\u062A\u0645\u0627\u0639 \u062F\u0648\u0631\u064A \u0645\u0639 \u0645\u0633\u0624\u0648\u0644\u064A \u0634\u0631\u0643\u0629 \u0627\u0644\u0628\u0631\u064A\u062F \u0644\u0644\u062A\u0648\u0632\u064A\u0639 \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629",
    location: "\u0642\u0627\u0639\u0629 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0627\u0644\u0635\u063A\u0631\u0649 (\u0628) - \u0627\u0644\u0642\u0631\u064A\u0629 \u0627\u0644\u0630\u0643\u064A\u0629",
    start_time: "2026-10-12T10:00:00",
    end_time: "2026-10-12T11:30:00",
    meeting_type: "internal",
    status: "scheduled",
    matter_id: "matter-001",
    confidentiality: "normal",
    notes: '\u0645\u0631\u0627\u062C\u0639\u0629 \u0632\u0645\u0646 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0642\u064A\u0627\u0633\u064A \u0644\u062E\u062F\u0645\u0629 "\u0625\u0643\u0633\u0628\u0631\u064A\u0633" \u0628\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0627\u062A \u0627\u0644\u062D\u062F\u0648\u062F\u064A\u0629.',
    created_at: "2026-10-01T08:30:00Z",
    updated_at: "2026-10-01T08:30:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "meet-007",
    title: "\u0645\u0631\u0627\u062C\u0639\u0629 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u0644\u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0639\u0646 \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0646\u0635\u0641 \u0627\u0644\u0633\u0646\u0648\u064A\u0629",
    location: "\u0642\u0627\u0639\u0629 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 - \u0627\u0644\u0642\u0631\u064A\u0629 \u0627\u0644\u0630\u0643\u064A\u0629",
    start_time: "2026-10-13T12:00:00",
    end_time: "2026-10-13T14:00:00",
    meeting_type: "internal",
    status: "scheduled",
    matter_id: "matter-002",
    confidentiality: "confidential",
    notes: "\u0628\u062D\u0636\u0648\u0631 \u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629.",
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T09:00:00Z",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  },
  {
    id: "meet-008",
    title: "\u062C\u0644\u0633\u0629 \u0627\u0639\u062A\u0645\u0627\u062F \u0645\u062D\u0627\u0636\u0631 \u0644\u062C\u0627\u0646 \u0641\u0636 \u0627\u0644\u0645\u0638\u0627\u0631\u064A\u0641 \u0627\u0644\u0641\u0646\u064A\u0629 \u0644\u0645\u0634\u0631\u0648\u0639 \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A \u0627\u0644\u062C\u062F\u064A\u062F\u0629",
    location: "\u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    start_time: "2026-10-14T09:30:00",
    end_time: "2026-10-14T11:00:00",
    meeting_type: "internal",
    status: "scheduled",
    matter_id: "matter-001",
    confidentiality: "normal",
    notes: "\u062A\u0648\u0642\u064A\u0639 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0625\u0633\u0646\u0627\u062F \u0644\u062A\u0648\u0631\u064A\u062F 300 \u0645\u0627\u0643\u064A\u0646\u0629 \u0635\u0631\u0627\u0641 \u062D\u062F\u064A\u062B\u0629.",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "meet-009",
    title: "\u0645\u0628\u0627\u062D\u062B\u0627\u062A \u062B\u0646\u0627\u0626\u064A\u0629 \u0645\u0639 \u0648\u0641\u062F \u0627\u062A\u062D\u0627\u062F \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0641\u0631\u064A\u0642\u064A \u0644\u062A\u0639\u0632\u064A\u0632 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A",
    location: "\u0642\u0627\u0639\u0629 \u0643\u0628\u0627\u0631 \u0627\u0644\u0632\u0648\u0627\u0631 - \u0641\u0646\u062F\u0642 \u0627\u0644\u0645\u0627\u0633\u0629 \u0643\u0627\u0628\u064A\u062A\u0627\u0644\u060C \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629",
    start_time: "2026-10-15T11:00:00",
    end_time: "2026-10-15T13:00:00",
    meeting_type: "external_entity",
    status: "confirmed",
    matter_id: "matter-001",
    confidentiality: "normal",
    notes: "\u062A\u0648\u0642\u064A\u0639 \u0645\u0630\u0643\u0631\u0629 \u062A\u0641\u0627\u0647\u0645 \u0644\u062A\u0628\u0627\u062F\u0644 \u0627\u0644\u0628\u0639\u0627\u0626\u062B \u0627\u0644\u0633\u0631\u064A\u0639\u0629 \u0628\u064A\u0646 \u0645\u0635\u0631 \u0648\u062F\u0648\u0644 \u062D\u0648\u0636 \u0627\u0644\u0646\u064A\u0644.",
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  },
  {
    id: "meet-010",
    title: "\u0648\u0631\u0634\u0629 \u0639\u0645\u0644 \u062D\u0648\u0644 \u062A\u062D\u062F\u064A\u062B \u0644\u0627\u0626\u062D\u0629 \u0627\u0644\u0645\u0648\u0627\u0631\u062F \u0627\u0644\u0628\u0634\u0631\u064A\u0629 \u0648\u0627\u0644\u062D\u0648\u0627\u0641\u0632 \u0627\u0644\u062A\u0634\u062C\u064A\u0639\u064A\u0629 \u0644\u0645\u0648\u0632\u0639\u064A \u0627\u0644\u0628\u0631\u064A\u062F",
    location: "\u0645\u0631\u0643\u0632 \u062A\u062F\u0631\u064A\u0628 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0635\u0631\u064A - \u0627\u0644\u062C\u064A\u0632\u0629",
    start_time: "2026-10-18T10:00:00",
    end_time: "2026-10-18T12:30:00",
    meeting_type: "internal",
    status: "scheduled",
    matter_id: null,
    confidentiality: "normal",
    notes: "\u0645\u0646\u0627\u0642\u0634\u0629 \u0645\u0646\u0638\u0648\u0645\u0629 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0623\u062F\u0627\u0621 \u0648\u0631\u0628\u0637 \u0627\u0644\u062D\u0648\u0627\u0641\u0632 \u0628\u0631\u0636\u0627 \u0627\u0644\u0639\u0645\u0644\u0627\u0621.",
    created_at: "2026-10-02T08:00:00Z",
    updated_at: "2026-10-02T08:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  }
];
var INITIAL_CORRESPONDENCE = [
  // 12 Incoming letters
  {
    id: "corr-in-001",
    serial_number: "IN-2026-0001",
    type: "incoming",
    date: "2026-09-28",
    source_or_dest_entity: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A - \u0645\u0643\u062A\u0628 \u0627\u0644\u0648\u0632\u064A\u0631",
    subject: "\u0637\u0644\u0628 \u0625\u0641\u0627\u062F\u0629 \u062D\u0648\u0644 \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0632\u0645\u0646\u064A \u0644\u062A\u0634\u063A\u064A\u0644 \u0645\u0643\u0627\u062A\u0628 \u0628\u0631\u064A\u062F \u0642\u0631\u0649 \u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0645\u0646 \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629 \u0628\u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0646\u064A\u0627",
    priority: "top_urgent",
    confidentiality: "normal",
    summary: "\u062E\u0637\u0627\u0628 \u0648\u0632\u0627\u0631\u064A \u064A\u0637\u0644\u0628 \u062A\u0642\u0631\u064A\u0631\u0627\u064B \u062A\u0641\u0635\u064A\u0644\u064A\u0627\u064B \u0645\u0639\u062A\u0645\u062F\u0627\u064B \u0639\u0646 \u0645\u0648\u0642\u0641 42 \u0645\u0643\u062A\u0628 \u0628\u0631\u064A\u062F \u0628\u0642\u0631\u0649 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0646\u064A\u0627 \u0642\u0628\u0644 \u0645\u0648\u0639\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D \u0627\u0644\u0631\u0626\u0627\u0633\u064A.",
    status: "presented_to_chairman",
    matter_id: "matter-001",
    created_at: "2026-09-28T09:15:00Z",
    updated_at: "2026-09-29T10:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-002",
    serial_number: "IN-2026-0002",
    type: "incoming",
    date: "2026-09-28",
    source_or_dest_entity: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A - \u0642\u0637\u0627\u0639 \u0646\u0638\u0645 \u0627\u0644\u062F\u0641\u0639 \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    subject: "\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u0628\u062F\u0626\u064A\u0629 \u0639\u0644\u0649 \u0631\u0628\u0637 \u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0628\u0645\u0646\u0638\u0648\u0645\u0629 \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A \u0627\u0644\u0644\u062D\u0638\u064A\u0629 \u0625\u0646\u0633\u062A\u0627\u0628\u0627\u064A",
    priority: "urgent",
    confidentiality: "confidential",
    summary: "\u0625\u062E\u0637\u0627\u0631 \u0628\u0627\u0644\u0636\u0648\u0627\u0628\u0637 \u0627\u0644\u0631\u0642\u0627\u0628\u064A\u0629 \u0648\u0645\u062A\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0623\u0645\u0646 \u0627\u0644\u0633\u064A\u0628\u0631\u0627\u0646\u064A \u0627\u0644\u0648\u0627\u062C\u0628 \u0627\u0633\u062A\u064A\u0641\u0627\u0624\u0647\u0627 \u0642\u0628\u0644 \u0625\u0637\u0644\u0627\u0642 \u0627\u0644\u062E\u062F\u0645\u0629 \u0631\u0633\u0645\u064A\u0627\u064B \u0644\u0644\u062C\u0645\u0647\u0648\u0631.",
    status: "approved",
    matter_id: "matter-002",
    created_at: "2026-09-28T11:00:00Z",
    updated_at: "2026-09-29T12:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-003",
    serial_number: "IN-2026-0003",
    type: "incoming",
    date: "2026-09-29",
    source_or_dest_entity: "\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0642\u0648\u0645\u064A\u0629 \u0644\u0644\u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A - \u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0627\u0644\u0647\u064A\u0626\u0629",
    subject: "\u062E\u0637\u0629 \u0635\u0631\u0641 \u0627\u0644\u0645\u0639\u0627\u0634\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u062B\u0646\u0627\u0626\u064A\u0629 \u0648\u0627\u0644\u0632\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0642\u0631\u0631\u0629 \u0644\u0634\u0647\u0631 \u0646\u0648\u0641\u0645\u0628\u0631 2026 \u0639\u0628\u0631 \u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u0628\u0631\u064A\u062F",
    priority: "top_urgent",
    confidentiality: "normal",
    summary: "\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0628\u0634\u0623\u0646 \u062A\u063A\u0630\u064A\u0629 \u0627\u0644\u062E\u0632\u0627\u0626\u0646 \u0627\u0644\u0641\u0631\u0639\u064A\u0629 \u0648\u0645\u0636\u0627\u0639\u0641\u0629 \u0633\u064A\u0648\u0644\u0629 \u0627\u0644\u0635\u0631\u0627\u0641\u0627\u062A \u0627\u0644\u0622\u0644\u064A\u0629 \u0644\u0644\u062A\u0639\u0627\u0645\u0644 \u0645\u0639 \u0623\u0643\u062B\u0631 \u0645\u0646 6 \u0645\u0644\u0627\u064A\u064A\u0646 \u0645\u0648\u0627\u0637\u0646 \u0645\u0633\u062A\u0641\u064A\u062F.",
    status: "referred",
    matter_id: "matter-003",
    created_at: "2026-09-29T08:30:00Z",
    updated_at: "2026-09-29T14:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-004",
    serial_number: "IN-2026-0004",
    type: "incoming",
    date: "2026-09-29",
    source_or_dest_entity: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 - \u0642\u0637\u0627\u0639 \u0627\u0644\u0623\u0645\u0646 \u0627\u0644\u0648\u0637\u0646\u064A",
    subject: "\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u062A\u062F\u0642\u064A\u0642 \u0623\u0645\u0646\u064A \u0645\u0634\u062F\u062F \u062D\u0648\u0644 \u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u0641\u0631\u0632 \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A \u0628\u0645\u0637\u0627\u0631 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0627\u0644\u062F\u0648\u0644\u064A",
    priority: "top_urgent",
    confidentiality: "top_secret",
    summary: "\u062A\u0648\u062C\u064A\u0647\u0627\u062A \u0623\u0645\u0646\u064A\u0629 \u0633\u0631\u064A\u0629 \u062A\u062A\u0639\u0644\u0642 \u0628\u062A\u0631\u0643\u064A\u0628 \u0628\u0648\u0627\u0628\u0627\u062A \u0645\u0633\u062D \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0630\u0643\u064A\u0629 \u0644\u0644\u0634\u062D\u0646\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629 \u0645\u0646 \u0627\u0644\u062E\u0627\u0631\u062C.",
    status: "presented_to_chairman",
    matter_id: "matter-004",
    created_at: "2026-09-29T13:00:00Z",
    updated_at: "2026-09-29T13:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-005",
    serial_number: "IN-2026-0005",
    type: "incoming",
    date: "2026-09-30",
    source_or_dest_entity: "\u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0642\u0648\u0645\u064A \u0644\u0644\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u062D\u0636\u0627\u0631\u064A",
    subject: "\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u062A\u0635\u0645\u064A\u0645\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629 \u0644\u062A\u0631\u0645\u064A\u0645 \u0627\u0644\u0648\u0627\u062C\u0647\u0627\u062A \u0627\u0644\u062A\u0631\u0627\u062B\u064A\u0629 \u0644\u0645\u0628\u0646\u0649 \u0628\u0631\u064A\u062F \u0627\u0644\u0639\u062A\u0628\u0629 \u0627\u0644\u0623\u062B\u0631\u064A",
    priority: "normal",
    confidentiality: "normal",
    summary: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0644\u062C\u0646\u0629 \u0627\u0644\u0641\u0646\u064A\u0629 \u0627\u0644\u062A\u0631\u0627\u062B\u064A\u0629 \u062D\u0648\u0644 \u062F\u0631\u062C\u0627\u062A \u0627\u0644\u0623\u0644\u0648\u0627\u0646 \u0648\u0646\u0648\u0639\u064A\u0629 \u0627\u0644\u0623\u062D\u062C\u0627\u0631 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0629 \u0641\u064A \u0627\u0644\u062A\u0631\u0645\u064A\u0645 \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A.",
    status: "briefing_prepared",
    matter_id: "matter-005",
    created_at: "2026-09-30T09:40:00Z",
    updated_at: "2026-09-30T11:20:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-006",
    serial_number: "IN-2026-0006",
    type: "incoming",
    date: "2026-09-30",
    source_or_dest_entity: "\u0645\u0635\u0644\u062D\u0629 \u0627\u0644\u062C\u0645\u0627\u0631\u0643 \u0627\u0644\u0645\u0635\u0631\u064A\u0629",
    subject: "\u0645\u0642\u062A\u0631\u062D \u062A\u062F\u0634\u064A\u0646 \u0646\u0638\u0627\u0645 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0622\u0644\u064A \u0644\u0644\u0625\u0641\u0631\u0627\u062C \u0627\u0644\u062C\u0645\u0631\u0643\u064A \u0627\u0644\u0641\u0648\u0631\u064A \u0639\u0646 \u0627\u0644\u0637\u0631\u0648\u062F \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0627\u0644\u0633\u0631\u064A\u0639\u0629",
    priority: "urgent",
    confidentiality: "normal",
    summary: "\u0645\u0633\u0648\u062F\u0629 \u0627\u062A\u0641\u0627\u0642\u064A\u0629 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u062F\u0645\u0629 \u0644\u062A\u062E\u0641\u064A\u0636 \u0632\u0645\u0646 \u0627\u0644\u0625\u0641\u0631\u0627\u062C \u0627\u0644\u062C\u0645\u0631\u0643\u064A \u0645\u0646 72 \u0633\u0627\u0639\u0629 \u0625\u0644\u0649 4 \u0633\u0627\u0639\u0627\u062A.",
    status: "registered",
    matter_id: "matter-004",
    created_at: "2026-09-30T12:15:00Z",
    updated_at: "2026-09-30T12:15:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-007",
    serial_number: "IN-2026-0007",
    type: "incoming",
    date: "2026-10-01",
    source_or_dest_entity: "\u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u0644\u0645\u062D\u0627\u0633\u0628\u0627\u062A - \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629 \u0644\u0645\u0631\u0627\u0642\u0628\u0629 \u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    subject: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u0645\u0627\u0644\u064A \u0644\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0627\u0644\u062F\u0648\u0631\u064A\u0629 \u0639\u0646 \u0627\u0644\u0646\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0645\u0646 \u0639\u0627\u0645 2026",
    priority: "urgent",
    confidentiality: "confidential",
    summary: "\u0637\u0644\u0628 \u0625\u064A\u0636\u0627\u062D\u0627\u062A \u0628\u0634\u0623\u0646 \u0623\u0631\u0635\u062F\u0629 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u062C\u0627\u0631\u064A\u0629 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0648\u062A\u0633\u0648\u064A\u0629 \u0641\u0631\u0648\u0642 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0627\u0644\u0623\u062C\u0646\u0628\u064A\u0629.",
    status: "briefing_prepared",
    matter_id: null,
    created_at: "2026-10-01T08:45:00Z",
    updated_at: "2026-10-01T10:30:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-008",
    serial_number: "IN-2026-0008",
    type: "incoming",
    date: "2026-10-01",
    source_or_dest_entity: "\u0645\u062D\u0627\u0641\u0638\u0629 \u0642\u0646\u0627 - \u0645\u0643\u062A\u0628 \u0627\u0644\u0645\u062D\u0627\u0641\u0638",
    subject: "\u0637\u0644\u0628 \u062A\u062E\u0635\u064A\u0635 \u0642\u0637\u0639\u0629 \u0623\u0631\u0636 \u0644\u0625\u0646\u0634\u0627\u0621 \u0645\u0631\u0643\u0632 \u062E\u062F\u0645\u0627\u062A \u0628\u0631\u064A\u062F\u064A\u0629 \u0645\u062A\u0637\u0648\u0631 \u0628\u0645\u062F\u064A\u0646\u0629 \u0642\u0646\u0627 \u0627\u0644\u062C\u062F\u064A\u062F\u0629",
    priority: "normal",
    confidentiality: "normal",
    summary: "\u0639\u0631\u0636 \u062A\u062E\u0635\u064A\u0635 \u0645\u0633\u0627\u062D\u0629 600 \u0645\u062A\u0631 \u0645\u0631\u0628\u0639 \u0628\u0627\u0644\u0645\u062C\u0627\u0646 \u0644\u0625\u0646\u0634\u0627\u0621 \u0645\u062C\u0645\u0639 \u062E\u062F\u0645\u0627\u062A \u0628\u0631\u064A\u062F\u064A \u0648\u062A\u0648\u0641\u064A\u0631\u064A \u0645\u062A\u0643\u0627\u0645\u0644 \u0644\u0644\u0645\u0648\u0627\u0637\u0646\u064A\u0646.",
    status: "registered",
    matter_id: "matter-001",
    created_at: "2026-10-01T11:30:00Z",
    updated_at: "2026-10-01T11:30:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-009",
    serial_number: "IN-2026-0009",
    type: "incoming",
    date: "2026-10-01",
    source_or_dest_entity: "\u0627\u062A\u062D\u0627\u062F \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0639\u0627\u0644\u0645\u064A - \u0628\u064A\u0631\u0646\u060C \u0633\u0648\u064A\u0633\u0631\u0627",
    subject: "\u062F\u0639\u0648\u0629 \u0644\u062D\u0636\u0648\u0631 \u0627\u0644\u0645\u0624\u062A\u0645\u0631 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0627\u0644\u0633\u0646\u0648\u064A \u0644\u062A\u0637\u0648\u064A\u0631 \u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u0625\u0645\u062F\u0627\u062F \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0629",
    priority: "normal",
    confidentiality: "normal",
    summary: "\u062F\u0639\u0648\u0629 \u0645\u0648\u062C\u0647\u0629 \u0644\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0644\u0625\u0644\u0642\u0627\u0621 \u0643\u0644\u0645\u0629 \u0631\u0626\u064A\u0633\u064A\u0629 \u062D\u0648\u0644 \u062A\u062C\u0631\u0628\u0629 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0635\u0631\u064A \u0641\u064A \u0627\u0644\u0634\u0645\u0648\u0644 \u0627\u0644\u0645\u0627\u0644\u064A.",
    status: "presented_to_chairman",
    matter_id: null,
    created_at: "2026-10-01T13:00:00Z",
    updated_at: "2026-10-01T13:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-010",
    serial_number: "IN-2026-0010",
    type: "incoming",
    date: "2026-10-02",
    source_or_dest_entity: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062A\u0636\u0627\u0645\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A - \u0642\u0637\u0627\u0639 \u0627\u0644\u062D\u0645\u0627\u064A\u0629 \u0648\u0627\u0644\u0631\u0639\u0627\u064A\u0629 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A\u0629",
    subject: "\u062A\u062C\u062F\u064A\u062F \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0635\u0631\u0641 \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0627\u062A \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0637\u0629 (\u062A\u0643\u0627\u0641\u0644 \u0648\u0643\u0631\u0627\u0645\u0629) \u0644\u0639\u0627\u0645 2027",
    priority: "top_urgent",
    confidentiality: "normal",
    summary: "\u0645\u0633\u0648\u062F\u0629 \u0627\u0644\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0633\u0646\u0648\u064A \u0627\u0644\u0645\u062A\u0636\u0645\u0646\u0629 \u0632\u064A\u0627\u062F\u0629 \u0646\u0642\u0627\u0637 \u0627\u0644\u0635\u0631\u0641 \u0639\u0628\u0631 \u0633\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u062A\u0646\u0642\u0644\u0629 \u0628\u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0646\u0627\u0626\u064A\u0629.",
    status: "registered",
    matter_id: "matter-003",
    created_at: "2026-10-02T08:15:00Z",
    updated_at: "2026-10-02T08:15:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-011",
    serial_number: "IN-2026-0011",
    type: "incoming",
    date: "2026-10-02",
    source_or_dest_entity: "\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0631\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    subject: "\u0627\u0633\u062A\u064A\u0641\u0627\u0621 \u0627\u0634\u062A\u0631\u0627\u0637\u0627\u062A \u062A\u0631\u062E\u064A\u0635 \u0646\u0634\u0627\u0637 \u0627\u0644\u062A\u0645\u0648\u064A\u0644 \u0645\u062A\u0646\u0627\u0647\u064A \u0627\u0644\u0635\u063A\u0631 \u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0628\u0631\u064A\u062F \u0644\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631",
    priority: "urgent",
    confidentiality: "normal",
    summary: "\u0645\u0637\u0644\u0648\u0628 \u0625\u0631\u0641\u0627\u0642 \u0642\u0631\u0627\u0631 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0628\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0632\u064A\u0627\u062F\u0629 \u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644 \u0627\u0644\u0645\u0631\u062E\u0635 \u0628\u0647.",
    status: "registered",
    matter_id: "matter-002",
    created_at: "2026-10-02T09:30:00Z",
    updated_at: "2026-10-02T09:30:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-in-012",
    serial_number: "IN-2026-0012",
    type: "incoming",
    date: "2026-10-02",
    source_or_dest_entity: "\u0627\u0644\u0645\u062C\u0644\u0633 \u0627\u0644\u0642\u0648\u0645\u064A \u0644\u0644\u0623\u0634\u062E\u0627\u0635 \u0630\u0648\u064A \u0627\u0644\u0625\u0639\u0627\u0642\u0629",
    subject: "\u062A\u0642\u0631\u064A\u0631 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0625\u062A\u0627\u062D\u0629 \u0627\u0644\u0645\u0643\u0627\u0646\u064A\u0629 \u0648\u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0628\u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0637\u0648\u0631\u0629 \u0628\u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0627\u0644\u0643\u0628\u0631\u0649",
    priority: "normal",
    confidentiality: "normal",
    summary: "\u0625\u0634\u0627\u062F\u0629 \u0628\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0645\u0646\u062D\u062F\u0631\u0627\u062A \u0648\u0643\u0627\u0648\u0646\u062A\u0631\u0627\u062A \u062E\u062F\u0645\u0629 \u0630\u0648\u064A \u0627\u0644\u0647\u0645\u0645 \u0648\u062A\u0648\u0635\u064A\u0629 \u0628\u0625\u0636\u0627\u0641\u0629 \u0634\u0627\u0634\u0627\u062A \u0625\u0631\u0634\u0627\u062F\u064A\u0629 \u0628\u0644\u063A\u0629 \u0627\u0644\u0625\u0634\u0627\u0631\u0629.",
    status: "registered",
    matter_id: null,
    created_at: "2026-10-02T10:45:00Z",
    updated_at: "2026-10-02T10:45:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  // 8 Outgoing letters
  {
    id: "corr-out-001",
    serial_number: "OUT-2026-0001",
    type: "outgoing",
    date: "2026-09-27",
    source_or_dest_entity: "\u0645\u0639\u0627\u0644\u064A \u0648\u0632\u064A\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    subject: "\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0634\u0627\u0645\u0644 \u0644\u0645\u0643\u0627\u062A\u0628 \u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0645\u0646 \u0645\u0628\u0627\u062F\u0631\u0629 \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629",
    priority: "top_urgent",
    confidentiality: "normal",
    summary: "\u0625\u062D\u0627\u0637\u0629 \u0645\u0639\u0627\u0644\u064A \u0627\u0644\u0648\u0632\u064A\u0631 \u0628\u062C\u0627\u0647\u0632\u064A\u0629 385 \u0645\u0643\u062A\u0628 \u0628\u0631\u064A\u062F \u0644\u0644\u0627\u0641\u062A\u062A\u0627\u062D \u0627\u0644\u0641\u0639\u0644\u064A \u0648\u0627\u0643\u062A\u0645\u0627\u0644 \u062A\u0631\u0643\u064A\u0628 \u0645\u0627\u0643\u064A\u0646\u0627\u062A \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A \u0628\u0647\u0627.",
    status: "dispatched",
    matter_id: "matter-001",
    created_at: "2026-09-26T11:00:00Z",
    updated_at: "2026-09-27T14:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-out-002",
    serial_number: "OUT-2026-0002",
    type: "outgoing",
    date: "2026-09-28",
    source_or_dest_entity: "\u0627\u0644\u0633\u064A\u062F \u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A",
    subject: "\u0637\u0644\u0628 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0631\u062A\u064A\u0628\u0627\u062A \u0627\u0644\u0641\u0646\u064A\u0629 \u0627\u0644\u0646\u0647\u0627\u0626\u064A\u0629 \u0644\u0625\u0637\u0644\u0627\u0642 \u062E\u062F\u0645\u0629 \u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0648\u0627\u0644\u0633\u062D\u0628 \u0627\u0644\u0644\u062D\u0638\u064A \u0644\u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0631\u064A\u062F",
    priority: "urgent",
    confidentiality: "confidential",
    summary: "\u0625\u0631\u0633\u0627\u0644 \u0646\u062A\u0627\u0626\u062C \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0636\u063A\u0637 \u0627\u0644\u0633\u064A\u0628\u0631\u0627\u0646\u064A \u0627\u0644\u062A\u064A \u0623\u062C\u0631\u062A\u0647\u0627 \u0627\u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u062A\u0627\u0628\u0639\u0629 \u0644\u0644\u0647\u064A\u0626\u0629.",
    status: "dispatched",
    matter_id: "matter-002",
    created_at: "2026-09-27T15:30:00Z",
    updated_at: "2026-09-28T09:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-out-003",
    serial_number: "OUT-2026-0003",
    type: "outgoing",
    date: "2026-09-29",
    source_or_dest_entity: "\u0627\u0644\u0633\u064A\u062F \u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0631\u0626\u064A\u0633 \u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0642\u0648\u0645\u064A\u0629 \u0644\u0644\u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A",
    subject: "\u062E\u0637\u0629 \u062A\u0623\u0645\u064A\u0646 \u0648\u0627\u0646\u062A\u0638\u0627\u0645 \u0633\u064A\u0648\u0644\u0629 \u0635\u0631\u0641 \u0627\u0644\u0645\u0639\u0627\u0634\u0627\u062A \u0628\u0645\u0643\u0627\u062A\u0628 \u0648\u0645\u0631\u0627\u0643\u0632 \u0628\u0631\u064A\u062F \u0627\u0644\u062C\u0645\u0647\u0648\u0631\u064A\u0629",
    priority: "urgent",
    confidentiality: "normal",
    summary: "\u0628\u064A\u0627\u0646 \u0628\u062C\u062F\u0648\u0644 \u0641\u062A\u062D \u0627\u0644\u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u064A\u0648\u0645 \u0627\u0644\u062C\u0645\u0639\u0629 \u0648\u0627\u0644\u0633\u0628\u062A \u0648\u062A\u0648\u0632\u064A\u0639 \u0641\u0631\u0642 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A.",
    status: "dispatched",
    matter_id: "matter-003",
    created_at: "2026-09-29T10:00:00Z",
    updated_at: "2026-09-29T16:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-out-004",
    serial_number: "OUT-2026-0004",
    type: "outgoing",
    date: "2026-09-30",
    source_or_dest_entity: "\u0627\u0644\u0633\u064A\u062F \u0627\u0644\u0645\u0633\u062A\u0634\u0627\u0631 \u0631\u0626\u064A\u0633 \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u0644\u0645\u062D\u0627\u0633\u0628\u0627\u062A",
    subject: "\u0627\u0644\u0631\u062F \u0627\u0644\u0631\u0633\u0645\u064A \u0644\u0644\u0647\u064A\u0626\u0629 \u0639\u0644\u0649 \u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0627\u062A \u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u062D\u0648\u0644 \u0646\u062A\u0627\u0626\u062C \u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0646\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 2026",
    priority: "urgent",
    confidentiality: "confidential",
    summary: "\u0625\u0631\u0641\u0627\u0642 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0627\u0644\u0645\u0624\u064A\u062F\u0629 \u0644\u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A\u0629 \u0648\u0639\u0648\u0627\u0626\u062F \u0635\u0646\u0627\u062F\u064A\u0642 \u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0648\u0627\u0644\u0634\u0647\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629.",
    status: "under_review",
    matter_id: null,
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T14:30:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-out-005",
    serial_number: "OUT-2026-0005",
    type: "outgoing",
    date: "2026-10-01",
    source_or_dest_entity: "\u0627\u0644\u0633\u064A\u062F \u0645\u062D\u0627\u0641\u0638 \u0642\u0646\u0627",
    subject: "\u0634\u0643\u0631 \u0648\u0642\u0628\u0648\u0644 \u062A\u062E\u0635\u064A\u0635 \u0623\u0631\u0636 \u0645\u0631\u0643\u0632 \u062E\u062F\u0645\u0627\u062A \u0628\u0631\u064A\u062F \u0642\u0646\u0627 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0648\u0628\u062F\u0621 \u0627\u0644\u062F\u0631\u0627\u0633\u0627\u062A \u0627\u0644\u0625\u0646\u0634\u0627\u0626\u064A\u0629",
    priority: "normal",
    confidentiality: "normal",
    summary: "\u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0634\u0643\u0631 \u0644\u0633\u064A\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0641\u0638 \u0648\u062A\u0643\u0644\u064A\u0641 \u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629 \u0628\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0645\u0648\u0642\u0639 \u0648\u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0631\u0633\u0648\u0645\u0627\u062A.",
    status: "under_review",
    matter_id: "matter-001",
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T15:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-out-006",
    serial_number: "OUT-2026-0006",
    type: "outgoing",
    date: "2026-10-01",
    source_or_dest_entity: "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0644\u0627\u062A\u062D\u0627\u062F \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0639\u0627\u0644\u0645\u064A - \u0628\u064A\u0631\u0646",
    subject: "\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0631\u0633\u0645\u064A\u0629 \u0644\u0648\u0641\u062F \u062C\u0645\u0647\u0648\u0631\u064A\u0629 \u0645\u0635\u0631 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0628\u0627\u0644\u0645\u0624\u062A\u0645\u0631 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0627\u0644\u0628\u0631\u064A\u062F\u064A \u0627\u0644\u0639\u0627\u0644\u0645\u064A",
    priority: "normal",
    confidentiality: "normal",
    summary: "\u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0648\u0641\u062F \u0627\u0644\u0631\u0633\u0645\u064A \u0628\u0631\u0626\u0627\u0633\u0629 \u0627\u0644\u0633\u064A\u062F \u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0648\u0639\u0646\u0627\u0648\u064A\u0646 \u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0639\u0645\u0644.",
    status: "draft",
    matter_id: null,
    created_at: "2026-10-01T14:00:00Z",
    updated_at: "2026-10-01T14:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-out-007",
    serial_number: "OUT-2026-0007",
    type: "outgoing",
    date: "2026-10-02",
    source_or_dest_entity: "\u0645\u0639\u0627\u0644\u064A \u0648\u0632\u064A\u0631 \u0627\u0644\u062A\u0636\u0627\u0645\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A",
    subject: "\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0645\u0633\u0648\u062F\u0629 \u062A\u062C\u062F\u064A\u062F \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0635\u0631\u0641 \u0645\u0633\u0627\u0639\u062F\u0627\u062A \u062A\u0643\u0627\u0641\u0644 \u0648\u0643\u0631\u0627\u0645\u0629 \u0644\u0644\u0639\u0627\u0645 2027",
    priority: "urgent",
    confidentiality: "normal",
    summary: "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0642\u062A\u0631\u062D\u0627\u062A \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u062A\u0648\u0633\u0639 \u0641\u064A \u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u0635\u0631\u0641 \u0627\u0644\u0645\u062A\u0646\u0642\u0644\u0629 \u0628\u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u062D\u062F\u0648\u062F\u064A\u0629.",
    status: "draft",
    matter_id: "matter-003",
    created_at: "2026-10-02T10:00:00Z",
    updated_at: "2026-10-02T10:00:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  },
  {
    id: "corr-out-008",
    serial_number: "OUT-2026-0008",
    type: "outgoing",
    date: "2026-10-02",
    source_or_dest_entity: "\u0627\u0644\u0633\u064A\u062F \u0631\u0626\u064A\u0633 \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0642\u0648\u0645\u064A \u0644\u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    subject: "\u0637\u0644\u0628 \u062A\u062E\u0635\u064A\u0635 \u062D\u0632\u0645 \u062A\u0631\u062F\u062F\u064A\u0629 \u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u0645\u0646\u0638\u0648\u0645\u0629 \u0627\u0644\u0644\u0627\u0633\u0644\u0643\u064A \u0648\u062A\u062A\u0628\u0639 \u0623\u0633\u0637\u0648\u0644 \u0633\u064A\u0627\u0631\u0627\u062A \u0646\u0642\u0644 \u0627\u0644\u0623\u0645\u0648\u0627\u0644 \u0648\u0627\u0644\u0637\u0631\u0648\u062F",
    priority: "urgent",
    confidentiality: "confidential",
    summary: "\u0645\u0630\u0643\u0631\u0629 \u0631\u0633\u0645\u064A\u0629 \u0628\u0637\u0644\u0628 \u0627\u0644\u062A\u0631\u0627\u062E\u064A\u0635 \u0627\u0644\u0644\u0627\u0632\u0645\u0629 \u0644\u0634\u0628\u0643\u0629 \u0627\u0644\u0644\u0627\u0633\u0644\u0643\u064A \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0627\u0644\u0645\u0634\u0641\u0631\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0627\u0644\u062A\u0627\u0628\u0639\u0629 \u0644\u0644\u0647\u064A\u0626\u0629.",
    status: "draft",
    matter_id: "matter-004",
    created_at: "2026-10-02T11:30:00Z",
    updated_at: "2026-10-02T11:30:00Z",
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644"
  }
];
var INITIAL_BRIEFING_NOTES = [
  {
    id: "brief-001",
    correspondence_id: "corr-in-001",
    background: "\u0648\u0631\u062F \u062E\u0637\u0627\u0628 \u0645\u0639\u0627\u0644\u064A \u0648\u0632\u064A\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0628\u0634\u0623\u0646 \u0627\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0639\u0646 \u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0644\u0640 42 \u0645\u0643\u062A\u0628 \u0628\u0631\u064A\u062F \u0628\u0642\u0631\u0649 \u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0646\u064A\u0627 \u0627\u0644\u0645\u0634\u0645\u0648\u0644\u0629 \u0628\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0644\u0645\u0628\u0627\u062F\u0631\u0629 \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629\u060C \u0648\u0630\u0644\u0643 \u062A\u0645\u0647\u064A\u062F\u0627\u064B \u0644\u0644\u062C\u0648\u0644\u0629 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u0631\u0626\u0627\u0633\u064A\u0629 \u0627\u0644\u0645\u0642\u0631\u0631\u0629 \u062E\u0644\u0627\u0644 \u0634\u0647\u0631 \u0623\u0643\u062A\u0648\u0628\u0631.",
    secretary_recommendation: "\u0646\u0642\u062A\u0631\u062D \u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0628\u0635\u0641\u0629 \u0639\u0627\u062C\u0644\u0629 \u062C\u062F\u0627\u064B \u0625\u0644\u0649 \u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629 \u0648\u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0628\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0645\u0639 \u0645\u0646\u0637\u0642\u0629 \u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0646\u064A\u0627\u060C \u0645\u0639 \u0627\u0644\u062A\u0643\u0644\u064A\u0641 \u0628\u0645\u0648\u0627\u0641\u0627\u0629 \u0645\u0643\u062A\u0628 \u0627\u0644\u0633\u064A\u062F \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0628\u0628\u064A\u0627\u0646 \u062F\u0642\u064A\u0642 \u0628\u062D\u0627\u0644\u0629 \u0627\u0644\u0631\u0628\u0637 \u0648\u062A\u0648\u0627\u0641\u0631 \u0645\u0627\u0643\u064A\u0646\u0627\u062A \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A \u062E\u0644\u0627\u0644 48 \u0633\u0627\u0639\u0629 \u0643\u062D\u062F \u0623\u0642\u0635\u0649.",
    executive_opinion: "\u062A\u0645 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 \u0645\u0646 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0625\u0646\u0634\u0627\u0626\u064A\u0629 \u0641\u064A 39 \u0645\u0643\u062A\u0628\u0627\u064B\u060C \u0648\u064A\u062A\u0628\u0642\u0649 3 \u0645\u0643\u0627\u062A\u0628 \u062C\u0627\u0631\u064D \u0625\u0637\u0644\u0627\u0642 \u0627\u0644\u062A\u064A\u0627\u0631 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0628\u0647\u0627 \u0628\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0645\u0639 \u0634\u0631\u0643\u0629 \u062A\u0648\u0632\u064A\u0639 \u0643\u0647\u0631\u0628\u0627\u0621 \u0645\u0635\u0631 \u0627\u0644\u0648\u0633\u0637\u0649.",
    prepared_by_name: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644",
    prepared_at: "2026-09-28T10:30:00Z"
  },
  {
    id: "brief-002",
    correspondence_id: "corr-in-002",
    background: "\u0625\u0641\u0627\u062F\u0629 \u0631\u0633\u0645\u064A\u0629 \u0645\u0646 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A \u062A\u062A\u0636\u0645\u0646 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0637\u0629 \u0639\u0644\u0649 \u0631\u0628\u0637 \u0627\u0644\u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0644\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0635\u0631\u064A \u0628\u0634\u0628\u0643\u0629 \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A \u0627\u0644\u0644\u062D\u0638\u064A\u0629 \u0648\u0641\u0642 \u0627\u0634\u062A\u0631\u0627\u0637\u0627\u062A \u0627\u0644\u0623\u0645\u0646 \u0627\u0644\u0633\u064A\u0628\u0631\u0627\u0646\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629.",
    secretary_recommendation: "\u064A\u064F\u0648\u0635\u0649 \u0628\u0627\u0639\u062A\u0645\u0627\u062F \u062A\u0634\u0643\u064A\u0644 \u0644\u062C\u0646\u0629 \u0641\u0646\u064A\u0629 \u0645\u0634\u062A\u0631\u0643\u0629 \u0628\u0631\u0626\u0627\u0633\u0629 \u0627\u0644\u0633\u064A\u062F \u0646\u0627\u0626\u0628 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0644\u0644\u062A\u062D\u0648\u0644 \u0627\u0644\u0631\u0642\u0645\u064A \u0644\u0633\u0631\u0639\u0629 \u0625\u0646\u0647\u0627\u0621 \u0645\u062A\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0631\u0628\u0637 \u0648\u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0623\u0645\u0646\u064A\u0629 \u062E\u0644\u0627\u0644 \u0623\u0633\u0628\u0648\u0639\u064A\u0646.",
    executive_opinion: "\u062E\u0637\u0648\u0629 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u0633\u062A\u0632\u064A\u062F \u0645\u0646 \u0627\u0644\u062D\u0635\u0629 \u0627\u0644\u0633\u0648\u0642\u064A\u0629 \u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0635\u0631\u064A \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0628\u0646\u0633\u0628\u0629 \u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 25%.",
    prepared_by_name: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644",
    prepared_at: "2026-09-28T12:00:00Z"
  }
];
var INITIAL_APPROVALS = [
  {
    id: "appr-001",
    correspondence_id: "corr-in-002",
    decision_type: "approved",
    standard_phrase: "\u0645\u0648\u0627\u0641\u0642 \u0645\u0639 \u0633\u0631\u0639\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0648\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0645\u0639 \u0627\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0627\u0644\u064A",
    custom_directive: "\u064A\u064F\u0643\u0644\u0641 \u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0628\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0645\u062A\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0623\u0645\u0646\u064A\u0629 \u0645\u0639 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0648\u0645\u0648\u0627\u0641\u0627\u062A\u064A \u0628\u062A\u0642\u0631\u064A\u0631 \u0623\u0633\u0628\u0648\u0639\u064A \u0645\u0646\u062A\u0638\u0645.",
    decided_at: "2026-09-29T12:10:00Z",
    decided_by_name: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  },
  {
    id: "appr-002",
    correspondence_id: "corr-in-003",
    decision_type: "referred",
    standard_phrase: "\u064A\u062D\u0627\u0644 \u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0644\u0627\u062A\u062E\u0627\u0630 \u0627\u0644\u0644\u0627\u0632\u0645",
    custom_directive: "\u062A\u0634\u0643\u064A\u0644 \u063A\u0631\u0641\u0629 \u0639\u0645\u0644\u064A\u0627\u062A \u0645\u0631\u0643\u0632\u064A\u0629 \u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0633\u064A\u0648\u0644\u0629 \u0627\u0644\u0645\u0643\u0627\u062A\u0628 \u0648\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0645\u0639 \u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A.",
    decided_at: "2026-09-29T14:05:00Z",
    decided_by_name: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  }
];
var INITIAL_DIRECTIVES = [
  {
    id: "dir-001",
    code: "DIR-2026-0001",
    title: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A \u0644\u0640 42 \u0645\u0643\u062A\u0628 \u0628\u0631\u064A\u062F \u0628\u0642\u0631\u0649 \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629 \u0628\u0627\u0644\u0645\u0646\u064A\u0627",
    instruction: "\u0625\u062C\u0631\u0627\u0621 \u0645\u0639\u0627\u064A\u0646\u0629 \u0645\u064A\u062F\u0627\u0646\u064A\u0629 \u0648\u062D\u0635\u0631 \u0634\u0627\u0645\u0644 \u0644\u0644\u062C\u0627\u0647\u0632\u064A\u0629 \u0627\u0644\u0641\u0646\u064A\u0629 \u0648\u0625\u0637\u0644\u0627\u0642 \u0627\u0644\u062A\u064A\u0627\u0631 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0648\u0645\u0627\u0643\u064A\u0646\u0627\u062A ATM \u0648\u0631\u0641\u0639 \u062A\u0642\u0631\u064A\u0631 \u0646\u0647\u0627\u0626\u064A.",
    assigned_department: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0648\u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    assigned_person: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    source_type: "correspondence",
    source_id: "corr-in-001",
    priority: "top_urgent",
    confidentiality: "normal",
    status: "in_progress",
    progress_percent: 75,
    issued_at: "2026-09-29T10:30:00Z",
    due_date: "2026-10-04",
    matter_id: "matter-001",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-01T16:00:00Z"
  },
  {
    id: "dir-002",
    code: "DIR-2026-0002",
    title: "\u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0623\u0645\u0646 \u0627\u0644\u0633\u064A\u0628\u0631\u0627\u0646\u064A \u0644\u0631\u0628\u0637 \u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0631\u064A\u062F \u0628\u0634\u0628\u0643\u0629 \u0625\u0646\u0633\u062A\u0627\u0628\u0627\u064A",
    instruction: "\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0645\u0639 \u0641\u0631\u064A\u0642 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0628\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0648\u0627\u062C\u062A\u064A\u0627\u0632 \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0627\u062E\u062A\u0631\u0627\u0642 \u0648\u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0648\u0638\u064A\u0641\u064A\u0629.",
    assigned_department: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u062D\u0648\u0644 \u0627\u0644\u0631\u0642\u0645\u064A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    assigned_person: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0623\u0645\u0646 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    source_type: "correspondence",
    source_id: "corr-in-002",
    priority: "urgent",
    confidentiality: "confidential",
    status: "in_progress",
    progress_percent: 60,
    issued_at: "2026-09-29T12:30:00Z",
    due_date: "2026-10-15",
    matter_id: "matter-002",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-01T11:00:00Z"
  },
  {
    id: "dir-003",
    code: "DIR-2026-0003",
    title: "\u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u062E\u0632\u0627\u0626\u0646 \u0648\u0645\u0636\u0627\u0639\u0641\u0629 \u0633\u064A\u0648\u0644\u0629 \u0635\u0631\u0641 \u0645\u0639\u0627\u0634\u0627\u062A \u0646\u0648\u0641\u0645\u0628\u0631 \u0628\u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0643\u0628\u0631\u0649",
    instruction: "\u0648\u0636\u0639 \u062E\u0637\u0629 \u062A\u063A\u0630\u064A\u0629 \u0646\u0642\u062F\u064A\u0629 \u0645\u0634\u062F\u062F\u0629 \u0648\u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0645\u0639 \u0634\u0631\u0643\u0627\u062A \u0646\u0642\u0644 \u0627\u0644\u0623\u0645\u0648\u0627\u0644 \u0639\u0644\u0649 \u0645\u062F\u0627\u0631 \u0627\u0644\u0633\u0627\u0639\u0629.",
    assigned_department: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629",
    assigned_person: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A",
    source_type: "correspondence",
    source_id: "corr-in-003",
    priority: "top_urgent",
    confidentiality: "normal",
    status: "assigned",
    progress_percent: 30,
    issued_at: "2026-09-29T14:15:00Z",
    due_date: "2026-10-25",
    matter_id: "matter-003",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-09-29T14:15:00Z"
  },
  {
    id: "dir-004",
    code: "DIR-2026-0004",
    title: "\u062A\u062D\u062F\u064A\u062B \u0643\u0627\u0645\u064A\u0631\u0627\u062A \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u0629 \u0648\u063A\u0631\u0641 \u0627\u0644\u062A\u062D\u0643\u0645 \u0628\u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u062A\u0628\u0627\u062F\u0644 \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A \u0628\u0645\u0637\u0627\u0631 \u0627\u0644\u0642\u0627\u0647\u0631\u0629",
    instruction: "\u0625\u062D\u0644\u0627\u0644 \u0648\u062A\u062C\u062F\u064A\u062F \u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u062A\u0644\u0641\u0632\u064A\u0648\u0646\u064A\u0629 \u0648\u0631\u0628\u0637 \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0625\u0646\u0630\u0627\u0631 \u0645\u0628\u0627\u0634\u0631\u0629 \u0628\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0623\u0645\u0646.",
    assigned_department: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0623\u0645\u0646 \u0648\u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u0623\u0635\u0648\u0644",
    assigned_person: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0623\u0645\u0646 \u0627\u0644\u0647\u064A\u0626\u0629",
    source_type: "correspondence",
    source_id: "corr-in-004",
    priority: "top_urgent",
    confidentiality: "top_secret",
    status: "in_progress",
    progress_percent: 45,
    issued_at: "2026-09-29T15:00:00Z",
    due_date: "2026-10-20",
    matter_id: "matter-004",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-02T09:00:00Z"
  },
  {
    id: "dir-005",
    code: "DIR-2026-0005",
    title: "\u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0631\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A \u0648\u0627\u0644\u0645\u0627\u0644\u064A \u0639\u0644\u0649 \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u0644\u0645\u062D\u0627\u0633\u0628\u0627\u062A",
    instruction: "\u0641\u062D\u0635 \u0628\u0646\u0648\u062F \u0627\u0644\u0639\u062C\u0632 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A \u0648\u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0627\u0644\u0645\u0624\u064A\u062F\u0629 \u0644\u0644\u0639\u0631\u0636 \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u062F \u0631\u0626\u064A\u0633 \u0627\u0644\u0645\u062C\u0644\u0633.",
    assigned_department: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u0648\u0641\u064A\u0631 \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    assigned_person: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    source_type: "correspondence",
    source_id: "corr-in-007",
    priority: "urgent",
    confidentiality: "confidential",
    status: "new",
    progress_percent: 10,
    issued_at: "2026-10-01T11:00:00Z",
    due_date: "2026-10-08",
    matter_id: null,
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-01T11:00:00Z"
  },
  {
    id: "dir-006",
    code: "DIR-2026-0006",
    title: "\u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u0627\u0633\u062A\u0644\u0627\u0645 \u0642\u0637\u0639\u0629 \u0627\u0644\u0623\u0631\u0636 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0645\u0631\u0643\u0632 \u0628\u0631\u064A\u062F \u0642\u0646\u0627 \u0627\u0644\u062C\u062F\u064A\u062F\u0629",
    instruction: "\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0645\u0639 \u0645\u0633\u0624\u0648\u0644\u064A \u062C\u0647\u0627\u0632 \u0645\u062F\u064A\u0646\u0629 \u0642\u0646\u0627 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0648\u0639\u0645\u0644 \u0627\u0644\u0631\u0641\u0639 \u0627\u0644\u0645\u0633\u0627\u062D\u064A \u0648\u0627\u0644\u062C\u0633\u0627\u062A \u0627\u0644\u062A\u0631\u0627\u0628\u064A\u0629.",
    assigned_department: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0648\u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    assigned_person: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629 \u0628\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0625\u0642\u0644\u064A\u0645\u064A\u0629",
    source_type: "correspondence",
    source_id: "corr-in-008",
    priority: "normal",
    confidentiality: "normal",
    status: "assigned",
    progress_percent: 20,
    issued_at: "2026-10-01T13:30:00Z",
    due_date: "2026-10-30",
    matter_id: "matter-001",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-01T13:30:00Z"
  },
  {
    id: "dir-007",
    code: "DIR-2026-0007",
    title: "\u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0641\u0646\u064A \u0648\u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0639\u0645\u0644 \u0644\u0644\u0645\u0624\u062A\u0645\u0631 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0644\u0644\u0627\u062A\u062D\u0627\u062F \u0627\u0644\u0628\u0631\u064A\u062F\u064A \u0628\u0628\u064A\u0631\u0646",
    instruction: "\u0635\u064A\u0627\u063A\u0629 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u062A\u0636\u0645\u0646\u0627\u064B \u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0634\u0645\u0648\u0644 \u0627\u0644\u0645\u0627\u0644\u064A \u0648\u0627\u0644\u0645\u064A\u0643\u0646\u0629 \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0627\u0644\u062D\u062F\u064A\u062B\u0629.",
    assigned_department: "\u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    assigned_person: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644",
    source_type: "correspondence",
    source_id: "corr-in-009",
    priority: "normal",
    confidentiality: "normal",
    status: "in_progress",
    progress_percent: 50,
    issued_at: "2026-10-01T14:30:00Z",
    due_date: "2026-10-10",
    matter_id: null,
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-02T10:00:00Z"
  },
  {
    id: "dir-008",
    code: "DIR-2026-0008",
    title: "\u0625\u0639\u062F\u0627\u062F \u062A\u0642\u0631\u064A\u0631 \u062D\u0635\u0631 \u0634\u0627\u0634\u0627\u062A \u0627\u0644\u0625\u0634\u0627\u0631\u0629 \u0628\u0644\u063A\u0629 \u0627\u0644\u0625\u0634\u0627\u0631\u0629 \u0628\u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0648\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629",
    instruction: "\u062D\u0635\u0631 \u0627\u0644\u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u062A\u064A \u064A\u0646\u0642\u0635\u0647\u0627 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0635\u0648\u062A\u064A \u0648\u0627\u0644\u0645\u0631\u0626\u064A \u0644\u0630\u0648\u064A \u0627\u0644\u0625\u0639\u0627\u0642\u0629 \u0644\u0633\u0631\u0639\u0629 \u0637\u0631\u062D\u0647\u0627.",
    assigned_department: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629",
    assigned_person: "\u0645\u062F\u064A\u0631 \u0625\u062F\u0627\u0631\u0629 \u062E\u062F\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621",
    source_type: "correspondence",
    source_id: "corr-in-012",
    priority: "normal",
    confidentiality: "normal",
    status: "new",
    progress_percent: 0,
    issued_at: "2026-10-02T11:00:00Z",
    due_date: "2026-10-22",
    matter_id: null,
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-02T11:00:00Z"
  },
  {
    id: "dir-009",
    code: "DIR-2026-0009",
    title: "\u0625\u062A\u0645\u0627\u0645 \u062A\u0633\u0648\u064A\u0629 \u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 \u0644\u0646\u0642\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0639\u0646 \u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u062B\u0627\u0646\u064A",
    instruction: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0626\u0631 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u0628\u0627\u0644\u0645\u0643\u0627\u062A\u0628 \u0648\u0633\u062F\u0627\u062F \u0627\u0644\u0645\u0628\u0627\u0644\u063A \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629 \u0641\u0648\u0631\u0627\u064B.",
    assigned_department: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u0648\u0641\u064A\u0631 \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    assigned_person: "\u0645\u062F\u064A\u0631 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629",
    source_type: "direct_instruction",
    priority: "urgent",
    confidentiality: "normal",
    status: "completed",
    progress_percent: 100,
    issued_at: "2026-09-15T09:00:00Z",
    due_date: "2026-09-30",
    matter_id: null,
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-09-30T15:00:00Z"
  },
  {
    id: "dir-010",
    code: "DIR-2026-0010",
    title: "\u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u062A\u0631\u0643\u064A\u0628 \u0648\u062A\u0634\u063A\u064A\u0644 150 \u0645\u0627\u0643\u064A\u0646\u0629 \u0635\u0631\u0627\u0641 \u0622\u0644\u064A \u0628\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0627\u062A \u0627\u0644\u0633\u0627\u062D\u0644\u064A\u0629",
    instruction: "\u0633\u0631\u0639\u0629 \u0625\u0646\u0647\u0627\u0621 \u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0635\u0628 \u0627\u0644\u062E\u0631\u0633\u0627\u0646\u064A \u0648\u0643\u0628\u0627\u0626\u0646 \u0627\u0644\u062D\u0645\u0627\u064A\u0629 \u0644\u0645\u0627\u0643\u064A\u0646\u0627\u062A \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629.",
    assigned_department: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0648\u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    assigned_person: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0628\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0633\u0627\u062D\u0644\u064A\u0629",
    source_type: "meeting",
    source_id: "meet-001",
    priority: "urgent",
    confidentiality: "normal",
    status: "overdue",
    // Overdue demonstration
    progress_percent: 70,
    issued_at: "2026-09-01T10:00:00Z",
    due_date: "2026-09-28",
    // Past date
    matter_id: "matter-001",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-09-29T08:00:00Z"
  },
  {
    id: "dir-011",
    code: "DIR-2026-0011",
    title: "\u062A\u0637\u0648\u064A\u0631 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0647\u0627\u062A\u0641 \u0627\u0644\u0645\u062D\u0645\u0648\u0644 \u0627\u0644\u062E\u0627\u0635 \u0628\u0633\u0639\u0627\u0629 \u0627\u0644\u0628\u0631\u064A\u062F",
    instruction: "\u0625\u0636\u0627\u0641\u0629 \u062E\u0627\u0635\u064A\u0629 \u0627\u0644\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0628\u064A\u0648\u0645\u062A\u0631\u064A \u0648\u062A\u0635\u0648\u064A\u0631 \u0627\u0644\u0625\u062E\u0637\u0627\u0631\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629 \u0639\u0646\u062F \u0627\u0644\u062A\u0633\u0644\u064A\u0645.",
    assigned_department: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u062D\u0648\u0644 \u0627\u0644\u0631\u0642\u0645\u064A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    assigned_person: "\u0645\u062F\u064A\u0631 \u0625\u062F\u0627\u0631\u0629 \u062A\u0637\u0648\u064A\u0631 \u0627\u0644\u062A\u0637\u0628\u064A\u0642\u0627\u062A",
    source_type: "direct_instruction",
    priority: "urgent",
    confidentiality: "normal",
    status: "in_progress",
    progress_percent: 85,
    issued_at: "2026-09-10T11:00:00Z",
    due_date: "2026-10-06",
    // Due soon (within 48h)
    matter_id: "matter-002",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-01T13:00:00Z"
  },
  {
    id: "dir-012",
    code: "DIR-2026-0012",
    title: "\u062D\u0635\u0631 \u0627\u0644\u0646\u0632\u0627\u0639\u0627\u062A \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 \u0627\u0644\u0645\u062A\u0639\u0644\u0642\u0629 \u0628\u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0641\u0636\u0627\u0621 \u0628\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0627\u062A",
    instruction: "\u0625\u0639\u062F\u0627\u062F \u062C\u062F\u0648\u0644 \u062A\u0641\u0635\u064A\u0644\u064A \u0628\u0627\u0644\u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u0645\u062A\u062F\u0627\u0648\u0644\u0629 \u0648\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0648\u062A\u0643\u0644\u064A\u0641 \u0645\u062D\u0627\u0645\u064A \u0627\u0644\u0647\u064A\u0626\u0629 \u0628\u0627\u0644\u062D\u0636\u0648\u0631.",
    assigned_department: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u062A\u062D\u0642\u064A\u0642\u0627\u062A",
    assigned_person: "\u0646\u0627\u0626\u0628 \u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629",
    source_type: "direct_instruction",
    priority: "normal",
    confidentiality: "confidential",
    status: "in_progress",
    progress_percent: 40,
    issued_at: "2026-09-18T12:00:00Z",
    due_date: "2026-10-18",
    matter_id: null,
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-09-28T14:00:00Z"
  },
  {
    id: "dir-013",
    code: "DIR-2026-0013",
    title: "\u062A\u062F\u0631\u064A\u0628 200 \u0645\u0648\u0638\u0641 \u0634\u0628\u0627\u0643 \u0639\u0644\u0649 \u0627\u0644\u062A\u0639\u0627\u0645\u0644 \u0645\u0639 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u062C\u0627\u0631\u064A\u0629 \u0627\u0644\u0630\u0647\u0628\u064A\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629",
    instruction: "\u0639\u0642\u062F \u0648\u0631\u0634 \u062A\u062F\u0631\u064A\u0628\u064A\u0629 \u0645\u0643\u062B\u0641\u0629 \u0639\u0628\u0631 \u0645\u0646\u0635\u0629 \u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u0644\u0644\u0647\u064A\u0626\u0629.",
    assigned_department: "\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u0648\u0641\u064A\u0631 \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    assigned_person: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630\u0629 / \u0645\u0646\u0627\u0644 \u0644\u0637\u0641\u064A - \u0627\u0644\u062A\u062F\u0631\u064A\u0628 \u0627\u0644\u0645\u0627\u0644\u064A",
    source_type: "meeting",
    source_id: "meet-001",
    priority: "normal",
    confidentiality: "normal",
    status: "completed",
    progress_percent: 100,
    issued_at: "2026-09-05T09:00:00Z",
    due_date: "2026-09-25",
    matter_id: "matter-002",
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-09-25T16:00:00Z"
  },
  {
    id: "dir-014",
    code: "DIR-2026-0014",
    title: "\u0641\u062D\u0635 \u0634\u0643\u0627\u0648\u0649 \u062A\u0623\u062E\u0631 \u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0637\u0631\u0648\u062F \u0627\u0644\u062F\u0648\u0644\u064A\u0629 \u0628\u0645\u0643\u062A\u0628 \u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0639\u0627\u062F\u064A \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    instruction: "\u0625\u064A\u0641\u0627\u062F \u0644\u062C\u0646\u0629 \u062A\u0641\u062A\u064A\u0634 \u0645\u0641\u0627\u062C\u0626\u0629 \u0648\u062D\u0635\u0631 \u0623\u0633\u0628\u0627\u0628 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064A\u0646 \u0648\u0645\u0648\u0627\u0641\u0627\u0629 \u0627\u0644\u0645\u0643\u062A\u0628 \u0628\u0627\u0644\u0646\u062A\u064A\u062C\u0629.",
    assigned_department: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629",
    assigned_person: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 / \u062D\u0633\u0627\u0645 \u0627\u0644\u0645\u0646\u0634\u0627\u0648\u064A - \u0627\u0644\u062A\u0641\u062A\u064A\u0634 \u0627\u0644\u0628\u0631\u064A\u062F\u064A",
    source_type: "direct_instruction",
    priority: "top_urgent",
    confidentiality: "normal",
    status: "in_progress",
    progress_percent: 80,
    issued_at: "2026-10-01T09:00:00Z",
    due_date: "2026-10-03",
    // Urgent / due soon
    matter_id: null,
    created_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    updated_at: "2026-10-02T11:00:00Z"
  },
  {
    id: "dir-015",
    code: "DIR-2026-0015",
    title: "\u0645\u0631\u0627\u062C\u0639\u0629 \u062E\u0637\u0629 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0633\u0646\u0648\u064A\u0629 \u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u062A\u0643\u064A\u064A\u0641 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0648\u0627\u0644\u0645\u0635\u0627\u0639\u062F \u0628\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    instruction: "\u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u0644\u062A\u0632\u0627\u0645 \u0627\u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u0646\u0641\u0630\u0629 \u0628\u0628\u0646\u0648\u062F \u0627\u0644\u0639\u0642\u062F \u0648\u062A\u0648\u0641\u064A\u0631 \u0642\u0637\u0639 \u0627\u0644\u063A\u064A\u0627\u0631 \u0627\u0644\u0623\u0635\u0644\u064A\u0629 \u0642\u0628\u0644 \u0641\u0635\u0644 \u0627\u0644\u0635\u064A\u0641.",
    assigned_department: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0648\u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    assigned_person: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0648\u0627\u0644\u062A\u0634\u063A\u064A\u0644",
    source_type: "direct_instruction",
    priority: "normal",
    confidentiality: "normal",
    status: "closed",
    progress_percent: 100,
    issued_at: "2026-08-15T10:00:00Z",
    due_date: "2026-09-15",
    matter_id: null,
    created_by: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644",
    updated_at: "2026-09-16T12:00:00Z"
  }
];
var INITIAL_CONTACTS = [
  {
    id: "cont-001",
    name: "\u0645\u0643\u062A\u0628 \u0648\u0632\u064A\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    entity: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0648\u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    position: "\u0645\u062F\u064A\u0631 \u0645\u0643\u062A\u0628 \u0627\u0644\u0648\u0632\u064A\u0631",
    phone: "02-35341000",
    email: "minister.office@telecom.internal",
    category: "ministry",
    notes: "\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0639\u0628\u0631 \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0644\u0645\u0639\u0627\u0644\u064A \u0627\u0644\u0648\u0632\u064A\u0631.",
    created_at: "2026-01-01T08:00:00Z"
  },
  {
    id: "cont-002",
    name: "\u0645\u0643\u062A\u0628 \u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    entity: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A",
    position: "\u0645\u062F\u064A\u0631 \u0645\u0643\u062A\u0628 \u0627\u0644\u0645\u062D\u0627\u0641\u0638",
    phone: "02-27702000",
    email: "governor.office@centralbank.internal",
    category: "central_bank",
    notes: "\u0645\u0644\u0641 \u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0646\u0642\u062F\u064A \u0648\u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A \u0627\u0644\u0644\u062D\u0638\u064A\u0629 IPN \u0648\u0627\u0644\u0634\u0645\u0648\u0644 \u0627\u0644\u0645\u0627\u0644\u064A.",
    created_at: "2026-01-05T09:00:00Z"
  },
  {
    id: "cont-003",
    name: "\u0631\u0626\u0627\u0633\u0629 \u0647\u064A\u0626\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A\u0629",
    entity: "\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0642\u0648\u0645\u064A\u0629 \u0644\u0644\u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A",
    position: "\u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0627\u0644\u0647\u064A\u0626\u0629",
    phone: "02-25911400",
    email: "contact@socialins.internal",
    category: "postal_administration",
    notes: "\u0645\u0644\u0641 \u0645\u0646\u0638\u0648\u0645\u0629 \u0635\u0631\u0641 \u0627\u0644\u0645\u0639\u0627\u0634\u0627\u062A \u0627\u0644\u0634\u0647\u0631\u064A\u0629 \u0628\u0627\u0644\u0645\u0643\u0627\u062A\u0628 \u0648\u0627\u0644\u062A\u0637\u0628\u064A\u0642\u0627\u062A \u0627\u0644\u0631\u0642\u0645\u064A\u0629.",
    created_at: "2026-01-10T10:00:00Z"
  },
  {
    id: "cont-004",
    name: "\u0645\u0643\u062A\u0628 \u0648\u0632\u064A\u0631\u0629 \u0627\u0644\u062A\u0636\u0627\u0645\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A",
    entity: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062A\u0636\u0627\u0645\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A",
    position: "\u0645\u062F\u064A\u0631 \u0645\u0643\u062A\u0628 \u0627\u0644\u0648\u0632\u064A\u0631\u0629",
    phone: "02-37617000",
    email: "contact@socialaffairs.internal",
    category: "ministry",
    notes: "\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u062A\u0643\u0627\u0641\u0644 \u0648\u0643\u0631\u0627\u0645\u0629 \u0648\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0625\u062A\u0627\u062D\u0629 \u0644\u0630\u0648\u064A \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u062C\u0627\u062A \u0627\u0644\u062E\u0627\u0635\u0629.",
    created_at: "2026-01-15T11:00:00Z"
  },
  {
    id: "cont-005",
    name: "\u0627\u0644\u0623\u0645\u0627\u0646\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u0627\u062A\u062D\u0627\u062F \u0627\u0644\u0628\u0631\u064A\u062F\u064A \u0627\u0644\u062F\u0648\u0644\u064A",
    entity: "\u0627\u062A\u062D\u0627\u062F \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0639\u0627\u0644\u0645\u064A",
    position: "\u0627\u0644\u0623\u0645\u064A\u0646 \u0627\u0644\u0639\u0627\u0645 \u0644\u0644\u0627\u062A\u062D\u0627\u062F \u0627\u0644\u0628\u0631\u064A\u062F\u064A",
    phone: "+41-31-350-3111",
    email: "secretariat@postal-union.internal",
    category: "postal_administration",
    notes: "\u0627\u0644\u0645\u0631\u0627\u0633\u0644\u0627\u062A \u0648\u0627\u0644\u062A\u0645\u062B\u064A\u0644 \u0627\u0644\u062F\u0648\u0644\u064A \u0641\u064A \u0627\u0644\u0645\u0646\u0638\u0645\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0627\u0644\u0645\u062A\u062E\u0635\u0635\u0629.",
    created_at: "2026-02-01T08:00:00Z"
  },
  {
    id: "cont-006",
    name: "\u0631\u0626\u0627\u0633\u0629 \u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0631\u0642\u0627\u0628\u064A \u0644\u0644\u0645\u062D\u0627\u0633\u0628\u0627\u062A",
    entity: "\u0627\u0644\u062C\u0647\u0627\u0632 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u0644\u0645\u062D\u0627\u0633\u0628\u0627\u062A",
    position: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0631\u0642\u0627\u0628\u064A",
    phone: "02-24017000",
    email: "liaison@audit.internal",
    category: "other",
    notes: "\u062A\u0642\u0627\u0631\u064A\u0631 \u0641\u062D\u0635 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629 \u0648\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0631\u0642\u0627\u0628\u064A\u0629 \u0627\u0644\u062F\u0648\u0631\u064A\u0629.",
    created_at: "2026-02-15T09:30:00Z"
  },
  {
    id: "cont-007",
    name: "\u0625\u062F\u0627\u0631\u0629 \u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0634\u0631\u064A\u0643\u0629",
    entity: "\u0647\u064A\u0626\u0629 \u062A\u0646\u0645\u064A\u0629 \u0635\u0646\u0627\u0639\u0629 \u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
    position: "\u0627\u0644\u0631\u0626\u064A\u0633 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0644\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0634\u0631\u064A\u0643\u0629",
    phone: "02-35345000",
    email: "contact@techdev.internal",
    category: "ministry",
    notes: "\u0645\u0644\u0641 \u0627\u0644\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u062A\u0637\u0648\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u0646\u0627\u0634\u0626\u0629 \u0648\u062D\u0627\u0636\u0646\u0627\u062A \u0627\u0644\u0623\u0639\u0645\u0627\u0644.",
    created_at: "2026-03-01T10:00:00Z"
  },
  {
    id: "cont-008",
    name: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0625\u0642\u0644\u064A\u0645\u064A",
    entity: "\u062F\u064A\u0648\u0627\u0646 \u0639\u0627\u0645 \u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0625\u0642\u0644\u064A\u0645\u064A\u0629",
    position: "\u0645\u062F\u064A\u0631 \u0645\u0643\u062A\u0628 \u0627\u0644\u0645\u062D\u0627\u0641\u0638",
    phone: "096-3210000",
    email: "governor.office@regional.internal",
    category: "other",
    notes: "\u062A\u062E\u0635\u064A\u0635 \u0623\u0631\u0627\u0636\u064A \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0627\u0644\u062E\u062F\u0645\u064A\u0629 \u0648\u0627\u0644\u0628\u0631\u064A\u062F\u064A\u0629 \u0648\u0645\u0628\u0627\u062F\u0631\u0629 \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629 \u0628\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0629.",
    created_at: "2026-03-10T11:00:00Z"
  }
];
var INITIAL_AUDIT_LOG = [
  {
    id: "audit-001",
    user_id: "usr-secretary",
    user_name: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644",
    user_role: "SECRETARY",
    action_type: "CREATE",
    entity_type: "CORRESPONDENCE",
    entity_id: "corr-in-001",
    before_value: null,
    after_value: "\u062A\u0633\u062C\u064A\u0644 \u062E\u0637\u0627\u0628 \u0648\u0627\u0631\u062F \u0631\u0642\u0645 IN-2026-0001 \u0648\u0627\u0631\u062F \u0645\u0646 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0628\u062E\u0635\u0648\u0635 \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629",
    timestamp: "2026-09-28T09:15:00Z",
    ip_address: "<LAN_CLIENT_IP>",
    prev_hash: "GENESIS-BLOCK-00000000000000000000000000000000",
    entry_hash: "26ba31099933888f8f2857ced7b8be3e0c41e261316760b64d2c524a6d33d9dc"
  },
  {
    id: "audit-002",
    user_id: "usr-secretary",
    user_name: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644",
    user_role: "SECRETARY",
    action_type: "UPDATE",
    entity_type: "BRIEFING_NOTE",
    entity_id: "brief-001",
    before_value: null,
    after_value: "\u0635\u064A\u0627\u063A\u0629 \u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u062E\u0637\u0627\u0628 IN-2026-0001 \u062A\u0645\u0647\u064A\u062F\u0627\u064B \u0644\u062A\u0642\u062F\u064A\u0645\u0647\u0627 \u0644\u0644\u0631\u0626\u064A\u0633",
    timestamp: "2026-09-28T10:30:00Z",
    ip_address: "<LAN_CLIENT_IP>",
    prev_hash: "26ba31099933888f8f2857ced7b8be3e0c41e261316760b64d2c524a6d33d9dc",
    entry_hash: "4190b40aeda2fef4987b3a0851e7bc430c900130aef805cdc32ecc598dcfae12"
  },
  {
    id: "audit-003",
    user_id: "usr-chairman",
    user_name: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    user_role: "CHAIRMAN",
    action_type: "DECIDE",
    entity_type: "CORRESPONDENCE",
    entity_id: "corr-in-002",
    before_value: "\u0627\u0644\u062D\u0627\u0644\u0629: \u0645\u0639\u0631\u0648\u0636 \u0639\u0644\u0649 \u0627\u0644\u0631\u0626\u064A\u0633",
    after_value: "\u062A\u0623\u0634\u064A\u0631\u0629 \u0627\u0639\u062A\u0645\u0627\u062F: \u0645\u0648\u0627\u0641\u0642 \u0645\u0639 \u0633\u0631\u0639\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0648\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0645\u0639 \u0627\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0627\u0644\u064A",
    timestamp: "2026-09-29T12:10:00Z",
    ip_address: "<LAN_CLIENT_IP>",
    prev_hash: "4190b40aeda2fef4987b3a0851e7bc430c900130aef805cdc32ecc598dcfae12",
    entry_hash: "cf19ff991de29312837d59213d4f7ce0f09271b482eef1fa57db24bfcbbfa7b1"
  },
  {
    id: "audit-004",
    user_id: "usr-chairman",
    user_name: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    user_role: "CHAIRMAN",
    action_type: "CREATE",
    entity_type: "DIRECTIVE",
    entity_id: "dir-002",
    before_value: null,
    after_value: "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0643\u0644\u064A\u0641 DIR-2026-0002 \u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u062A\u062D\u0648\u0644 \u0627\u0644\u0631\u0642\u0645\u064A \u0628\u0634\u0623\u0646 \u0625\u0646\u0633\u062A\u0627\u0628\u0627\u064A",
    timestamp: "2026-09-29T12:30:00Z",
    ip_address: "<LAN_CLIENT_IP>",
    prev_hash: "cf19ff991de29312837d59213d4f7ce0f09271b482eef1fa57db24bfcbbfa7b1",
    entry_hash: "0e193ac21e570235617ceed84bc60fa061de11054a13d4e066484e522eb81031"
  }
];
var INITIAL_MEETING_ATTENDEES = [
  {
    id: "att-001",
    meeting_id: "meet-001",
    name: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    title: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 (\u0631\u0626\u064A\u0633 \u0627\u0644\u062C\u0644\u0633\u0629)",
    entity: "\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0642\u0648\u0645\u064A\u0629 \u0644\u0644\u0628\u0631\u064A\u062F",
    is_external: 0,
    attendance_status: "confirmed"
  },
  {
    id: "att-002",
    meeting_id: "meet-001",
    name: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    title: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062A\u0648\u0641\u064A\u0631",
    entity: "\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0642\u0648\u0645\u064A\u0629 \u0644\u0644\u0628\u0631\u064A\u062F",
    is_external: 0,
    attendance_status: "confirmed"
  },
  {
    id: "att-003",
    meeting_id: "meet-001",
    name: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    title: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629 \u0648\u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A",
    entity: "\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0642\u0648\u0645\u064A\u0629 \u0644\u0644\u0628\u0631\u064A\u062F",
    is_external: 0,
    attendance_status: "confirmed"
  },
  {
    id: "att-004",
    meeting_id: "meet-001",
    name: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644",
    title: "\u0633\u0643\u0631\u062A\u064A\u0631 \u0623\u0648\u0644 \u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0627\u0644\u0645\u062C\u0644\u0633 (\u0623\u0645\u064A\u0646 \u0627\u0644\u0633\u0631)",
    entity: "\u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    is_external: 0,
    attendance_status: "confirmed"
  },
  {
    id: "att-005",
    meeting_id: "meet-002",
    name: "\u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    title: "\u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A",
    entity: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A",
    is_external: 1,
    attendance_status: "confirmed"
  },
  {
    id: "att-006",
    meeting_id: "meet-002",
    name: "\u0648\u0643\u064A\u0644 \u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u0646\u0638\u0645 \u0627\u0644\u062F\u0641\u0639",
    title: "\u0648\u0643\u064A\u0644 \u0645\u062D\u0627\u0641\u0638 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u0646\u0638\u0645 \u0627\u0644\u062F\u0641\u0639",
    entity: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0627\u0644\u0645\u0635\u0631\u064A",
    is_external: 1,
    attendance_status: "confirmed"
  }
];
var INITIAL_AGENDA_ITEMS = [
  {
    id: "agenda-001",
    meeting_id: "meet-001",
    order_index: 1,
    title: "\u0627\u0644\u062A\u0635\u062F\u064A\u0642 \u0639\u0644\u0649 \u0645\u062D\u0636\u0631 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0635\u0627\u062F\u0631\u0629",
    description: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0644\u0640 6 \u0642\u0631\u0627\u0631\u0627\u062A \u0635\u0627\u062F\u0631\u0629 \u0628\u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0648\u0645\u0627 \u062A\u0645 \u0625\u0646\u062C\u0627\u0632\u0647.",
    duration_minutes: 20,
    presenter: "\u0627\u0644\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0623\u0648\u0644 - \u0623\u0645\u064A\u0646 \u0633\u0631 \u0627\u0644\u0645\u062C\u0644\u0633"
  },
  {
    id: "agenda-002",
    meeting_id: "meet-001",
    order_index: 2,
    title: "\u0639\u0631\u0636 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u062D\u0635\u064A\u0644\u0629 \u0623\u0648\u0639\u064A\u0629 \u0627\u0644\u062A\u0648\u0641\u064A\u0631 \u0644\u0644\u0631\u0628\u0639 \u0627\u0644\u062B\u0627\u0644\u062B 2026",
    description: "\u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629 \u0648\u0646\u0645\u0648 \u0627\u0644\u0648\u062F\u0627\u0626\u0639 \u0648\u0627\u0644\u0623\u0631\u0628\u0627\u062D \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629 \u0627\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A\u0629 \u0644\u0644\u0647\u064A\u0626\u0629.",
    duration_minutes: 45,
    presenter: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064A\u0629"
  },
  {
    id: "agenda-003",
    meeting_id: "meet-001",
    order_index: 3,
    title: "\u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0644\u0645\u0643\u0627\u062A\u0628 \u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0645\u0646 \u0645\u0628\u0627\u062F\u0631\u0629 \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629",
    description: "\u0639\u0631\u0636 \u062E\u0637\u0629 \u0627\u0641\u062A\u062A\u0627\u062D 385 \u0645\u0643\u062A\u0628\u0627\u064B \u0645\u0637\u0648\u0631\u0627\u064B \u0648\u062C\u0627\u0647\u0632\u064A\u0629 \u0645\u0627\u0643\u064A\u0646\u0627\u062A \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A \u0648\u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0634\u0628\u0643\u064A.",
    duration_minutes: 40,
    presenter: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629"
  },
  {
    id: "agenda-004",
    meeting_id: "meet-001",
    order_index: 4,
    title: "\u0645\u0627 \u064A\u064F\u0633\u062A\u062C\u062F \u0645\u0646 \u0623\u0639\u0645\u0627\u0644 \u0648\u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629",
    description: "\u0627\u0644\u062A\u0648\u062C\u064A\u0647\u0627\u062A \u0627\u0644\u0631\u0626\u0627\u0633\u064A\u0629 \u0627\u0644\u0639\u0627\u062C\u0644\u0629 \u0648\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0646\u0639\u0642\u0627\u062F \u0627\u0644\u0644\u062C\u0627\u0646 \u0627\u0644\u0646\u0648\u0639\u064A\u0629 \u0627\u0644\u0645\u0646\u0628\u062B\u0642\u0629.",
    duration_minutes: 15,
    presenter: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629"
  }
];
var INITIAL_MEETING_MINUTES = [
  {
    id: "min-001",
    meeting_id: "meet-001",
    draft_content: "\u0639\u064F\u0642\u062F \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u0628\u0631\u0626\u0627\u0633\u0629 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629\u060C \u0648\u062A\u0645 \u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u062C\u062F\u0648\u0644 \u0627\u0644\u0623\u0639\u0645\u0627\u0644. \u0648\u0642\u062F \u0623\u0634\u0627\u062F \u0627\u0644\u0645\u062C\u0644\u0633 \u0628\u0645\u0639\u062F\u0644\u0627\u062A \u0625\u0646\u062C\u0627\u0632 \u0645\u0634\u0631\u0648\u0639\u0627\u062A \u062D\u064A\u0627\u0629 \u0643\u0631\u064A\u0645\u0629 \u0648\u0634\u062F\u062F \u0639\u0644\u0649 \u0636\u0631\u0648\u0631\u0629 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 \u0645\u0646 \u0643\u0627\u0641\u0629 \u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0648\u0627\u0644\u0645\u064A\u0643\u0646\u0629 \u0628\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0627\u062A \u0642\u0628\u0644 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u062C\u0627\u0631\u064A\u060C \u0645\u0639 \u062A\u0639\u0632\u064A\u0632 \u0627\u0644\u0633\u064A\u0648\u0644\u0629 \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0627\u0633\u062A\u0639\u062F\u0627\u062F\u0627\u064B \u0644\u0635\u0631\u0641 \u0627\u0644\u0645\u0639\u0627\u0634\u0627\u062A.",
    approved_content: "\u0627\u0639\u062A\u064F\u0645\u062F \u0627\u0644\u0645\u062D\u0636\u0631 \u0631\u0633\u0645\u064A\u0627\u064B \u0645\u0646 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0628\u062C\u0644\u0633\u062A\u0647 \u0627\u0644\u0645\u0646\u0639\u0642\u062F\u0629\u060C \u0645\u0639 \u0627\u0644\u062A\u0643\u0644\u064A\u0641 \u0627\u0644\u0641\u0648\u0631\u064A \u0644\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0627\u0644\u064A \u0648\u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0628\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0648\u0636\u062D\u0629 \u0623\u062F\u0646\u0627\u0647.",
    status: "draft",
    approved_by: "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
    approved_at: "2026-10-01T15:00:00Z"
  }
];
var INITIAL_DECISIONS = [
  {
    id: "dec-001",
    meeting_id: "meet-001",
    order_index: 1,
    content: "\u0627\u0639\u062A\u0645\u0627\u062F \u062E\u0637\u0629 \u0627\u0644\u062A\u063A\u0630\u064A\u0629 \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u0645\u0627\u0643\u064A\u0646\u0627\u062A \u0627\u0644\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0644\u064A \u0628\u0627\u0644\u0642\u0631\u0649 \u0648\u062A\u0648\u0641\u064A\u0631 \u0633\u064A\u0648\u0644\u0629 \u0639\u0627\u062C\u0644\u0629 \u0628\u0642\u064A\u0645\u0629 500 \u0645\u0644\u064A\u0648\u0646 \u062C\u0646\u064A\u0647.",
    assigned_department_id: "dept-fin",
    assigned_to_name: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    due_date: "2026-10-10",
    directive_id: null,
    status: "in_progress"
  },
  {
    id: "dec-002",
    meeting_id: "meet-001",
    order_index: 2,
    content: "\u0633\u0631\u0639\u0629 \u0625\u0646\u0647\u0627\u0621 \u0625\u0637\u0644\u0627\u0642 \u0627\u0644\u062A\u064A\u0627\u0631 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0644\u0640 3 \u0645\u0643\u0627\u062A\u0628 \u0628\u0631\u064A\u062F \u0645\u062A\u0628\u0642\u064A\u0629 \u0628\u0627\u0644\u0645\u0646\u064A\u0627 \u0628\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0645\u0639 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621.",
    assigned_department_id: "dept-prop",
    assigned_to_name: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
    due_date: "2026-10-06",
    directive_id: "dir-001",
    status: "in_progress"
  }
];
var INITIAL_SETTINGS = {
  id: "settings-global",
  fiscal_year: "2026/2027",
  session_timeout_minutes: 15,
  default_digit_format: "western",
  default_calendar_format: "gregorian",
  last_backup_date: "2026-10-02T10:00:00Z"
};

// src/data/database/sqliteEngine.ts
function formatStartupBanner(info) {
  const lines = [];
  lines.push("======================================================================");
  lines.push("\u{1F3DB}\uFE0F  EGYPT NATIONAL POST - CHAIRMAN OFFICE EXECUTIVE PORTAL");
  if (info.isMemory) {
    lines.push("\u26A0\uFE0F  WARNING: Database running in SQLite IN-MEMORY mode (:memory:)!");
    lines.push("\u26A0\uFE0F  ALL DATA WILL BE PERMANENTLY LOST WHEN THE PROCESS EXITS!");
    lines.push(`\u{1F4C1} Database Path: ${info.absolutePath}`);
    lines.push(`\u2699\uFE0F  Journal Mode: ${info.journalMode} | Foreign Keys: ${info.foreignKeys ? "ENABLED (ON)" : "DISABLED (OFF)"} | Schema Version: ${info.schemaVersion}`);
    lines.push(`\u{1F4BE} Database Size: ${info.fileSizeFormatted} (In-Memory Buffer)`);
  } else {
    lines.push(`\u{1F4BE} Mode: File-Backed Persistent Database`);
    lines.push(`\u{1F4C1} Database Path: ${info.absolutePath}`);
    lines.push(`\u2699\uFE0F  Journal Mode: ${info.journalMode} | Foreign Keys: ${info.foreignKeys ? "ENABLED (ON)" : "DISABLED (OFF)"} | Schema Version: ${info.schemaVersion}`);
    lines.push(`\u{1F4E6} Database Size: ${info.fileSizeFormatted}`);
  }
  if (info.isFirstStart) {
    lines.push(`\u{1F195} Status: First Start (Clean initialization - Credentials generated)`);
    lines.push(`\u{1F511} Initial credentials printed above. Keep this console private.`);
  } else {
    lines.push(`\u{1F504} Status: Server Restart (Loaded ${info.userCount} existing users from storage)`);
    lines.push(`\u{1F512} Retaining existing encrypted credentials from database.`);
  }
  lines.push("======================================================================");
  return lines.join("\n");
}
var SqliteEngine = class {
  constructor() {
    this.db = null;
    this.dbPath = "";
    this.isFirstStart = false;
    this.initPromise = null;
    this.writeMutex = Promise.resolve();
  }
  getDbPath() {
    return this.dbPath;
  }
  getEngineInfo() {
    const isMemory = this.dbPath === ":memory:";
    const journalMode = this.query("PRAGMA journal_mode")[0]?.journal_mode?.toUpperCase() || "UNKNOWN";
    const foreignKeys = Boolean(this.query("PRAGMA foreign_keys")[0]?.foreign_keys);
    let schemaVersion = 1;
    try {
      const vRows = this.query("SELECT MAX(version) as version FROM schema_version");
      schemaVersion = vRows[0]?.version || 1;
    } catch {
      schemaVersion = this.query("PRAGMA schema_version")[0]?.schema_version || 1;
    }
    let fileSizeBytes = 0;
    if (!isMemory && fs.existsSync(this.dbPath)) {
      try {
        fileSizeBytes = fs.statSync(this.dbPath).size;
      } catch {
        fileSizeBytes = 0;
      }
    }
    let userCount = 0;
    try {
      userCount = this.query("SELECT count(*) as count FROM users")[0]?.count || 0;
    } catch {
    }
    const fileSizeFormatted = isMemory ? "0 KB" : fileSizeBytes > 1024 * 1024 ? `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB (${fileSizeBytes} bytes)` : `${(fileSizeBytes / 1024).toFixed(1)} KB (${fileSizeBytes} bytes)`;
    return {
      mode: isMemory ? "memory" : "file",
      isMemory,
      dbPath: this.dbPath,
      absolutePath: isMemory ? ":memory:" : path.resolve(this.dbPath),
      journalMode,
      foreignKeys,
      schemaVersion,
      fileSizeBytes,
      fileSizeFormatted,
      isFirstStart: this.isFirstStart,
      userCount
    };
  }
  async runWithMutex(fn) {
    let release;
    const next = new Promise((resolve2) => {
      release = resolve2;
    });
    const wait = this.writeMutex;
    this.writeMutex = next;
    await wait;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  async init(customPath) {
    if (this.db && !customPath) return;
    if (this.initPromise && !customPath) return this.initPromise;
    this.initPromise = (async () => {
      const isExplicitMemory = process.env.DATA_DIR === ":memory:" || customPath === ":memory:";
      if (isExplicitMemory) {
        this.dbPath = ":memory:";
        this.db = new Database(":memory:");
      } else {
        const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true, mode: 448 });
        }
        this.dbPath = customPath || path.join(dataDir, "app.db");
        this.db = new Database(this.dbPath);
        try {
          if (fs.existsSync(this.dbPath)) {
            fs.chmodSync(this.dbPath, 384);
          }
        } catch {
        }
      }
      if (!isExplicitMemory) {
        this.db.pragma("journal_mode = WAL");
      } else {
        this.db.pragma("journal_mode = MEMORY");
      }
      this.db.pragma("foreign_keys = ON");
      this.db.pragma("busy_timeout = 5000");
      await this.runMigrationsAndSeed();
    })();
    return this.initPromise;
  }
  getDatabase() {
    if (!this.db) {
      throw new Error("SQLite Engine is not initialized. Call init() first.");
    }
    return this.db;
  }
  sanitizeParams(params = []) {
    return params.map((p) => p === void 0 ? null : p);
  }
  query(sql, params = []) {
    const db = this.getDatabase();
    const sanitized = this.sanitizeParams(params);
    const stmt = db.prepare(sql);
    return stmt.all(...sanitized);
  }
  run(sql, params = []) {
    const db = this.getDatabase();
    const sanitized = this.sanitizeParams(params);
    const stmt = db.prepare(sql);
    const result = stmt.run(...sanitized);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }
  transaction(fn) {
    const db = this.getDatabase();
    const tx = db.transaction(fn);
    return tx();
  }
  async saveImmediate() {
    return Promise.resolve();
  }
  async backup(destPath) {
    const db = this.getDatabase();
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true, mode: 448 });
    }
    await db.backup(destPath);
    try {
      if (fs.existsSync(destPath)) {
        fs.chmodSync(destPath, 384);
      }
    } catch {
    }
  }
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
  async reopen(customPath) {
    this.close();
    await this.init(customPath);
  }
  async runMigrationsAndSeed(isNewDb) {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const versions = this.query("SELECT version FROM schema_version ORDER BY version ASC");
    const appliedVersions = new Set(versions.map((v) => v.version));
    if (!appliedVersions.has(1)) {
      this.db.exec(SCHEMA_SQL);
      this.db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(1, (/* @__PURE__ */ new Date()).toISOString());
    }
    const userCountRows = this.query("SELECT count(*) as count FROM users");
    const existingUserCount = userCountRows[0]?.count || 0;
    this.isFirstStart = existingUserCount === 0;
    if (existingUserCount === 0) {
      this.bootstrapFreshDatabase();
    }
  }
  bootstrapFreshDatabase() {
    if (!this.db) return;
    this.transaction(() => {
      const deptStmt = this.db.prepare(
        "INSERT OR IGNORE INTO departments (id, name, code, head_title, is_active) VALUES (?, ?, ?, ?, ?)"
      );
      for (const d of INITIAL_DEPARTMENTS) {
        deptStmt.run(d.id, d.name, d.code, d.head_title, d.is_active);
      }
      const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
      if (!isTestEnv) {
        console.log("\n======================================================");
        console.log("\u{1F511} INITIAL SECURITY PROVISIONING: CREATING USERS");
        console.log("======================================================");
      }
      const userStmt = this.db.prepare(
        "INSERT OR IGNORE INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const u of INITIAL_USERS) {
        let passHash = u.password_hash;
        let passSalt = u.password_salt;
        let initPass = "";
        if (!isTestEnv) {
          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
          const bytes = crypto2.randomBytes(16);
          for (let i = 0; i < 16; i++) initPass += chars[bytes[i] % chars.length];
          const salt = crypto2.randomBytes(16);
          const hash = crypto2.pbkdf2Sync(initPass, salt, 6e5, 32, "sha256");
          passHash = hash.toString("hex");
          passSalt = salt.toString("hex");
          console.log(`\u{1F464} User: [${u.username}] (${u.role}) -> Initial Password: ${initPass}`);
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
        console.log("======================================================\n");
      }
      const matterStmt = this.db.prepare(
        "INSERT OR IGNORE INTO matters (id, code, title, description, confidentiality, status, lead_entity, priority, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const m of INITIAL_MATTERS) {
        matterStmt.run(m.id, m.code, m.title, m.description, m.confidentiality, m.status, m.lead_entity, m.priority, m.created_at, m.updated_at, m.created_by);
      }
      const meetingStmt = this.db.prepare(
        "INSERT OR IGNORE INTO meetings (id, title, location, start_time, end_time, meeting_type, status, matter_id, confidentiality, notes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const m of INITIAL_MEETINGS) {
        meetingStmt.run(m.id, m.title, m.location, m.start_time, m.end_time, m.meeting_type, m.status, m.matter_id, m.confidentiality, m.notes, m.created_at, m.updated_at, m.created_by);
      }
      const attStmt = this.db.prepare(
        "INSERT OR IGNORE INTO meeting_attendees (id, meeting_id, name, title, entity, is_external, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const att of INITIAL_MEETING_ATTENDEES) {
        attStmt.run(att.id, att.meeting_id, att.name, att.title, att.entity, att.is_external, att.attendance_status);
      }
      const agendaStmt = this.db.prepare(
        "INSERT OR IGNORE INTO agenda_items (id, meeting_id, order_index, title, description, duration_minutes, presenter) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const ag of INITIAL_AGENDA_ITEMS) {
        agendaStmt.run(ag.id, ag.meeting_id, ag.order_index, ag.title, ag.description, ag.duration_minutes, ag.presenter);
      }
      const minStmt = this.db.prepare(
        "INSERT OR IGNORE INTO meeting_minutes (id, meeting_id, draft_content, approved_content, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const min of INITIAL_MEETING_MINUTES) {
        minStmt.run(min.id, min.meeting_id, min.draft_content, min.approved_content, min.status, min.approved_by, min.approved_at);
      }
      const decStmt = this.db.prepare(
        "INSERT OR IGNORE INTO decisions (id, meeting_id, order_index, content, assigned_department_id, assigned_to_name, due_date, directive_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const dec of INITIAL_DECISIONS) {
        decStmt.run(dec.id, dec.meeting_id, dec.order_index, dec.content, dec.assigned_department_id, dec.assigned_to_name, dec.due_date, dec.directive_id, dec.status);
      }
      const corrStmt = this.db.prepare(
        "INSERT OR IGNORE INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, matter_id, category, tags, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
          c.category || "operations",
          JSON.stringify(c.tags || []),
          c.created_at,
          c.updated_at,
          c.created_by
        );
      }
      const bnStmt = this.db.prepare(
        "INSERT OR IGNORE INTO briefing_notes (id, correspondence_id, background, secretary_recommendation, executive_opinion, prepared_by_name, prepared_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const bn of INITIAL_BRIEFING_NOTES) {
        bnStmt.run(bn.id, bn.correspondence_id, bn.background, bn.secretary_recommendation, bn.executive_opinion, bn.prepared_by_name, bn.prepared_at);
      }
      const appStmt = this.db.prepare(
        "INSERT OR IGNORE INTO approvals (id, correspondence_id, decision_type, standard_phrase, custom_directive, decided_at, decided_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const a of INITIAL_APPROVALS) {
        appStmt.run(a.id, a.correspondence_id, a.decision_type, a.standard_phrase, a.custom_directive || null, a.decided_at, a.decided_by_name);
      }
      const dirStmt = this.db.prepare(
        "INSERT OR IGNORE INTO directives (id, code, title, instruction, assigned_department, assigned_person, source_type, source_id, priority, confidentiality, status, progress_percent, issued_at, due_date, matter_id, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
      const contactStmt = this.db.prepare(
        "INSERT OR IGNORE INTO contacts (id, name, entity, position, phone, email, category, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const con of INITIAL_CONTACTS) {
        contactStmt.run(con.id, con.name, con.entity, con.position, con.phone, con.email, con.category, con.notes, con.created_at);
      }
      const auditStmt = this.db.prepare(
        "INSERT OR IGNORE INTO audit_log (id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address, prev_hash, entry_hash, is_confidential) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      let lastSeq = 0;
      let lastHash = "GENESIS-BLOCK-00000000000000000000000000000000";
      let auditCount = 0;
      for (const a of INITIAL_AUDIT_LOG) {
        const nextSeq = lastSeq + 1;
        const prevHash = lastHash;
        const isConf = a.is_confidential ? 1 : 0;
        const payload = [
          String(nextSeq),
          a.id,
          a.timestamp,
          a.user_id,
          a.user_role,
          a.action_type,
          a.entity_type,
          a.entity_id,
          a.before_value || "",
          a.after_value || "",
          a.ip_address || "",
          prevHash,
          isConf ? "1" : "0"
        ].join("||");
        const entryHash = crypto2.createHash("sha256").update(payload).digest("hex");
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
      const setStmt = this.db.prepare(
        "INSERT OR IGNORE INTO settings (id, fiscal_year, session_timeout_minutes, default_digit_format, default_calendar_format, last_backup_date, audit_last_seq, audit_head_hash, audit_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
};
var sqliteEngine = new SqliteEngine();

// src/server/services/session.service.ts
var SESSION_COOKIE_NAME = "chairmans_session";
var SessionService = class {
  /**
   * Hashes a raw session token using SHA-256 for secure DB storage.
   */
  static hashToken(token) {
    return crypto3.createHash("sha256").update(token).digest("hex");
  }
  /**
   * Creates a new session in the database and returns the raw token to send to the client.
   */
  static createSession(userId, meta = {}) {
    const rawToken = crypto3.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const settingsRows = sqliteEngine.query(
      "SELECT session_timeout_minutes FROM settings LIMIT 1"
    );
    const idleMinutes = settingsRows[0]?.session_timeout_minutes || 30;
    const absoluteHours = parseInt(process.env.SESSION_ABSOLUTE_HOURS || "12", 10);
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(now.getTime() + absoluteHours * 60 * 60 * 1e3);
    sqliteEngine.run(
      `INSERT INTO sessions (id, user_id, created_at, last_active_at, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tokenHash,
        userId,
        now.toISOString(),
        now.toISOString(),
        expiresAt.toISOString(),
        meta.ipAddress || null,
        meta.userAgent || null
      ]
    );
    return rawToken;
  }
  /**
   * Validates a session token from request cookie against the database.
   * Checks both absolute expiration and idle expiration.
   */
  static validateSession(rawToken, meta = {}) {
    if (!rawToken || typeof rawToken !== "string") {
      return { isValid: false };
    }
    const tokenHash = this.hashToken(rawToken);
    const sessionRows = sqliteEngine.query(
      "SELECT * FROM sessions WHERE id = ? LIMIT 1",
      [tokenHash]
    );
    const session = sessionRows[0];
    if (!session) {
      return { isValid: false };
    }
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(session.expires_at);
    if (now > expiresAt) {
      this.destroySession(rawToken);
      return { isValid: false };
    }
    const settingsRows = sqliteEngine.query(
      "SELECT session_timeout_minutes FROM settings LIMIT 1"
    );
    const idleMinutes = settingsRows[0]?.session_timeout_minutes || 30;
    const lastActive = new Date(session.last_active_at);
    const idleExpiry = new Date(lastActive.getTime() + idleMinutes * 60 * 1e3);
    if (now > idleExpiry) {
      this.destroySession(rawToken);
      return { isValid: false };
    }
    const userRows = sqliteEngine.query(
      `SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, avatar, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [session.user_id]
    );
    const dbUser = userRows[0];
    if (!dbUser) {
      this.destroySession(rawToken);
      return { isValid: false };
    }
    sqliteEngine.run(
      "UPDATE sessions SET last_active_at = ? WHERE id = ?",
      [now.toISOString(), tokenHash]
    );
    const user = {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      title: dbUser.title,
      department_id: dbUser.department_id,
      email: dbUser.email,
      role: dbUser.role,
      can_view_confidential: Boolean(dbUser.can_view_confidential),
      must_change_password: Boolean(dbUser.must_change_password),
      avatar: dbUser.avatar,
      created_at: dbUser.created_at
    };
    return { isValid: true, user, tokenHash };
  }
  /**
   * Destroys a single session.
   */
  static destroySession(rawToken) {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    sqliteEngine.run("DELETE FROM sessions WHERE id = ?", [tokenHash]);
  }
  /**
   * Destroys all sessions for a specific user (e.g. after password change).
   */
  static destroyAllUserSessions(userId) {
    sqliteEngine.run("DELETE FROM sessions WHERE user_id = ?", [userId]);
  }
  /**
   * Attaches the session cookie to the HTTP response.
   * In Production: SameSite=Strict, Secure (unless COOKIE_SECURE=false for LAN).
   * In Preview Mode (PREVIEW_MODE=true): SameSite=None, Secure=true for AI Studio iframe embedding.
   */
  static setCookie(res, rawToken) {
    const isProduction2 = process.env.NODE_ENV === "production";
    const isPreview = !isProduction2 && process.env.PREVIEW_MODE === "true";
    const isSecure = isPreview || process.env.COOKIE_SECURE !== "false";
    const sameSiteMode = isPreview ? "none" : "strict";
    const absoluteHours = parseInt(process.env.SESSION_ABSOLUTE_HOURS || "12", 10);
    res.cookie(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: sameSiteMode,
      secure: isSecure,
      path: "/",
      maxAge: absoluteHours * 60 * 60 * 1e3
    });
  }
  /**
   * Clears the session cookie from the client.
   */
  static clearCookie(res) {
    const isProduction2 = process.env.NODE_ENV === "production";
    const isPreview = !isProduction2 && process.env.PREVIEW_MODE === "true";
    const isSecure = isPreview || process.env.COOKIE_SECURE !== "false";
    const sameSiteMode = isPreview ? "none" : "strict";
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: sameSiteMode,
      secure: isSecure,
      path: "/"
    });
  }
};

// src/server/security/permissions.ts
var PERMISSION_MATRIX = {
  SECRETARY: {
    meetings: { create: true, read: true, update: true, update_minutes: true, archive: true },
    correspondence: { create: true, read: true, update: true, comment: true, refer: true, archive: true },
    directives: { read: true, update: true, archive: true },
    matters: { create: true, read: true, update: true, archive: true },
    contacts: { create: true, read: true, update: true, archive: true },
    notifications: { read: true, update: true },
    users: { read: true },
    audit: { read: true }
  },
  CHAIRMAN: {
    meetings: { read: true, approve_minutes: true, decide: true },
    correspondence: { read: true, approve: true, comment: true, refer: true },
    directives: { create: true, read: true, update: true },
    matters: { read: true },
    contacts: { read: true },
    notifications: { read: true, update: true },
    users: { read: true }
  },
  ADMIN: {
    users: { create: true, read: true, update: true, disable: true },
    settings: { read: true, update: true },
    audit: { read: true }
  },
  AUDITOR: {},
  DEPT_HEAD: {}
};
function can(user, action, resource) {
  if (!user) {
    return false;
  }
  const role = "role" in user ? user.role : user.role;
  return Boolean(PERMISSION_MATRIX[role]?.[resource]?.[action]);
}

// src/server/middleware/auth.middleware.ts
function sessionAuthMiddleware(req, res, next) {
  const cookies = req.cookies || {};
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (rawToken) {
    const meta = {
      ipAddress: req.ip || req.socket.remoteAddress || "127.0.0.1",
      userAgent: req.headers["user-agent"]
    };
    const validation = SessionService.validateSession(rawToken, meta);
    if (validation.isValid && validation.user) {
      req.user = validation.user;
      req.userContext = {
        userId: validation.user.id,
        role: validation.user.role,
        can_view_confidential: Boolean(validation.user.can_view_confidential)
      };
      req.rawSessionToken = rawToken;
    }
  }
  next();
}
function csrfProtection(req, res, next) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }
  const customHeader = req.headers["x-requested-with"] || req.headers["x-executive-client"];
  if (!customHeader) {
    res.status(403).json({
      error: "\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647: \u062A\u0631\u0648\u064A\u0633\u0629 \u0645\u0643\u0627\u0641\u062D\u0629 \u0627\u0644\u062A\u0632\u0648\u064A\u0631 \u0645\u0641\u0642\u0648\u062F\u0629 (CSRF Protection: Missing Custom Header)"
    });
    return;
  }
  const forwardedHost = req.headers["x-forwarded-host"];
  const directHost = req.headers.host;
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const validHosts = /* @__PURE__ */ new Set();
  if (directHost) validHosts.add(directHost);
  if (forwardedHost) {
    forwardedHost.split(",").forEach((h) => validHosts.add(h.trim()));
  }
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || "";
  if (allowedOriginsEnv) {
    allowedOriginsEnv.split(",").forEach((o) => {
      try {
        const u = new URL(o.trim());
        validHosts.add(u.host);
      } catch {
        validHosts.add(o.trim());
      }
    });
  }
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (!validHosts.has(originHost)) {
        res.status(403).json({
          error: "\u0637\u0644\u0628 \u0645\u0631\u0641\u0648\u0636: \u0639\u062F\u0645 \u062A\u0637\u0627\u0628\u0642 \u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628"
        });
        return;
      }
    } catch {
      res.status(403).json({ error: "\u0637\u0644\u0628 \u0645\u0631\u0641\u0648\u0636: \u0635\u064A\u063A\u0629 \u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
      return;
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (!validHosts.has(refererHost)) {
        res.status(403).json({
          error: "\u0637\u0644\u0628 \u0645\u0631\u0641\u0648\u0636: \u0639\u062F\u0645 \u062A\u0637\u0627\u0628\u0642 \u0645\u0631\u062C\u0639 \u0627\u0644\u0637\u0644\u0628"
        });
        return;
      }
    } catch {
      res.status(403).json({ error: "\u0637\u0644\u0628 \u0645\u0631\u0641\u0648\u0636: \u0635\u064A\u063A\u0629 \u0645\u0631\u062C\u0639 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
      return;
    }
  }
  next();
}
function requireAuth(req, res, next) {
  if (!req.user || !req.userContext) {
    res.status(401).json({
      error: "\u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0631\u062F"
    });
    return;
  }
  next();
}
function mustChangePasswordGuard(req, res, next) {
  if (req.user?.must_change_password) {
    const allowedPaths = [
      "/api/auth/change-password",
      "/api/auth/me",
      "/api/auth/logout",
      "/api/health"
    ];
    if (!allowedPaths.includes(req.path)) {
      res.status(403).json({
        error: "\u064A\u062C\u0628 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0623\u0648\u0644\u064A\u0629 \u0642\u0628\u0644 \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0646\u0638\u0627\u0645",
        code: "MUST_CHANGE_PASSWORD"
      });
      return;
    }
  }
  next();
}
function rbacGuard(resource, action) {
  return (req, res, next) => {
    if (!req.userContext) {
      res.status(401).json({
        error: "\u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0631\u062F",
        code: "UNAUTHORIZED"
      });
      return;
    }
    if (!can(req.userContext, action, resource)) {
      let errorMsg = "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0639\u062F\u0645 \u0643\u0641\u0627\u064A\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A";
      if (action === "approve") {
        errorMsg = "\u062A\u0623\u0634\u064A\u0631\u0629 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0631\u0626\u0627\u0633\u064A\u0629 \u0645\u0642\u0635\u0648\u0631\u0629 \u062D\u0635\u0631\u064A\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u062F \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629";
      }
      res.status(403).json({
        error: errorMsg,
        code: "FORBIDDEN"
      });
      return;
    }
    next();
  };
}

// src/server/middleware/error.middleware.ts
import { ZodError } from "zod";

// src/data/contracts/index.ts
var SecurityAuthorizationError = class extends Error {
  constructor(message = "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621") {
    super(message);
    this.name = "SecurityAuthorizationError";
  }
};

// src/server/middleware/error.middleware.ts
function errorHandler(err, req, res, next) {
  console.error(`[Server Error] ${req.method} ${req.path}:`, err);
  if (err instanceof SecurityAuthorizationError) {
    res.status(403).json({
      error: err.message || "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621"
    });
    return;
  }
  if (err instanceof ZodError || err.name === "ZodError") {
    res.status(400).json({
      error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629 \u0623\u0648 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u062D\u0642\u0648\u0644 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647\u0627",
      code: "VALIDATION_ERROR",
      details: err.issues || err.errors
    });
    return;
  }
  const errCode = String(err.code || "");
  const errMsg = String(err.message || "");
  const isSqliteConstraint = errCode.startsWith("SQLITE_CONSTRAINT") || errMsg.toLowerCase().includes("constraint failed");
  if (isSqliteConstraint) {
    if (errCode === "SQLITE_CONSTRAINT_NOTNULL" || errMsg.includes("NOT NULL constraint failed") || errCode === "SQLITE_CONSTRAINT_CHECK" || errMsg.includes("CHECK constraint failed")) {
      res.status(400).json({
        error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0635\u062D\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A: \u0628\u0639\u0636 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0625\u0644\u0632\u0627\u0645\u064A\u0629 \u0645\u0641\u0642\u0648\u062F\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629",
        code: "VALIDATION_ERROR"
      });
      return;
    }
    if (errCode === "SQLITE_CONSTRAINT_UNIQUE" || errCode === "SQLITE_CONSTRAINT_PRIMARYKEY" || errMsg.includes("UNIQUE constraint failed") || errMsg.includes("PRIMARY KEY constraint failed")) {
      res.status(409).json({
        error: "\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A: \u0627\u0644\u0633\u062C\u0644 \u0623\u0648 \u0627\u0644\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u062F\u062E\u0644 \u0645\u0648\u062C\u0648\u062F \u0645\u0633\u0628\u0642\u0627\u064B \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645",
        code: "CONFLICT"
      });
      return;
    }
    if (errCode === "SQLITE_CONSTRAINT_FOREIGNKEY" || errMsg.includes("FOREIGN KEY constraint failed")) {
      res.status(409).json({
        error: "\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u0627\u0644\u0639\u0644\u0627\u0642\u0627\u062A: \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u0631\u0628\u0637 \u0628\u0647",
        code: "CONFLICT"
      });
      return;
    }
    res.status(400).json({
      error: "\u062E\u0637\u0623 \u0641\u064A \u0642\u064A\u0648\u062F \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A",
      code: "VALIDATION_ERROR"
    });
    return;
  }
  const statusCode = err.statusCode || err.status || 500;
  let safeMessage = err.message || "\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0637\u0644\u0628";
  if (statusCode === 500 || safeMessage.toLowerCase().includes("sql") || safeMessage.includes("sqlite")) {
    safeMessage = "\u062D\u062F\u062B \u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645";
  }
  res.status(statusCode).json({
    error: safeMessage,
    code: err.code || (statusCode === 409 ? "CONFLICT" : statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR")
  });
}

// src/server/routes/api.router.ts
import { Router } from "express";

// src/server/controllers/auth.controller.ts
import { z } from "zod";

// src/domain/rules/serialGenerator.ts
function generateSerialNumber(prefix, currentCountForYear, year = (/* @__PURE__ */ new Date()).getFullYear()) {
  const padLength = prefix === "MATTER" ? 3 : 4;
  const nextSeq = String(currentCountForYear + 1).padStart(padLength, "0");
  return `${prefix}-${year}-${nextSeq}`;
}

// src/data/sqlite/repositories.ts
init_cryptoUtils();
var ALLOWED_MEETING_COLUMNS = /* @__PURE__ */ new Set(["title", "location", "start_time", "end_time", "meeting_type", "matter_id", "notes"]);
var ALLOWED_CORRESPONDENCE_COLUMNS = /* @__PURE__ */ new Set(["date", "source_or_dest_entity", "subject", "priority", "summary", "matter_id", "category", "tags"]);
var ALLOWED_DIRECTIVE_COLUMNS = /* @__PURE__ */ new Set(["title", "instruction", "assigned_department", "assigned_person", "source_type", "source_id", "priority", "due_date", "matter_id"]);
var ALLOWED_MATTER_COLUMNS = /* @__PURE__ */ new Set(["title", "description", "lead_entity", "priority"]);
var ALLOWED_CONTACT_COLUMNS = /* @__PURE__ */ new Set(["name", "entity", "position", "phone", "email", "category", "notes"]);
function canAccessConfidential(ctx) {
  return Boolean(ctx && ctx.can_view_confidential);
}
var SqliteAuditRepository = class {
  async getAll(filter, ctx) {
    if (!can(ctx, "read", "audit")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0631\u0642\u0627\u0628\u0629 \u0648\u0627\u0644\u062A\u062A\u0628\u0639 (403 Forbidden)");
    }
    let sql = "SELECT * FROM audit_log WHERE 1=1";
    const params = [];
    if (filter?.entityType) {
      sql += " AND entity_type = ?";
      params.push(filter.entityType);
    }
    if (filter?.userId) {
      sql += " AND user_id = ?";
      params.push(filter.userId);
    }
    sql += " ORDER BY seq DESC";
    if (filter?.limit) {
      sql += " LIMIT ?";
      params.push(filter.limit);
    }
    const rows = sqliteEngine.query(sql, params);
    if (!canAccessConfidential(ctx)) {
      return rows.map((r) => {
        if (r.is_confidential === 1 || r.entity_type?.toLowerCase().includes("confidential")) {
          return {
            ...r,
            before_value: r.before_value ? "[\u0628\u064A\u0627\u0646\u0627\u062A \u0633\u0631\u064A\u0629 \u0645\u062D\u062C\u0648\u0628\u0629]" : null,
            after_value: `[\u0625\u062C\u0631\u0627\u0621 \u0639\u0644\u0649 \u0639\u0646\u0635\u0631 \u0633\u0631\u064A \u0631\u0642\u0645: ${r.entity_id}]`
          };
        }
        return r;
      });
    }
    return rows;
  }
  async verify(ctx) {
    if (!can(ctx, "read", "audit")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A");
    }
    const rows = sqliteEngine.query("SELECT * FROM audit_log ORDER BY seq ASC");
    const settingsRows = sqliteEngine.query("SELECT audit_last_seq, audit_head_hash, audit_count FROM settings LIMIT 1");
    const checkpoint = settingsRows[0] ? {
      last_seq: settingsRows[0].audit_last_seq,
      head_hash: settingsRows[0].audit_head_hash,
      count: settingsRows[0].audit_count
    } : null;
    const { verifyAuditLogIntegrity: verifyAuditLogIntegrity3 } = await Promise.resolve().then(() => (init_cryptoUtils(), cryptoUtils_exports));
    return verifyAuditLogIntegrity3(rows, checkpoint);
  }
  async log(entry, ctx) {
    return sqliteEngine.runWithMutex(async () => {
      const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const latestRows = sqliteEngine.query("SELECT seq, entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1");
      const prevHash = latestRows[0]?.entry_hash || "GENESIS-BLOCK-00000000000000000000000000000000";
      const nextSeq = (latestRows[0]?.seq || 0) + 1;
      const ip = entry.ip_address || "";
      let safeBefore = entry.before_value;
      let safeAfter = entry.after_value;
      let confidentiality = "confidential";
      if (entry.entity_type === "CORRESPONDENCE") {
        const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [entry.entity_id]);
        if (rows.length > 0) {
          confidentiality = rows[0].confidentiality;
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          confidentiality = parsed.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "MEETING") {
        const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [entry.entity_id]);
        if (rows.length > 0) {
          confidentiality = rows[0].confidentiality;
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          confidentiality = parsed.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "DIRECTIVE") {
        const rows = sqliteEngine.query("SELECT confidentiality FROM directives WHERE id = ?", [entry.entity_id]);
        if (rows.length > 0) {
          confidentiality = rows[0].confidentiality;
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          confidentiality = parsed.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "MATTER") {
        const rows = sqliteEngine.query("SELECT confidentiality FROM matters WHERE id = ?", [entry.entity_id]);
        if (rows.length > 0) {
          confidentiality = rows[0].confidentiality;
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          confidentiality = parsed.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "BRIEFING_NOTE") {
        const bnRows = sqliteEngine.query("SELECT correspondence_id FROM briefing_notes WHERE id = ?", [entry.entity_id]);
        if (bnRows.length > 0) {
          const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [bnRows[0].correspondence_id]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          const parentId = parsed.correspondence_id || parsed.id;
          const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [parentId]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "APPROVAL") {
        const appRows = sqliteEngine.query("SELECT correspondence_id FROM approvals WHERE id = ?", [entry.entity_id]);
        if (appRows.length > 0) {
          const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [appRows[0].correspondence_id]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          const parentId = parsed.correspondence_id || parsed.id;
          const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [parentId]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "ATTACHMENT") {
        const attRows = sqliteEngine.query("SELECT entity_id, entity_type FROM attachments WHERE id = ?", [entry.entity_id]);
        if (attRows.length > 0) {
          if (attRows[0].entity_type === "correspondence") {
            const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [attRows[0].entity_id]);
            confidentiality = rows[0]?.confidentiality || "confidential";
          } else if (attRows[0].entity_type === "meeting") {
            const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [attRows[0].entity_id]);
            confidentiality = rows[0]?.confidentiality || "confidential";
          }
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          if (parsed.entity_type === "correspondence") {
            const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [parsed.entity_id]);
            confidentiality = rows[0]?.confidentiality || "confidential";
          } else if (parsed.entity_type === "meeting") {
            const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [parsed.entity_id]);
            confidentiality = rows[0]?.confidentiality || "confidential";
          }
        }
      } else if (entry.entity_type === "ROUTING") {
        const rtRows = sqliteEngine.query("SELECT correspondence_id FROM correspondence_routing WHERE id = ?", [entry.entity_id]);
        if (rtRows.length > 0) {
          const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [rtRows[0].correspondence_id]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          const parentId = parsed.correspondence_id || parsed.id;
          const rows = sqliteEngine.query("SELECT confidentiality FROM correspondence WHERE id = ?", [parentId]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "DECISION") {
        const decRows = sqliteEngine.query("SELECT meeting_id FROM decisions WHERE id = ?", [entry.entity_id]);
        if (decRows.length > 0) {
          const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [decRows[0].meeting_id]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          const parentId = parsed.meeting_id || parsed.id;
          const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [parentId]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "AGENDA_ITEM") {
        const agRows = sqliteEngine.query("SELECT meeting_id FROM agenda_items WHERE id = ?", [entry.entity_id]);
        if (agRows.length > 0) {
          const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [agRows[0].meeting_id]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          const parentId = parsed.meeting_id || parsed.id;
          const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [parentId]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "MEETING_MINUTES") {
        const mmRows = sqliteEngine.query("SELECT meeting_id FROM meeting_minutes WHERE id = ?", [entry.entity_id]);
        if (mmRows.length > 0) {
          const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [mmRows[0].meeting_id]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          const parentId = parsed.meeting_id || parsed.id;
          const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [parentId]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        }
      } else if (entry.entity_type === "MEETING_ATTENDEE") {
        const maRows = sqliteEngine.query("SELECT meeting_id FROM meeting_attendees WHERE id = ?", [entry.entity_id]);
        if (maRows.length > 0) {
          const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [maRows[0].meeting_id]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        } else if (entry.after_value) {
          const parsed = JSON.parse(entry.after_value);
          const parentId = parsed.meeting_id || parsed.id;
          const rows = sqliteEngine.query("SELECT confidentiality FROM meetings WHERE id = ?", [parentId]);
          confidentiality = rows[0]?.confidentiality || "confidential";
        }
      } else if (["AUTH", "SESSION", "LOGIN_FAILURE", "USER_PASSWORD", "LOCK_SCREEN_UNLOCK", "CONFIG", "BACKUP"].includes(entry.entity_type)) {
        confidentiality = "normal";
      } else {
        confidentiality = "confidential";
      }
      const isConfVal = confidentiality !== "normal" ? 1 : 0;
      if (isConfVal === 1) {
        const whitelistConfidentialJson = (jsonStr) => {
          if (!jsonStr) return null;
          try {
            const parsed = JSON.parse(jsonStr);
            if (typeof parsed !== "object" || parsed === null) {
              return JSON.stringify({
                entity_type: entry.entity_type,
                entity_id: entry.entity_id,
                action: entry.action_type
              });
            }
            const whitelisted = {
              entity_type: entry.entity_type,
              entity_id: entry.entity_id,
              action: entry.action_type,
              details: "[\u0645\u062D\u062C\u0648\u0628 \u0644\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A]"
            };
            const allowedKeys = ["id", "serial_number", "serial", "code", "type", "status", "confidentiality"];
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
              details: "[\u0645\u062D\u062C\u0648\u0628 \u0644\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A]"
            });
          }
        };
        safeBefore = whitelistConfidentialJson(safeBefore);
        safeAfter = whitelistConfidentialJson(safeAfter);
      }
      const entryHash = await computeAuditEntryHash({
        seq: nextSeq,
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
        prev_hash: prevHash,
        is_confidential: isConfVal
      });
      sqliteEngine.transaction(() => {
        sqliteEngine.run(
          "INSERT INTO audit_log (seq, id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address, prev_hash, entry_hash, is_confidential) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            nextSeq,
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
        sqliteEngine.run(
          `UPDATE settings SET audit_last_seq = ?, audit_head_hash = ?, audit_count = audit_count + 1 WHERE id = 'settings-global' OR id = (SELECT id FROM settings LIMIT 1)`,
          [nextSeq, entryHash]
        );
      });
    });
  }
};
var SqliteMeetingRepository = class {
  async getAll(filter, ctx) {
    if (!can(ctx, "read", "meetings")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A");
    }
    let sql = "SELECT * FROM meetings WHERE deleted_at IS NULL";
    const params = [];
    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }
    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }
    if (filter?.matterId) {
      sql += " AND matter_id = ?";
      params.push(filter.matterId);
    }
    if (filter?.date) {
      sql += " AND date(start_time) = date(?)";
      params.push(filter.date);
    }
    if (filter?.search) {
      sql += " AND (title LIKE ? OR location LIKE ? OR notes LIKE ?)";
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }
    sql += " ORDER BY start_time DESC";
    return sqliteEngine.query(sql, params);
  }
  async getById(id, ctx) {
    if (!can(ctx, "read", "meetings")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u062A\u0641\u0627\u0635\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639");
    }
    const rows = sqliteEngine.query("SELECT * FROM meetings WHERE id = ? AND deleted_at IS NULL", [id]);
    const meeting = rows[0] || null;
    if (meeting && meeting.confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      return null;
    }
    return meeting;
  }
  async create(data, ctx) {
    if (!can(ctx, "create", "meetings")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0631\u062A\u0628\u062A\u0643 \u0627\u0644\u0648\u0638\u064A\u0641\u064A\u0629 \u0628\u0625\u0646\u0634\u0627\u0621 \u0623\u0648 \u062C\u062F\u0648\u0644\u0629 \u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0631\u0633\u0645\u064A\u0629");
    }
    const confidentiality = data.confidentiality || "normal";
    if (confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0646\u0634\u0627\u0621 \u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0630\u0627\u062A \u062A\u0635\u0646\u064A\u0641 \u0633\u0631\u064A \u062F\u0648\u0646 \u062A\u0635\u0631\u064A\u062D \u0623\u0645\u0646\u064A");
    }
    const id = `mtg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const status = "scheduled";
    const created_by = ctx.userId || "\u0645\u0633\u062A\u062E\u062F\u0645";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO meetings (id, title, location, start_time, end_time, meeting_type, status, matter_id, confidentiality, notes, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        data.title,
        data.location,
        data.start_time,
        data.end_time,
        data.meeting_type,
        status,
        data.matter_id || null,
        confidentiality,
        data.notes || null,
        now,
        now,
        created_by
      ]
    );
    return await this.getById(id, ctx);
  }
  async update(id, meeting, ctx) {
    if (!can(ctx, "update", "meetings")) {
      const keys = Object.keys(meeting);
      const isStatusOnly = keys.every((k) => k === "status" || k === "updated_at");
      if (isStatusOnly && can(ctx, "approve_minutes", "meetings")) {
      } else {
        throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0631\u062A\u0628\u062A\u0643 \u0627\u0644\u0648\u0638\u064A\u0641\u064A\u0629 \u0628\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639");
      }
    }
    const existing = await this.getById(id, ctx);
    if (!existing) {
      throw new SecurityAuthorizationError("\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0645\u062D\u062C\u0648\u0628 \u0644\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const fields = ["updated_at = ?"];
    const params = [now];
    for (const [key, value] of Object.entries(meeting)) {
      if (key !== "id" && key !== "created_at" && key !== "updated_at" && ALLOWED_MEETING_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE meetings SET ${fields.join(", ")} WHERE id = ?`, params);
    return await this.getById(id, ctx);
  }
  async softDelete(id, ctx) {
    if (!can(ctx, "archive", "meetings")) {
      throw new SecurityAuthorizationError("\u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u0642\u0635\u0648\u0631 \u0648\u0645\u062D\u0638\u0648\u0631 \u0639\u0644\u0649 \u0643\u0627\u0641\u0629 \u0627\u0644\u0631\u062A\u0628");
    }
    const existing = await this.getById(id, ctx);
    if (!existing) {
      const err = new Error("\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0645\u062D\u062C\u0648\u0628 \u0644\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
      err.statusCode = 404;
      throw err;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run("UPDATE meetings SET deleted_at = ? WHERE id = ?", [now, id]);
    return true;
  }
  async getAttendees(meetingId, ctx) {
    const parent = await this.getById(meetingId, ctx);
    if (!parent) return [];
    return sqliteEngine.query("SELECT * FROM meeting_attendees WHERE meeting_id = ? ORDER BY name ASC", [meetingId]);
  }
  async setAttendees(meetingId, attendees, ctx) {
    if (!can(ctx, "update", "meetings")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062D\u0627\u0636\u0631\u064A\u0646");
    }
    const parent = await this.getById(meetingId, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0633\u0631\u064A");
    sqliteEngine.run("DELETE FROM meeting_attendees WHERE meeting_id = ?", [meetingId]);
    for (const a of attendees) {
      const id = `attd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqliteEngine.run(
        "INSERT INTO meeting_attendees (id, meeting_id, name, title, entity, is_required, attendance_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, meetingId, a.name, a.title, a.entity, a.is_required ? 1 : 0, a.attendance_status || "invited"]
      );
    }
  }
  async getAgenda(meetingId, ctx) {
    const parent = await this.getById(meetingId, ctx);
    if (!parent) return [];
    return sqliteEngine.query("SELECT * FROM agenda_items WHERE meeting_id = ? ORDER BY order_index ASC", [meetingId]);
  }
  async setAgenda(meetingId, items, ctx) {
    if (!can(ctx, "update", "meetings")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u062C\u062F\u0648\u0644 \u0627\u0644\u0623\u0639\u0645\u0627\u0644");
    }
    const parent = await this.getById(meetingId, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0633\u0631\u064A");
    sqliteEngine.run("DELETE FROM agenda_items WHERE meeting_id = ?", [meetingId]);
    for (const item of items) {
      const id = `agenda-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqliteEngine.run(
        "INSERT INTO agenda_items (id, meeting_id, order_index, title, presenter_name, duration_minutes, is_confidential) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, meetingId, item.order_index, item.title, item.presenter_name || item.presenter, item.duration_minutes, item.is_confidential ? 1 : 0]
      );
    }
  }
  async getMinutes(meetingId, ctx) {
    const parent = await this.getById(meetingId, ctx);
    if (!parent) return null;
    const rows = sqliteEngine.query("SELECT * FROM meeting_minutes WHERE meeting_id = ?", [meetingId]);
    return rows[0] || null;
  }
  async saveMinutes(minutes, ctx) {
    const parent = await this.getById(minutes.meeting_id, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0633\u0631\u064A");
    if (minutes.status === "approved" && !can(ctx, "approve_minutes", "meetings")) {
      throw new SecurityAuthorizationError("\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u0625\u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u062D\u0636\u0631 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u0642\u0635\u0648\u0631 \u062D\u0635\u0631\u064A\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u062F \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629");
    }
    if (minutes.status === "draft" && !can(ctx, "update_minutes", "meetings")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062D\u0641\u0638 \u0645\u0633\u0648\u062F\u0629 \u0645\u062D\u0636\u0631 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639");
    }
    const existing = await this.getMinutes(minutes.meeting_id, ctx);
    if (existing) {
      sqliteEngine.run(
        "UPDATE meeting_minutes SET draft_content = ?, approved_content = ?, status = ?, approved_by = ?, approved_at = ? WHERE meeting_id = ?",
        [minutes.draft_content ?? existing.draft_content ?? null, minutes.approved_content ?? existing.approved_content ?? null, minutes.status, minutes.approved_by || null, minutes.approved_at || null, minutes.meeting_id]
      );
      return await this.getMinutes(minutes.meeting_id, ctx);
    } else {
      const id = `min-${Date.now()}`;
      const draftContent = minutes.draft_content ?? "";
      sqliteEngine.run(
        "INSERT INTO meeting_minutes (id, meeting_id, draft_content, approved_content, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, minutes.meeting_id, draftContent, minutes.approved_content || null, minutes.status || "draft", minutes.approved_by || null, minutes.approved_at || null]
      );
      return await this.getMinutes(minutes.meeting_id, ctx);
    }
  }
  async getDecisions(meetingId, ctx) {
    const parent = await this.getById(meetingId, ctx);
    if (!parent) return [];
    return sqliteEngine.query("SELECT * FROM decisions WHERE meeting_id = ? ORDER BY order_index ASC", [meetingId]);
  }
  async addDecision(decision, ctx) {
    if (!can(ctx, "decide", "meetings")) {
      throw new SecurityAuthorizationError("\u0625\u0642\u0631\u0627\u0631 \u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0627\u0644\u0631\u0633\u0645\u064A\u0629 \u0645\u0642\u0635\u0648\u0631 \u062D\u0635\u0631\u064A\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u062F \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629");
    }
    const parent = await this.getById(decision.meeting_id, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0633\u0631\u064A");
    const id = `dec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const orderIndex = decision.order_index ?? 1;
    const content = decision.content || decision.decision_text || "";
    const assignedToName = decision.assigned_to_name || decision.assigned_to_entity || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F";
    const dueDate = decision.due_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const status = decision.status || "pending";
    sqliteEngine.run(
      "INSERT INTO decisions (id, meeting_id, order_index, content, assigned_department_id, assigned_to_name, due_date, directive_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, decision.meeting_id, orderIndex, content, decision.assigned_department_id || null, assignedToName, dueDate, decision.directive_id || null, status]
    );
    const rows = sqliteEngine.query("SELECT * FROM decisions WHERE id = ?", [id]);
    return rows[0];
  }
};
function mapCorrespondenceRow(row) {
  if (!row) return row;
  let parsedTags = [];
  if (Array.isArray(row.tags)) {
    parsedTags = row.tags;
  } else if (typeof row.tags === "string") {
    try {
      parsedTags = JSON.parse(row.tags);
    } catch {
      parsedTags = [];
    }
  }
  return {
    ...row,
    tags: parsedTags,
    category: row.category || "operations"
  };
}
var SqliteCorrespondenceRepository = class {
  async getAll(filter, ctx) {
    if (!can(ctx, "read", "correspondence")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0631\u0627\u0633\u0644\u0627\u062A \u0627\u0644\u0631\u0633\u0645\u064A\u0629");
    }
    let sql = "SELECT * FROM correspondence WHERE deleted_at IS NULL";
    if (!canAccessConfidential(ctx)) {
      sql += " AND confidentiality = 'normal'";
    }
    const params = [];
    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }
    if (filter?.type) {
      sql += " AND type = ?";
      params.push(filter.type);
    }
    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }
    if (filter?.matterId) {
      sql += " AND matter_id = ?";
      params.push(filter.matterId);
    }
    if (filter?.priority) {
      sql += " AND priority = ?";
      params.push(filter.priority);
    }
    if (filter?.category && filter.category !== "all") {
      sql += " AND category = ?";
      params.push(filter.category);
    }
    if (filter?.tag && filter.tag !== "all") {
      sql += " AND tags LIKE ?";
      params.push(`%"${filter.tag}"%`);
    }
    if (filter?.search) {
      sql += " AND (subject LIKE ? OR serial_number LIKE ? OR summary LIKE ? OR source_or_dest_entity LIKE ? OR tags LIKE ?)";
      const term = `%${filter.search}%`;
      params.push(term, term, term, term, term);
    }
    sql += " ORDER BY created_at DESC";
    const rows = sqliteEngine.query(sql, params);
    return rows.map(mapCorrespondenceRow);
  }
  async getById(id, ctx) {
    if (!can(ctx, "read", "correspondence")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0643\u0627\u062A\u0628\u0629");
    }
    const rows = sqliteEngine.query("SELECT * FROM correspondence WHERE id = ? AND deleted_at IS NULL", [id]);
    const corr = rows[0] ? mapCorrespondenceRow(rows[0]) : null;
    if (corr && corr.confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      return null;
    }
    return corr;
  }
  async getBySerial(serial, ctx) {
    if (!can(ctx, "read", "correspondence")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0643\u0627\u062A\u0628\u0629");
    }
    const rows = sqliteEngine.query("SELECT * FROM correspondence WHERE serial_number = ? AND deleted_at IS NULL", [serial]);
    const corr = rows[0] ? mapCorrespondenceRow(rows[0]) : null;
    if (corr && corr.confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      return null;
    }
    return corr;
  }
  async getNextSerial(type, year = (/* @__PURE__ */ new Date()).getFullYear()) {
    const prefix = type === "incoming" ? "IN" : "OUT";
    const rows = sqliteEngine.query(
      "SELECT COUNT(*) as count FROM correspondence WHERE type = ? AND strftime('%Y', created_at) = ?",
      [type, String(year)]
    );
    const count = rows[0]?.count || 0;
    return generateSerialNumber(prefix, count, year);
  }
  async create(data, ctx) {
    if (!can(ctx, "create", "correspondence")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0631\u062A\u0628\u062A\u0643 \u0627\u0644\u0648\u0638\u064A\u0641\u064A\u0629 \u0628\u062A\u0633\u062C\u064A\u0644 \u0645\u0643\u0627\u062A\u0628\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0641\u064A \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0631\u0633\u0645\u064A");
    }
    const confidentiality = data.confidentiality || "normal";
    if (confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0646\u0634\u0627\u0621 \u0645\u0643\u0627\u062A\u0628\u0627\u062A \u0633\u0631\u064A\u0629 \u062F\u0648\u0646 \u062A\u0635\u0631\u064A\u062D \u0623\u0645\u0646\u064A");
    }
    const id = `corr-${data.type === "incoming" ? "in" : "out"}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const serial_number = data.serial_number || await this.getNextSerial(data.type);
    const status = "registered";
    const created_by = ctx.userId || "\u0645\u0633\u062A\u062E\u062F\u0645";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, matter_id, category, tags, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        serial_number,
        data.type,
        data.date,
        data.source_or_dest_entity,
        data.subject,
        data.priority,
        confidentiality,
        data.summary ?? "",
        status,
        data.matter_id || null,
        data.category || "operations",
        JSON.stringify(data.tags || []),
        now,
        now,
        created_by
      ]
    );
    return await this.getById(id, ctx);
  }
  async update(id, item, ctx) {
    if (!can(ctx, "update", "correspondence")) {
      const keys = Object.keys(item);
      const isStatusOnly = keys.every((k) => k === "status" || k === "updated_at");
      if (isStatusOnly && can(ctx, "approve", "correspondence")) {
      } else {
        throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0631\u062A\u0628\u062A\u0643 \u0627\u0644\u0648\u0638\u064A\u0641\u064A\u0629 \u0628\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0643\u0627\u062A\u0628\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629");
      }
    }
    const existing = await this.getById(id, ctx);
    if (!existing) {
      throw new SecurityAuthorizationError("\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0645\u062D\u062C\u0648\u0628\u0629 \u0644\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const fields = ["updated_at = ?"];
    const params = [now];
    for (const [key, value] of Object.entries(item)) {
      if (key !== "id" && key !== "created_at" && key !== "updated_at" && ALLOWED_CORRESPONDENCE_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        if (key === "tags" && Array.isArray(value)) {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE correspondence SET ${fields.join(", ")} WHERE id = ?`, params);
    return await this.getById(id, ctx);
  }
  async softDelete(id, ctx) {
    if (!can(ctx, "archive", "correspondence")) {
      throw new SecurityAuthorizationError("\u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u0642\u0635\u0648\u0631 \u0648\u0645\u062D\u0638\u0648\u0631 \u0639\u0644\u0649 \u0643\u0627\u0641\u0629 \u0627\u0644\u0631\u062A\u0628");
    }
    const existing = await this.getById(id, ctx);
    if (!existing) {
      const err = new Error("\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0645\u062D\u062C\u0648\u0628\u0629 \u0628\u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
      err.statusCode = 404;
      throw err;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run("UPDATE correspondence SET deleted_at = ? WHERE id = ?", [now, id]);
    return true;
  }
  async submit(id, comment, ctx) {
    if (!can(ctx, "update", "correspondence")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0643\u0627\u062A\u0628\u0629 \u0644\u0644\u0639\u0631\u0636");
    }
    const existing = await this.getById(id, ctx);
    if (!existing) {
      const err = new Error("\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0645\u062D\u062C\u0648\u0628\u0629 \u0628\u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
      err.statusCode = 404;
      throw err;
    }
    if (existing.status !== "registered" && existing.status !== "draft") {
      const err = new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0643\u0627\u062A\u0628\u0629: \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u0644\u0645\u0643\u0627\u062A\u0628\u0629 \u0644\u0627 \u062A\u0633\u0645\u062D \u0628\u0647\u0630\u0627 \u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644");
      err.statusCode = 409;
      throw err;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run("UPDATE correspondence SET status = ?, updated_at = ? WHERE id = ?", ["submitted", now, id]);
    return await this.getById(id, ctx);
  }
  async reclassify(id, confidentiality, reason, ctx) {
    if (!canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError("\u062A\u063A\u064A\u064A\u0631 \u0645\u0633\u062A\u0648\u0649 \u0633\u0631\u064A\u0629 \u0627\u0644\u0645\u0643\u0627\u062A\u0628\u0627\u062A \u064A\u062A\u0637\u0644\u0628 \u062A\u0635\u0631\u064A\u062D\u0627\u064B \u0623\u0645\u0646\u064A\u0627\u064B \u0645\u0639\u062A\u0645\u062F\u0627\u064B");
    }
    const existing = await this.getById(id, ctx);
    if (!existing) {
      const err = new Error("\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0645\u062D\u062C\u0648\u0628\u0629 \u0628\u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
      err.statusCode = 404;
      throw err;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run("UPDATE correspondence SET confidentiality = ?, updated_at = ? WHERE id = ?", [confidentiality, now, id]);
    return await this.getById(id, ctx);
  }
  async getBriefingNote(correspondenceId, ctx) {
    const parent = await this.getById(correspondenceId, ctx);
    if (!parent) return null;
    const rows = sqliteEngine.query("SELECT * FROM briefing_notes WHERE correspondence_id = ?", [correspondenceId]);
    return rows[0] || null;
  }
  async saveBriefingNote(note, ctx) {
    if (!can(ctx, "comment", "correspondence")) {
      throw new SecurityAuthorizationError("\u0625\u0639\u062F\u0627\u062F \u0648\u062D\u0641\u0638 \u0645\u0630\u0643\u0631\u0627\u062A \u0627\u0644\u0639\u0631\u0636 \u0645\u0642\u0635\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A\u0629 \u0648\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629");
    }
    const parent = await this.getById(note.correspondence_id, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0627\u0644\u0633\u0631\u064A\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062F\u0648\u0646 \u062A\u0635\u0631\u064A\u062D \u0623\u0645\u0646\u064A");
    const existing = await this.getBriefingNote(note.correspondence_id, ctx);
    const background = note.background ?? note.summary ?? "";
    const secretary_recommendation = note.secretary_recommendation ?? note.recommendation ?? "";
    const executive_opinion = note.executive_opinion ?? note.legal_opinion ?? "";
    const prepared_by_name = note.prepared_by_name || ctx.userId || "\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0646\u0638\u0627\u0645";
    const prepared_at = note.prepared_at || (/* @__PURE__ */ new Date()).toISOString();
    if (existing) {
      sqliteEngine.run(
        "UPDATE briefing_notes SET background = ?, secretary_recommendation = ?, executive_opinion = ?, prepared_by_name = ?, prepared_at = ? WHERE correspondence_id = ?",
        [background, secretary_recommendation, executive_opinion, prepared_by_name, prepared_at, note.correspondence_id]
      );
    } else {
      const id = `brief-${Date.now()}`;
      sqliteEngine.run(
        "INSERT INTO briefing_notes (id, correspondence_id, background, secretary_recommendation, executive_opinion, prepared_by_name, prepared_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, note.correspondence_id, background, secretary_recommendation, executive_opinion, prepared_by_name, prepared_at]
      );
    }
    return await this.getBriefingNote(note.correspondence_id, ctx);
  }
  async getApproval(correspondenceId, ctx) {
    const parent = await this.getById(correspondenceId, ctx);
    if (!parent) return null;
    const rows = sqliteEngine.query("SELECT * FROM approvals WHERE correspondence_id = ?", [correspondenceId]);
    return rows[0] || null;
  }
  async recordApproval(approval, ctx) {
    if (!can(ctx, "approve", "correspondence")) {
      throw new SecurityAuthorizationError("\u062A\u0623\u0634\u064A\u0631\u0629 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0631\u0626\u0627\u0633\u064A\u0629 \u0645\u0642\u0635\u0648\u0631\u0629 \u062D\u0635\u0631\u064A\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u062F \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629");
    }
    const parent = await this.getById(approval.correspondence_id, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0645\u062D\u062C\u0648\u0628\u0629 \u0628\u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
    const id = `appr-${Date.now()}`;
    const decision_type = approval.decision_type || approval.decision || "approved";
    const standard_phrase = approval.standard_phrase || approval.notes || "\u0645\u0639\u062A\u0645\u062F";
    const decided_at = approval.decided_at || (/* @__PURE__ */ new Date()).toISOString();
    const decided_by_name = approval.decided_by_name || ctx.userId || "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629";
    sqliteEngine.run(
      "INSERT INTO approvals (id, correspondence_id, decision_type, standard_phrase, custom_directive, decided_at, decided_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, approval.correspondence_id, decision_type, standard_phrase, approval.custom_directive || null, decided_at, decided_by_name]
    );
    return await this.getApproval(approval.correspondence_id, ctx);
  }
  async getRoutings(correspondenceId, ctx) {
    const parent = await this.getById(correspondenceId, ctx);
    if (!parent) return [];
    return sqliteEngine.query("SELECT * FROM correspondence_routing WHERE correspondence_id = ? ORDER BY routed_at ASC", [correspondenceId]);
  }
  async addRouting(routing, ctx) {
    if (!can(ctx, "update", "correspondence")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0648\u062C\u064A\u0647 \u0648\u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0643\u0627\u062A\u0628\u0629");
    }
    const parent = await this.getById(routing.correspondence_id, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0645\u062D\u062C\u0648\u0628\u0629 \u0644\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
    const id = `rout-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const to_department_id = routing.to_department_id || routing.to_entity || "dept-general";
    const to_department_name = routing.to_department_name || routing.to_entity || "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629";
    const action_required = routing.action_required || "\u0644\u0644\u062F\u0631\u0627\u0633\u0629 \u0648\u0627\u0644\u0639\u0631\u0636";
    const deadline = routing.deadline || routing.due_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const status = routing.status || "sent";
    const routed_at = routing.routed_at || (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO correspondence_routing (id, correspondence_id, from_entity, to_department_id, to_department_name, action_required, deadline, status, routed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, routing.correspondence_id, routing.from_entity, to_department_id, to_department_name, action_required, deadline, status, routed_at]
    );
    const rows = sqliteEngine.query("SELECT * FROM correspondence_routing WHERE id = ?", [id]);
    return rows[0];
  }
  async getAttachments(correspondenceId, ctx) {
    const parent = await this.getById(correspondenceId, ctx);
    if (!parent) return [];
    let sql = "SELECT * FROM attachments WHERE entity_type = 'correspondence' AND entity_id = ?";
    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }
    return sqliteEngine.query(sql, [correspondenceId]);
  }
  async addAttachment(att, ctx) {
    if (!can(ctx, "update", "correspondence")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0625\u0636\u0627\u0641\u0629 \u0645\u0631\u0641\u0642\u0627\u062A \u0625\u0644\u0649 \u0627\u0644\u0645\u0643\u0627\u062A\u0628\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629");
    }
    const entityId = att.entity_id || att.correspondence_id;
    const parent = await this.getById(entityId, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0633\u0631\u064A\u0651\u0629");
    if (att.confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0636\u0627\u0641\u0629 \u0645\u0631\u0641\u0642\u0627\u062A \u0633\u0631\u064A\u0629 \u062F\u0648\u0646 \u062A\u0635\u0631\u064A\u062D \u0623\u0645\u0646\u064A");
    }
    const id = `att-${Date.now()}`;
    const entityType = att.entity_type || "correspondence";
    const fileName = att.file_name || "attachment.dat";
    const fileSizeKb = att.file_size_kb ?? att.file_size ?? 0;
    const mimeType = att.mime_type || att.file_type || "application/octet-stream";
    const confidentiality = att.confidentiality || "normal";
    const uploadedAt = att.uploaded_at || (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO attachments (id, entity_type, entity_id, file_name, file_size_kb, mime_type, confidentiality, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, entityType, entityId, fileName, fileSizeKb, mimeType, confidentiality, uploadedAt]
    );
    const rows = sqliteEngine.query("SELECT * FROM attachments WHERE id = ?", [id]);
    return rows[0];
  }
};
var SqliteDirectiveRepository = class {
  async getAll(filter, ctx) {
    if (!can(ctx, "read", "directives")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u062A\u0643\u0644\u064A\u0641\u0627\u062A \u0627\u0644\u0631\u0626\u0627\u0633\u064A\u0629");
    }
    let sql = "SELECT * FROM directives WHERE deleted_at IS NULL";
    const params = [];
    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }
    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }
    if (filter?.assignedDepartment) {
      sql += " AND assigned_department = ?";
      params.push(filter.assignedDepartment);
    }
    if (filter?.matterId) {
      sql += " AND matter_id = ?";
      params.push(filter.matterId);
    }
    if (filter?.search) {
      sql += " AND (title LIKE ? OR instruction LIKE ? OR code LIKE ? OR assigned_person LIKE ?)";
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }
    sql += " ORDER BY issued_at DESC";
    return sqliteEngine.query(sql, params);
  }
  async getById(id, ctx) {
    if (!can(ctx, "read", "directives")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u062A\u0643\u0644\u064A\u0641");
    }
    const rows = sqliteEngine.query("SELECT * FROM directives WHERE id = ? AND deleted_at IS NULL", [id]);
    const dir = rows[0] || null;
    if (dir && dir.confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      return null;
    }
    return dir;
  }
  async getNextCode(year = (/* @__PURE__ */ new Date()).getFullYear()) {
    const rows = sqliteEngine.query(
      "SELECT COUNT(*) as count FROM directives WHERE strftime('%Y', issued_at) = ?",
      [String(year)]
    );
    const count = rows[0]?.count || 0;
    return generateSerialNumber("DIR", count, year);
  }
  async create(data, ctx) {
    if (!can(ctx, "create", "directives")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0631\u062A\u0628\u062A\u0643 \u0628\u0625\u0646\u0634\u0627\u0621 \u062A\u0643\u0644\u064A\u0641\u0627\u062A \u062C\u062F\u064A\u062F\u0629");
    }
    const confidentiality = data.confidentiality || "normal";
    if (confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0635\u062F\u0627\u0631 \u062A\u0643\u0644\u064A\u0641 \u0633\u0631\u064A \u062F\u0648\u0646 \u062A\u0635\u0631\u064A\u062D \u0623\u0645\u0646\u064A");
    }
    const id = `dir-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const code = data.code || await this.getNextCode();
    const status = "new";
    const progress_percent = 0;
    const created_by = ctx.userId || "\u0645\u0633\u062A\u062E\u062F\u0645";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO directives (id, code, title, instruction, assigned_department, assigned_person, source_type, source_id, priority, confidentiality, status, progress_percent, issued_at, due_date, matter_id, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        code,
        data.title,
        data.instruction,
        data.assigned_department,
        data.assigned_person ?? "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
        data.source_type,
        data.source_id || null,
        data.priority,
        confidentiality,
        status,
        progress_percent,
        data.issued_at || now,
        data.due_date ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        data.matter_id || null,
        created_by,
        now
      ]
    );
    return await this.getById(id, ctx);
  }
  async update(id, directive, ctx) {
    if (!can(ctx, "update", "directives")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0643\u0644\u064A\u0641");
    }
    const existing = await this.getById(id, ctx);
    if (!existing) {
      throw new SecurityAuthorizationError("\u0627\u0644\u062A\u0643\u0644\u064A\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0645\u062D\u062C\u0648\u0628 \u0628\u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0633\u0631\u064A");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const fields = ["updated_at = ?"];
    const params = [now];
    for (const [key, value] of Object.entries(directive)) {
      if (key !== "id" && key !== "created_at" && key !== "updated_at" && ALLOWED_DIRECTIVE_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE directives SET ${fields.join(", ")} WHERE id = ?`, params);
    return await this.getById(id, ctx);
  }
  async softDelete(id, ctx) {
    if (!can(ctx, "archive", "directives")) {
      throw new SecurityAuthorizationError("\u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u0642\u0635\u0648\u0631 \u0648\u0645\u062D\u0638\u0648\u0631 \u0639\u0644\u0649 \u0643\u0627\u0641\u0629 \u0627\u0644\u0631\u062A\u0628");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run("UPDATE directives SET deleted_at = ? WHERE id = ?", [now, id]);
    return true;
  }
  async getUpdates(directiveId, ctx) {
    const parent = await this.getById(directiveId, ctx);
    if (!parent) return [];
    return sqliteEngine.query("SELECT * FROM directive_updates WHERE directive_id = ? ORDER BY created_at DESC", [directiveId]);
  }
  async addUpdate(update, ctx) {
    if (!can(ctx, "update", "directives")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0633\u062C\u064A\u0644 \u062A\u062D\u062F\u064A\u062B\u0627\u062A \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0639\u0644\u0649 \u0627\u0644\u062A\u0643\u0644\u064A\u0641");
    }
    const parent = await this.getById(update.directive_id, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u062A\u0643\u0644\u064A\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0633\u0631\u064A");
    const id = `upd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const notes = update.notes || update.update_text || update.content || "";
    const progress_percent = update.progress_percent ?? 0;
    const updated_by = update.updated_by || update.updated_by_name || ctx.userId || "\u0645\u0633\u062A\u062E\u062F\u0645";
    sqliteEngine.run(
      "INSERT INTO directive_updates (id, directive_id, notes, progress_percent, updated_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, update.directive_id, notes, progress_percent, updated_by, now]
    );
    sqliteEngine.run("UPDATE directives SET progress_percent = ?, updated_at = ? WHERE id = ?", [progress_percent, now, update.directive_id]);
    const rows = sqliteEngine.query("SELECT * FROM directive_updates WHERE id = ?", [id]);
    return rows[0];
  }
};
var SqliteMatterRepository = class {
  async getAll(filter, ctx) {
    if (!can(ctx, "read", "matters")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u0648\u0627\u0644\u0642\u0636\u0627\u064A\u0627");
    }
    let sql = "SELECT * FROM matters WHERE deleted_at IS NULL";
    const params = [];
    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }
    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }
    if (filter?.search) {
      sql += " AND (title LIKE ? OR description LIKE ? OR code LIKE ? OR lead_entity LIKE ?)";
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }
    sql += " ORDER BY updated_at DESC";
    return sqliteEngine.query(sql, params);
  }
  async getById(id, ctx) {
    if (!can(ctx, "read", "matters")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A");
    }
    const rows = sqliteEngine.query("SELECT * FROM matters WHERE id = ? AND deleted_at IS NULL", [id]);
    const matter = rows[0] || null;
    if (matter && matter.confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      return null;
    }
    return matter;
  }
  async create(data, ctx) {
    if (!can(ctx, "create", "matters")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0625\u0646\u0634\u0627\u0621 \u0645\u0644\u0641\u0627\u062A \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u062C\u062F\u064A\u062F\u0629");
    }
    const confidentiality = data.confidentiality || "normal";
    if (confidentiality !== "normal" && !canAccessConfidential(ctx)) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0646\u0634\u0627\u0621 \u0645\u0644\u0641\u0627\u062A \u0633\u0631\u064A\u0629 \u062F\u0648\u0646 \u062A\u0635\u0631\u064A\u062D \u0623\u0645\u0646\u064A");
    }
    const id = `mat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const count = sqliteEngine.query("SELECT count(*) as count FROM matters")[0]?.count || 0;
    const code = data.code || generateSerialNumber("MATTER", count, (/* @__PURE__ */ new Date()).getFullYear());
    const status = "active";
    const created_by = ctx.userId || "\u0645\u0633\u062A\u062E\u062F\u0645";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO matters (id, code, title, description, confidentiality, status, lead_entity, priority, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        code,
        data.title,
        data.description ?? "",
        confidentiality,
        status,
        data.lead_entity,
        data.priority || "normal",
        now,
        now,
        created_by
      ]
    );
    return await this.getById(id, ctx);
  }
  async update(id, matter, ctx) {
    if (!can(ctx, "update", "matters")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A");
    }
    const existing = await this.getById(id, ctx);
    if (!existing) throw new SecurityAuthorizationError("\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0633\u0631\u064A");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const fields = ["updated_at = ?"];
    const params = [now];
    for (const [key, value] of Object.entries(matter)) {
      if (key !== "id" && key !== "created_at" && key !== "updated_at" && ALLOWED_MATTER_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    sqliteEngine.run(`UPDATE matters SET ${fields.join(", ")} WHERE id = ?`, params);
    return await this.getById(id, ctx);
  }
  async softDelete(id, ctx) {
    if (!can(ctx, "archive", "matters")) {
      throw new SecurityAuthorizationError("\u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u0642\u0635\u0648\u0631 \u0648\u0645\u062D\u0638\u0648\u0631 \u0639\u0644\u0649 \u0643\u0627\u0641\u0629 \u0627\u0644\u0631\u062A\u0628");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run("UPDATE matters SET deleted_at = ? WHERE id = ?", [now, id]);
    return true;
  }
  async getLinks(matterId, ctx) {
    const parent = await this.getById(matterId, ctx);
    if (!parent) return [];
    return sqliteEngine.query("SELECT * FROM matter_links WHERE matter_id = ? ORDER BY created_at DESC", [matterId]);
  }
  async addLink(link, ctx) {
    if (!can(ctx, "update", "matters")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0631\u0628\u0637 \u0639\u0646\u0627\u0635\u0631 \u062C\u062F\u064A\u062F\u0629 \u0628\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A");
    }
    const parent = await this.getById(link.matter_id, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0633\u0631\u064A");
    const id = `mlink-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO matter_links (id, matter_id, item_type, item_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, link.matter_id, link.item_type, link.item_id, link.title, now]
    );
    const rows = sqliteEngine.query("SELECT * FROM matter_links WHERE id = ?", [id]);
    return rows[0];
  }
  async removeLink(linkId, ctx) {
    if (!can(ctx, "update", "matters")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0625\u0644\u063A\u0627\u0621 \u0631\u0628\u0637 \u0627\u0644\u0639\u0646\u0635\u0631");
    }
    sqliteEngine.run("DELETE FROM matter_links WHERE id = ?", [linkId]);
    return true;
  }
};
var SqliteContactRepository = class {
  async getAll(ctx) {
    if (!can(ctx, "read", "contacts")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u062F\u0644\u064A\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0648\u0627\u0644\u062C\u0647\u0627\u062A \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629");
    }
    return sqliteEngine.query("SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY name ASC");
  }
  async getById(id, ctx) {
    if (!can(ctx, "read", "contacts")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u062C\u0647\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644");
    }
    const rows = sqliteEngine.query("SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL", [id]);
    return rows[0] || null;
  }
  async create(data, ctx) {
    if (!can(ctx, "create", "contacts")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0625\u0636\u0627\u0641\u0629 \u062C\u0647\u0627\u062A \u0627\u062A\u0635\u0627\u0644 \u062C\u062F\u064A\u062F\u0629");
    }
    const id = `cnt-${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO contacts (id, name, entity, position, phone, email, category, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, data.name, data.entity, data.position ?? "", data.phone ?? "", data.email ?? "", data.category || "external", data.notes || null, now]
    );
    return await this.getById(id, ctx);
  }
  async update(id, contact, ctx) {
    if (!can(ctx, "update", "contacts")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u062C\u0647\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644");
    }
    const existing = await this.getById(id, ctx);
    if (!existing) throw new SecurityAuthorizationError("\u062C\u0647\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(contact)) {
      if (key !== "id" && key !== "created_at" && ALLOWED_CONTACT_COLUMNS.has(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    if (fields.length > 0) {
      sqliteEngine.run(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`, params);
    }
    return await this.getById(id, ctx);
  }
  async softDelete(id, ctx) {
    if (!can(ctx, "archive", "contacts")) {
      throw new SecurityAuthorizationError("\u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0645\u0642\u0635\u0648\u0631 \u0648\u0645\u062D\u0638\u0648\u0631 \u0639\u0644\u0649 \u0643\u0627\u0641\u0629 \u0627\u0644\u0631\u062A\u0628");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run("UPDATE contacts SET deleted_at = ? WHERE id = ?", [now, id]);
    return true;
  }
  async getInteractions(contactId, ctx) {
    const parent = await this.getById(contactId, ctx);
    if (!parent) return [];
    return sqliteEngine.query("SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC", [contactId]);
  }
  async addInteraction(interaction, ctx) {
    if (!can(ctx, "update", "contacts")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0633\u062C\u064A\u0644 \u062A\u0641\u0627\u0639\u0644\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0645\u0639 \u062C\u0647\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644");
    }
    const parent = await this.getById(interaction.contact_id, ctx);
    if (!parent) throw new SecurityAuthorizationError("\u062C\u0647\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const id = `int-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const interactionType = interaction.interaction_type || interaction.type || "call";
    const recordedBy = interaction.recorded_by || ctx.userId || "\u0645\u0633\u062A\u062E\u062F\u0645";
    sqliteEngine.run(
      "INSERT INTO interactions (id, contact_id, interaction_type, date, summary, recorded_by) VALUES (?, ?, ?, ?, ?, ?)",
      [id, interaction.contact_id, interactionType, interaction.date, interaction.summary, recordedBy]
    );
    const rows = sqliteEngine.query("SELECT * FROM interactions WHERE id = ?", [id]);
    return rows[0];
  }
};
var SqliteNotificationRepository = class {
  async getAllForRole(role, ctx) {
    if (!can(ctx, "read", "notifications")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A");
    }
    let sql = 'SELECT * FROM notifications WHERE (recipient_role = ? OR recipient_role = "ALL")';
    const params = [role];
    if (!canAccessConfidential(ctx)) {
      sql += " AND (confidentiality = 'normal' OR confidentiality IS NULL)";
    }
    sql += " ORDER BY created_at DESC";
    const rows = sqliteEngine.query(sql, params);
    return rows.map((r) => ({
      id: r.id,
      recipient_role: r.recipient_role,
      title: r.title,
      body: r.message || r.body || "",
      confidentiality: r.confidentiality || (r.is_confidential ? "confidential" : "normal"),
      link_url: r.link_url || null,
      is_read: Boolean(r.is_read),
      created_at: r.created_at
    }));
  }
  async create(notification, ctx) {
    if (!can(ctx, "create", "notifications")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u062C\u062F\u064A\u062F\u0629");
    }
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      "INSERT INTO notifications (id, recipient_role, title, message, confidentiality, link_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, notification.recipient_role, notification.title, notification.body, notification.confidentiality || "normal", notification.link_url || null, 0, now]
    );
    const rows = sqliteEngine.query("SELECT * FROM notifications WHERE id = ?", [id]);
    const r = rows[0];
    return {
      id: r.id,
      recipient_role: r.recipient_role,
      title: r.title,
      body: r.message || r.body || "",
      confidentiality: r.confidentiality || "normal",
      link_url: r.link_url || null,
      is_read: Boolean(r.is_read),
      created_at: r.created_at
    };
  }
  async markAsRead(id, ctx) {
    if (!can(ctx, "update", "notifications")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0634\u0639\u0627\u0631");
    }
    sqliteEngine.run("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
  }
  async markAllAsRead(role, ctx) {
    if (!can(ctx, "update", "notifications")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A");
    }
    sqliteEngine.run("UPDATE notifications SET is_read = 1 WHERE recipient_role = ?", [role]);
  }
};
var SqliteUserRepository = class {
  async getAll(ctx) {
    if (!can(ctx, "read", "users")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646");
    }
    const isFullAdmin = ctx.role === "ADMIN";
    const rows = sqliteEngine.query("SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, avatar, created_at FROM users ORDER BY name ASC");
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
  async getById(id, ctx) {
    if (!can(ctx, "read", "users")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645");
    }
    const rows = sqliteEngine.query("SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, avatar, created_at FROM users WHERE id = ?", [id]);
    if (!rows[0]) return null;
    const u = rows[0];
    const isFullAdmin = ctx.role === "ADMIN" || ctx.userId === id;
    return {
      ...u,
      can_view_confidential: isFullAdmin ? Boolean(u.can_view_confidential) : false,
      must_change_password: isFullAdmin ? Boolean(u.must_change_password) : false
    };
  }
  async getByUsername(username) {
    const rows = sqliteEngine.query("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", [username.trim()]);
    if (!rows[0]) return null;
    const u = rows[0];
    return {
      ...u,
      can_view_confidential: Boolean(u.can_view_confidential),
      must_change_password: Boolean(u.must_change_password)
    };
  }
  async getByRole(role, ctx) {
    if (!can(ctx, "read", "users")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646");
    }
    const rows = sqliteEngine.query("SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, avatar, created_at FROM users WHERE role = ?", [role]);
    return rows.map((u) => ({
      ...u,
      can_view_confidential: Boolean(u.can_view_confidential),
      must_change_password: Boolean(u.must_change_password)
    }));
  }
  async updatePassword(userId, hash, salt, ctx) {
    if (ctx.role !== "ADMIN" && ctx.userId !== userId) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062D\u0633\u0627\u0628 \u0622\u062E\u0631");
    }
    sqliteEngine.run("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?", [hash, salt, userId]);
  }
};
var SqliteSettingsRepository = class {
  async getSettings(ctx) {
    if (!can(ctx, "read", "settings")) {
      throw new SecurityAuthorizationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645");
    }
    const rows = sqliteEngine.query("SELECT * FROM settings LIMIT 1");
    const r = rows[0] || {};
    return {
      id: r.id || "sys-settings",
      fiscal_year: r.fiscal_year || "2025/2026",
      session_timeout_minutes: r.session_timeout_minutes || 30,
      default_digit_format: r.default_digit_format || "indic",
      default_calendar_format: r.default_calendar_format || "gregorian",
      last_backup_date: r.last_backup_date || void 0
    };
  }
  async updateSettings(settings, ctx) {
    if (!can(ctx, "update", "settings")) {
      throw new SecurityAuthorizationError("\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0646\u0638\u0648\u0645\u0629 \u0645\u0642\u0635\u0648\u0631 \u062D\u0635\u0631\u064A\u0627\u064B \u0639\u0644\u0649 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0645 \u0648\u0633\u0643\u0631\u062A\u064A\u0631 \u0627\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A (403 Forbidden)");
    }
    const current = await this.getSettings(ctx);
    const updated = { ...current, ...settings };
    sqliteEngine.run(
      "UPDATE settings SET fiscal_year = ?, session_timeout_minutes = ?, default_digit_format = ?, default_calendar_format = ?, last_backup_date = ? WHERE id = ?",
      [
        updated.fiscal_year,
        updated.session_timeout_minutes,
        updated.default_digit_format,
        updated.default_calendar_format,
        updated.last_backup_date || null,
        current.id
      ]
    );
    return await this.getSettings(ctx);
  }
};
var meetingRepo = new SqliteMeetingRepository();
var correspondenceRepo = new SqliteCorrespondenceRepository();
var directiveRepo = new SqliteDirectiveRepository();
var matterRepo = new SqliteMatterRepository();
var contactRepo = new SqliteContactRepository();
var notificationRepo = new SqliteNotificationRepository();
var auditRepo = new SqliteAuditRepository();
var userRepo = new SqliteUserRepository();
var settingsRepo = new SqliteSettingsRepository();

// src/server/repositories/index.ts
var meetingRepo2 = new SqliteMeetingRepository();
var correspondenceRepo2 = new SqliteCorrespondenceRepository();
var directiveRepo2 = new SqliteDirectiveRepository();
var matterRepo2 = new SqliteMatterRepository();
var contactRepo2 = new SqliteContactRepository();
var notificationRepo2 = new SqliteNotificationRepository();
var auditRepo2 = new SqliteAuditRepository();
var userRepo2 = new SqliteUserRepository();
var settingsRepo2 = new SqliteSettingsRepository();

// src/server/services/authSecurity.service.ts
var COMMON_PASSWORDS = /* @__PURE__ */ new Set([
  "123456789012",
  "1234567890123",
  "password1234",
  "password12345",
  "password123456",
  "admin1234567",
  "admin12345678",
  "secret123456",
  "secret1234567",
  "egyptpost123",
  "egyptpost2026",
  "welcome12345",
  "welcome123456",
  "qwerty123456",
  "123456abcdef",
  "iloveegypt123"
]);
var AuthSecurityService = class {
  /**
   * Checks if an account is currently locked due to repeated failed login attempts.
   */
  static checkLockout(username) {
    const rows = sqliteEngine.query("SELECT failed_attempts, locked_until FROM login_security WHERE username = ? LIMIT 1", [username]);
    if (!rows || rows.length === 0) {
      return { isLocked: false, failedAttempts: 0 };
    }
    const rec = rows[0];
    if (rec.locked_until) {
      const lockExpiry = new Date(rec.locked_until);
      if (/* @__PURE__ */ new Date() < lockExpiry) {
        return {
          isLocked: true,
          lockedUntil: rec.locked_until,
          failedAttempts: rec.failed_attempts
        };
      }
    }
    return { isLocked: false, failedAttempts: rec.failed_attempts || 0 };
  }
  /**
   * Records a failed login attempt in the database with progressive exponential delay.
   */
  static recordFailure(username) {
    const now = /* @__PURE__ */ new Date();
    const rows = sqliteEngine.query(
      "SELECT failed_attempts FROM login_security WHERE username = ? LIMIT 1",
      [username]
    );
    const currentAttempts = (rows[0]?.failed_attempts || 0) + 1;
    let lockedUntil = null;
    if (currentAttempts >= 5) {
      const lockSeconds = Math.min(1800, Math.pow(2, currentAttempts - 4) * 30);
      const lockDate = new Date(now.getTime() + lockSeconds * 1e3);
      lockedUntil = lockDate.toISOString();
    }
    sqliteEngine.run(
      `INSERT INTO login_security (username, failed_attempts, locked_until, last_failed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET
         failed_attempts = ?,
         locked_until = ?,
         last_failed_at = ?`,
      [
        username,
        currentAttempts,
        lockedUntil,
        now.toISOString(),
        currentAttempts,
        lockedUntil,
        now.toISOString()
      ]
    );
    return {
      isLocked: Boolean(lockedUntil),
      lockedUntil,
      failedAttempts: currentAttempts
    };
  }
  /**
   * Resets failed login attempts upon successful authentication.
   */
  static recordSuccess(username) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    sqliteEngine.run(
      `INSERT INTO login_security (username, failed_attempts, locked_until, last_success_at)
       VALUES (?, 0, NULL, ?)
       ON CONFLICT(username) DO UPDATE SET
         failed_attempts = 0,
         locked_until = NULL,
         last_success_at = ?`,
      [username, now, now]
    );
  }
  /**
   * Validates password strength policy:
   * - Minimum 12 characters
   * - Cannot match username
   * - Cannot be in common weak password list
   * - Cannot be same as current password
   */
  static validatePasswordStrength(password, username, currentPassword) {
    if (!password || typeof password !== "string") {
      return { isValid: false, error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629" };
    }
    if (currentPassword && password === currentPassword) {
      return {
        isValid: false,
        reason: "SAME_AS_CURRENT",
        error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0645\u062E\u062A\u0644\u0641\u0629"
      };
    }
    if (password.length < 12) {
      return {
        isValid: false,
        reason: "TOO_SHORT",
        error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0642\u0635\u064A\u0631\u0629 \u062C\u062F\u0627\u064B: \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 12 \u062D\u0631\u0641\u0627\u064B \u0648\u0631\u0645\u0632\u0627\u064B"
      };
    }
    if (username && password.toLowerCase().includes(username.toLowerCase())) {
      return {
        isValid: false,
        reason: "CONTAINS_USERNAME",
        error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u062A\u062D\u062A\u0648\u064A \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0639\u0644\u0649 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"
      };
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      return {
        isValid: false,
        reason: "COMMON_PASSWORD",
        error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0634\u0627\u0626\u0639\u0629 \u0648\u0633\u0647\u0644\u0629 \u0627\u0644\u062A\u062E\u0645\u064A\u0646: \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0642\u0648\u064A\u0629 \u0648\u063A\u064A\u0631 \u0645\u062A\u062F\u0627\u0648\u0644\u0629"
      };
    }
    return { isValid: true };
  }
};

// src/server/utils/crypto.ts
import crypto4 from "crypto";
function hashPasswordServer(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto4.randomBytes(16);
  const iterations = 6e5;
  const hash = crypto4.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return {
    hashHex: hash.toString("hex"),
    saltHex: salt.toString("hex"),
    iterations,
    algo: "PBKDF2-SHA256"
  };
}
function verifyPasswordServer(password, storedHashHex, storedSaltHex) {
  try {
    const salt = Buffer.from(storedSaltHex, "hex");
    const computedHash = crypto4.pbkdf2Sync(password, salt, 6e5, 32, "sha256");
    const storedHash = Buffer.from(storedHashHex, "hex");
    if (computedHash.length !== storedHash.length) {
      return false;
    }
    return crypto4.timingSafeEqual(computedHash, storedHash);
  } catch (err) {
    return false;
  }
}
function dummyPasswordHash(password) {
  try {
    const dummySalt = Buffer.alloc(16, 0);
    crypto4.pbkdf2Sync(password, dummySalt, 6e5, 32, "sha256");
  } catch {
  }
}

// src/server/controllers/auth.controller.ts
var loginSchema = z.object({
  username: z.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0637\u0644\u0648\u0628"),
  password: z.string().min(1, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629")
}).strict();
var changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(1).optional(),
  current_password: z.string().min(1).optional(),
  new_password: z.string().min(1).optional()
}).strict();
var reauthSchema = z.object({
  password: z.string().min(1, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629")
}).strict();
var AuthController = class {
  /**
   * POST /api/auth/login
   */
  static async login(req, res, next) {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
        return;
      }
      const { username, password } = parseResult.data;
      const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const securityStatus = AuthSecurityService.checkLockout(username);
      if (securityStatus.isLocked) {
        res.status(429).json({
          error: `\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0624\u0642\u062A\u0627\u064B \u0628\u0633\u0628\u0628 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062E\u0627\u0637\u0626\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u062D\u062A\u0649: ${securityStatus.lockedUntil}`,
          code: "ACCOUNT_LOCKED"
        });
        return;
      }
      const userRecord = await userRepo2.getByUsername(username);
      if (!userRecord) {
        dummyPasswordHash(password);
        AuthSecurityService.recordFailure(username);
        await auditRepo2.log({
          user_id: "anonymous",
          user_name: username,
          user_role: "ADMIN",
          action_type: "AUTH",
          entity_type: "LOGIN_FAILURE",
          entity_id: "unknown_user",
          before_value: null,
          after_value: `\u0645\u062D\u0627\u0648\u0644\u0629 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0641\u0627\u0634\u0644\u0629 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${username}) - \u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0633\u062C\u0644`,
          ip_address: clientIp
        }, { userId: "anonymous", role: "ADMIN", can_view_confidential: false });
        res.status(401).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
        return;
      }
      const isValid = verifyPasswordServer(
        password,
        userRecord.password_hash,
        userRecord.password_salt
      );
      if (!isValid) {
        const failureStatus = AuthSecurityService.recordFailure(username);
        await auditRepo2.log({
          user_id: userRecord.id,
          user_name: userRecord.name,
          user_role: userRecord.role,
          action_type: "AUTH",
          entity_type: "LOGIN_FAILURE",
          entity_id: userRecord.id,
          before_value: null,
          after_value: `\u0645\u062D\u0627\u0648\u0644\u0629 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0641\u0627\u0634\u0644\u0629 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${username}) - \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062E\u0627\u0637\u0626\u0629 (\u0645\u062D\u0627\u0648\u0644\u0629 \u0631\u0642\u0645 ${failureStatus.failedAttempts})`,
          ip_address: clientIp
        }, { userId: userRecord.id, role: userRecord.role, can_view_confidential: Boolean(userRecord.can_view_confidential) });
        res.status(401).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
        return;
      }
      AuthSecurityService.recordSuccess(username);
      const rawToken = SessionService.createSession(userRecord.id, {
        ipAddress: clientIp,
        userAgent: req.headers["user-agent"]
      });
      SessionService.setCookie(res, rawToken);
      await auditRepo2.log({
        user_id: userRecord.id,
        user_name: userRecord.name,
        user_role: userRecord.role,
        action_type: "AUTH",
        entity_type: "SESSION",
        entity_id: userRecord.id,
        before_value: null,
        after_value: `\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0646\u0627\u062C\u062D \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${userRecord.name} - ${userRecord.role}) \u0648\u0625\u0646\u0634\u0627\u0621 \u062C\u0644\u0633\u0629 \u0639\u0645\u0644 \u0645\u0624\u0645\u0646\u0629`,
        ip_address: clientIp
      }, { userId: userRecord.id, role: userRecord.role, can_view_confidential: Boolean(userRecord.can_view_confidential) });
      const { password_hash, password_salt, ...safeUser } = userRecord;
      res.json({
        user: {
          ...safeUser,
          can_view_confidential: Boolean(safeUser.can_view_confidential),
          must_change_password: Boolean(safeUser.must_change_password)
        }
      });
    } catch (err) {
      next(err);
    }
  }
  /**
   * GET /api/auth/me
   */
  static async me(req, res, next) {
    try {
      if (!req.user) {
        res.status(401).json({ error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u0639\u0645\u0644 \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629 \u0623\u0648 \u0645\u0646\u062A\u0647\u064A\u0629" });
        return;
      }
      res.json({ user: req.user });
    } catch (err) {
      next(err);
    }
  }
  /**
   * POST /api/auth/logout
   */
  static async logout(req, res, next) {
    try {
      if (req.rawSessionToken) {
        SessionService.destroySession(req.rawSessionToken);
      }
      SessionService.clearCookie(res);
      if (req.user) {
        await auditRepo2.log({
          user_id: req.user.id,
          user_name: req.user.name,
          user_role: req.user.role,
          action_type: "AUTH",
          entity_type: "SESSION",
          entity_id: req.user.id,
          before_value: "\u062C\u0644\u0633\u0629 \u0646\u0634\u0637\u0629",
          after_value: `\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C \u0622\u0645\u0646 \u0648\u0625\u0628\u0637\u0627\u0644 \u062C\u0644\u0633\u0629 \u0627\u0644\u0639\u0645\u0644 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${req.user.name})`,
          ip_address: req.ip || "127.0.0.1"
        }, req.userContext || { userId: req.user.id, role: req.user.role, can_view_confidential: Boolean(req.user.can_view_confidential) });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
  /**
   * POST /api/auth/change-password
   */
  static async changePassword(req, res, next) {
    try {
      if (!req.user) {
        res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
        return;
      }
      const parseResult = changePasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
        return;
      }
      const { current_password, currentPassword, new_password, newPassword } = parseResult.data;
      const effectiveCurrentPassword = current_password || currentPassword;
      const effectiveNewPassword = new_password || newPassword;
      if (!effectiveCurrentPassword || !effectiveNewPassword) {
        res.status(400).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" });
        return;
      }
      const userWithHash = await userRepo2.getByUsername(req.user.username);
      if (!userWithHash) {
        res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
        return;
      }
      const isCurrentValid = verifyPasswordServer(
        effectiveCurrentPassword,
        userWithHash.password_hash,
        userWithHash.password_salt
      );
      if (!isCurrentValid) {
        res.status(400).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
        return;
      }
      const strengthCheck = AuthSecurityService.validatePasswordStrength(effectiveNewPassword, req.user.username, effectiveCurrentPassword);
      if (!strengthCheck.isValid) {
        res.status(400).json({ error: strengthCheck.error, reason: strengthCheck.reason, code: "VALIDATION_ERROR" });
        return;
      }
      const newCredentials = hashPasswordServer(effectiveNewPassword);
      sqliteEngine.run(
        "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?",
        [newCredentials.hashHex, newCredentials.saltHex, req.user.id]
      );
      SessionService.destroyAllUserSessions(req.user.id);
      const rawToken = SessionService.createSession(req.user.id, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
      });
      SessionService.setCookie(res, rawToken);
      await auditRepo2.log({
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action_type: "UPDATE",
        entity_type: "USER_PASSWORD",
        entity_id: req.user.id,
        before_value: "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0633\u0627\u0628\u0642\u0629",
        after_value: `\u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0648\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0628\u0646\u062C\u0627\u062D \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${req.user.name})`,
        ip_address: req.ip || "127.0.0.1"
      }, req.userContext || { userId: req.user.id, role: req.user.role, can_view_confidential: Boolean(req.user.can_view_confidential) });
      const updatedUser = {
        ...req.user,
        must_change_password: false
      };
      res.json({ success: true, user: updatedUser });
    } catch (err) {
      next(err);
    }
  }
  /**
   * POST /api/auth/reauth
   */
  static async reauth(req, res, next) {
    try {
      if (!req.user) {
        res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
        return;
      }
      const parseResult = reauthSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629" });
        return;
      }
      const { password } = parseResult.data;
      const userWithHash = await userRepo2.getByUsername(req.user.username);
      if (!userWithHash) {
        res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
        return;
      }
      const isValid = verifyPasswordServer(
        password,
        userWithHash.password_hash,
        userWithHash.password_salt
      );
      if (!isValid) {
        res.status(401).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
        return;
      }
      if (req.rawSessionToken) {
        SessionService.validateSession(req.rawSessionToken);
      }
      await auditRepo2.log({
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action_type: "AUTH",
        entity_type: "LOCK_SCREEN_UNLOCK",
        entity_id: req.user.id,
        before_value: "\u0634\u0627\u0634\u0629 \u0645\u0642\u0641\u0644\u0629",
        after_value: `\u0625\u0644\u063A\u0627\u0621 \u0642\u0641\u0644 \u0627\u0644\u0634\u0627\u0634\u0629 \u0628\u0646\u062C\u0627\u062D \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${req.user.name})`,
        ip_address: req.ip || "127.0.0.1"
      }, req.userContext || { userId: req.user.id, role: req.user.role, can_view_confidential: Boolean(req.user.can_view_confidential) });
      res.json({ success: true, user: req.user });
    } catch (err) {
      next(err);
    }
  }
  /**
   * GET /api/users
   */
  static async getUsers(req, res, next) {
    try {
      const list = await userRepo2.getAll(req.userContext);
      const isFullAdmin = req.user?.role === "ADMIN";
      const sanitized = list.map((u) => {
        if (isFullAdmin) {
          return {
            id: u.id,
            username: u.username,
            name: u.name,
            title: u.title,
            department_id: u.department_id,
            email: u.email,
            role: u.role,
            can_view_confidential: Boolean(u.can_view_confidential),
            must_change_password: Boolean(u.must_change_password),
            avatar: u.avatar,
            created_at: u.created_at
          };
        }
        return {
          id: u.id,
          name: u.name,
          title: u.title,
          role: u.role
        };
      });
      res.json(sanitized);
    } catch (err) {
      next(err);
    }
  }
};

// src/domain/security/auditLogger.ts
init_cryptoUtils();
var AuditLogger = class {
  /**
   * Core logging method with tamper-resistant cryptographic chaining
   */
  static async log(user, actionType, entityType, entityId, details) {
    return sqliteEngine.runWithMutex(async () => {
      const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const ip = details.ipAddress || "";
      const isConf = details.isConfidential ? 1 : 0;
      const latestRows = sqliteEngine.query(
        "SELECT seq, entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1"
      );
      const prevHash = latestRows[0]?.entry_hash || "GENESIS-BLOCK-00000000000000000000000000000000";
      const nextSeq = (latestRows[0]?.seq || 0) + 1;
      const entryHash = await computeAuditEntryHash({
        seq: nextSeq,
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
        prev_hash: prevHash,
        is_confidential: isConf
      });
      const entry = {
        seq: nextSeq,
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
        entry_hash: entryHash,
        is_confidential: isConf
      };
      sqliteEngine.transaction(() => {
        sqliteEngine.run(
          `INSERT INTO audit_log (seq, id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address, prev_hash, entry_hash, is_confidential)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.seq,
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
            entry.entry_hash,
            entry.is_confidential
          ]
        );
        sqliteEngine.run(
          `UPDATE settings SET audit_last_seq = ?, audit_head_hash = ?, audit_count = audit_count + 1 WHERE id = 'settings-global' OR id = (SELECT id FROM settings LIMIT 1)`,
          [entry.seq, entry.entry_hash]
        );
      });
      return entry;
    });
  }
  // --- Specific Directive Audit Methods ---
  /**
   * Track Creation of a Presidential Directive
   */
  static async logDirectiveCreation(user, directive, context) {
    return this.log(user, "CREATE", "DIRECTIVE", directive.id, {
      beforeValue: null,
      afterValue: `\u0625\u0635\u062F\u0627\u0631 \u062A\u0643\u0644\u064A\u0641 \u0631\u0626\u0627\u0633\u064A \u062C\u062F\u064A\u062F [${directive.code}]: "${directive.title}" \u2014 \u0627\u0644\u0645\u0643\u0644\u0641: ${directive.assigned_department} (${directive.assigned_person}) \u2014 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642: ${directive.due_date}`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Updates or modifications to a Directive
   */
  static async logDirectiveUpdate(user, directiveId, before, after, context) {
    const beforeSummary = `\u0627\u0644\u062D\u0627\u0644\u0629: ${before.status || "-"} | \u0627\u0644\u0625\u0646\u062C\u0627\u0632: ${before.progress ?? "-"}%`;
    const afterSummary = `\u0627\u0644\u062D\u0627\u0644\u0629: ${after.status || "-"} | \u0627\u0644\u0625\u0646\u062C\u0627\u0632: ${after.progress ?? "-"}% ${after.reason ? `(${after.reason})` : ""}`;
    return this.log(user, "UPDATE", "DIRECTIVE", directiveId, {
      beforeValue: beforeSummary,
      afterValue: afterSummary,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Progress Update Log on a Directive
   */
  static async logDirectiveProgress(user, directive, newProgress, notes, context) {
    return this.log(user, "UPDATE", "DIRECTIVE", directive.id, {
      beforeValue: `\u0646\u0633\u0628\u0629 \u0627\u0644\u0625\u0646\u062C\u0627\u0632 \u0627\u0644\u0633\u0627\u0628\u0642\u0629: ${directive.progress_percent}%`,
      afterValue: `\u062A\u0633\u062C\u064A\u0644 \u062A\u0642\u0631\u064A\u0631 \u0645\u062A\u0627\u0628\u0639\u0629 \u062F\u0648\u0631\u064A: ${newProgress}% \u2014 \u0628\u064A\u0627\u0646 \u0627\u0644\u0625\u0646\u062C\u0627\u0632: ${notes}`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Official Completion & Signoff Closure of a Directive
   */
  static async logDirectiveClosure(user, directive, context) {
    return this.log(user, "UPDATE", "DIRECTIVE", directive.id, {
      beforeValue: `\u0627\u0644\u062D\u0627\u0644\u0629: ${directive.status} (${directive.progress_percent}%)`,
      afterValue: `\u0625\u063A\u0644\u0627\u0642 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0633\u062A\u064A\u0641\u0627\u0621 \u0627\u0644\u062A\u0643\u0644\u064A\u0641 \u0627\u0644\u0631\u0626\u0627\u0633\u064A \u0646\u0647\u0627\u0626\u064A\u0627\u064B [${directive.code}] \u0628\u0646\u0633\u0628\u0629 \u0625\u0646\u062C\u0627\u0632 100%`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Soft Deletion of a Directive
   */
  static async logDirectiveDeletion(user, directive, reason, context) {
    return this.log(user, "DELETE", "DIRECTIVE", directive.id, {
      beforeValue: `\u0627\u0644\u062A\u0643\u0644\u064A\u0641 [${directive.code}]: "${directive.title}" \u2014 \u0627\u0644\u0645\u0643\u0644\u0641: ${directive.assigned_department}`,
      afterValue: `\u062D\u0630\u0641 \u0648\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u062A\u0643\u0644\u064A\u0641 \u0627\u0644\u0631\u0626\u0627\u0633\u064A ${reason ? `(\u0627\u0644\u0633\u0628\u0628: ${reason})` : ""}`,
      ipAddress: context?.ipAddress
    });
  }
  // --- Meetings & Decisions Audit Methods ---
  /**
   * Track Scheduling of a Meeting / Board Session
   */
  static async logMeetingScheduled(user, meeting, context) {
    return this.log(user, "CREATE", "MEETING", meeting.id, {
      beforeValue: null,
      afterValue: `\u062C\u062F\u0648\u0644\u0629 \u062C\u0644\u0633\u0629 \u0627\u062C\u062A\u0645\u0627\u0639: "${meeting.title}" \u2014 \u0627\u0644\u0642\u0627\u0639\u0629: ${meeting.location} \u2014 \u0627\u0644\u0645\u0648\u0639\u062F: ${meeting.start_time}`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Meeting Status Transitions
   */
  static async logMeetingStatus(user, meetingId, meetingTitle, beforeStatus, afterStatus, context) {
    return this.log(user, "UPDATE", "MEETING", meetingId, {
      beforeValue: `\u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629: ${beforeStatus}`,
      afterValue: `\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 "${meetingTitle}" \u0625\u0644\u0649: ${afterStatus}`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Minutes Drafting
   */
  static async logMinutesDrafted(user, meetingId, meetingTitle, context) {
    return this.log(user, "UPDATE", "MEETING_MINUTES", meetingId, {
      beforeValue: "\u0645\u0633\u0648\u062F\u0629 \u0642\u064A\u062F \u0627\u0644\u0625\u0639\u062F\u0627\u062F",
      afterValue: `\u0635\u064A\u0627\u063A\u0629 \u0648\u062D\u0641\u0638 \u0645\u0633\u0648\u062F\u0629 \u0645\u062D\u0636\u0631 \u062C\u0644\u0633\u0629: "${meetingTitle}"`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Official Approval of Meeting Minutes
   */
  static async logMinutesApproved(user, meetingId, meetingTitle, context) {
    return this.log(user, "DECIDE", "MEETING_MINUTES", meetingId, {
      beforeValue: "\u0645\u0633\u0648\u062F\u0629 \u0645\u062D\u0636\u0631 \u0645\u0639\u0631\u0648\u0636\u0629 \u0644\u0644\u0627\u0639\u062A\u0645\u0627\u062F",
      afterValue: `\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u062A\u0648\u0642\u064A\u0639 \u0645\u062D\u0636\u0631 \u0627\u062C\u062A\u0645\u0627\u0639 \u0631\u0633\u0645\u064A: "${meetingTitle}" \u0628\u0648\u0627\u0633\u0637\u0629 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Executive Board Decisions
   */
  static async logDecisionRecorded(user, decision, context) {
    return this.log(user, "DECIDE", "MEETING_DECISION", decision.id, {
      beforeValue: null,
      afterValue: `\u0625\u0635\u062F\u0627\u0631 \u0648\u062A\u0648\u062B\u064A\u0642 \u0642\u0631\u0627\u0631 \u0645\u062C\u0644\u0633 \u0625\u062F\u0627\u0631\u0629: "${decision.content}" \u2014 \u0627\u0644\u0645\u0643\u0644\u0641: ${decision.assigned_to_name}`,
      ipAddress: context?.ipAddress
    });
  }
  // --- Correspondence & Briefing Audit Methods ---
  /**
   * Track Registration of Incoming / Outgoing Correspondence
   */
  static async logCorrespondenceRegistered(user, corr, context) {
    const typeLabel = corr.type === "incoming" ? "\u0648\u0627\u0631\u062F \u0631\u0633\u0645\u064A" : "\u0635\u0627\u062F\u0631 \u0631\u0633\u0645\u064A";
    return this.log(user, "CREATE", "CORRESPONDENCE", corr.id, {
      beforeValue: null,
      afterValue: `\u062A\u0633\u062C\u064A\u0644 ${typeLabel} [${corr.serial_number}]: "${corr.subject}" \u2014 \u0627\u0644\u062C\u0647\u0629: ${corr.source_or_dest_entity}`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Briefing Note Saved or Presented
   */
  static async logBriefingNoteSaved(user, corrId, serialNumber, isPresented, context) {
    return this.log(user, "UPDATE", "BRIEFING_NOTE", corrId, {
      beforeValue: isPresented ? "\u0645\u0633\u0648\u062F\u0629 \u0642\u064A\u062F \u0627\u0644\u0625\u0639\u062F\u0627\u062F" : null,
      afterValue: isPresented ? `\u062A\u0642\u062F\u064A\u0645 \u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 [${serialNumber}] \u0631\u0633\u0645\u064A\u0627\u064B \u0644\u0634\u0627\u0634\u0629 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629` : `\u062D\u0641\u0638 \u0648\u062A\u062D\u062F\u064A\u062B \u0645\u0633\u0648\u062F\u0629 \u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 [${serialNumber}]`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Presidential Approval / Endorsement on Correspondence
   */
  static async logCorrespondenceApproved(user, corrId, serialNumber, decisionType, standardPhrase, customDirective, context) {
    const customPart = customDirective ? ` | \u0627\u0644\u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u062E\u0637\u064A: "${customDirective}"` : "";
    return this.log(user, "DECIDE", "CORRESPONDENCE", corrId, {
      beforeValue: "\u0645\u0639\u0631\u0648\u0636 \u0639\u0644\u0649 \u0627\u0644\u0631\u0626\u064A\u0633",
      afterValue: `\u062A\u062B\u0628\u064A\u062A \u062A\u0623\u0634\u064A\u0631\u0629 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0639\u0644\u0649 [${serialNumber}]: (${standardPhrase})${customPart}`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Correspondence Routing to Departments
   */
  static async logCorrespondenceRouted(user, corrId, serialNumber, toDept, actionRequired, context) {
    return this.log(user, "ROUTING", "CORRESPONDENCE", corrId, {
      beforeValue: null,
      afterValue: `\u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 [${serialNumber}] \u0625\u0644\u0649 ${toDept} \u2014 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0645\u0637\u0644\u0648\u0628: "${actionRequired}"`,
      ipAddress: context?.ipAddress
    });
  }
  // --- Strategic Matters & Contacts Audit Methods ---
  /**
   * Track Creation of Strategic Matters
   */
  static async logMatterCreated(user, matter, context) {
    return this.log(user, "CREATE", "MATTER", matter.id, {
      beforeValue: null,
      afterValue: `\u0641\u062A\u062D \u0645\u0644\u0641 \u0645\u0648\u0636\u0648\u0639 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A [${matter.code}]: "${matter.title}" \u2014 \u0627\u0644\u062C\u0647\u0629 \u0627\u0644\u0642\u0627\u0626\u062F\u0629: ${matter.lead_entity}`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Creation of VIP Contacts & Interactions
   */
  static async logContactCreated(user, contact, context) {
    return this.log(user, "CREATE", "CONTACT", contact.id, {
      beforeValue: null,
      afterValue: `\u062A\u0633\u062C\u064A\u0644 \u062C\u0647\u0629 \u0627\u062A\u0635\u0627\u0644 \u0631\u0641\u064A\u0639\u0629 \u0627\u0644\u0645\u0633\u062A\u0648\u0649: ${contact.name} (${contact.position} - ${contact.entity})`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Logging of Official Interactions / Calls
   */
  static async logInteractionRecorded(user, contactName, type, summary, context) {
    return this.log(user, "CREATE", "INTERACTION", `interact-${Date.now()}`, {
      beforeValue: null,
      afterValue: `\u062A\u0648\u062B\u064A\u0642 \u062A\u0641\u0627\u0639\u0644 \u0631\u0633\u0645\u064A \u0645\u0639 (${contactName}) \u2014 \u0627\u0644\u0646\u0648\u0639: ${type} \u2014 \u0627\u0644\u0645\u0644\u062E\u0635: "${summary}"`,
      ipAddress: context?.ipAddress
    });
  }
  /**
   * Track Authentication and Session Events
   */
  static async logAuthEvent(user, eventType, details, context) {
    return this.log(user, "AUTH", "SESSION", user.id, {
      beforeValue: null,
      afterValue: `[${eventType}] ${details}`,
      ipAddress: context?.ipAddress
    });
  }
  // --- Export utilities ---
  /**
   * Export all audit logs as a structured CSV string including cryptographic signatures
   */
  static async exportToCsv() {
    const rows = sqliteEngine.query("SELECT * FROM audit_log ORDER BY timestamp DESC");
    const header = [
      "\u0627\u0644\u0645\u0639\u0631\u0641",
      "\u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645",
      "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645",
      "\u0627\u0644\u0635\u0641\u0629",
      "\u0646\u0648\u0639 \u0627\u0644\u0625\u062C\u0631\u0627\u0621",
      "\u0646\u0648\u0639 \u0627\u0644\u0643\u064A\u0627\u0646",
      "\u0645\u0639\u0631\u0641 \u0627\u0644\u0643\u064A\u0627\u0646",
      "\u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629",
      "\u0627\u0644\u0642\u064A\u0645\u0629 \u0628\u0639\u062F \u0627\u0644\u062A\u0639\u062F\u064A\u0644",
      "\u0627\u0644\u062A\u0648\u0642\u064A\u062A",
      "\u0639\u0646\u0648\u0627\u0646 IP",
      "\u0647\u0627\u0634 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0633\u0627\u0628\u0642 (prev_hash)",
      "\u062A\u0648\u0642\u064A\u0639 SHA-256 (entry_hash)"
    ];
    const csvLines = [header.join(",")];
    for (const r of rows) {
      const line = [
        `"${r.id}"`,
        `"${r.user_id}"`,
        `"${r.user_name}"`,
        `"${r.user_role}"`,
        `"${r.action_type}"`,
        `"${r.entity_type}"`,
        `"${r.entity_id}"`,
        `"${(r.before_value || "").replace(/"/g, '""')}"`,
        `"${(r.after_value || "").replace(/"/g, '""')}"`,
        `"${r.timestamp}"`,
        `"${r.ip_address}"`,
        `"${r.prev_hash || ""}"`,
        `"${r.entry_hash || ""}"`
      ];
      csvLines.push(line.join(","));
    }
    return "\uFEFF" + csvLines.join("\n");
  }
};

// src/server/services/backendCommand.service.ts
var BackendCommandService = class {
  // Meetings
  static async createMeeting(data, userContext) {
    const ctx = userContext || { userId: "server", role: "SECRETARY", can_view_confidential: false };
    const created = await meetingRepo2.create(data, ctx);
    await auditRepo2.log({
      user_id: ctx.userId,
      user_name: data.created_by || "\u0627\u0644\u0646\u0638\u0627\u0645",
      user_role: ctx.role,
      action_type: "CREATE",
      entity_type: "MEETING",
      entity_id: created.id,
      before_value: null,
      after_value: `\u062C\u062F\u0648\u0644\u0629 \u0627\u062C\u062A\u0645\u0627\u0639 \u062C\u062F\u064A\u062F: ${created.title} \u0641\u064A ${created.location}`,
      ip_address: "127.0.0.1"
    }, ctx);
    return created;
  }
  // Correspondence
  static async createCorrespondence(data, userContext) {
    const ctx = userContext || { userId: "server", role: "SECRETARY", can_view_confidential: false };
    const created = await correspondenceRepo2.create(data, ctx);
    await auditRepo2.log({
      user_id: ctx.userId,
      user_name: data.created_by || "\u0627\u0644\u0646\u0638\u0627\u0645",
      user_role: ctx.role,
      action_type: "CREATE",
      entity_type: "CORRESPONDENCE",
      entity_id: created.id,
      before_value: null,
      after_value: `\u062A\u0633\u062C\u064A\u0644 \u0645\u0643\u0627\u062A\u0628\u0629 \u062C\u062F\u064A\u062F\u0629: [${created.serial_number}] ${created.subject}`,
      ip_address: "127.0.0.1"
    }, ctx);
    return created;
  }
  // Directives
  static async createDirective(data, userContext) {
    const ctx = userContext || { userId: "server", role: "SECRETARY", can_view_confidential: false };
    const created = await directiveRepo2.create(data, ctx);
    const mockUser = {
      id: ctx.userId,
      username: "system",
      name: data.created_by || "\u0645\u0643\u062A\u0628 \u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
      title: "\u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A\u0629",
      role: ctx.role,
      department_id: "dept-sec",
      can_view_confidential: ctx.can_view_confidential,
      email: "system@egyptpost.org",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await AuditLogger.logDirectiveCreation(mockUser, created);
    return created;
  }
};

// src/server/validation/schemas.ts
import { z as z2 } from "zod";
var createCorrespondenceSchema = z2.object({
  type: z2.enum(["incoming", "outgoing"]),
  date: z2.string().min(1),
  source_or_dest_entity: z2.string().min(1),
  subject: z2.string().min(1),
  priority: z2.enum(["normal", "urgent", "top_urgent"]),
  confidentiality: z2.enum(["normal", "confidential", "secret", "top_secret"]).optional(),
  summary: z2.string().nullable().optional().transform((val) => val ?? ""),
  matter_id: z2.string().nullable().optional(),
  category: z2.string().optional(),
  tags: z2.array(z2.string()).optional()
}).strict();
var updateCorrespondenceSchema = z2.object({
  date: z2.string().optional(),
  source_or_dest_entity: z2.string().optional(),
  subject: z2.string().optional(),
  priority: z2.enum(["normal", "urgent", "top_urgent"]).optional(),
  summary: z2.string().nullable().optional(),
  matter_id: z2.string().nullable().optional(),
  category: z2.string().optional(),
  tags: z2.array(z2.string()).optional()
}).strict();
var reclassifyCorrespondenceSchema = z2.object({
  confidentiality: z2.enum(["normal", "confidential", "secret", "top_secret"]),
  reason: z2.string().optional()
}).strict();
var submitCorrespondenceSchema = z2.object({
  comment: z2.string().optional()
}).strict();
var saveBriefingSchema = z2.object({
  correspondence_id: z2.string().optional(),
  summary: z2.string().optional(),
  background: z2.string().optional(),
  secretary_recommendation: z2.string().optional(),
  executive_opinion: z2.string().optional(),
  prepared_by_name: z2.string().optional(),
  prepared_at: z2.string().optional(),
  legal_opinion: z2.string().nullable().optional(),
  financial_impact: z2.string().nullable().optional(),
  recommendation: z2.string().nullable().optional()
}).strict();
var recordApprovalSchema = z2.object({
  correspondence_id: z2.string().optional(),
  decision: z2.string().optional(),
  decision_type: z2.string().optional(),
  notes: z2.string().nullable().optional(),
  referral_target: z2.string().nullable().optional(),
  due_date: z2.string().nullable().optional(),
  standard_phrase: z2.string().optional(),
  custom_directive: z2.string().nullable().optional(),
  decided_at: z2.string().optional(),
  decided_by_name: z2.string().optional()
}).strict();
var addRoutingSchema = z2.object({
  correspondence_id: z2.string().optional(),
  from_entity: z2.string().min(1),
  to_entity: z2.string().optional(),
  to_department_id: z2.string().optional(),
  to_department_name: z2.string().optional(),
  action_required: z2.string().min(1),
  notes: z2.string().nullable().optional(),
  deadline: z2.string().optional(),
  due_date: z2.string().nullable().optional()
}).strict();
var addAttachmentSchema = z2.object({
  correspondence_id: z2.string().optional(),
  file_name: z2.string().min(1),
  file_size: z2.number().nonnegative().optional(),
  file_size_kb: z2.number().nonnegative().optional(),
  file_type: z2.string().optional(),
  mime_type: z2.string().optional(),
  confidentiality: z2.enum(["normal", "confidential", "secret", "top_secret"]).optional()
}).strict();
var createDirectiveSchema = z2.object({
  title: z2.string().min(1),
  instruction: z2.string().min(1),
  assigned_department: z2.string().min(1),
  assigned_person: z2.string().nullable().optional().transform((v) => v ?? "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"),
  source_type: z2.string().min(1),
  source_id: z2.string().nullable().optional(),
  priority: z2.enum(["normal", "urgent", "top_urgent"]),
  confidentiality: z2.enum(["normal", "confidential", "secret", "top_secret"]).optional(),
  due_date: z2.string().nullable().optional().transform((v) => v ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0]),
  matter_id: z2.string().nullable().optional()
}).strict();
var updateDirectiveSchema = z2.object({
  title: z2.string().optional(),
  instruction: z2.string().optional(),
  assigned_department: z2.string().optional(),
  assigned_person: z2.string().nullable().optional(),
  source_type: z2.string().optional(),
  source_id: z2.string().nullable().optional(),
  priority: z2.enum(["normal", "urgent", "top_urgent"]).optional(),
  due_date: z2.string().nullable().optional(),
  matter_id: z2.string().nullable().optional()
}).strict();
var updateDirectiveStatusSchema = z2.object({
  status: z2.enum(["pending", "in_progress", "completed", "delayed", "cancelled"]),
  reason: z2.string().optional()
}).strict();
var addDirectiveUpdateSchema = z2.object({
  directive_id: z2.string().optional(),
  update_text: z2.string().optional(),
  content: z2.string().optional(),
  notes: z2.string().optional(),
  progress_percent: z2.number().min(0).max(100)
}).strict();
var createMeetingSchema = z2.object({
  title: z2.string().min(1),
  location: z2.string().min(1),
  start_time: z2.string().min(1),
  end_time: z2.string().min(1),
  meeting_type: z2.string().min(1),
  matter_id: z2.string().nullable().optional(),
  confidentiality: z2.enum(["normal", "confidential", "secret", "top_secret"]).optional(),
  notes: z2.string().nullable().optional()
}).strict();
var updateMeetingSchema = z2.object({
  title: z2.string().optional(),
  location: z2.string().optional(),
  start_time: z2.string().optional(),
  end_time: z2.string().optional(),
  meeting_type: z2.string().optional(),
  matter_id: z2.string().nullable().optional(),
  notes: z2.string().nullable().optional()
}).strict();
var setAttendeesSchema = z2.object({
  attendees: z2.array(z2.object({
    id: z2.string().optional(),
    name: z2.string().min(1),
    title: z2.string().min(1),
    entity: z2.string().min(1),
    is_required: z2.boolean().or(z2.number()).optional(),
    is_external: z2.boolean().or(z2.number()).optional(),
    attendance_status: z2.enum(["invited", "confirmed", "attended", "apologized", "absent"]).optional()
  }).strict())
}).strict();
var setAgendaSchema = z2.object({
  items: z2.array(z2.object({
    id: z2.string().optional(),
    order_index: z2.number(),
    title: z2.string().min(1),
    presenter_name: z2.string().optional(),
    presenter: z2.string().optional(),
    duration_minutes: z2.number().nonnegative(),
    is_confidential: z2.boolean().or(z2.number()).optional()
  }).strict())
}).strict();
var saveMinutesSchema = z2.object({
  meeting_id: z2.string().min(1),
  draft_content: z2.string().nullable().optional(),
  approved_content: z2.string().nullable().optional(),
  status: z2.enum(["draft", "approved"]).optional()
}).strict();
var approveMinutesSchema = z2.object({
  meeting_id: z2.string().optional(),
  approved_content: z2.string().min(1),
  status: z2.string().optional()
}).strict();
var addDecisionSchema = z2.object({
  meeting_id: z2.string().optional(),
  agenda_item_id: z2.string().nullable().optional(),
  order_index: z2.number().optional(),
  content: z2.string().optional(),
  decision_text: z2.string().optional(),
  assigned_to_entity: z2.string().optional(),
  assigned_department_id: z2.string().nullable().optional(),
  assigned_to_name: z2.string().optional(),
  due_date: z2.string().nullable().optional(),
  priority: z2.enum(["normal", "urgent", "top_urgent"]).optional()
}).strict();
var createMatterSchema = z2.object({
  title: z2.string().min(1),
  description: z2.string().nullable().optional().transform((v) => v ?? ""),
  confidentiality: z2.enum(["normal", "confidential", "secret", "top_secret"]).optional(),
  lead_entity: z2.string().min(1),
  priority: z2.enum(["normal", "urgent", "top_urgent"]).optional()
}).strict();
var updateMatterSchema = z2.object({
  title: z2.string().optional(),
  description: z2.string().optional(),
  lead_entity: z2.string().optional(),
  priority: z2.enum(["normal", "urgent", "top_urgent"]).optional()
}).strict();
var addMatterLinkSchema = z2.object({
  target_type: z2.enum(["correspondence", "directive", "meeting"]),
  target_id: z2.string().min(1)
}).strict();
var createContactSchema = z2.object({
  name: z2.string().min(1),
  entity: z2.string().min(1),
  position: z2.string().min(1),
  phone: z2.string().min(1),
  email: z2.string().email(),
  category: z2.string().min(1),
  notes: z2.string().nullable().optional()
}).strict();
var updateContactSchema = z2.object({
  name: z2.string().optional(),
  entity: z2.string().optional(),
  position: z2.string().optional(),
  phone: z2.string().optional(),
  email: z2.string().email().optional(),
  category: z2.string().optional(),
  notes: z2.string().nullable().optional()
}).strict();
var addInteractionSchema = z2.object({
  contact_id: z2.string().optional(),
  date: z2.string().min(1),
  type: z2.string().optional(),
  interaction_type: z2.string().optional(),
  summary: z2.string().min(1),
  follow_up_needed: z2.boolean().or(z2.number()).optional()
}).strict();
var markNotificationReadSchema = z2.object({}).strict();
var markAllNotificationsReadSchema = z2.object({}).strict();
var updateSettingsSchema = z2.object({
  council_name: z2.string().optional(),
  header_title: z2.string().optional(),
  primary_color: z2.string().optional(),
  session_timeout_minutes: z2.number().int().positive().optional(),
  auto_archive_days: z2.number().int().positive().optional(),
  enable_two_factor: z2.boolean().or(z2.number()).optional(),
  fiscal_year: z2.string().optional(),
  default_digit_format: z2.string().optional(),
  default_calendar_format: z2.string().optional()
}).strict();
var loginSchema2 = z2.object({
  username: z2.string().min(1),
  password: z2.string().min(1)
}).strict();
var changePasswordSchema2 = z2.object({
  current_password: z2.string().min(1, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629"),
  new_password: z2.string().min(1, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0645\u0637\u0644\u0648\u0628\u0629")
}).strict();
var reauthSchema2 = z2.object({
  password: z2.string().min(1)
}).strict();

// src/server/controllers/meetings.controller.ts
import { z as z3 } from "zod";
var attendeeItemSchema = z3.object({
  id: z3.string().optional(),
  name: z3.string().min(1),
  title: z3.string().min(1),
  entity: z3.string().min(1),
  is_required: z3.boolean().or(z3.number()).optional(),
  is_external: z3.boolean().or(z3.number()).optional(),
  attendance_status: z3.enum(["invited", "confirmed", "attended", "apologized", "absent"]).optional()
}).strict();
var agendaItemSchema = z3.object({
  id: z3.string().optional(),
  order_index: z3.number(),
  title: z3.string().min(1),
  presenter_name: z3.string().optional(),
  presenter: z3.string().optional(),
  duration_minutes: z3.number().nonnegative(),
  is_confidential: z3.boolean().or(z3.number()).optional()
}).strict();
var MeetingsController = class {
  static async getAll(req, res, next) {
    try {
      const filter = {
        status: req.query.status,
        matterId: req.query.matterId,
        search: req.query.search
      };
      const data = await meetingRepo2.getAll(filter, req.userContext);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
  static async getById(req, res, next) {
    try {
      const item = await meetingRepo2.getById(req.params.id, req.userContext);
      if (!item) {
        res.status(404).json({ error: "\u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
  static async create(req, res, next) {
    try {
      const validated = createMeetingSchema.parse(req.body);
      const created = await BackendCommandService.createMeeting(validated, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
  static async update(req, res, next) {
    try {
      const validated = updateMeetingSchema.parse(req.body);
      const updated = await meetingRepo2.update(req.params.id, validated, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
  static async softDelete(req, res, next) {
    try {
      const success = await meetingRepo2.softDelete(req.params.id, req.userContext);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }
  static async getAttendees(req, res, next) {
    try {
      const list = await meetingRepo2.getAttendees(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async setAttendees(req, res, next) {
    try {
      let attendeesList;
      if (Array.isArray(req.body)) {
        attendeesList = z3.array(attendeeItemSchema).parse(req.body);
      } else {
        const parsed = setAttendeesSchema.parse(req.body);
        attendeesList = parsed.attendees;
      }
      await meetingRepo2.setAttendees(req.params.id, attendeesList, req.userContext);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
  static async getAgenda(req, res, next) {
    try {
      const list = await meetingRepo2.getAgenda(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async setAgenda(req, res, next) {
    try {
      let agendaList;
      if (Array.isArray(req.body)) {
        agendaList = z3.array(agendaItemSchema).parse(req.body);
      } else {
        const parsed = setAgendaSchema.parse(req.body);
        agendaList = parsed.items;
      }
      await meetingRepo2.setAgenda(req.params.id, agendaList, req.userContext);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
  static async getMinutes(req, res, next) {
    try {
      const minutes = await meetingRepo2.getMinutes(req.params.id, req.userContext);
      res.json(minutes);
    } catch (err) {
      next(err);
    }
  }
  static async saveMinutes(req, res, next) {
    try {
      const validated = saveMinutesSchema.parse(req.body);
      if (validated.status && validated.status !== "draft") {
        res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0623\u0648 \u062D\u0641\u0638 \u0645\u062D\u0636\u0631 \u0646\u0647\u0627\u0626\u064A \u0645\u0639\u062A\u0645\u062F \u0645\u0628\u0627\u0634\u0631\u0629" });
        return;
      }
      const saved = await meetingRepo2.saveMinutes({ ...validated, draft_content: validated.draft_content || "", status: "draft" }, req.userContext);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }
  static async approveMinutes(req, res, next) {
    try {
      let approvedContent = "";
      if (req.body.approved_content) {
        const parsed = approveMinutesSchema.parse(req.body);
        approvedContent = parsed.approved_content;
      } else if (req.body.meeting_id) {
        const parsed = saveMinutesSchema.parse(req.body);
        approvedContent = parsed.approved_content || parsed.draft_content || "";
      }
      const saved = await meetingRepo2.saveMinutes({
        meeting_id: req.params.id || req.body.meeting_id,
        approved_content: approvedContent,
        status: "approved",
        approved_by: req.user?.name || req.userContext?.userId || "CHAIRMAN",
        approved_at: (/* @__PURE__ */ new Date()).toISOString()
      }, req.userContext);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }
  static async getDecisions(req, res, next) {
    try {
      const list = await meetingRepo2.getDecisions(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async addDecision(req, res, next) {
    try {
      const validated = addDecisionSchema.parse(req.body);
      const meeting_id = req.params.id || validated.meeting_id;
      const payload = {
        ...validated,
        meeting_id,
        order_index: validated.order_index || 1,
        content: validated.content || validated.decision_text || "",
        assigned_to_name: validated.assigned_to_name || validated.assigned_to_entity || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"
      };
      const added = await meetingRepo2.addDecision(payload, req.userContext);
      res.status(201).json(added);
    } catch (err) {
      next(err);
    }
  }
};

// src/server/controllers/correspondence.controller.ts
var CorrespondenceController = class {
  static async getAll(req, res, next) {
    try {
      const filter = {
        type: req.query.type,
        status: req.query.status,
        matterId: req.query.matterId,
        search: req.query.search
      };
      const list = await correspondenceRepo2.getAll(filter, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async getNextSerial(req, res, next) {
    try {
      const type = req.query.type || "incoming";
      const year = req.query.year ? parseInt(req.query.year, 10) : void 0;
      const serial = await correspondenceRepo2.getNextSerial(type, year);
      res.json({ serial });
    } catch (err) {
      next(err);
    }
  }
  static async getById(req, res, next) {
    try {
      const item = await correspondenceRepo2.getById(req.params.id, req.userContext);
      if (!item) {
        res.status(404).json({ error: "\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
  static async create(req, res, next) {
    try {
      const validated = createCorrespondenceSchema.parse(req.body);
      const created = await BackendCommandService.createCorrespondence(validated, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
  static async update(req, res, next) {
    try {
      const validated = updateCorrespondenceSchema.parse(req.body);
      const updated = await correspondenceRepo2.update(req.params.id, validated, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
  static async submit(req, res, next) {
    try {
      const validated = submitCorrespondenceSchema.parse(req.body);
      const updated = await correspondenceRepo2.submit(req.params.id, validated.comment, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
  static async reclassify(req, res, next) {
    try {
      const validated = reclassifyCorrespondenceSchema.parse(req.body);
      const updated = await correspondenceRepo2.reclassify(
        req.params.id,
        validated.confidentiality,
        validated.reason,
        req.userContext
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
  static async softDelete(req, res, next) {
    try {
      const success = await correspondenceRepo2.softDelete(req.params.id, req.userContext);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }
  static async getBriefing(req, res, next) {
    try {
      const note = await correspondenceRepo2.getBriefingNote(req.params.id, req.userContext);
      res.json(note);
    } catch (err) {
      next(err);
    }
  }
  static async saveBriefing(req, res, next) {
    try {
      const validated = saveBriefingSchema.parse(req.body);
      const correspondence_id = req.params.id || validated.correspondence_id;
      const payload = {
        ...validated,
        correspondence_id,
        background: validated.background || validated.summary || "",
        secretary_recommendation: validated.secretary_recommendation || validated.recommendation || "",
        executive_opinion: validated.executive_opinion || validated.legal_opinion || "",
        prepared_by_name: validated.prepared_by_name || req.user?.name || req.userContext?.userId || "\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0646\u0638\u0627\u0645",
        prepared_at: validated.prepared_at || (/* @__PURE__ */ new Date()).toISOString()
      };
      const saved = await correspondenceRepo2.saveBriefingNote(payload, req.userContext);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  }
  static async getApproval(req, res, next) {
    try {
      const approval = await correspondenceRepo2.getApproval(req.params.id, req.userContext);
      res.json(approval);
    } catch (err) {
      next(err);
    }
  }
  static async recordApproval(req, res, next) {
    try {
      const validated = recordApprovalSchema.parse(req.body);
      const correspondence_id = req.params.id || validated.correspondence_id;
      const decision_type = validated.decision_type || validated.decision || "approved";
      const payload = {
        ...validated,
        correspondence_id,
        decision_type,
        standard_phrase: validated.standard_phrase || validated.notes || "\u0645\u0639\u062A\u0645\u062F",
        custom_directive: validated.custom_directive || null,
        decided_by_name: validated.decided_by_name || req.user?.name || req.userContext?.userId || "\u0631\u0626\u064A\u0633 \u0645\u062C\u0644\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
        decided_at: validated.decided_at || (/* @__PURE__ */ new Date()).toISOString()
      };
      const recorded = await correspondenceRepo2.recordApproval(payload, req.userContext);
      res.json(recorded);
    } catch (err) {
      next(err);
    }
  }
  static async getRoutings(req, res, next) {
    try {
      const list = await correspondenceRepo2.getRoutings(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async addRouting(req, res, next) {
    try {
      const validated = addRoutingSchema.parse(req.body);
      const correspondence_id = req.params.id || validated.correspondence_id;
      const created = await correspondenceRepo2.addRouting({
        ...validated,
        correspondence_id
      }, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
  static async getAttachments(req, res, next) {
    try {
      const list = await correspondenceRepo2.getAttachments(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async addAttachment(req, res, next) {
    try {
      const validated = addAttachmentSchema.parse(req.body);
      const correspondence_id = req.params.id || validated.correspondence_id;
      const created = await correspondenceRepo2.addAttachment({
        ...validated,
        correspondence_id,
        entity_id: correspondence_id
      }, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
};

// src/server/controllers/directives.controller.ts
var DirectivesController = class {
  static async getAll(req, res, next) {
    try {
      const filter = {
        status: req.query.status,
        assignedDepartment: req.query.assignedDepartment,
        matterId: req.query.matterId,
        search: req.query.search
      };
      const list = await directiveRepo2.getAll(filter, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async getNextCode(req, res, next) {
    try {
      const year = req.query.year ? parseInt(req.query.year, 10) : void 0;
      const code = await directiveRepo2.getNextCode(year);
      res.json({ code });
    } catch (err) {
      next(err);
    }
  }
  static async getById(req, res, next) {
    try {
      const item = await directiveRepo2.getById(req.params.id, req.userContext);
      if (!item) {
        res.status(404).json({ error: "\u0627\u0644\u062A\u0643\u0644\u064A\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
  static async create(req, res, next) {
    try {
      const validated = createDirectiveSchema.parse(req.body);
      const created = await BackendCommandService.createDirective(validated, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
  static async update(req, res, next) {
    try {
      const validated = updateDirectiveSchema.parse(req.body);
      const updated = await directiveRepo2.update(req.params.id, validated, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
  static async updateStatus(req, res, next) {
    try {
      const validated = updateDirectiveStatusSchema.parse(req.body);
      const updated = await directiveRepo2.updateStatus(
        req.params.id,
        validated.status,
        validated.reason,
        req.userContext
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
  static async softDelete(req, res, next) {
    try {
      const success = await directiveRepo2.softDelete(req.params.id, req.userContext);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }
  static async getUpdates(req, res, next) {
    try {
      const list = await directiveRepo2.getUpdates(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async addUpdate(req, res, next) {
    try {
      const validated = addDirectiveUpdateSchema.parse(req.body);
      const directive_id = req.params.id || validated.directive_id;
      const created = await directiveRepo2.addUpdate({
        ...validated,
        directive_id
      }, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
};

// src/server/controllers/matters.controller.ts
var MattersController = class {
  static async getAll(req, res, next) {
    try {
      const filter = {
        status: req.query.status,
        search: req.query.search
      };
      const list = await matterRepo2.getAll(filter, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async getById(req, res, next) {
    try {
      const item = await matterRepo2.getById(req.params.id, req.userContext);
      if (!item) {
        res.status(404).json({ error: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
  static async create(req, res, next) {
    try {
      const validated = createMatterSchema.parse(req.body);
      const created = await matterRepo2.create(validated, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
  static async update(req, res, next) {
    try {
      const validated = updateMatterSchema.parse(req.body);
      const updated = await matterRepo2.update(req.params.id, validated, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
  static async softDelete(req, res, next) {
    try {
      const success = await matterRepo2.softDelete(req.params.id, req.userContext);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }
  static async getLinks(req, res, next) {
    try {
      const list = await matterRepo2.getLinks(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async addLink(req, res, next) {
    try {
      const validated = addMatterLinkSchema.parse(req.body);
      const created = await matterRepo2.addLink({ ...validated, matter_id: req.params.id }, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
  static async removeLink(req, res, next) {
    try {
      const success = await matterRepo2.removeLink(req.params.linkId, req.userContext);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }
};

// src/server/controllers/contacts.controller.ts
var ContactsController = class {
  static async getAll(req, res, next) {
    try {
      const list = await contactRepo2.getAll(req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async getById(req, res, next) {
    try {
      const item = await contactRepo2.getById(req.params.id, req.userContext);
      if (!item) {
        res.status(404).json({ error: "\u062C\u0647\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
  static async create(req, res, next) {
    try {
      const validated = createContactSchema.parse(req.body);
      const created = await contactRepo2.create(validated, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
  static async update(req, res, next) {
    try {
      const validated = updateContactSchema.parse(req.body);
      const updated = await contactRepo2.update(req.params.id, validated, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
  static async softDelete(req, res, next) {
    try {
      const success = await contactRepo2.softDelete(req.params.id, req.userContext);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }
  static async getInteractions(req, res, next) {
    try {
      const list = await contactRepo2.getInteractions(req.params.id, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async addInteraction(req, res, next) {
    try {
      const validated = addInteractionSchema.parse(req.body);
      const contact_id = req.params.id || validated.contact_id;
      const created = await contactRepo2.addInteraction({
        ...validated,
        contact_id
      }, req.userContext);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
};

// src/server/controllers/notifications.controller.ts
var NotificationsController = class {
  static async getAll(req, res, next) {
    try {
      const role = req.query.role || req.userContext?.role || "SECRETARY";
      const list = await notificationRepo2.getAllForRole(role, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async markAsRead(req, res, next) {
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        markNotificationReadSchema.parse(req.body);
      }
      await notificationRepo2.markAsRead(req.params.id, req.userContext);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
  static async markAllAsRead(req, res, next) {
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        markAllNotificationsReadSchema.parse(req.body);
      }
      const role = req.userContext?.role || "SECRETARY";
      await notificationRepo2.markAllAsRead(role, req.userContext);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
};

// src/server/controllers/audit.controller.ts
var AuditController = class {
  static async getAll(req, res, next) {
    try {
      const filter = {
        entityType: req.query.entityType,
        userId: req.query.userId,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 100
      };
      const list = await auditRepo2.getAll(filter, req.userContext);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
  static async log(req, res, next) {
    try {
      await auditRepo2.log(req.body, req.userContext);
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
  static async verify(req, res, next) {
    try {
      const result = await auditRepo2.verify(req.userContext);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
};

// src/server/controllers/settings.controller.ts
var SettingsController = class {
  static async getSettings(req, res, next) {
    try {
      const settings = await settingsRepo2.getSettings(req.userContext);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }
  static async updateSettings(req, res, next) {
    try {
      const validated = updateSettingsSchema.parse(req.body);
      const updated = await settingsRepo2.updateSettings(validated, req.userContext);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
};

// src/server/routes/api.router.ts
var DECLARATIVE_ROUTES = [
  // 1. Open Routes
  { method: "get", path: "/health", handler: (req, res) => res.json({ status: "ok" }), requireAuth: false, mustChangePassword: false },
  { method: "post", path: "/auth/login", handler: AuthController.login, requireAuth: false, mustChangePassword: false },
  // 2. Session Routes
  { method: "get", path: "/auth/me", handler: AuthController.me, requireAuth: true, mustChangePassword: false },
  { method: "post", path: "/auth/logout", handler: AuthController.logout, requireAuth: true, mustChangePassword: false },
  { method: "post", path: "/auth/change-password", handler: AuthController.changePassword, requireAuth: true, mustChangePassword: false },
  { method: "post", path: "/auth/reauth", handler: AuthController.reauth, requireAuth: true, mustChangePassword: false },
  // 3. Users Management
  { method: "get", path: "/users", handler: AuthController.getUsers, requireAuth: true, mustChangePassword: true, resource: "users", action: "read" },
  // 4. Meetings
  { method: "get", path: "/meetings", handler: MeetingsController.getAll, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "read" },
  { method: "post", path: "/meetings", handler: MeetingsController.create, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "create" },
  { method: "get", path: "/meetings/:id", handler: MeetingsController.getById, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "read" },
  { method: "patch", path: "/meetings/:id", handler: MeetingsController.update, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "update" },
  { method: "delete", path: "/meetings/:id", handler: MeetingsController.softDelete, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "archive" },
  { method: "get", path: "/meetings/:id/attendees", handler: MeetingsController.getAttendees, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "read" },
  { method: "put", path: "/meetings/:id/attendees", handler: MeetingsController.setAttendees, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "update" },
  { method: "get", path: "/meetings/:id/agenda", handler: MeetingsController.getAgenda, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "read" },
  { method: "put", path: "/meetings/:id/agenda", handler: MeetingsController.setAgenda, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "update" },
  { method: "get", path: "/meetings/:id/minutes", handler: MeetingsController.getMinutes, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "read" },
  { method: "post", path: "/meetings/:id/minutes", handler: MeetingsController.saveMinutes, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "update_minutes" },
  { method: "post", path: "/meetings/:id/minutes/approve", handler: MeetingsController.approveMinutes, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "approve_minutes" },
  { method: "get", path: "/meetings/:id/decisions", handler: MeetingsController.getDecisions, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "read" },
  { method: "post", path: "/meetings/:id/decisions", handler: MeetingsController.addDecision, requireAuth: true, mustChangePassword: true, resource: "meetings", action: "decide" },
  // 5. Correspondence
  { method: "get", path: "/correspondence", handler: CorrespondenceController.getAll, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "read" },
  { method: "post", path: "/correspondence", handler: CorrespondenceController.create, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "create" },
  { method: "get", path: "/correspondence/next-serial", handler: CorrespondenceController.getNextSerial, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "read" },
  { method: "get", path: "/correspondence/:id", handler: CorrespondenceController.getById, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "read" },
  { method: "patch", path: "/correspondence/:id", handler: CorrespondenceController.update, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "update" },
  { method: "post", path: "/correspondence/:id/submit", handler: CorrespondenceController.submit, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "update" },
  { method: "post", path: "/correspondence/:id/reclassify", handler: CorrespondenceController.reclassify, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "update" },
  { method: "delete", path: "/correspondence/:id", handler: CorrespondenceController.softDelete, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "archive" },
  { method: "get", path: "/correspondence/:id/briefing", handler: CorrespondenceController.getBriefing, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "read" },
  { method: "post", path: "/correspondence/:id/briefing", handler: CorrespondenceController.saveBriefing, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "comment" },
  { method: "get", path: "/correspondence/:id/approval", handler: CorrespondenceController.getApproval, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "read" },
  { method: "post", path: "/correspondence/:id/approval", handler: CorrespondenceController.recordApproval, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "approve" },
  { method: "get", path: "/correspondence/:id/routings", handler: CorrespondenceController.getRoutings, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "read" },
  { method: "post", path: "/correspondence/:id/routings", handler: CorrespondenceController.addRouting, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "refer" },
  { method: "get", path: "/correspondence/:id/attachments", handler: CorrespondenceController.getAttachments, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "read" },
  { method: "post", path: "/correspondence/:id/attachments", handler: CorrespondenceController.addAttachment, requireAuth: true, mustChangePassword: true, resource: "correspondence", action: "update" },
  // 6. Directives
  { method: "get", path: "/directives", handler: DirectivesController.getAll, requireAuth: true, mustChangePassword: true, resource: "directives", action: "read" },
  { method: "post", path: "/directives", handler: DirectivesController.create, requireAuth: true, mustChangePassword: true, resource: "directives", action: "create" },
  { method: "get", path: "/directives/next-code", handler: DirectivesController.getNextCode, requireAuth: true, mustChangePassword: true, resource: "directives", action: "read" },
  { method: "get", path: "/directives/:id", handler: DirectivesController.getById, requireAuth: true, mustChangePassword: true, resource: "directives", action: "read" },
  { method: "patch", path: "/directives/:id", handler: DirectivesController.update, requireAuth: true, mustChangePassword: true, resource: "directives", action: "update" },
  { method: "post", path: "/directives/:id/status", handler: DirectivesController.updateStatus, requireAuth: true, mustChangePassword: true, resource: "directives", action: "update" },
  { method: "delete", path: "/directives/:id", handler: DirectivesController.softDelete, requireAuth: true, mustChangePassword: true, resource: "directives", action: "archive" },
  { method: "get", path: "/directives/:id/updates", handler: DirectivesController.getUpdates, requireAuth: true, mustChangePassword: true, resource: "directives", action: "read" },
  { method: "post", path: "/directives/:id/updates", handler: DirectivesController.addUpdate, requireAuth: true, mustChangePassword: true, resource: "directives", action: "update" },
  // 7. Matters
  { method: "get", path: "/matters", handler: MattersController.getAll, requireAuth: true, mustChangePassword: true, resource: "matters", action: "read" },
  { method: "post", path: "/matters", handler: MattersController.create, requireAuth: true, mustChangePassword: true, resource: "matters", action: "create" },
  { method: "get", path: "/matters/:id", handler: MattersController.getById, requireAuth: true, mustChangePassword: true, resource: "matters", action: "read" },
  { method: "patch", path: "/matters/:id", handler: MattersController.update, requireAuth: true, mustChangePassword: true, resource: "matters", action: "update" },
  { method: "delete", path: "/matters/:id", handler: MattersController.softDelete, requireAuth: true, mustChangePassword: true, resource: "matters", action: "archive" },
  { method: "get", path: "/matters/:id/links", handler: MattersController.getLinks, requireAuth: true, mustChangePassword: true, resource: "matters", action: "read" },
  { method: "post", path: "/matters/:id/links", handler: MattersController.addLink, requireAuth: true, mustChangePassword: true, resource: "matters", action: "update" },
  { method: "delete", path: "/matters/links/:linkId", handler: MattersController.removeLink, requireAuth: true, mustChangePassword: true, resource: "matters", action: "update" },
  // 8. Contacts
  { method: "get", path: "/contacts", handler: ContactsController.getAll, requireAuth: true, mustChangePassword: true, resource: "contacts", action: "read" },
  { method: "post", path: "/contacts", handler: ContactsController.create, requireAuth: true, mustChangePassword: true, resource: "contacts", action: "create" },
  { method: "get", path: "/contacts/:id", handler: ContactsController.getById, requireAuth: true, mustChangePassword: true, resource: "contacts", action: "read" },
  { method: "patch", path: "/contacts/:id", handler: ContactsController.update, requireAuth: true, mustChangePassword: true, resource: "contacts", action: "update" },
  { method: "delete", path: "/contacts/:id", handler: ContactsController.softDelete, requireAuth: true, mustChangePassword: true, resource: "contacts", action: "archive" },
  { method: "get", path: "/contacts/:id/interactions", handler: ContactsController.getInteractions, requireAuth: true, mustChangePassword: true, resource: "contacts", action: "read" },
  { method: "post", path: "/contacts/:id/interactions", handler: ContactsController.addInteraction, requireAuth: true, mustChangePassword: true, resource: "contacts", action: "update" },
  // 9. Notifications
  { method: "get", path: "/notifications", handler: NotificationsController.getAll, requireAuth: true, mustChangePassword: true, resource: "notifications", action: "read" },
  { method: "patch", path: "/notifications/:id/read", handler: NotificationsController.markAsRead, requireAuth: true, mustChangePassword: true, resource: "notifications", action: "update" },
  { method: "post", path: "/notifications/read-all", handler: NotificationsController.markAllAsRead, requireAuth: true, mustChangePassword: true, resource: "notifications", action: "update" },
  // 10. Audit Log
  { method: "get", path: "/audit", handler: AuditController.getAll, requireAuth: true, mustChangePassword: true, resource: "audit", action: "read" },
  { method: "get", path: "/audit/verify", handler: AuditController.verify, requireAuth: true, mustChangePassword: true, resource: "audit", action: "read" },
  // 11. Settings
  { method: "get", path: "/settings", handler: SettingsController.getSettings, requireAuth: true, mustChangePassword: true, resource: "settings", action: "read" },
  { method: "patch", path: "/settings", handler: SettingsController.updateSettings, requireAuth: true, mustChangePassword: true, resource: "settings", action: "update" }
];
var apiRouter = Router();
apiRouter.use(csrfProtection);
DECLARATIVE_ROUTES.forEach((route) => {
  const middlewares = [];
  if (route.requireAuth) {
    middlewares.push(requireAuth);
  }
  if (route.mustChangePassword) {
    middlewares.push(mustChangePasswordGuard);
  }
  if (route.resource && route.action) {
    middlewares.push(rbacGuard(route.resource, route.action));
  }
  apiRouter[route.method](route.path, ...middlewares, route.handler);
});

// src/server/app.ts
function createApp() {
  const app = express();
  const isProduction2 = process.env.NODE_ENV === "production";
  const isPreview = !isProduction2 && process.env.PREVIEW_MODE === "true";
  if (process.env.COOKIE_SECURE === "false") {
    console.warn("\u26A0\uFE0F  [SECURITY WARNING] COOKIE_SECURE is set to false. Cookies are not encrypted over plain HTTP.");
  }
  if (process.env.PREVIEW_MODE === "true") {
    if (isProduction2) {
      console.warn("\u2139\uFE0F  [SECURITY NOTICE] PREVIEW_MODE is set, but running in PRODUCTION mode. Preview mode is ignored; full strict security controls enforced.");
    } else {
      console.warn("\n**********************************************************************");
      console.warn("\u26A0\uFE0F  PREVIEW MODE: NOT FOR PRODUCTION");
      console.warn("   Relaxed frame-ancestors allowlist and SameSite=None session cookies active.");
      console.warn("**********************************************************************\n");
    }
  }
  const rawAncestors = process.env.FRAME_ANCESTORS || "'self' https://aistudio.google.com https://*.google.com https://*.google.dev https://*.run.app";
  const parsedAncestors = rawAncestors.split(/\s+/).map((s) => s.trim()).filter((s) => s.length > 0 && s !== "*");
  const allowedAncestors = parsedAncestors.length > 0 ? parsedAncestors : ["'self'", "https://aistudio.google.com", "https://*.google.com", "https://*.google.dev", "https://*.run.app"];
  app.set("trust proxy", process.env.TRUST_PROXY ? process.env.TRUST_PROXY === "true" ? true : parseInt(process.env.TRUST_PROXY, 10) : false);
  app.use((req, res, next) => {
    if (req.secure) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }
    next();
  });
  app.use(
    helmet({
      hsts: false,
      // Handled conditionally above for req.secure
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProduction2 ? ["'self'", "'wasm-unsafe-eval'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: isProduction2 ? ["'self'"] : ["'self'", "ws:", "wss:"],
          frameAncestors: isPreview ? allowedAncestors : ["'none'"],
          upgradeInsecureRequests: null
        }
      },
      xContentTypeOptions: true,
      referrerPolicy: { policy: "no-referrer" },
      frameguard: isPreview ? false : { action: "deny" },
      crossOriginResourcePolicy: { policy: isPreview ? "cross-origin" : "same-origin" },
      crossOriginOpenerPolicy: isPreview ? false : { policy: "same-origin" }
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(sessionAuthMiddleware);
  app.use("/api", apiRouter);
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0628\u0631\u0645\u062C\u064A \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F",
      code: "NOT_FOUND",
      path: req.path
    });
  });
  app.use(errorHandler);
  return app;
}

// src/server/start.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var isProduction = process.env.NODE_ENV === "production";
var PORT = parseInt(process.env.APP_PORT || (process.env.PORT === "8080" ? "3000" : process.env.PORT || "3000"), 10);
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "REPLACE_WITH_STRONG_RANDOM_64_CHAR_SECRET") {
    if (isProd) {
      console.error("\u274C FATAL: Critical environment variable SESSION_SECRET is missing or has placeholder value.");
      process.exit(1);
    } else {
      process.env.SESSION_SECRET = (await import("crypto")).randomBytes(32).toString("hex");
      console.log("\u2139\uFE0F  Development/Preview mode: auto-generated volatile SESSION_SECRET.");
    }
  }
  if (!process.env.BACKUP_PASSPHRASE || process.env.BACKUP_PASSPHRASE === "REPLACE_WITH_STRONG_OFFLINE_PASSPHRASE") {
    if (isProd) {
      console.error("\u274C FATAL: Critical environment variable BACKUP_PASSPHRASE is missing or has placeholder value.");
      process.exit(1);
    } else {
      process.env.BACKUP_PASSPHRASE = (await import("crypto")).randomBytes(24).toString("hex");
      console.log("\u2139\uFE0F  Development/Preview mode: auto-generated volatile BACKUP_PASSPHRASE.");
    }
  }
  await sqliteEngine.init();
  const engineInfo = sqliteEngine.getEngineInfo();
  console.log("\n" + formatStartupBanner(engineInfo) + "\n");
  const app = createApp();
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("\u26A1 Vite Dev Middlewares mounted on Express.");
  } else {
    const distPath = path2.resolve(process.cwd(), "dist");
    const indexHtmlPath = path2.join(distPath, "index.html");
    if (fs2.existsSync(indexHtmlPath)) {
      app.use((await import("express")).default.static(distPath));
      app.get("*", (req, res) => {
        if (fs2.existsSync(indexHtmlPath)) {
          res.sendFile(indexHtmlPath);
        } else {
          res.status(503).type("html").send(`
            <!doctype html>
            <html lang="ar" dir="rtl">
              <head><meta charset="UTF-8"><title>\u062E\u0637\u0623 \u0641\u064A \u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0648\u0627\u062C\u0647\u0629</title></head>
              <body style="font-family:sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="background:#1e293b;padding:30px;border-radius:16px;max-width:500px;text-align:center;border:1px solid #dc2626;">
                  <h1 style="color:#ef4444;font-size:20px;margin-bottom:12px;">\u0645\u0644\u0641\u0627\u062A \u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0625\u0646\u062A\u0627\u062C \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629 (Build Missing)</h1>
                  <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0644\u0641 <code>dist/index.html</code>. \u064A\u0631\u062C\u0649 \u062A\u0646\u0641\u064A\u0630 \u0623\u0645\u0631 \u0627\u0644\u0628\u0646\u0627\u0621 <code>npm run build</code> \u0623\u0648\u0644\u0627\u064B.</p>
                </div>
              </body>
            </html>
          `);
        }
      });
      console.log(`\u{1F4E6} Production static assets mounted from ${distPath}`);
    } else {
      console.error("\n======================================================");
      console.error("\u274C FATAL: Production frontend build not found.");
      console.error('\u{1F4A1} Run "npm run build" before starting the production server.');
      console.error(`\u{1F4CC} Expected file: ${indexHtmlPath}`);
      console.error("======================================================\n");
      app.get("*", (req, res) => {
        res.status(503).type("html").send(`
          <!doctype html>
          <html lang="ar" dir="rtl">
            <head><meta charset="UTF-8"><title>\u062E\u0637\u0623 \u0641\u064A \u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0648\u0627\u062C\u0647\u0629</title></head>
            <body style="font-family:sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
              <div style="background:#1e293b;padding:30px;border-radius:16px;max-width:500px;text-align:center;border:1px solid #dc2626;">
                <h1 style="color:#ef4444;font-size:20px;margin-bottom:12px;">\u0645\u0644\u0641\u0627\u062A \u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0625\u0646\u062A\u0627\u062C \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629 (Build Missing)</h1>
                <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0644\u0641 <code>dist/index.html</code>. \u064A\u0631\u062C\u0649 \u062A\u0646\u0641\u064A\u0630 \u0623\u0645\u0631 \u0627\u0644\u0628\u0646\u0627\u0621 <code>npm run build</code> \u0623\u0648\u0644\u0627\u064B \u0642\u0628\u0644 \u062A\u0634\u063A\u064A\u0644 \u062E\u0627\u062F\u0645 \u0627\u0644\u0625\u0646\u062A\u0627\u062C.</p>
              </div>
            </body>
          </html>
        `);
      });
    }
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`
======================================================`);
    console.log(`\u{1F680} Executive Office Portal Server Running on Port ${PORT}`);
    console.log(`\u{1F310} URL: http://0.0.0.0:${PORT}`);
    console.log(`\u{1F4BE} Storage: ${engineInfo.isMemory ? "SQLite In-Memory Mode (:memory:)" : `SQLite File-Backed Mode (${engineInfo.journalMode})`}`);
    console.log(`\u{1F4C1} Database: ${engineInfo.absolutePath}`);
    console.log(`\u{1F4C1} API Routes: Mounted at /api/* (JSON 404 for unknown endpoints)`);
    console.log(`======================================================
`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`
\u274C FATAL: Port ${PORT} is already in use by another process.`);
      console.error(`\u{1F4A1} Please terminate any existing process on port ${PORT} or configure PORT env variable.
`);
    } else {
      console.error("\u274C Server startup error:", err);
    }
    process.exit(1);
  });
  let isShuttingDown = false;
  const handleShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`
\u{1F6D1} Received ${signal}. Gracefully shutting down Executive Office Portal server...`);
    server.close((err) => {
      if (err) {
        console.error("\u274C Error during server shutdown:", err);
        process.exit(1);
      }
      console.log("\u2705 Server HTTP listener closed cleanly. Exiting.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("\u26A0\uFE0F Forcing shutdown after timeout.");
      process.exit(1);
    }, 1e4).unref();
  };
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  return { app, server };
}
startServer().catch((err) => {
  console.error("Fatal Server Initialization Error:", err);
  process.exit(1);
});
