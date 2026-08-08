export type WorkTimerStatus =
  | "not_started"
  | "working"
  | "on_break"
  | "clocked_out";

export type WorkTimerOperation = "start" | "pause" | "resume" | "stop";

export type WorkTimerSession = {
  id: string;
  workDate: string;
  startedAt: string;
  endedAt: string | null;
};

export type WorkSegment = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  categoryId: string | null;
  todoId: string | null;
};

export type BreakSegment = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};

export type WorkTimerSnapshot = {
  serverNow: string;
  dailyTargetMinutes: number;
  session: WorkTimerSession | null;
  workSegments: WorkSegment[];
  breakSegments: BreakSegment[];
  status: WorkTimerStatus;
};

