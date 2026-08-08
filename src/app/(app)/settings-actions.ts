"use server";

import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/lib/forms/action-state";
import { parseSettingsForm } from "@/lib/settings/logic";
import { createClient } from "@/lib/supabase/server";

export async function saveSettings(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const settings = parseSettingsForm(formData);
  if (!settings) {
    return { error: "設定値を確認してください。最低ラインは1日の目標以下にします。", message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({
      cat_name: settings.catName,
      daily_minimum_minutes: settings.dailyMinimumMinutes,
      daily_target_minutes: settings.dailyTargetMinutes,
      weekly_target_minutes: settings.weeklyTargetMinutes,
    }, { onConflict: "user_id" });

  if (error) {
    console.error("Settings update failed", { code: error.code, message: error.message });
    return { error: "設定を保存できませんでした。", message: null };
  }

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/week");
  revalidatePath("/month");
  return { error: null, message: "設定を保存しました。" };
}
