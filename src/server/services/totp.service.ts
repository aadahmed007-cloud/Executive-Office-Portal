import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { sqliteEngine } from '../../data/database/sqliteEngine.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a Buffer into an RFC 4648 Base32 string (without padding)
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decode an RFC 4648 Base32 string into a Buffer
 */
export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[=\s]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate cryptographically secure random Base32 secret for TOTP (20 bytes = 160 bits)
 */
export function generateTotpSecret(numBytes: number = 20): string {
  const buf = crypto.randomBytes(numBytes);
  return base32Encode(buf);
}

/**
 * RFC 6238 TOTP computation using HMAC-SHA1
 */
export function generateTotpCode(
  secret: Buffer | string,
  timeSec: number = Math.floor(Date.now() / 1000),
  digits: number = 6,
  period: number = 30
): string {
  const secretBuffer = typeof secret === 'string' ? base32Decode(secret) : secret;
  const counter = Math.floor(timeSec / period);

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verify a TOTP code accepting a drift window of one step (default: -1, 0, +1)
 * and rejecting code reuse within the same step.
 */
export function verifyTotpCode(
  secret: Buffer | string,
  token: string,
  timeSec: number = Math.floor(Date.now() / 1000),
  options: {
    window?: number;
    digits?: number;
    period?: number;
    lastStep?: number;
  } = {}
): { isValid: boolean; matchedStep?: number; reason?: string } {
  const digits = options.digits ?? 6;
  const period = options.period ?? 30;
  const window = options.window ?? 1;
  const lastStep = options.lastStep ?? -1;

  const normalizedToken = token.trim();
  if (normalizedToken.length !== digits || !/^\d+$/.test(normalizedToken)) {
    return { isValid: false, reason: 'INVALID_FORMAT' };
  }

  const currentStep = Math.floor(timeSec / period);
  const secretBuffer = typeof secret === 'string' ? base32Decode(secret) : secret;

  // Search window [currentStep - window, currentStep + window]
  for (let s = currentStep - window; s <= currentStep + window; s++) {
    const stepTime = s * period;
    const expected = generateTotpCode(secretBuffer, stepTime, digits, period);

    if (crypto.timingSafeEqual(Buffer.from(normalizedToken), Buffer.from(expected))) {
      // Replay prevention: reject code if s <= lastStep
      if (s <= lastStep) {
        return { isValid: false, reason: 'REUSED_CODE' };
      }
      return { isValid: true, matchedStep: s };
    }
  }

  return { isValid: false, reason: 'CODE_MISMATCH' };
}

/**
 * Generate 10 one-time recovery codes
 */
export function generateRecoveryCodes(count: number = 10): { plaintextCodes: string[]; hashedCodes: string[] } {
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let b = 0; b < 8; b++) {
      code += charset[bytes[b] % charset.length];
      if (b === 3) code += '-';
    }
    plaintextCodes.push(code);
    const hash = crypto.createHash('sha256').update(code.replace(/[^A-Z0-9]/g, '')).digest('hex');
    hashedCodes.push(hash);
  }

  return { plaintextCodes, hashedCodes };
}

/**
 * Verify and consume a recovery code from the stored JSON array of hashes
 */
export function verifyAndConsumeRecoveryCode(
  inputCode: string,
  hashedCodesJson: string | null | undefined
): { isValid: boolean; remainingHashedCodesJson?: string } {
  if (!hashedCodesJson) return { isValid: false };
  let hashes: string[] = [];
  try {
    hashes = JSON.parse(hashedCodesJson);
    if (!Array.isArray(hashes)) return { isValid: false };
  } catch {
    return { isValid: false };
  }

  const normalized = inputCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return { isValid: false };
  const inputHash = crypto.createHash('sha256').update(normalized).digest('hex');

  const matchIdx = hashes.findIndex((h) => crypto.timingSafeEqual(Buffer.from(h), Buffer.from(inputHash)));
  if (matchIdx === -1) {
    return { isValid: false };
  }

  // Remove the matched hash
  hashes.splice(matchIdx, 1);
  return { isValid: true, remainingHashedCodesJson: JSON.stringify(hashes) };
}

/**
 * Helper to derive encryption key from SESSION_SECRET
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || 'fallback-session-secret-at-least-32-chars-long';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt TOTP secret with AES-256-GCM
 */
export function encryptTotpSecret(secretBase32: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt TOTP secret with AES-256-GCM
 */
export function decryptTotpSecret(encryptedString: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted TOTP secret format');
  }

  const [ivHex, tagHex, dataHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generate otpauth:// URI
 */
export function generateOtpAuthUri(
  username: string,
  secretBase32: string,
  issuer: string = 'Egyptian Post Executive Office'
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(username)}`;
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate QR code SVG string locally with zero network calls
 */
export async function generateQrCodeSvg(otpauthUri: string): Promise<string> {
  return QRCode.toString(otpauthUri, {
    type: 'svg',
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff'
    }
  });
}

/**
 * Create a signed temporary 2FA pre-auth token (expires in 5 minutes)
 */
export function sign2FaToken(userId: string, purpose: 'login' | 'enrollment'): string {
  const key = getEncryptionKey();
  const payload = JSON.stringify({
    userId,
    purpose,
    exp: Date.now() + 5 * 60 * 1000
  });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
}

/**
 * Verify temporary 2FA pre-auth token
 */
export function verify2FaToken(token: string): { userId: string; purpose: 'login' | 'enrollment' } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, dataHex] = parts;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    const parsed = JSON.parse(decrypted.toString('utf8'));

    if (!parsed.userId || !parsed.exp || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;

    return { userId: parsed.userId, purpose: parsed.purpose };
  } catch {
    return null;
  }
}

/**
 * Check if user 2FA is locked out
 */
export function checkTotpLockout(user: {
  totp_locked_until?: string | null;
  totp_failed_attempts?: number;
}): { isLocked: boolean; lockedUntil?: string } {
  if (user.totp_locked_until) {
    const lockedUntilTime = new Date(user.totp_locked_until).getTime();
    if (lockedUntilTime > Date.now()) {
      return { isLocked: true, lockedUntil: user.totp_locked_until };
    }
  }
  return { isLocked: false };
}

/**
 * Record a 2FA failure in the database with persistent lockout after 5 attempts
 */
export function recordTotpFailure(userId: string): { isLocked: boolean; failedAttempts: number; lockedUntil?: string } {
  const rows = sqliteEngine.query<{ totp_failed_attempts: number }>(
    'SELECT totp_failed_attempts FROM users WHERE id = ?',
    [userId]
  );
  const currentAttempts = (rows[0]?.totp_failed_attempts || 0) + 1;

  if (currentAttempts >= 5) {
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    sqliteEngine.run(
      'UPDATE users SET totp_failed_attempts = ?, totp_locked_until = ? WHERE id = ?',
      [currentAttempts, lockedUntil, userId]
    );
    return { isLocked: true, failedAttempts: currentAttempts, lockedUntil };
  } else {
    sqliteEngine.run(
      'UPDATE users SET totp_failed_attempts = ? WHERE id = ?',
      [currentAttempts, userId]
    );
    return { isLocked: false, failedAttempts: currentAttempts };
  }
}

/**
 * Reset 2FA failure counter on success
 */
export function recordTotpSuccess(userId: string): void {
  sqliteEngine.run(
    'UPDATE users SET totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = ?',
    [userId]
  );
}
