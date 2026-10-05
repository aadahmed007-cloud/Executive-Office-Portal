import crypto from 'crypto';

/**
 * Generates a cryptographically strong random password.
 */
export function generateRandomPassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * PBKDF2-SHA256 with 600,000 iterations and 16-byte random salt.
 */
export function hashPasswordServer(
  password: string,
  saltHex?: string
): { hashHex: string; saltHex: string; iterations: number; algo: string } {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const iterations = 600000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return {
    hashHex: hash.toString('hex'),
    saltHex: salt.toString('hex'),
    iterations,
    algo: 'PBKDF2-SHA256'
  };
}

/**
 * Constant-time comparison for password verification.
 */
export function verifyPasswordServer(
  password: string,
  storedHashHex: string,
  storedSaltHex: string
): boolean {
  try {
    const salt = Buffer.from(storedSaltHex, 'hex');
    const computedHash = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256');
    const storedHash = Buffer.from(storedHashHex, 'hex');
    if (computedHash.length !== storedHash.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedHash, storedHash);
  } catch (err) {
    return false;
  }
}

/**
 * Dummy hash computation to equalize response timing on unknown users.
 */
export function dummyPasswordHash(password: string): void {
  try {
    const dummySalt = Buffer.alloc(16, 0);
    crypto.pbkdf2Sync(password, dummySalt, 600000, 32, 'sha256');
  } catch {}
}
