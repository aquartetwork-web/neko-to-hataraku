import type { Json } from "@/types/database.types";
import { WORK_TIMER_CONFIG } from "@/config/work-timer";
import { deriveWorkTimerStatus } from "@/lib/work-timer/calculations";
import type {
  BreakSegment,
  WorkSegment,
  WorkTimerSession,
  WorkTimerSnapshot,
} from "@/lib/work-timer/types";
import { createClient } from "@/lib/supabase/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid timer state field: ${field}`);
  }

  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  return requireString(value, field);
}

function parseSession(value: unknown): WorkTimerSession | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error("Invalid timer state field: session");
  }

  return {
    id: requireString(value.id, "session.id"),
    workDate: requireString(value.work_date, "session.work_date"),
    startedAt: requireString(value.started_at, "session.started_at"),
    endedAt: nullableString(value.ended_at, "session.ended_at"),
  };
}

function parseWorkSegments(value: unknown): WorkSegment[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid timer state field: work_segments");
  }

  return value.map((segment, index) => {
    if (!isRecord(segment)) {
      throw new Error(`Invalid timer state field: work_segments.${index}`);
    }

    return {
      id: requireString(segment.id, `work_segments.${index}.id`),
      startedAt: requireString(
        segment.started_at,
        `work_segments.${index}.started_at`,
      ),
      endedAt: nullableString(
        segment.ended_at,
        `work_segments.${index}.ended_at`,
      ),
      categoryId: nullableString(
        segment.category_id,
        `work_segments.${index}.category_id`,
      ),
      todoId: nullableString(segment.todo_id, `work_segments.${index}.todo_id`),
    };
  });
}

function parseBreakSegments(value: unknown): BreakSegment[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid timer state field: break_segments");
  }

  return value.map((segment, index) => {
    if (!isRecord(segment)) {
      throw new Error(`Invalid timer state field: break_segments.${index}`);
    }

    return {
      id: requireString(segment.id, `break_segments.${index}.id`),
      startedAt: requireString(
        segment.started_at,
        `break_segments.${index}.started_at`,
      ),
      endedAt: nullableString(
        segment.ended_at,
        `break_segments.${index}.ended_at`,
      ),
    };
  });
}

export function parseWorkTimerSnapshot(value: Json): WorkTimerSnapshot {
  if (!isRecord(value)) {
    throw new Error("Invalid timer state response");
  }

  const session = parseSession(value.session);
  const workSegments = parseWorkSegments(value.work_segments);
  const breakSegments = parseBreakSegments(value.break_segments);
  const rawTargetMinutes = value.daily_target_minutes;
  const dailyTargetMinutes =
    typeof rawTargetMinutes === "number" && rawTargetMinutes > 0
      ? rawTargetMinutes
      : WORK_TIMER_CONFIG.defaultDailyTargetMinutes;

  return {
    serverNow: requireString(value.server_now, "server_now"),
    dailyTargetMinutes,
    session,
    workSegments,
    breakSegments,
    status: deriveWorkTimerStatus(session, workSegments, breakSegments),
  };
}

export async function getWorkTimerSnapshot(): Promise<WorkTimerSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_work_timer_state");

  if (error) {
    throw new Error(error.message);
  }

  return parseWorkTimerSnapshot(data);
}

