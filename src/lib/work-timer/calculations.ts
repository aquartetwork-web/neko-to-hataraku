import { WORK_TIMER_CONFIG } from "@/config/work-timer";
import type {
  BreakSegment,
  WorkSegment,
  WorkTimerSession,
  WorkTimerStatus,
} from "@/lib/work-timer/types";

type TimedSegment = Pick<WorkSegment | BreakSegment, "startedAt" | "endedAt">;

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  return timestamp;
}

export function calculateSegmentDurationMilliseconds(
  segment: TimedSegment,
  nowMilliseconds: number,
): number {
  const startedAt = parseTimestamp(segment.startedAt);
  const endedAt = segment.endedAt
    ? parseTimestamp(segment.endedAt)
    : nowMilliseconds;

  return Math.max(0, endedAt - startedAt);
}

export function calculateWorkedMilliseconds(
  segments: WorkSegment[],
  nowMilliseconds: number,
): number {
  return segments.reduce(
    (total, segment) =>
      total + calculateSegmentDurationMilliseconds(segment, nowMilliseconds),
    0,
  );
}

export function calculateBreakMilliseconds(
  segments: BreakSegment[],
  nowMilliseconds: number,
): number {
  return segments.reduce(
    (total, segment) =>
      total + calculateSegmentDurationMilliseconds(segment, nowMilliseconds),
    0,
  );
}

export function calculateLiveDailyWorkedMilliseconds(
  baselineMilliseconds: number,
  status: WorkTimerStatus,
  serverNowMilliseconds: number,
  nowMilliseconds: number,
  nextAppDayStartMilliseconds: number,
): number {
  const safeBaseline = Math.max(0, baselineMilliseconds);

  if (nowMilliseconds >= nextAppDayStartMilliseconds) {
    if (status !== "working") {
      return 0;
    }

    const appDayMilliseconds = 24 * 60 * 60 * 1_000;
    const elapsedAfterBoundary = nowMilliseconds - nextAppDayStartMilliseconds;
    return elapsedAfterBoundary % appDayMilliseconds;
  }

  if (status !== "working") {
    return safeBaseline;
  }

  return safeBaseline + Math.max(0, nowMilliseconds - serverNowMilliseconds);
}

export function formatElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function calculateGoalProgress(
  workedMilliseconds: number,
  dailyTargetMinutes: number,
): number {
  const safeTargetMinutes =
    dailyTargetMinutes > 0
      ? dailyTargetMinutes
      : WORK_TIMER_CONFIG.defaultDailyTargetMinutes;
  const targetMilliseconds = safeTargetMinutes * 60 * 1_000;

  return Math.min(100, Math.max(0, (workedMilliseconds / targetMilliseconds) * 100));
}

export function isLongRunningSession(
  session: WorkTimerSession | null,
  nowMilliseconds: number,
): boolean {
  if (!session || session.endedAt) {
    return false;
  }

  const warningMilliseconds =
    WORK_TIMER_CONFIG.longSessionWarningHours * 60 * 60 * 1_000;

  return nowMilliseconds - parseTimestamp(session.startedAt) >= warningMilliseconds;
}

export function deriveWorkTimerStatus(
  session: WorkTimerSession | null,
  workSegments: WorkSegment[],
  breakSegments: BreakSegment[],
): WorkTimerStatus {
  if (!session) {
    return "not_started";
  }

  if (session.endedAt) {
    return "clocked_out";
  }

  const openWorkSegments = workSegments.filter((segment) => !segment.endedAt);
  const openBreakSegments = breakSegments.filter((segment) => !segment.endedAt);

  if (openWorkSegments.length === 1 && openBreakSegments.length === 0) {
    return "working";
  }

  if (openWorkSegments.length === 0 && openBreakSegments.length === 1) {
    return "on_break";
  }

  throw new Error("勤務データの状態が不整合です。管理者へ確認してください。");
}
