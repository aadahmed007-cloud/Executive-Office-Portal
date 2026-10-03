import React, { createContext, useContext, useState, useEffect } from 'react';
import arDict from './ar.json';

export type DigitFormat = 'western' | 'indic';
export type CalendarFormat = 'gregorian' | 'with_hijri';

interface I18nContextType {
  locale: string;
  dir: 'rtl' | 'ltr';
  digitFormat: DigitFormat;
  calendarFormat: CalendarFormat;
  setDigitFormat: (format: DigitFormat) => void;
  setCalendarFormat: (format: CalendarFormat) => void;
  t: (path: string, fallback?: string) => string;
  formatNumber: (num: number | string) => string;
  formatDate: (dateStr: string | Date, options?: { showTime?: boolean }) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Eastern Arabic / Arabic-Indic digits mapping
const INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [digitFormat, setDigitFormat] = useState<DigitFormat>('western');
  const [calendarFormat, setCalendarFormat] = useState<CalendarFormat>('gregorian');

  // Load preferences from localStorage if available
  useEffect(() => {
    try {
      const savedDigits = localStorage.getItem('app_digit_format') as DigitFormat;
      if (savedDigits === 'indic' || savedDigits === 'western') {
        setDigitFormat(savedDigits);
      }
      const savedCalendar = localStorage.getItem('app_calendar_format') as CalendarFormat;
      if (savedCalendar === 'with_hijri' || savedCalendar === 'gregorian') {
        setCalendarFormat(savedCalendar);
      }
    } catch {
      // localStorage may fail in restricted context
    }
  }, []);

  const handleSetDigitFormat = (format: DigitFormat) => {
    setDigitFormat(format);
    try {
      localStorage.setItem('app_digit_format', format);
    } catch {
      // ignore
    }
  };

  const handleSetCalendarFormat = (format: CalendarFormat) => {
    setCalendarFormat(format);
    try {
      localStorage.setItem('app_calendar_format', format);
    } catch {
      // ignore
    }
  };

  // Safe nested translation lookup
  const t = (path: string, fallback?: string): string => {
    const keys = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = arDict;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return fallback || path;
      }
    }
    return typeof current === 'string' ? current : fallback || path;
  };

  // Convert digits if indic is selected
  const formatNumber = (val: number | string): string => {
    const str = String(val);
    if (digitFormat === 'western') return str;
    return str.replace(/\d/g, (d) => INDIC_DIGITS[parseInt(d, 10)]);
  };

  // Format date with Cairo Timezone & optional Hijri
  const formatDate = (dateInput: string | Date, options?: { showTime?: boolean }): string => {
    if (!dateInput) return '';
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return String(dateInput);

    // Cairo Gregorian date options
    const gregFormatter = new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(options?.showTime ? { hour: '2-digit', minute: '2-digit' } : {})
    });

    let gregStr = gregFormatter.format(date);
    if (digitFormat === 'western') {
      // Convert ar-EG output digits back to western if requested
      gregStr = gregStr.replace(/[٠-٩]/g, (d) => String(INDIC_DIGITS.indexOf(d)));
    }

    if (calendarFormat === 'with_hijri') {
      try {
        const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        let hijriStr = hijriFormatter.format(date);
        if (digitFormat === 'western') {
          hijriStr = hijriStr.replace(/[٠-٩]/g, (d) => String(INDIC_DIGITS.indexOf(d)));
        }
        return `${gregStr} (الموافق: ${hijriStr})`;
      } catch {
        return gregStr;
      }
    }

    return gregStr;
  };

  return (
    <I18nContext.Provider
      value={{
        locale: 'ar',
        dir: 'rtl',
        digitFormat,
        calendarFormat,
        setDigitFormat: handleSetDigitFormat,
        setCalendarFormat: handleSetCalendarFormat,
        t,
        formatNumber,
        formatDate
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
