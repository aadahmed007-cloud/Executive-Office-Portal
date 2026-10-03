import React from 'react';
import { Lock, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { ConfidentialityLevel, PriorityLevel } from '../../domain/types';

interface SecurityBadgeProps {
  confidentiality?: ConfidentialityLevel;
  priority?: PriorityLevel;
  status?: string;
  className?: string;
}

export const SecurityBadge: React.FC<SecurityBadgeProps> = ({
  confidentiality,
  priority,
  status,
  className = ''
}) => {
  if (confidentiality && confidentiality !== 'normal') {
    const isTopSecret = confidentiality === 'top_secret';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold border ${
          isTopSecret
            ? 'bg-purple-900/90 text-purple-100 border-purple-700 shadow-sm'
            : 'bg-purple-800/80 text-purple-200 border-purple-600'
        } ${className}`}
      >
        <Lock className="w-3 h-3" />
        <span>{isTopSecret ? 'سري للغاية' : 'سري'}</span>
      </span>
    );
  }

  if (priority && priority !== 'normal') {
    const isTopUrgent = priority === 'top_urgent';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold border ${
          isTopUrgent
            ? 'bg-rose-900/90 text-rose-100 border-rose-700 shadow-sm'
            : 'bg-amber-900/80 text-amber-200 border-amber-600'
        } ${className}`}
      >
        <AlertTriangle className="w-3 h-3" />
        <span>{isTopUrgent ? 'عاجل جداً وخاص' : 'عاجل'}</span>
      </span>
    );
  }

  return null;
};
