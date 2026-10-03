/**
 * Deterministic official serial number generator
 * Standard Egyptian Government formats:
 * - IN-YYYY-0001 (الوارد)
 * - OUT-YYYY-0001 (الصادر)
 * - DIR-YYYY-0001 (التكليفات)
 * - MATTER-YYYY-001 (الملفات والقضايا)
 */

export function generateSerialNumber(
  prefix: 'IN' | 'OUT' | 'DIR' | 'MATTER',
  currentCountForYear: number,
  year: number = new Date().getFullYear()
): string {
  const padLength = prefix === 'MATTER' ? 3 : 4;
  const nextSeq = String(currentCountForYear + 1).padStart(padLength, '0');
  return `${prefix}-${year}-${nextSeq}`;
}

export function parseSerialNumber(serial: string): { prefix: string; year: number; sequence: number } | null {
  const parts = serial.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[1], 10);
  const sequence = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(sequence)) return null;
  return { prefix: parts[0], year, sequence };
}
