import {
  addAppDays,
  enumerateAppDates,
  formatAppDateKey,
  startOfAppDay,
} from "@/lib/datetime";
import type {
  CategoryDuration,
  CategorySummary,
  DailyReport,
  ReportBreakSegment,
  ReportWorkSegment,
  TodoSummary,
} from "@/lib/reports/types";

type TimedInterval = {
  startedAt: string;
  endedAt: string | null;
};

export type DailyIntervalSlice = {
  date: string;
  milliseconds: number;
};

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  return timestamp;
}

export function splitIntervalByAppDate(
  interval: TimedInterval,
  nowMilliseconds: number,
  rangeStart?: Date,
  rangeEnd?: Date,
): DailyIntervalSlice[] {
  const rawStart = parseTimestamp(interval.startedAt);
  const rawEnd = interval.endedAt ? parseTimestamp(interval.endedAt) : nowMilliseconds;
  let cursor = Math.max(rawStart, rangeStart?.getTime() ?? Number.NEGATIVE_INFINITY);
  const end = Math.min(rawEnd, rangeEnd?.getTime() ?? Number.POSITIVE_INFINITY);
  const slices: DailyIntervalSlice[] = [];

  while (cursor < end) {
    const date = formatAppDateKey(cursor);
    const nextBoundary = startOfAppDay(addAppDays(date, 1)).getTime();
    const sliceEnd = Math.min(end, nextBoundary);
    slices.push({ date, milliseconds: sliceEnd - cursor });
    cursor = sliceEnd;
  }

  return slices;
}

export function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h${minutes}m`;
}

export function formatDecimalHours(milliseconds: number): string {
  return `${(milliseconds / 3_600_000).toFixed(1)}h`;
}

export function formatTimeBank(milliseconds: number): string {
  const sign = milliseconds >= 0 ? "+" : "−";
  return `${sign}${Math.abs(milliseconds / 3_600_000).toFixed(1)}h`;
}

export function calculateTimeBank(
  workedMilliseconds: number,
  targetMinutes: number,
): number {
  return workedMilliseconds - Math.max(0, targetMinutes) * 60_000;
}

export function buildDailyReports({
  startDate,
  endDateExclusive,
  nowMilliseconds,
  workSegments,
  breakSegments,
  todos,
  categories,
}: {
  startDate: string;
  endDateExclusive: string;
  nowMilliseconds: number;
  workSegments: ReportWorkSegment[];
  breakSegments: ReportBreakSegment[];
  todos: TodoSummary[];
  categories: CategorySummary[];
}): DailyReport[] {
  const dateKeys = enumerateAppDates(startDate, endDateExclusive);
  const dateSet = new Set(dateKeys);
  const rangeStart = startOfAppDay(startDate);
  const rangeEnd = startOfAppDay(endDateExclusive);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoryBuckets = new Map<string, Map<string | null, number>>();
  const reports = new Map<string, DailyReport>(
    dateKeys.map((date) => [
      date,
      {
        date,
        workedMilliseconds: 0,
        breakMilliseconds: 0,
        completedTodoCount: 0,
        categoryDurations: [],
      },
    ]),
  );

  for (const segment of workSegments) {
    for (const slice of splitIntervalByAppDate(
      segment,
      nowMilliseconds,
      rangeStart,
      rangeEnd,
    )) {
      if (!dateSet.has(slice.date)) continue;
      const report = reports.get(slice.date);
      if (!report) continue;
      report.workedMilliseconds += slice.milliseconds;
      const bucket = categoryBuckets.get(slice.date) ?? new Map<string | null, number>();
      bucket.set(
        segment.categoryId,
        (bucket.get(segment.categoryId) ?? 0) + slice.milliseconds,
      );
      categoryBuckets.set(slice.date, bucket);
    }
  }

  for (const segment of breakSegments) {
    for (const slice of splitIntervalByAppDate(
      segment,
      nowMilliseconds,
      rangeStart,
      rangeEnd,
    )) {
      const report = reports.get(slice.date);
      if (report) report.breakMilliseconds += slice.milliseconds;
    }
  }

  for (const todo of todos) {
    if (!todo.completedAt) continue;
    const date = formatAppDateKey(todo.completedAt);
    const report = reports.get(date);
    if (report) report.completedTodoCount += 1;
  }

  for (const [date, bucket] of categoryBuckets) {
    const report = reports.get(date);
    if (!report) continue;
    report.categoryDurations = [...bucket.entries()]
      .map(([categoryId, milliseconds]): CategoryDuration => {
        const category = categoryId ? categoryById.get(categoryId) : null;
        return {
          categoryId,
          name: category?.name ?? "未分類",
          colorKey: category?.colorKey ?? "gray",
          milliseconds,
        };
      })
      .sort((left, right) => right.milliseconds - left.milliseconds);
  }

  return dateKeys.map((date) => reports.get(date)!);
}

export function mergeCategoryDurations(reports: DailyReport[]): CategoryDuration[] {
  const buckets = new Map<string | null, CategoryDuration>();

  for (const report of reports) {
    for (const duration of report.categoryDurations) {
      const existing = buckets.get(duration.categoryId);
      buckets.set(duration.categoryId, {
        ...duration,
        milliseconds: (existing?.milliseconds ?? 0) + duration.milliseconds,
      });
    }
  }

  return [...buckets.values()].sort((left, right) => right.milliseconds - left.milliseconds);
}

export function summarizeWeek(
  reports: DailyReport[],
  dailyTargetMinutes: number,
  weeklyTargetMinutes: number,
) {
  const totalWorked = reports.reduce(
    (sum, report) => sum + report.workedMilliseconds,
    0,
  );
  const weeklyTarget = weeklyTargetMinutes * 60_000;

  return {
    totalWorked,
    weeklyTarget,
    remaining: Math.max(0, weeklyTarget - totalWorked),
    timeBank: totalWorked - weeklyTarget,
    targetDays: reports.filter(
      (report) => report.workedMilliseconds >= dailyTargetMinutes * 60_000,
    ).length,
    completedTodos: reports.reduce(
      (sum, report) => sum + report.completedTodoCount,
      0,
    ),
    categoryDurations: mergeCategoryDurations(reports),
  };
}

export function summarizeMonth(reports: DailyReport[]) {
  const totalWorked = reports.reduce(
    (sum, report) => sum + report.workedMilliseconds,
    0,
  );
  const activeDays = reports.filter(
    (report) => report.workedMilliseconds > 0,
  ).length;

  return {
    totalWorked,
    activeDays,
    averageWorked: activeDays > 0 ? totalWorked / activeDays : 0,
    completedTodos: reports.reduce(
      (sum, report) => sum + report.completedTodoCount,
      0,
    ),
    categoryDurations: mergeCategoryDurations(reports),
  };
}
