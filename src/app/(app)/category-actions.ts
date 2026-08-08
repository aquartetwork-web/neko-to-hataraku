"use server";

import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type CategoryColor = Database["public"]["Enums"]["category_color"];
const COLORS: CategoryColor[] = ["main", "cyan", "yellow", "pink", "purple", "gray"];

function value(formData: FormData, key: string): string {
  return formData.get(key)?.toString().trim() ?? "";
}

function color(valueToCheck: string): CategoryColor | null {
  return COLORS.includes(valueToCheck as CategoryColor)
    ? (valueToCheck as CategoryColor)
    : null;
}

export async function performCategoryAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const operation = value(formData, "operation");
  const name = value(formData, "name");
  const categoryId = value(formData, "categoryId");
  const colorKey = color(value(formData, "colorKey"));
  const supabase = await createClient();
  let error: { code?: string; message: string } | null = null;

  if (operation === "add") {
    if (!name || name.length > 80 || !colorKey) {
      return { error: "カテゴリ名と色を確認してください。", message: null };
    }
    const { data: last, error: loadError } = await supabase
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    error = loadError;
    if (!error) {
      const result = await supabase.from("categories").insert({
        name,
        color_key: colorKey,
        sort_order: (last?.[0]?.sort_order ?? 0) + 10,
      });
      error = result.error;
    }
  } else if (operation === "edit") {
    if (!categoryId || !name || name.length > 80 || !colorKey) {
      return { error: "カテゴリの内容を確認してください。", message: null };
    }
    const result = await supabase
      .from("categories")
      .update({ name, color_key: colorKey })
      .eq("id", categoryId)
      .eq("archived", false);
    error = result.error;
  } else if (operation === "archive") {
    if (!categoryId) return { error: "カテゴリを確認できませんでした。", message: null };
    const result = await supabase
      .from("categories")
      .update({ archived: true })
      .eq("id", categoryId);
    error = result.error;
  } else {
    return { error: "不明なカテゴリ操作です。", message: null };
  }

  if (error) {
    console.error("Category operation failed", {
      operation,
      code: error.code,
      message: error.message,
    });
    return { error: "カテゴリを保存できませんでした。名前の重複も確認してください。", message: null };
  }

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/week");
  revalidatePath("/month");
  return {
    error: null,
    message: operation === "archive" ? "カテゴリをアーカイブしました。" : "カテゴリを保存しました。",
  };
}
