import { detectMeetingConflict } from '../domain/rules/conflictDetector';
import { Meeting } from '../domain/types';

/**
 * Unit Test Suite for Calendar Conflict Detection
 */
export function runConflictTests(): boolean {
  const existingMeetings: Meeting[] = [
    {
      id: 'm1',
      title: 'جلسة مجلس الإدارة',
      location: 'قاعة مجلس الإدارة الكبرى',
      start_time: '2026-10-10T10:00:00',
      end_time: '2026-10-10T12:00:00',
      meeting_type: 'board',
      status: 'confirmed',
      confidentiality: 'normal',
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
      created_by: 'Secretary'
    }
  ];

  // Test 1: Overlapping time window in same location -> Conflict detected
  const test1 = detectMeetingConflict(
    {
      location: 'قاعة مجلس الإدارة الكبرى',
      start_time: '2026-10-10T11:00:00',
      end_time: '2026-10-10T13:00:00'
    },
    existingMeetings
  );
  console.assert(test1.hasConflict === true, 'Test 1 Failed: Overlap should be detected');

  // Test 2: Non-overlapping time window -> No conflict
  const test2 = detectMeetingConflict(
    {
      location: 'قاعة مجلس الإدارة الكبرى',
      start_time: '2026-10-10T13:00:00',
      end_time: '2026-10-10T14:00:00'
    },
    existingMeetings
  );
  console.assert(test2.hasConflict === false, 'Test 2 Failed: Non-overlapping should not conflict');

  return test1.hasConflict && !test2.hasConflict;
}
