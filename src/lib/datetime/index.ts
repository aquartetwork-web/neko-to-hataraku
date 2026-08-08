import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { APP_CONFIG } from "@/config/app";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function inAppTimezone(date: Date | number | string): TZDate {
  const instant = date instanceof Date ? date.getTime() : new Date(date).getTime();

  return new TZDate(instant, APP_CONFIG.timezone);
}

export function formatAppDate(date: Date | number | string): string {
  return format(inAppTimezone(date), "M月d日（EEE）", { locale: ja });
}

export function formatAppDateKey(date: Date | number | string): string {
  return format(inAppTimezone(date), "yyyy-MM-dd");
}

export function formatAppTime(date: Date | number | string): string {
  return format(inAppTimezone(date), "HH:mm");
}

export function formatDateKeyLabel(dateKey: string): string {
  return format(startOfAppDay(dateKey), "M月d日（EEE）", { locale: ja });
}

export function startOfAppDay(dateKey: string): TZDate {
  const match = DATE_KEY_PATTERN.exec(dateKey);

  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  const [, year, month, day] = match;
  const result = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    0,
    0,
    0,
    APP_CONFIG.timezone,
  );

  if (format(result, "yyyy-MM-dd") !== dateKey) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return result;
}

export function addAppDays(dateKey: string, amount: number): string {
  const date = startOfAppDay(dateKey);
  date.setDate(date.getDate() + amount);
  return formatAppDateKey(date);
}

export function getAppDayRange(dateKey: string): { start: Date; end: Date } {
  return {
    start: new Date(startOfAppDay(dateKey).getTime()),
    end: new Date(startOfAppDay(addAppDays(dateKey, 1)).getTime()),
  };
}

export function getAppWeekRange(date: Date | number | string = new Date()): {
  startDate: string;
  endDateExclusive: string;
} {
  const localDate = inAppTimezone(date);
  const weekdayOffset = (localDate.getDay() + 6) % 7;
  localDate.setDate(localDate.getDate() - weekdayOffset);
  const startDate = formatAppDateKey(localDate);

  return { startDate, endDateExclusive: addAppDays(startDate, 7) };
}

export function getAppMonthRange(date: Date | number | string = new Date()): {
  startDate: string;
  endDateExclusive: string;
} {
  const localDate = inAppTimezone(date);
  const start = new TZDate(
    localDate.getFullYear(),
    localDate.getMonth(),
    1,
    APP_CONFIG.timezone,
  );
  const next = new TZDate(
    localDate.getFullYear(),
    localDate.getMonth() + 1,
    1,
    APP_CONFIG.timezone,
  );

  return {
    startDate: formatAppDateKey(start),
    endDateExclusive: formatAppDateKey(next),
  };
}

export function enumerateAppDates(startDate: string, endDateExclusive: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;

  while (cursor < endDateExclusive) {
    dates.push(cursor);
    cursor = addAppDays(cursor, 1);
  }

  return dates;
}
