import { describe, expect, it } from "vitest";

import { parseWorkTimerSnapshot } from "@/lib/work-timer/data";

describe("parseWorkTimerSnapshot", () => {
  it("restores an open server session and its segments", () => {
    const snapshot = parseWorkTimerSnapshot({
      server_now: "2026-08-07T06:00:00.000Z",
      daily_target_minutes: 360,
      session: {
        id: "session-1",
        work_date: "2026-08-07",
        started_at: "2026-08-07T05:00:00.000Z",
        ended_at: null,
      },
      work_segments: [
        {
          id: "work-1",
          started_at: "2026-08-07T05:00:00.000Z",
          ended_at: null,
          category_id: null,
          todo_id: null,
        },
      ],
      break_segments: [],
    });

    expect(snapshot.status).toBe("working");
    expect(snapshot.session?.id).toBe("session-1");
    expect(snapshot.workSegments).toHaveLength(1);
  });

  it("uses the safe target default when settings are missing", () => {
    const snapshot = parseWorkTimerSnapshot({
      server_now: "2026-08-07T06:00:00.000Z",
      daily_target_minutes: null,
      session: null,
      work_segments: [],
      break_segments: [],
    });

    expect(snapshot.dailyTargetMinutes).toBe(360);
    expect(snapshot.status).toBe("not_started");
  });
});

