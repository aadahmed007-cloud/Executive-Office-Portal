import { Directive, Correspondence } from '../types';

export interface OverdueAnalysis {
  isOverdue: boolean;
  daysRemaining: number;
  urgencyLevel: 'normal' | 'due_soon' | 'overdue';
}

/**
 * Calculates whether a directive or correspondence deadline is overdue or nearing deadline.
 * Rules:
 * - < 0 days (past due): overdue
 * - 0 to 2 days (within 48 hours): due_soon (تحذير أصفر)
 * - > 2 days: normal
 */
export function analyzeOverdue(
  dueDateStr: string,
  currentStatus: string,
  now: Date = new Date()
): OverdueAnalysis {
  // If already completed or closed, it's not overdue
  if (['completed', 'closed'].includes(currentStatus)) {
    return { isOverdue: false, daysRemaining: 999, urgencyLevel: 'normal' };
  }

  const dueDate = new Date(dueDateStr);
  if (isNaN(dueDate.getTime())) {
    return { isOverdue: false, daysRemaining: 0, urgencyLevel: 'normal' };
  }

  // Calculate day difference
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { isOverdue: true, daysRemaining: diffDays, urgencyLevel: 'overdue' };
  } else if (diffDays <= 2) {
    return { isOverdue: false, daysRemaining: diffDays, urgencyLevel: 'due_soon' };
  } else {
    return { isOverdue: false, daysRemaining: diffDays, urgencyLevel: 'normal' };
  }
}

export function filterOverdueDirectives(directives: Directive[], now: Date = new Date()): Directive[] {
  return directives.filter((d) => {
    const analysis = analyzeOverdue(d.due_date, d.status, now);
    return analysis.isOverdue || d.status === 'overdue';
  });
}
