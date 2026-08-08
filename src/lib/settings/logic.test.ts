import { describe, expect, it } from "vitest";

import { parseSettingsForm } from "@/lib/settings/logic";

function settingsForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    catName: "ねこ屋さん",
    dailyMinimumMinutes: "240",
    dailyTargetMinutes: "360",
    weeklyTargetMinutes: "1800",
    ...overrides,
  };
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("settings form", () => {
  it("parses valid settings", () => {
    expect(parseSettingsForm(settingsForm())).toEqual({
      catName: "ねこ屋さん",
      dailyMinimumMinutes: 240,
      dailyTargetMinutes: 360,
      weeklyTargetMinutes: 1800,
    });
  });

  it("rejects a minimum above the daily target", () => {
    expect(
      parseSettingsForm(
        settingsForm({ dailyMinimumMinutes: "420", dailyTargetMinutes: "360" }),
      ),
    ).toBeNull();
  });

  it("rejects invalid or out-of-range numbers", () => {
    expect(parseSettingsForm(settingsForm({ dailyTargetMinutes: "0" }))).toBeNull();
    expect(parseSettingsForm(settingsForm({ weeklyTargetMinutes: "abc" }))).toBeNull();
  });
});
