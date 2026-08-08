"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { FormActionState } from "@/lib/forms/action-state";
import type { WorkTimerActionState } from "@/lib/work-timer/action-state";
import type { WorkTimerOperation } from "@/lib/work-timer/types";
import type { Database } from "@/types/database.types";

const RPC_BY_OPERATION = {
  pause: "pause_work",
  resume: "resume_work",
  stop: "stop_work",
} as const satisfies Record<
  Exclude<WorkTimerOperation, "start">,
  keyof Database["public"]["Functions"]
>;

function isWorkTimerOperation(
  value: FormDataEntryValue | null,
): value is WorkTimerOperation {
  return value === "start" || value === "pause" || value === "resume" || value === "stop";
}

function getOperationErrorMessage(operation: WorkTimerOperation): string {
  const label = {
    start: "勤務開始",
    pause: "休憩開始",
    resume: "勤務再開",
    stop: "退勤",
  }[operation];

  return `${label}に失敗しました。別端末で状態が変わっていないか確認し、再読み込みしてください。`;
}

export async function performWorkTimerAction(
  _previousState: WorkTimerActionState,
  formData: FormData,
): Promise<WorkTimerActionState> {
  const operation = formData.get("operation");

  if (!isWorkTimerOperation(operation)) {
    return { error: "不明な操作です。ページを再読み込みしてください。" };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/login");
  }

  const { error } = operation === "start"
    ? await supabase.rpc("start_or_switch_work", {
        p_category_id: null,
        p_todo_id: null,
      })
    : await supabase.rpc(RPC_BY_OPERATION[operation]);

  revalidatePath("/");

  if (error) {
    console.error("Work timer RPC failed", {
      operation,
      code: error.code,
      message: error.message,
    });

    return { error: getOperationErrorMessage(operation) };
  }

  return { error: null };
}

export async function switchWorkCategory(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rawCategoryId = formData.get("categoryId")?.toString().trim() ?? "";
  const categoryId = rawCategoryId || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_or_switch_work", {
    p_category_id: categoryId,
    p_todo_id: null,
  });

  if (error) {
    console.error("Work category switch failed", {
      code: error.code,
      message: error.message,
    });
    return { error: "作業カテゴリを切り替えられませんでした。", message: null };
  }

  revalidatePath("/");
  return { error: null, message: "作業カテゴリを切り替えました。" };
}
