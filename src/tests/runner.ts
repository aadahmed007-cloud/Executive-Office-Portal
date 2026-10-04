/**
 * Sovereign Automated Test Suite Runner
 * Executes domain rules, access control, audit integrity, genesis verification, and database triggers.
 */
import { runConflictTests } from './conflictDetector.test';
import { runSerialTests } from './serialGenerator.test';
import { runOverdueTests } from './overdueLogic.test';
import { runAccessControlRuleTests, runAccessControlRepositoryTests } from './accessControl.test';
import { runAuditIntegrityRuleTests, runAuditDatabaseTriggerTests } from './auditIntegrity.test';
import { runCommandServiceTests } from './commandService.test';
import { sqliteEngine } from '../data/database/sqliteEngine';

async function main() {
  console.log('🚀 Running Executive Office Portal Hardened Test Suites...\n');

  let passed = 0;
  let failed = 0;

  function assertSuite(name: string, ok: boolean) {
    if (ok) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Conflict detector tests
  assertSuite('Meeting Conflict Detector Rules', runConflictTests());

  // 2. Serial number generator tests
  assertSuite('Serial Number Generator (IN/OUT/DIR Determinism)', runSerialTests());

  // 3. Overdue logic tests
  assertSuite('Directive Overdue Calculation & Status', runOverdueTests());

  // 4. Access control pure rules
  assertSuite('Domain Access Control & Redaction Rules', runAccessControlRuleTests());

  // 5. Cryptographic audit integrity (Genesis block & hash chain)
  const auditRulesOk = await runAuditIntegrityRuleTests();
  assertSuite('Audit Log Cryptographic Genesis & Chain Verification', auditRulesOk);

  // 6. SQLite in-memory engine initialization
  await sqliteEngine.init();

  // 7. Repository access control & mutation authorization tests
  const repoAccessOk = await runAccessControlRepositoryTests();
  assertSuite('Repository-level Access Control & Mutation Security', repoAccessOk);

  // 8. Command Service & Automatic Audit Hash Logging tests
  const commandServiceOk = await runCommandServiceTests();
  assertSuite('Application Command Service & Automatic Audit Chaining', commandServiceOk);

  // 9. Audit database triggers immutability tests
  const triggersOk = await runAuditDatabaseTriggerTests();
  assertSuite('SQLite Immutability Triggers (Prevent UPDATE/DELETE on audit_log)', triggersOk);

  console.log(`\n========================================`);
  console.log(`Total Test Suites Passed: ${passed} / ${passed + failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
