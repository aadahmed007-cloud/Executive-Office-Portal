/**
 * Cryptographic utility for Audit Log chaining and integrity verification.
 * Supports standard Web Crypto API and pure isomorphic execution.
 */
import { AuditLogEntry } from '../types/index.js';

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Computes SHA-256 hash in hexadecimal using Web Crypto API.
 */
export async function sha256Hex(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Builds canonical string payload for audit hash calculation.
 * Includes seq, user_id, and is_confidential for complete tamper-resistance.
 */
export function buildAuditPayload(entry: {
  seq?: number;
  id: string;
  timestamp: string;
  user_id: string;
  user_role: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_value?: string | null;
  after_value?: string | null;
  ip_address?: string | null;
  prev_hash?: string | null;
  is_confidential?: number | boolean;
}): string {
  return [
    entry.seq !== undefined ? String(entry.seq) : '',
    entry.id,
    entry.timestamp,
    entry.user_id,
    entry.user_role,
    entry.action_type,
    entry.entity_type,
    entry.entity_id,
    entry.before_value || '',
    entry.after_value || '',
    entry.ip_address || '',
    entry.prev_hash || 'GENESIS',
    entry.is_confidential ? '1' : '0'
  ].join('||');
}

/**
 * Computes SHA-256 hash for an audit log entry chained to prev_hash.
 */
export async function computeAuditEntryHash(entry: {
  seq?: number;
  id: string;
  timestamp: string;
  user_id: string;
  user_role: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_value?: string | null;
  after_value?: string | null;
  ip_address?: string | null;
  prev_hash?: string | null;
  is_confidential?: number | boolean;
}): Promise<string> {
  const payload = buildAuditPayload(entry);
  return sha256Hex(payload);
}

export const GENESIS_BLOCK_HASH = 'GENESIS-BLOCK-00000000000000000000000000000000';

export interface AuditCheckpoint {
  last_seq: number;
  head_hash: string;
  count: number;
}

export interface IntegrityVerificationResult {
  isValid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenEntryId?: string;
  brokenReason?: string;
}

/**
 * Verifies the integrity of the audit log cryptographic chain.
 * Validates:
 * 1. First row prev_hash == GENESIS_BLOCK_HASH
 * 2. null/empty entry_hash = broken
 * 3. Strict sequential hash linking: entry[i].prev_hash === entry[i-1].entry_hash
 * 4. Content tamper verification (computed hash == entry_hash)
 * 5. Checkpoint verification (detects deleted oldest or newest rows)
 */
export async function verifyAuditLogIntegrity(
  entries: AuditLogEntry[],
  checkpoint?: AuditCheckpoint | null
): Promise<IntegrityVerificationResult> {
  if (entries.length === 0) {
    if (checkpoint && checkpoint.count > 0) {
      return {
        isValid: false,
        totalEntries: 0,
        verifiedEntries: 0,
        brokenReason: 'عدم تطابق مع نقطة التحقق: قاعدة البيانات لا تحتوي على سجلات تدقيق بالرغم من تسجيل نقطة تحقق'
      };
    }
    return { isValid: true, totalEntries: 0, verifiedEntries: 0 };
  }

  // Sort by sequence if present, otherwise by timestamp
  const sorted = [...entries].sort((a, b) => {
    if (a.seq !== undefined && b.seq !== undefined) {
      return a.seq - b.seq;
    }
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Checkpoint validation: count check
  if (checkpoint && checkpoint.count !== undefined && checkpoint.count !== sorted.length) {
    return {
      isValid: false,
      totalEntries: sorted.length,
      verifiedEntries: 0,
      brokenReason: `عدم تطابق في إجمالي عدد سجلات التدقيق مع نقطة التحقق: المتوقع ${checkpoint.count}، الفعلي ${sorted.length} (تم اكتشاف حذف سجلات)`
    };
  }

  // Checkpoint validation: oldest row deletion check
  if (checkpoint && checkpoint.count > 0 && sorted[0].seq !== undefined && sorted[0].seq !== 1) {
    return {
      isValid: false,
      totalEntries: sorted.length,
      verifiedEntries: 0,
      brokenEntryId: sorted[0].id,
      brokenReason: `تم اكتشاف حذف أقدم السجلات: التسلسل يبدأ من ${sorted[0].seq} بدلاً من 1`
    };
  }

  let expectedPrevHash: string | null = GENESIS_BLOCK_HASH;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // Rule: null or empty entry_hash is broken
    if (!entry.entry_hash || entry.entry_hash.trim() === '') {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: i,
        brokenEntryId: entry.id,
        brokenReason: `توقيع السجل [${entry.id}] مفقود أو فارغ`
      };
    }

    // Rule: First entry must link to genesis
    if (i === 0) {
      if (entry.prev_hash !== GENESIS_BLOCK_HASH) {
        return {
          isValid: false,
          totalEntries: sorted.length,
          verifiedEntries: 0,
          brokenEntryId: entry.id,
          brokenReason: `انقطاع في أصل السجل: السجل الأول [${entry.id}] لا يرتبط بالهاش الأولي المعتمد`
        };
      }
    } else {
      // Subsequent entries must strictly match predecessor
      if (entry.prev_hash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntries: sorted.length,
          verifiedEntries: i,
          brokenEntryId: entry.id,
          brokenReason: `انقطاع في سلسلة الهاش: السجل [${entry.id}] لا يرتبط بتوقيع السجل السابق [${sorted[i - 1].id}]`
        };
      }
    }

    // Content verification
    const computedHash = await computeAuditEntryHash(entry);
    if (entry.entry_hash !== computedHash) {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: i,
        brokenEntryId: entry.id,
        brokenReason: `تلاعب في بيانات السجل [${entry.id}]: التوقيع المحفوظ لا يطابق المحتوى الفعلي المحسوب`
      };
    }

    expectedPrevHash = entry.entry_hash;
  }

  // Checkpoint validation: newest row deletion check
  if (checkpoint && sorted.length > 0) {
    const lastEntry = sorted[sorted.length - 1];
    if (checkpoint.last_seq !== undefined && lastEntry.seq !== undefined && checkpoint.last_seq !== lastEntry.seq) {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: sorted.length - 1,
        brokenReason: `عدم تطابق التسلسل النهائي مع نقطة التحقق: المتوقع ${checkpoint.last_seq}، الفعلي ${lastEntry.seq} (تم اكتشاف حذف أحدث السجلات)`
      };
    }
    if (checkpoint.head_hash && checkpoint.head_hash !== lastEntry.entry_hash) {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: sorted.length - 1,
        brokenReason: `عدم تطابق الهاش النهائي مع نقطة التحقق: المتوقع ${checkpoint.head_hash}، الفعلي ${lastEntry.entry_hash} (تم اكتشاف حذف أو تعديل أحدث السجلات)`
      };
    }
  }

  return {
    isValid: true,
    totalEntries: sorted.length,
    verifiedEntries: sorted.length
  };
}
