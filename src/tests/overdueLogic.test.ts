import { analyzeOverdue } from '../domain/rules/overdueLogic';

/**
 * Unit Test Suite for Overdue Directive Logic
 */
export function runOverdueTests(): boolean {
  const simulatedNow = new Date('2026-10-02T12:00:00Z');

  // Test 1: Past Due Date -> Overdue
  const pastResult = analyzeOverdue('2026-09-28', 'in_progress', simulatedNow);
  console.assert(pastResult.isOverdue === true, 'Test 1 Failed: Should be overdue');

  // Test 2: Due in 1 day -> Due Soon
  const soonResult = analyzeOverdue('2026-10-03', 'in_progress', simulatedNow);
  console.assert(soonResult.urgencyLevel === 'due_soon', 'Test 2 Failed: Should be due_soon');

  // Test 3: Due in 15 days -> Normal
  const normalResult = analyzeOverdue('2026-10-20', 'in_progress', simulatedNow);
  console.assert(normalResult.urgencyLevel === 'normal', 'Test 3 Failed: Should be normal');

  // Test 4: Already completed -> Not overdue even if past date
  const completedResult = analyzeOverdue('2026-09-01', 'completed', simulatedNow);
  console.assert(completedResult.isOverdue === false, 'Test 4 Failed: Completed item should never be overdue');

  return pastResult.isOverdue && soonResult.urgencyLevel === 'due_soon' && normalResult.urgencyLevel === 'normal';
}
