import { describe, expect, it } from "vitest";

import {
  calculateBreakMilliseconds,
  calculateGoalProgress,
  calculateLiveDailyWorkedMilliseconds,
  calculateWorkedMilliseconds,
  deriveWorkTimerStatus,
  formatElapsedTime,
  isLongRunningSession,
} from "@/lib/work-timer/calculations";
import type {
  BreakSegment,
  WorkSegment,
  WorkTimerSession,
} from "@/lib/work-timer/types";

const NOW = Date.parse("2026-08-07T06:00:00.000Z");
const NEXT_APP_DAY = Date.parse("2026-08-07T15:00:00.000Z");

function workSegment(
  id: string,
  startedAt: string,
  endedAt: string | null,
): WorkSegment {
  return { id, startedAt, endedAt, categoryId: null, todoId: null };
}

function breakSegment(
  id: string,
  startedAt: string,
  endedAt: string | null,
): BreakSegment {
  return { id, startedAt, endedAt };
}

function session(
  startedAt = "2026-08-07T03:00:00.000Z",
  endedAt: string | null = null,
): WorkTimerSession {
  return {
    id: "session-1",
    workDate: "2026-08-07",
    startedAt,
    endedAt,
  };
}

describe("work timer calculations", () => {
  it("calculates a completed work segment", () => {
    const result = calculateWorkedMilliseconds(
      [
        workSegment(
          "work-1",
          "2026-08-07T03:00:00.000Z",
          "2026-08-07T04:30:00.000Z",
        ),
      ],
      NOW,
    );

    expect(result).toBe(90 * 60 * 1_000);
  });

  it("sums multiple work segments", () => {
    const result = calculateWorkedMilliseconds(
      [
        workSegment(
          "work-1",
          "2026-08-07T03:00:00.000Z",
          "2026-08-07T03:30:00.000Z",
        ),
        workSegment(
          "work-2",
          "2026-08-07T04:00:00.000Z",
          "2026-08-07T04:45:00.000Z",
        ),
      ],
      NOW,
    );

    expect(result).toBe(75 * 60 * 1_000);
  });

  it("excludes breaks by summing only work intervals", () => {
    const work = calculateWorkedMilliseconds(
      [
        workSegment(
          "work-1",
          "2026-08-07T03:00:00.000Z",
          "2026-08-07T04:00:00.000Z",
        ),
        workSegment(
          "work-2",
          "2026-08-07T04:30:00.000Z",
          "2026-08-07T05:00:00.000Z",
        ),
      ],
      NOW,
    );
    const breaks = calculateBreakMilliseconds(
      [
        breakSegment(
          "break-1",
          "2026-08-07T04:00:00.000Z",
          "2026-08-07T04:30:00.000Z",
        ),
      ],
      NOW,
    );

    expect(work).toBe(90 * 60 * 1_000);
    expect(breaks).toBe(30 * 60 * 1_000);
  });

  it("uses the supplied current time for an open work segment", () => {
    const result = calculateWorkedMilliseconds(
      [workSegment("work-1", "2026-08-07T05:15:00.000Z", null)],
      NOW,
    );

    expect(result).toBe(45 * 60 * 1_000);
  });

  it("advances the daily total only while working", () => {
    const baseline = 90 * 60 * 1_000;

    expect(
      calculateLiveDailyWorkedMilliseconds(
        baseline,
        "working",
        NOW,
        NOW + 5_000,
        NEXT_APP_DAY,
      ),
    ).toBe(baseline + 5_000);
    expect(
      calculateLiveDailyWorkedMilliseconds(
        baseline,
        "on_break",
        NOW,
        NOW + 5_000,
        NEXT_APP_DAY,
      ),
    ).toBe(baseline);
    expect(
      calculateLiveDailyWorkedMilliseconds(
        baseline,
        "clocked_out",
        NOW,
        NOW + 5_000,
        NEXT_APP_DAY,
      ),
    ).toBe(baseline);
  });

  it("does not subtract time when the client clock is behind the server", () => {
    expect(
      calculateLiveDailyWorkedMilliseconds(
        60_000,
        "working",
        NOW,
        NOW - 5_000,
        NEXT_APP_DAY,
      ),
    ).toBe(60_000);
  });

  it("resets the displayed daily total at the Tokyo date boundary", () => {
    expect(
      calculateLiveDailyWorkedMilliseconds(
        5 * 60 * 60 * 1_000,
        "working",
        NOW,
        NEXT_APP_DAY + 30_000,
        NEXT_APP_DAY,
      ),
    ).toBe(30_000);
    expect(
      calculateLiveDailyWorkedMilliseconds(
        5 * 60 * 60 * 1_000,
        "on_break",
        NOW,
        NEXT_APP_DAY + 30_000,
        NEXT_APP_DAY,
      ),
    ).toBe(0);
  });

  it("formats elapsed time without saving per-second values", () => {
    expect(formatElapsedTime(9_691_999)).toBe("02:41:31");
  });

  it("clamps goal progress and falls back for an invalid target", () => {
    expect(calculateGoalProgress(3 * 60 * 60 * 1_000, 360)).toBe(50);
    expect(calculateGoalProgress(7 * 60 * 60 * 1_000, 360)).toBe(100);
    expect(calculateGoalProgress(3 * 60 * 60 * 1_000, 0)).toBe(50);
  });

  it("detects an open session at the long-work threshold only", () => {
    const eighteenHoursAgo = new Date(NOW - 18 * 60 * 60 * 1_000).toISOString();

    expect(isLongRunningSession(session(eighteenHoursAgo), NOW)).toBe(true);
    expect(
      isLongRunningSession(
        session(eighteenHoursAgo, "2026-08-07T05:00:00.000Z"),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("restored timer status", () => {
  it("derives not started without a session", () => {
    expect(deriveWorkTimerStatus(null, [], [])).toBe("not_started");
  });

  it("restores working from one open work segment", () => {
    expect(
      deriveWorkTimerStatus(
        session(),
        [workSegment("work-1", "2026-08-07T03:00:00.000Z", null)],
        [],
      ),
    ).toBe("working");
  });

  it("restores a break from one open break segment", () => {
    expect(
      deriveWorkTimerStatus(
        session(),
        [
          workSegment(
            "work-1",
            "2026-08-07T03:00:00.000Z",
            "2026-08-07T04:00:00.000Z",
          ),
        ],
        [breakSegment("break-1", "2026-08-07T04:00:00.000Z", null)],
      ),
    ).toBe("on_break");
  });

  it("derives clocked out from a completed session", () => {
    expect(
      deriveWorkTimerStatus(
        session(
          "2026-08-07T03:00:00.000Z",
          "2026-08-07T05:00:00.000Z",
        ),
        [],
        [],
      ),
    ).toBe("clocked_out");
  });

  it("rejects simultaneous work and break states", () => {
    expect(() =>
      deriveWorkTimerStatus(
        session(),
        [workSegment("work-1", "2026-08-07T03:00:00.000Z", null)],
        [breakSegment("break-1", "2026-08-07T04:00:00.000Z", null)],
      ),
    ).toThrow("勤務データの状態が不整合です");
  });
});
