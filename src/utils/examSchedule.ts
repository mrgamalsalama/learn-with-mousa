import { Exam } from '../types';

export type ExamScheduleStatus = 'open' | 'upcoming' | 'expired' | 'unscheduled';

export interface ExamScheduleInfo {
  status: ExamScheduleStatus;
  isScheduled: boolean;
  startDate: Date | null;
  endDate: Date | null;
  timeUntilStartMs: number;
  timeUntilEndMs: number;
  formattedStartText?: string;
  formattedEndText?: string;
}

/**
 * تحويل تاريخ أو نص ISO إلى تنسيق محلي مناسب لمدخل datetime-local (YYYY-MM-DDTHH:mm)
 */
export function toDatetimeLocalString(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * تحويل قيمة حقل datetime-local إلى ISO string
 */
export function fromDatetimeLocalString(localStr?: string): string | null {
  if (!localStr || !localStr.trim()) return null;
  const d = new Date(localStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * تنسيق التاريخ والوقت باللغة العربية الواضحة وفق التوقيت المحلي للمستخدم
 */
export function formatArabicDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return 'غير محدد';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return 'غير محدد';

  try {
    const dayName = d.toLocaleDateString('ar-EG', { weekday: 'long' });
    const datePart = d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
    const timePart = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

    return `يوم ${dayName} ${datePart} الساعة ${timePart}`;
  } catch {
    return d.toLocaleString('ar-EG');
  }
}

/**
 * تنسيق الوقت فقط باللغة العربية
 */
export function formatArabicTimeOnly(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

/**
 * حساب حالة الجدولة والنافذة الزمنية للاختبار مقارنة بالوقت الحالي
 */
export function getExamScheduleStatus(exam: Exam, now: Date = new Date()): ExamScheduleInfo {
  // إذا لم يكن الاختبار مجدولاً
  if (!exam.is_scheduled || (!exam.scheduled_start && !exam.scheduled_end)) {
    return {
      status: exam.is_active ? 'open' : 'expired',
      isScheduled: false,
      startDate: null,
      endDate: null,
      timeUntilStartMs: 0,
      timeUntilEndMs: 0
    };
  }

  const nowMs = now.getTime();
  const startDate = exam.scheduled_start ? new Date(exam.scheduled_start) : null;
  const endDate = exam.scheduled_end ? new Date(exam.scheduled_end) : null;

  const startMs = startDate && !isNaN(startDate.getTime()) ? startDate.getTime() : null;
  const endMs = endDate && !isNaN(endDate.getTime()) ? endDate.getTime() : null;

  // الحالة أ: الاختبار مجدول وسيبدأ مستقبلاً (Now < scheduled_start)
  if (startMs !== null && nowMs < startMs) {
    return {
      status: 'upcoming',
      isScheduled: true,
      startDate,
      endDate,
      timeUntilStartMs: Math.max(0, startMs - nowMs),
      timeUntilEndMs: endMs ? Math.max(0, endMs - nowMs) : 0,
      formattedStartText: formatArabicDateTime(startDate),
      formattedEndText: endDate ? formatArabicDateTime(endDate) : undefined
    };
  }

  // الحالة ج: تجاوز الوقت موعد الإغلاق (Now > scheduled_end)
  if (endMs !== null && nowMs > endMs) {
    return {
      status: 'expired',
      isScheduled: true,
      startDate,
      endDate,
      timeUntilStartMs: 0,
      timeUntilEndMs: 0,
      formattedStartText: startDate ? formatArabicDateTime(startDate) : undefined,
      formattedEndText: formatArabicDateTime(endDate)
    };
  }

  // الحالة ب: الآن داخل النافذة الزمنية (scheduled_start <= Now <= scheduled_end)
  return {
    status: exam.is_active ? 'open' : 'expired',
    isScheduled: true,
    startDate,
    endDate,
    timeUntilStartMs: 0,
    timeUntilEndMs: endMs ? Math.max(0, endMs - nowMs) : 0,
    formattedStartText: startDate ? formatArabicDateTime(startDate) : undefined,
    formattedEndText: endDate ? formatArabicDateTime(endDate) : undefined
  };
}

/**
 * تنسيق عداد تنازلي بالأيام والساعات والدقائق والثواني
 */
export function formatCountdown(target: number | string | Date, now: Date = new Date()): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  displayText: string;
} {
  let ms: number;
  if (typeof target === 'number') {
    ms = target;
  } else {
    const targetDate = typeof target === 'string' ? new Date(target) : target;
    ms = isNaN(targetDate.getTime()) ? 0 : Math.max(0, targetDate.getTime() - now.getTime());
  }

  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, displayText: 'حان الوقت الآن' };
  }

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0 || days > 0) parts.push(`${hours} ساعة`);
  parts.push(`${minutes} دقيقة`);
  parts.push(`${seconds} ثانية`);

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    displayText: parts.join(' و ')
  };
}
