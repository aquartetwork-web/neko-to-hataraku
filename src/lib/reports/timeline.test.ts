import { describe, expect, it } from "vitest";

import { buildTimeline } from "@/lib/reports/timeline";

describe("buildTimeline", () => {
  it("休憩とカテゴリ変更を時刻順にまとめる", () => {
    const events = buildTimeline({
      date: "2026-08-07",
      sessions: [{
        id: "session",
        startedAt: "2026-08-07T00:00:00.000Z",
        endedAt: "2026-08-07T03:00:00.000Z",
      }],
      workSegments: [
        {
          id: "work-1",
          workSessionId: "session",
          categoryId: null,
          todoId: null,
          startedAt: "2026-08-07T00:00:00.000Z",
          endedAt: "2026-08-07T01:00:00.000Z",
        },
        {
          id: "work-2",
          workSessionId: "session",
          categoryId: null,
          todoId: null,
          startedAt: "2026-08-07T01:30:00.000Z",
          endedAt: "2026-08-07T02:00:00.000Z",
        },
        {
          id: "work-3",
          workSessionId: "session",
          categoryId: "category",
          todoId: null,
          startedAt: "2026-08-07T02:00:00.000Z",
          endedAt: "2026-08-07T03:00:00.000Z",
        },
      ],
      breakSegments: [{
        id: "break",
        workSessionId: "session",
        startedAt: "2026-08-07T01:00:00.000Z",
        endedAt: "2026-08-07T01:30:00.000Z",
      }],
      categories: [{
        id: "category",
        name: "執筆",
        colorKey: "purple",
        sortOrder: 10,
        archived: false,
      }],
      todos: [],
    });

    expect(events.map((event) => [event.label, event.detail])).toEqual([
      ["勤務開始", null],
      ["休憩開始", null],
      ["再開", null],
      ["作業変更", "執筆"],
      ["退勤", null],
    ]);
  });

  it("休憩中の退勤を再開として表示しない", () => {
    const endedAt = "2026-08-07T03:00:00.000Z";
    const events = buildTimeline({
      date: "2026-08-07",
      sessions: [{
        id: "session",
        startedAt: "2026-08-07T00:00:00.000Z",
        endedAt,
      }],
      workSegments: [{
        id: "work",
        workSessionId: "session",
        categoryId: null,
        todoId: null,
        startedAt: "2026-08-07T00:00:00.000Z",
        endedAt: "2026-08-07T02:00:00.000Z",
      }],
      breakSegments: [{
        id: "break",
        workSessionId: "session",
        startedAt: "2026-08-07T02:00:00.000Z",
        endedAt,
      }],
      categories: [],
      todos: [],
    });

    expect(events.map((event) => event.label)).toEqual([
      "勤務開始",
      "休憩開始",
      "退勤",
    ]);
  });
});
