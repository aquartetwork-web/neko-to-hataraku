import type { Database } from "@/types/database.types";

export type CategoryColor = Database["public"]["Enums"]["category_color"];
export type TodoStatus = Database["public"]["Enums"]["todo_status"];

export type CategorySummary = {
  id: string;
  name: string;
  colorKey: CategoryColor;
  sortOrder: number;
  archived: boolean;
};

export type TodoSummary = {
  id: string;
  title: string;
  scheduledFor: string;
  categoryId: string | null;
  status: TodoStatus;
  sortOrder: number;
  completedAt: string | null;
};

export type ReportWorkSession = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};

export type ReportWorkSegment = {
  id: string;
  workSessionId: string;
  categoryId: string | null;
  todoId: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type ReportBreakSegment = {
  id: string;
  workSessionId: string;
  startedAt: string;
  endedAt: string | null;
};

export type AppSettings = {
  catName: string;
  dailyMinimumMinutes: number;
  dailyTargetMinutes: number;
  weeklyTargetMinutes: number;
};

export type CategoryDuration = {
  categoryId: string | null;
  name: string;
  colorKey: CategoryColor;
  milliseconds: number;
};

export type DailyReport = {
  date: string;
  workedMilliseconds: number;
  breakMilliseconds: number;
  completedTodoCount: number;
  categoryDurations: CategoryDuration[];
};
