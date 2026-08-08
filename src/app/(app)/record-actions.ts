"use server";

import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

export async function saveDailyNote(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const noteDate = formData.get("noteDate")?.toString().trim() ?? "";
  const body = formData.get("body")?.toString().trim() ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate) || body.length > 2_000) {
    return { error: "メモの内容を確認してください。", message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_notes")
    .upsert({ note_date: noteDate, body }, { onConflict: "user_id,note_date" });

  if (error) {
    console.error("Daily note update failed", { code: error.code, message: error.message });
    return { error: "メモを保存できませんでした。", message: null };
  }

  revalidatePath(`/records/${noteDate}`);
  return { error: null, message: "メモを保存しました。" };
}
