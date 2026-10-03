import { Meeting } from '../types';

export interface ConflictResult {
  hasConflict: boolean;
  conflictingMeetings: Meeting[];
  conflictReason?: 'ROOM_OVERLAP' | 'TIME_OVERLAP' | 'EXECUTIVE_ENGAGED';
}

/**
 * Checks for time and room conflicts when scheduling meetings.
 * Compares start and end time windows:
 * (StartA < EndB) and (EndA > StartB)
 */
export function detectMeetingConflict(
  newMeeting: {
    id?: string;
    location: string;
    start_time: string;
    end_time: string;
  },
  existingMeetings: Meeting[]
): ConflictResult {
  const newStart = new Date(newMeeting.start_time).getTime();
  const newEnd = new Date(newMeeting.end_time).getTime();

  if (isNaN(newStart) || isNaN(newEnd) || newEnd <= newStart) {
    return {
      hasConflict: true,
      conflictingMeetings: [],
      conflictReason: 'TIME_OVERLAP'
    };
  }

  const conflicts = existingMeetings.filter((meeting) => {
    // Exclude self if updating
    if (newMeeting.id && meeting.id === newMeeting.id) return false;
    // Exclude cancelled or deleted
    if (meeting.status === 'cancelled' || meeting.deleted_at) return false;

    const mStart = new Date(meeting.start_time).getTime();
    const mEnd = new Date(meeting.end_time).getTime();

    // Time window overlap condition
    const isOverlapping = newStart < mEnd && newEnd > mStart;

    if (!isOverlapping) return false;

    // Check if same location or Chairman is engaged
    const isSameLocation = meeting.location.trim().toLowerCase() === newMeeting.location.trim().toLowerCase();
    return isOverlapping && (isSameLocation || true); // In Chairman's office, any overlapping meeting engages the Chairman!
  });

  return {
    hasConflict: conflicts.length > 0,
    conflictingMeetings: conflicts,
    conflictReason: conflicts.length > 0 ? 'EXECUTIVE_ENGAGED' : undefined
  };
}
