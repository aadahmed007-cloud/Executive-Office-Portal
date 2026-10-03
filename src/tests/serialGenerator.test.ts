import { generateSerialNumber, parseSerialNumber } from '../domain/rules/serialGenerator';

/**
 * Unit Test Suite for Serial Number Generation
 */
export function runSerialTests(): boolean {
  // Test 1: Generate Incoming Serial
  const serialIn = generateSerialNumber('IN', 0, 2026);
  console.assert(serialIn === 'IN-2026-0001', `Test 1 Failed: Expected IN-2026-0001, got ${serialIn}`);

  // Test 2: Generate Next Sequence
  const serialInNext = generateSerialNumber('IN', 24, 2026);
  console.assert(serialInNext === 'IN-2026-0025', `Test 2 Failed: Expected IN-2026-0025, got ${serialInNext}`);

  // Test 3: Generate Outgoing Serial
  const serialOut = generateSerialNumber('OUT', 9, 2026);
  console.assert(serialOut === 'OUT-2026-0010', `Test 3 Failed: Expected OUT-2026-0010, got ${serialOut}`);

  // Test 4: Parse Serial
  const parsed = parseSerialNumber('IN-2026-0015');
  console.assert(parsed?.prefix === 'IN' && parsed?.sequence === 15, 'Test 4 Failed: Parse error');

  return serialIn === 'IN-2026-0001' && serialInNext === 'IN-2026-0025' && serialOut === 'OUT-2026-0010';
}
