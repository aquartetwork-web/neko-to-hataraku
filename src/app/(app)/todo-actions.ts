"use server";

import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";
import {
  getTodoCompletionUpdate,
  moveTodoIds,
  nextTodoSortOrder,
  normalizeTodoTitle,
} from "@/lib/todos/logic";

type TodoOperation = "add" | "edit" | "toggle" | "start" | "move";

function value(formData: FormData, key: string): string {
  return formData.get(key)?.toString().trim() ?? "";
}

function optionalUuid(formData: FormData, key: string): string | null {
  const result = value(formData, key);
  return result || null;
}

function errorState(message: string): FormActionState {
  return { error: message, message: null, reaction: null };
}

export async function performTodoAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const operation = value(formData, "operation") as TodoOperation;
  const supabase = await createClient();
  let error: { code?: string; message: string } | null = null;

  if (operation === "add") {
    const title = normalizeTodoTitle(formData.get("title"));
    const scheduledFor = value(formData, "scheduledFor");
    if (!title || !scheduledFor) return errorState("タイトルを入力してください。");

    const { data: current, error: loadError } = await supabase
      .from("todos")
      .select("sort_order")
      .eq("scheduled_for", scheduledFor)
      .order("sort_order", { ascending: false })
      .limit(1);
    error = loadError;
    if (!error) {
      const result = await supabase.from("todos").insert({
        title,
        scheduled_for: scheduledFor,
        category_id: optionalUuid(formData, "categoryId"),
        sort_order: nextTodoSortOrder((current ?? []).map((todo) => todo.sort_order)),
      });
      error = result.error;
    }
  } else if (operation === "edit") {
    const todoId = value(formData, "todoId");
    const title = normalizeTodoTitle(formData.get("title"));
    if (!todoId || !title) return errorState("ToDoの内容を確認してください。");
    const result = await supabase
      .from("todos")
      .update({ title, category_id: optionalUuid(formData, "categoryId") })
      .eq("id", todoId);
    error = result.error;
  } else if (operation === "toggle") {
    const todoId = value(formData, "todoId");
    if (!todoId) return errorState("ToDoを確認できませんでした。");
    const { data: currentTodo, error: loadError } = await supabase
      .from("todos")
      .select("status")
      .eq("id", todoId)
      .maybeSingle();
    if (loadError || !currentTodo) {
      error = loadError ?? { message: "Todo was not found" };
    }
    const currentlyDone = currentTodo?.status === "done";
    const result = error ? null : await supabase
      .from("todos")
      .update(getTodoCompletionUpdate(currentlyDone, new Date().toISOString()))
      .eq("id", todoId);
    error = error ?? result?.error ?? null;
    if (!error) {
      revalidatePath("/");
      revalidatePath("/records");
      revalidatePath("/week");
      revalidatePath("/month");
      return {
        error: null,
        message: currentlyDone ? "未完了へ戻しました。" : "完了しました。",
        reaction: currentlyDone ? null : "猫が、こくんとうなずきました。",
      };
    }
  } else if (operation === "start") {
    const todoId = value(formData, "todoId");
    if (!todoId) return errorState("開始するToDoを確認できませんでした。");
    const result = await supabase.rpc("start_or_switch_work", {
      p_category_id: null,
      p_todo_id: todoId,
    });
    error = result.error;
  } else if (operation === "move") {
    const todoId = value(formData, "todoId");
    const scheduledFor = value(formData, "scheduledFor");
    const direction = value(formData, "direction");
    if (!todoId || !scheduledFor || (direction !== "up" && direction !== "down")) {
      return errorState("並べ替え対象を確認できませんでした。");
    }
    const { data, error: loadError } = await supabase
      .from("todos")
      .select("id")
      .eq("scheduled_for", scheduledFor)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    error = loadError;
    if (!error) {
      const orderedIds = moveTodoIds(
        (data ?? []).map((todo) => todo.id),
        todoId,
        direction,
      );
      const result = await supabase.rpc("reorder_todos", { p_todo_ids: orderedIds });
      error = result.error;
    }
  } else {
    return errorState("不明なToDo操作です。");
  }

  if (error) {
    console.error("Todo operation failed", {
      operation,
      code: error.code,
      message: error.message,
    });
    return errorState("ToDoを更新できませんでした。少し待ってから再度お試しください。");
  }

  revalidatePath("/");
  revalidatePath("/records");
  revalidatePath("/week");
  revalidatePath("/month");
  return { error: null, message: "保存しました。", reaction: null };
}
