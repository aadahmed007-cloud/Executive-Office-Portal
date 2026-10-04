import {
  buildAuditPayload,
  computeAuditEntryHash,
  verifyAuditLogIntegrity,
  sha256Hex
} from '../domain/security/cryptoUtils';
import { AuditLogEntry } from '../domain/types';

/**
 * Phase D Unit Test Suite: Audit Log Tamper-Resistance & Hash Chain Verification
 */
export async function runAuditIntegrityRuleTests(): Promise<boolean> {
  const entries: AuditLogEntry[] = [
    {
      id: 'test-audit-001',
      user_id: 'usr-secretary',
      user_name: 'السكرتير التنفيذي',
      user_role: 'SECRETARY',
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-001',
      before_value: null,
      after_value: 'تسجيل معاملة رسمية جديدة',
      timestamp: '2026-10-01T08:00:00Z',
      ip_address: '10.120.4.22',
      prev_hash: 'GENESIS-BLOCK-00000000000000000000000000000000'
    },
    {
      id: 'test-audit-002',
      user_id: 'usr-chairman',
      user_name: 'رئيس مجلس الإدارة',
      user_role: 'CHAIRMAN',
      action_type: 'DECIDE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-001',
      before_value: 'الحالة: معروض',
      after_value: 'تأشيرة اعتماد: موافق مع سرعة التنفيذ',
      timestamp: '2026-10-01T09:00:00Z',
      ip_address: '10.120.4.10'
    },
    {
      id: 'test-audit-003',
      user_id: 'usr-chairman',
      user_name: 'رئيس مجلس الإدارة',
      user_role: 'CHAIRMAN',
      action_type: 'CREATE',
      entity_type: 'DIRECTIVE',
      entity_id: 'dir-001',
      before_value: null,
      after_value: 'إصدار تكليف رئاسي بالبدء في التنفيذ',
      timestamp: '2026-10-01T09:30:00Z',
      ip_address: '10.120.4.10'
    }
  ];

  // 1. Build and verify a valid cryptographic hash chain
  let prevHash = 'GENESIS-BLOCK-00000000000000000000000000000000';
  for (let i = 0; i < entries.length; i++) {
    entries[i].prev_hash = prevHash;
    entries[i].entry_hash = await computeAuditEntryHash(entries[i]);
    prevHash = entries[i].entry_hash!;
  }

  const validResult = await verifyAuditLogIntegrity(entries);
  console.assert(
    validResult.isValid === true && validResult.verifiedEntries === 3,
    'Audit Test 1 Failed: Valid hash chain must verify successfully'
  );

  // 2. Tamper Test: Modify after_value of entry 2 without recalculating hash
  const tamperedContentEntries = JSON.parse(JSON.stringify(entries));
  tamperedContentEntries[1].after_value = 'تعديل مزور غير مصرح به';

  const tamperedContentResult = await verifyAuditLogIntegrity(tamperedContentEntries);
  console.assert(
    tamperedContentResult.isValid === false && tamperedContentResult.brokenEntryId === 'test-audit-002',
    'Audit Test 2 Failed: Modified content must fail cryptographic verification'
  );

  // 3. Tamper Test: Alter timestamp of entry 1
  const tamperedTimestampEntries = JSON.parse(JSON.stringify(entries));
  tamperedTimestampEntries[0].timestamp = '2026-09-01T00:00:00Z';

  const tamperedTimestampResult = await verifyAuditLogIntegrity(tamperedTimestampEntries);
  console.assert(
    tamperedTimestampResult.isValid === false,
    'Audit Test 3 Failed: Modified timestamp must fail cryptographic verification'
  );

  // 4. Broken Link Test: Break prev_hash of entry 3
  const brokenChainEntries = JSON.parse(JSON.stringify(entries));
  brokenChainEntries[2].prev_hash = 'INVALID-PREV-HASH-CORRUPTED';
  brokenChainEntries[2].entry_hash = await computeAuditEntryHash(brokenChainEntries[2]);

  const brokenChainResult = await verifyAuditLogIntegrity(brokenChainEntries);
  console.assert(
    brokenChainResult.isValid === false && brokenChainResult.brokenEntryId === 'test-audit-003',
    'Audit Test 4 Failed: Broken predecessor link must be detected'
  );

  // 5. Test SHA-256 Checksum Calculation
  const testPayload = JSON.stringify({ test: 'Egypt Post Sovereign Platform', count: 42 });
  const checksum1 = await sha256Hex(testPayload);
  const checksum2 = await sha256Hex(testPayload);
  console.assert(
    checksum1 === checksum2 && checksum1.length === 64,
    'Audit Test 5 Failed: SHA-256 checksum must be deterministic and 64 hex characters'
  );

  return true;
}

/**
 * Phase D Database Trigger Immutability Tests (Async against SQLite)
 */
export async function runAuditDatabaseTriggerTests(): Promise<boolean> {
  const { sqliteEngine } = await import('../data/database/sqliteEngine');

  // Test 1: Verify UPDATE on audit_log is rejected by SQLite trigger
  let updateBlocked = false;
  try {
    sqliteEngine.run("UPDATE audit_log SET after_value = 'تعديل غير مصرح' WHERE id = 'audit-001'");
  } catch (err: any) {
    updateBlocked = true;
  }
  console.assert(updateBlocked === true, 'Trigger Test 1 Failed: UPDATE trigger must abort any update on audit_log');

  // Test 2: Verify DELETE on audit_log is rejected by SQLite trigger
  let deleteBlocked = false;
  try {
    sqliteEngine.run("DELETE FROM audit_log WHERE id = 'audit-001'");
  } catch (err: any) {
    deleteBlocked = true;
  }
  console.assert(deleteBlocked === true, 'Trigger Test 2 Failed: DELETE trigger must abort any delete on audit_log');

  return updateBlocked && deleteBlocked;
}
