/**
 * Cryptographic utility using standard Web Crypto API (SubtleCrypto).
 * Works 100% offline, zero external dependencies, zero CDN.
 */
import { AuditLogEntry } from '../types';

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Computes SHA-256 hash in hexadecimal.
 */
export async function sha256Hex(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Builds canonical string payload for audit hash calculation.
 */
export function buildAuditPayload(entry: {
  id: string;
  timestamp: string;
  user_id: string;
  user_role: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_value?: string | null;
  after_value?: string | null;
  ip_address: string;
  prev_hash?: string | null;
}): string {
  return [
    entry.id,
    entry.timestamp,
    entry.user_id,
    entry.user_role,
    entry.action_type,
    entry.entity_type,
    entry.entity_id,
    entry.before_value || '',
    entry.after_value || '',
    entry.ip_address,
    entry.prev_hash || 'GENESIS'
  ].join('||');
}

/**
 * Computes SHA-256 hash for an audit log entry chained to prev_hash.
 */
export async function computeAuditEntryHash(entry: {
  id: string;
  timestamp: string;
  user_id: string;
  user_role: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_value?: string | null;
  after_value?: string | null;
  ip_address: string;
  prev_hash?: string | null;
}): Promise<string> {
  const payload = buildAuditPayload(entry);
  return sha256Hex(payload);
}

export const GENESIS_BLOCK_HASH = 'GENESIS-BLOCK-00000000000000000000000000000000';

export interface IntegrityVerificationResult {
  isValid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenEntryId?: string;
  brokenReason?: string;
}

/**
 * Verifies the integrity of the audit log cryptographic chain.
 * Validates that the chain originates strictly from GENESIS_BLOCK_HASH,
 * that each entry is hashed correctly, and strictly linked to its predecessor.
 */
export async function verifyAuditLogIntegrity(entries: AuditLogEntry[]): Promise<IntegrityVerificationResult> {
  if (entries.length === 0) {
    return { isValid: true, totalEntries: 0, verifiedEntries: 0 };
  }

  // Sort chronologically ascending
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  let expectedPrevHash: string | null = GENESIS_BLOCK_HASH;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // Check prev_hash matches
    if (i === 0) {
      if (entry.prev_hash !== GENESIS_BLOCK_HASH) {
        return {
          isValid: false,
          totalEntries: sorted.length,
          verifiedEntries: 0,
          brokenEntryId: entry.id,
          brokenReason: `انقطاع في أصل السجل (Genesis Block Violation): السجل الأول [${entry.id}] لا يرتبط بالهاش الأولي المعتمد`
        };
      }
    } else {
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

    // Recompute entry_hash and compare
    const computedHash = await computeAuditEntryHash(entry);
    if (entry.entry_hash && entry.entry_hash !== computedHash) {
      return {
        isValid: false,
        totalEntries: sorted.length,
        verifiedEntries: i,
        brokenEntryId: entry.id,
        brokenReason: `تلاعب في بيانات السجل [${entry.id}]: التوقيع المحفوظ (${entry.entry_hash?.substring(0, 10)}...) لا يطابق المحتوى الفعلي المحسوب (${computedHash.substring(0, 10)}...)`
      };
    }

    expectedPrevHash = entry.entry_hash || computedHash;
  }

  return {
    isValid: true,
    totalEntries: sorted.length,
    verifiedEntries: sorted.length
  };
}

/**
 * Derives a PBKDF2 key using SHA-256 (100,000 iterations).
 */
export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hashHex: string; saltHex: string }> {
  const encoder = new TextEncoder();
  let saltBytes: Uint8Array;

  if (saltHex) {
    saltBytes = hexToBuffer(saltHex);
  } else {
    saltBytes = new Uint8Array(16);
    (crypto as any).getRandomValues(saltBytes);
  }

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256 // 32 bytes = 256 bits
  );

  return {
    hashHex: bytesToHex(new Uint8Array(derivedBits)),
    saltHex: bytesToHex(saltBytes)
  };
}

/**
 * Verifies a password against stored PBKDF2 hash and salt in constant-time comparison.
 */
export async function verifyPassword(
  password: string,
  storedHashHex: string,
  storedSaltHex: string
): Promise<boolean> {
  try {
    const { hashHex } = await hashPassword(password, storedSaltHex);
    if (hashHex.length !== storedHashHex.length) return false;

    // Constant-time comparison
    let match = 0;
    for (let i = 0; i < hashHex.length; i++) {
      match |= hashHex.charCodeAt(i) ^ storedHashHex.charCodeAt(i);
    }
    return match === 0;
  } catch (err) {
    console.error('Password verification failure:', err);
    return false;
  }
}
