import { describe, expect, it } from "vitest";

import {
  buildDailyReports,
  calculateTimeBank,
  mergeCategoryDurations,
  splitIntervalByAppDate,
  summarizeMonth,
  summarizeWeek,
} from "@/lib/reports/calculations";
import type { CategorySummary, ReportWorkSegment } from "@/lib/reports/types";

const categories: CategorySummary[] = [
  {
    id: "writing",
    name: "シナリオ執筆",
    colorKey: "purple",
    sortOrder: 10,
    archived: false,
  },
];

const overnight: ReportWorkSegment = {
  id: "segment-1",
  workSessionId: "session-1",
  categoryId: "writing",
  todoId: null,
  startedAt: "2026-08-07T14:00:00.000Z",
  endedAt: "2026-08-07T16:00:00.000Z",
};

describe("report calculations", () => {
  it("splits a segment at the Asia/Tokyo date boundary", () => {
    expect(splitIntervalByAppDate(overnight, Date.parse(overnight.endedAt!))).toEqual([
      { date: "2026-08-07", milliseconds: 60 * 60 * 1_000 },
      { date: "2026-08-08", milliseconds: 60 * 60 * 1_000 },
    ]);
  });

  it("allocates work, breaks, categories and completed todos by day", () => {
    const reports = buildDailyReports({
      startDate: "2026-08-07",
      endDateExclusive: "2026-08-09",
      nowMilliseconds: Date.parse("2026-08-08T03:00:00.000Z"),
      workSegments: [overnight],
      breakSegments: [
        {
          id: "break-1",
          workSessionId: "session-1",
          startedAt: "2026-08-07T15:10:00.000Z",
          endedAt: "2026-08-07T15:30:00.000Z",
        },
      ],
      todos: [
        {
          id: "todo-1",
          title: "確認",
          scheduledFor: "2026-08-08",
          categoryId: "writing",
          status: "done",
          sortOrder: 10,
          completedAt: "2026-08-07T15:40:00.000Z",
        },
      ],
      categories,
    });

    expect(reports.map((report) => report.workedMilliseconds)).toEqual([
      60 * 60 * 1_000,
      60 * 60 * 1_000,
    ]);
    expect(reports[1].breakMilliseconds).toBe(20 * 60 * 1_000);
    expect(reports[1].completedTodoCount).toBe(1);
    expect(reports[0].categoryDurations[0].name).toBe("シナリオ執筆");
    expect(mergeCategoryDurations(reports)[0].milliseconds).toBe(2 * 60 * 60 * 1_000);
  });

  it("calculates positive and gentle negative time bank values", () => {
    expect(calculateTimeBank(7 * 60 * 60 * 1_000, 360)).toBe(60 * 60 * 1_000);
    expect(calculateTimeBank(5 * 60 * 60 * 1_000, 360)).toBe(-60 * 60 * 1_000);
  });

  it("summarizes weekly targets without assigning work by session date", () => {
    const reports = [
      {
        date: "2026-08-03",
        workedMilliseconds: 7 * 3_600_000,
        breakMilliseconds: 0,
        completedTodoCount: 2,
        categoryDurations: [{
          categoryId: "writing",
          name: "シナリオ執筆",
          colorKey: "purple" as const,
          milliseconds: 7 * 3_600_000,
        }],
      },
      {
        date: "2026-08-04",
        workedMilliseconds: 5 * 3_600_000,
        breakMilliseconds: 0,
        completedTodoCount: 1,
        categoryDurations: [],
      },
    ];

    const summary = summarizeWeek(reports, 360, 1_800);
    expect(summary.totalWorked).toBe(12 * 3_600_000);
    expect(summary.remaining).toBe(18 * 3_600_000);
    expect(summary.timeBank).toBe(-18 * 3_600_000);
    expect(summary.targetDays).toBe(1);
    expect(summary.completedTodos).toBe(3);
  });

  it("summarizes active monthly days and their average", () => {
    const reports = [
      { date: "2026-08-01", workedMilliseconds: 2 * 3_600_000, breakMilliseconds: 0, completedTodoCount: 1, categoryDurations: [] },
      { date: "2026-08-02", workedMilliseconds: 0, breakMilliseconds: 0, completedTodoCount: 0, categoryDurations: [] },
      { date: "2026-08-03", workedMilliseconds: 6 * 3_600_000, breakMilliseconds: 0, completedTodoCount: 2, categoryDurations: [] },
    ];
    const summary = summarizeMonth(reports);

    expect(summary.totalWorked).toBe(8 * 3_600_000);
    expect(summary.activeDays).toBe(2);
    expect(summary.averageWorked).toBe(4 * 3_600_000);
    expect(summary.completedTodos).toBe(3);
  });
});
