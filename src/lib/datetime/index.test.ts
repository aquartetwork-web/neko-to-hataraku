import { describe, expect, it } from "vitest";

import {
  addAppDays,
  enumerateAppDates,
  formatAppDate,
  formatAppDateKey,
  getAppDayRange,
  getAppMonthRange,
  getAppWeekRange,
  inAppTimezone,
  startOfAppDay,
} from "@/lib/datetime";

describe("app timezone", () => {
  it("formats dates in Asia/Tokyo", () => {
    const instant = new Date("2026-08-07T15:30:00.000Z");

    expect(formatAppDate(instant)).toBe("8月8日（土）");
  });

  it("keeps the real instant while exposing Tokyo calendar fields", () => {
    const instant = new Date("2026-08-07T15:00:00.000Z");
    const tokyoDate = inAppTimezone(instant);

    expect(tokyoDate.getFullYear()).toBe(2026);
    expect(tokyoDate.getMonth()).toBe(7);
    expect(tokyoDate.getDate()).toBe(8);
    expect(tokyoDate.getHours()).toBe(0);
    expect(tokyoDate.getTime()).toBe(instant.getTime());
  });

  it("creates Tokyo day boundaries as real instants", () => {
    const range = getAppDayRange("2026-08-08");

    expect(range.start.toISOString()).toBe("2026-08-07T15:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-08T15:00:00.000Z");
    expect(formatAppDateKey(range.start)).toBe("2026-08-08");
  });

  it("uses Monday through Sunday for app weeks", () => {
    expect(getAppWeekRange("2026-08-07T12:00:00.000Z")).toEqual({
      startDate: "2026-08-03",
      endDateExclusive: "2026-08-10",
    });
  });

  it("keeps a Tokyo Monday in the same week", () => {
    expect(getAppWeekRange("2026-08-02T15:00:00.000Z")).toEqual({
      startDate: "2026-08-03",
      endDateExclusive: "2026-08-10",
    });
  });

  it("places a Tokyo Sunday at the end of the preceding week", () => {
    expect(getAppWeekRange("2026-08-02T12:00:00.000Z")).toEqual({
      startDate: "2026-07-27",
      endDateExclusive: "2026-08-03",
    });
  });

  it("creates month ranges and enumerates date keys", () => {
    expect(getAppMonthRange("2026-08-07T12:00:00.000Z")).toEqual({
      startDate: "2026-08-01",
      endDateExclusive: "2026-09-01",
    });
    expect(enumerateAppDates("2026-08-30", "2026-09-02")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ]);
    expect(addAppDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("rejects impossible date keys", () => {
    expect(() => startOfAppDay("2026-02-30")).toThrow("Invalid date key");
  });
});
