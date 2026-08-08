import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkTimerCard } from "@/components/work-timer/work-timer-card";
import type { WorkTimerSnapshot } from "@/lib/work-timer/types";

vi.mock("@/app/(app)/actions", () => ({
  performWorkTimerAction: async () => ({ error: null }),
  switchWorkCategory: async () => ({ error: null, message: null, reaction: null }),
}));

const SERVER_NOW = Date.parse("2026-08-08T12:00:00.000Z");

const snapshot: WorkTimerSnapshot = {
  serverNow: new Date(SERVER_NOW).toISOString(),
  dailyTargetMinutes: 360,
  session: {
    id: "session-1",
    workDate: "2026-08-08",
    startedAt: new Date(SERVER_NOW - 5_000).toISOString(),
    endedAt: null,
  },
  workSegments: [{
    id: "segment-1",
    startedAt: new Date(SERVER_NOW - 5_000).toISOString(),
    endedAt: null,
    categoryId: null,
    todoId: null,
  }],
  breakSegments: [],
  status: "working",
};

describe("WorkTimerCard", () => {
  let animationFrameCallback: FrameRequestCallback | undefined;

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(SERVER_NOW);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates the visible worked time once per elapsed second", () => {
    render(
      <WorkTimerCard
        snapshot={snapshot}
        categories={[]}
        todos={[]}
        dailyWorkedMillisecondsAtServerNow={5_000}
        nextAppDayStartMilliseconds={SERVER_NOW + 12 * 60 * 60 * 1_000}
      />,
    );

    expect(screen.getByText("00:00:05", { exact: false })).toBeInTheDocument();
    expect(animationFrameCallback).toBeTypeOf("function");

    vi.mocked(Date.now).mockReturnValue(SERVER_NOW + 1_000);
    act(() => animationFrameCallback?.(0));

    expect(screen.getByText("00:00:06", { exact: false })).toBeInTheDocument();
  });
});
