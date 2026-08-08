import { describe, expect, it } from "vitest";

import {
  getTodoCompletionUpdate,
  moveTodoIds,
  nextTodoSortOrder,
  normalizeTodoTitle,
} from "@/lib/todos/logic";

describe("todo logic", () => {
  it("normalizes valid titles and rejects empty titles", () => {
    expect(normalizeTodoTitle("  請求書を送る  ")).toBe("請求書を送る");
    expect(normalizeTodoTitle("   ")).toBeNull();
  });

  it("moves a todo without changing the supplied array", () => {
    const ids = ["a", "b", "c"];
    expect(moveTodoIds(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveTodoIds(ids, "b", "down")).toEqual(["a", "c", "b"]);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("keeps boundary items in place", () => {
    expect(moveTodoIds(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveTodoIds(["a", "b"], "b", "down")).toEqual(["a", "b"]);
  });

  it("allocates sort orders in stable increments", () => {
    expect(nextTodoSortOrder([])).toBe(10);
    expect(nextTodoSortOrder([20, 10, 40])).toBe(50);
  });

  it("creates constraint-safe completion updates", () => {
    const completedAt = "2026-08-08T01:00:00.000Z";
    expect(getTodoCompletionUpdate(false, completedAt)).toEqual({
      status: "done",
      completed_at: completedAt,
    });
    expect(getTodoCompletionUpdate(true, completedAt)).toEqual({
      status: "todo",
      completed_at: null,
    });
  });
});
