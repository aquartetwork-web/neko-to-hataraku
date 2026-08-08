import type { AppSettings } from "@/lib/reports/types";

function integer(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

export function parseSettingsForm(formData: FormData): AppSettings | null {
  const catName = formData.get("catName")?.toString().trim() ?? "";
  const dailyMinimumMinutes = integer(formData.get("dailyMinimumMinutes"));
  const dailyTargetMinutes = integer(formData.get("dailyTargetMinutes"));
  const weeklyTargetMinutes = integer(formData.get("weeklyTargetMinutes"));

  if (
    catName.length < 1 ||
    catName.length > 40 ||
    dailyMinimumMinutes === null ||
    dailyTargetMinutes === null ||
    weeklyTargetMinutes === null ||
    dailyMinimumMinutes < 0 ||
    dailyMinimumMinutes > dailyTargetMinutes ||
    dailyTargetMinutes < 1 ||
    dailyTargetMinutes > 1_440 ||
    weeklyTargetMinutes < 1 ||
    weeklyTargetMinutes > 10_080
  ) {
    return null;
  }

  return {
    catName,
    dailyMinimumMinutes,
    dailyTargetMinutes,
    weeklyTargetMinutes,
  };
}
