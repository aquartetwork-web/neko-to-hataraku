export function normalizeTodoTitle(value: FormDataEntryValue | null): string | null {
  const title = typeof value === "string" ? value.trim() : "";
  return title.length >= 1 && title.length <= 240 ? title : null;
}

export function moveTodoIds(
  ids: string[],
  targetId: string,
  direction: "up" | "down",
): string[] {
  const index = ids.indexOf(targetId);
  if (index < 0) return ids;
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= ids.length) return ids;

  const result = [...ids];
  [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
  return result;
}

export function nextTodoSortOrder(sortOrders: number[]): number {
  return (sortOrders.length > 0 ? Math.max(...sortOrders) : 0) + 10;
}

export function getTodoCompletionUpdate(
  currentlyDone: boolean,
  completedAt: string,
): { status: "todo" | "done"; completed_at: string | null } {
  return currentlyDone
    ? { status: "todo", completed_at: null }
    : { status: "done", completed_at: completedAt };
}
