import "server-only";

import { WORK_TIMER_CONFIG } from "@/config/work-timer";
import { getAppDayRange } from "@/lib/datetime";
import type {
  AppSettings,
  CategorySummary,
  ReportBreakSegment,
  ReportWorkSegment,
  ReportWorkSession,
  TodoSummary,
} from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_SETTINGS: AppSettings = {
  catName: "ねこ屋さん",
  dailyMinimumMinutes: 240,
  dailyTargetMinutes: WORK_TIMER_CONFIG.defaultDailyTargetMinutes,
  weeklyTargetMinutes: 1_800,
};

function fail(message: string, error: { message: string } | null): never {
  throw new Error(error ? `${message}: ${error.message}` : message);
}

export async function getCategories(): Promise<CategorySummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,color_key,sort_order,archived")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) fail("Failed to load categories", error);

  return (data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    colorKey: category.color_key,
    sortOrder: category.sort_order,
    archived: category.archived,
  }));
}

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("cat_name,daily_minimum_minutes,daily_target_minutes,weekly_target_minutes")
    .maybeSingle();

  if (error) fail("Failed to load settings", error);
  if (!data) return DEFAULT_SETTINGS;

  return {
    catName: data.cat_name,
    dailyMinimumMinutes: data.daily_minimum_minutes,
    dailyTargetMinutes: data.daily_target_minutes,
    weeklyTargetMinutes: data.weekly_target_minutes,
  };
}

function mapTodo(todo: {
  id: string;
  title: string;
  scheduled_for: string;
  category_id: string | null;
  status: TodoSummary["status"];
  sort_order: number;
  completed_at: string | null;
}): TodoSummary {
  return {
    id: todo.id,
    title: todo.title,
    scheduledFor: todo.scheduled_for,
    categoryId: todo.category_id,
    status: todo.status,
    sortOrder: todo.sort_order,
    completedAt: todo.completed_at,
  };
}

export type ReportBundle = {
  serverNow: string;
  categories: CategorySummary[];
  settings: AppSettings;
  sessions: ReportWorkSession[];
  workSegments: ReportWorkSegment[];
  breakSegments: ReportBreakSegment[];
  todos: TodoSummary[];
};

export async function getReportBundle(
  startDate: string,
  endDateExclusive: string,
): Promise<ReportBundle> {
  const supabase = await createClient();
  const rangeStart = getAppDayRange(startDate).start.toISOString();
  const rangeEnd = getAppDayRange(endDateExclusive).start.toISOString();

  const [
    categoriesResult,
    settingsResult,
    sessionsResult,
    workSegmentsResult,
    breakSegmentsResult,
    scheduledTodosResult,
    completedTodosResult,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id,name,color_key,sort_order,archived")
      .order("sort_order", { ascending: true }),
    supabase
      .from("settings")
      .select("cat_name,daily_minimum_minutes,daily_target_minutes,weekly_target_minutes")
      .maybeSingle(),
    supabase
      .from("work_sessions")
      .select("id,started_at,ended_at")
      .lt("started_at", rangeEnd)
      .or(`ended_at.is.null,ended_at.gt.${rangeStart}`)
      .order("started_at", { ascending: true }),
    supabase
      .from("work_segments")
      .select("id,work_session_id,category_id,todo_id,started_at,ended_at")
      .lt("started_at", rangeEnd)
      .or(`ended_at.is.null,ended_at.gt.${rangeStart}`)
      .order("started_at", { ascending: true }),
    supabase
      .from("break_segments")
      .select("id,work_session_id,started_at,ended_at")
      .lt("started_at", rangeEnd)
      .or(`ended_at.is.null,ended_at.gt.${rangeStart}`)
      .order("started_at", { ascending: true }),
    supabase
      .from("todos")
      .select("id,title,scheduled_for,category_id,status,sort_order,completed_at")
      .gte("scheduled_for", startDate)
      .lt("scheduled_for", endDateExclusive),
    supabase
      .from("todos")
      .select("id,title,scheduled_for,category_id,status,sort_order,completed_at")
      .gte("completed_at", rangeStart)
      .lt("completed_at", rangeEnd),
  ]);

  const results = [
    categoriesResult,
    settingsResult,
    sessionsResult,
    workSegmentsResult,
    breakSegmentsResult,
    scheduledTodosResult,
    completedTodosResult,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) fail("Failed to load report data", failed.error);

  const referencedTodoIds = [
    ...new Set(
      (workSegmentsResult.data ?? []).flatMap((segment) =>
        segment.todo_id ? [segment.todo_id] : [],
      ),
    ),
  ];
  let referencedTodos: NonNullable<typeof scheduledTodosResult.data> = [];
  if (referencedTodoIds.length > 0) {
    const referencedTodosResult = await supabase
      .from("todos")
      .select("id,title,scheduled_for,category_id,status,sort_order,completed_at")
      .in("id", referencedTodoIds);

    if (referencedTodosResult.error) {
      fail("Failed to load referenced todos", referencedTodosResult.error);
    }
    referencedTodos = referencedTodosResult.data ?? [];
  }

  const categories = (categoriesResult.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    colorKey: category.color_key,
    sortOrder: category.sort_order,
    archived: category.archived,
  }));
  const settings = settingsResult.data
    ? {
        catName: settingsResult.data.cat_name,
        dailyMinimumMinutes: settingsResult.data.daily_minimum_minutes,
        dailyTargetMinutes: settingsResult.data.daily_target_minutes,
        weeklyTargetMinutes: settingsResult.data.weekly_target_minutes,
      }
    : DEFAULT_SETTINGS;
  const todoMap = new Map<string, TodoSummary>();
  for (const todo of [
    ...(scheduledTodosResult.data ?? []),
    ...(completedTodosResult.data ?? []),
    ...referencedTodos,
  ]) {
    todoMap.set(todo.id, mapTodo(todo));
  }

  return {
    serverNow: new Date().toISOString(),
    categories,
    settings,
    sessions: (sessionsResult.data ?? []).map((session) => ({
      id: session.id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
    })),
    workSegments: (workSegmentsResult.data ?? []).map((segment) => ({
      id: segment.id,
      workSessionId: segment.work_session_id,
      categoryId: segment.category_id,
      todoId: segment.todo_id,
      startedAt: segment.started_at,
      endedAt: segment.ended_at,
    })),
    breakSegments: (breakSegmentsResult.data ?? []).map((segment) => ({
      id: segment.id,
      workSessionId: segment.work_session_id,
      startedAt: segment.started_at,
      endedAt: segment.ended_at,
    })),
    todos: [...todoMap.values()],
  };
}

export async function getDailyNote(date: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_notes")
    .select("body")
    .eq("note_date", date)
    .maybeSingle();

  if (error) fail("Failed to load daily note", error);
  return data?.body ?? "";
}
