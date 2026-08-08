import { formatAppDateKey, formatAppTime } from "@/lib/datetime";
import type {
  CategorySummary,
  ReportBreakSegment,
  ReportWorkSegment,
  ReportWorkSession,
  TodoSummary,
} from "@/lib/reports/types";

export type TimelineEvent = {
  at: string;
  label: string;
  detail: string | null;
  kind: "start" | "break" | "resume" | "switch" | "stop";
};

function isSameInstant(left: string, right: string): boolean {
  return Date.parse(left) === Date.parse(right);
}

export function buildTimeline({
  date,
  sessions,
  workSegments,
  breakSegments,
  categories,
  todos,
}: {
  date: string;
  sessions: ReportWorkSession[];
  workSegments: ReportWorkSegment[];
  breakSegments: ReportBreakSegment[];
  categories: CategorySummary[];
  todos: TodoSummary[];
}): TimelineEvent[] {
  const categoryById = new Map(categories.map((category) => [category.id, category.name]));
  const todoById = new Map(todos.map((todo) => [todo.id, todo.title]));
  const sessionStartTimes = new Set(sessions.map((session) => session.startedAt));
  const sessionEndTimes = new Set(
    sessions.flatMap((session) => session.endedAt ? [session.endedAt] : []),
  );
  const resumeTimes = new Set(
    breakSegments.flatMap((segment) => segment.endedAt ? [segment.endedAt] : []),
  );
  const events: TimelineEvent[] = [];

  const add = (event: TimelineEvent) => {
    if (formatAppDateKey(event.at) === date) events.push(event);
  };

  for (const session of sessions) {
    add({ at: session.startedAt, label: "勤務開始", detail: null, kind: "start" });
    if (session.endedAt) {
      add({ at: session.endedAt, label: "退勤", detail: null, kind: "stop" });
    }
  }

  for (const segment of breakSegments) {
    add({ at: segment.startedAt, label: "休憩開始", detail: null, kind: "break" });
    if (
      segment.endedAt &&
      ![...sessionEndTimes].some((time) => isSameInstant(time, segment.endedAt!))
    ) {
      add({ at: segment.endedAt, label: "再開", detail: null, kind: "resume" });
    }
  }

  for (const segment of workSegments) {
    const startsSession = [...sessionStartTimes].some((time) =>
      isSameInstant(time, segment.startedAt),
    );
    const resumesWork = [...resumeTimes].some((time) =>
      isSameInstant(time, segment.startedAt),
    );
    if (startsSession || resumesWork) continue;

    const detail = segment.todoId
      ? todoById.get(segment.todoId) ?? "ToDo"
      : segment.categoryId
        ? categoryById.get(segment.categoryId) ?? "アーカイブ済みカテゴリ"
        : "未分類";
    add({ at: segment.startedAt, label: "作業変更", detail, kind: "switch" });
  }

  return events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

export function formatTimelineTime(event: TimelineEvent): string {
  return formatAppTime(event.at);
}
