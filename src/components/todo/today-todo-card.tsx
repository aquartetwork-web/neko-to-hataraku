"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Pencil,
  Play,
  Plus,
} from "lucide-react";
import { useActionState } from "react";

import { performTodoAction } from "@/app/(app)/todo-actions";
import { Card, CardBody } from "@/components/ui/card";
import { INITIAL_FORM_ACTION_STATE } from "@/lib/forms/action-state";
import type { CategorySummary, TodoSummary } from "@/lib/reports/types";

type TodayTodoCardProps = {
  date: string;
  todos: TodoSummary[];
  categories: CategorySummary[];
};

export function TodayTodoCard({ date, todos, categories }: TodayTodoCardProps) {
  const [state, formAction, isPending] = useActionState(
    performTodoAction,
    INITIAL_FORM_ACTION_STATE,
  );
  const activeCategories = categories.filter((category) => !category.archived);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <Card className="todo-card" aria-labelledby="today-todo-title">
      <CardBody>
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">TODAY</p>
            <h2 className="card__title" id="today-todo-title">今日のToDo</h2>
          </div>
          <span className="count-chip">
            {todos.filter((todo) => todo.status === "done").length} / {todos.length}
          </span>
        </div>

        {todos.length === 0 ? (
          <p className="empty-state">今日やることを、ひとつだけ書いてみましょう。</p>
        ) : (
          <ul className="todo-list">
            {todos.map((todo, index) => {
              const category = todo.categoryId ? categoryById.get(todo.categoryId) : null;
              const done = todo.status === "done";
              const categoryArchived = category?.archived ?? false;

              return (
                <li className="todo-item" data-status={todo.status} key={todo.id}>
                  <form action={formAction}>
                    <input type="hidden" name="operation" value="toggle" />
                    <input type="hidden" name="todoId" value={todo.id} />
                    <button
                      className="todo-check"
                      type="submit"
                      disabled={isPending}
                      aria-label={done ? `${todo.title}を未完了に戻す` : `${todo.title}を完了する`}
                    >
                      {done ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
                    </button>
                  </form>

                  <div className="todo-item__content">
                    <div className="todo-item__title-row">
                      {todo.status === "doing" ? <Play aria-label="作業中" /> : null}
                      <span className="todo-item__title">{todo.title}</span>
                    </div>
                    <span className="category-chip" data-color={category?.colorKey ?? "gray"}>
                      {category
                        ? `${category.name}${categoryArchived ? "（アーカイブ済み）" : ""}`
                        : "未分類"}
                    </span>
                  </div>

                  <div className="todo-item__actions">
                    {!done ? (
                      <form action={formAction}>
                        <input type="hidden" name="operation" value="start" />
                        <input type="hidden" name="todoId" value={todo.id} />
                        <button
                          className="icon-button icon-button--start"
                          type="submit"
                          disabled={isPending || categoryArchived}
                          aria-label={categoryArchived
                            ? `${todo.title}はカテゴリを変更してから開始できます`
                            : `${todo.title}を開始`}
                          title={categoryArchived ? "カテゴリを変更してから開始してください" : undefined}
                        >
                          <Play aria-hidden="true" />
                        </button>
                      </form>
                    ) : null}
                    <form action={formAction}>
                      <input type="hidden" name="operation" value="move" />
                      <input type="hidden" name="todoId" value={todo.id} />
                      <input type="hidden" name="scheduledFor" value={date} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        className="icon-button"
                        type="submit"
                        disabled={isPending || index === 0}
                        aria-label={`${todo.title}を上へ`}
                      >
                        <ChevronUp aria-hidden="true" />
                      </button>
                    </form>
                    <form action={formAction}>
                      <input type="hidden" name="operation" value="move" />
                      <input type="hidden" name="todoId" value={todo.id} />
                      <input type="hidden" name="scheduledFor" value={date} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        className="icon-button"
                        type="submit"
                        disabled={isPending || index === todos.length - 1}
                        aria-label={`${todo.title}を下へ`}
                      >
                        <ChevronDown aria-hidden="true" />
                      </button>
                    </form>
                  </div>

                  <details className="todo-edit">
                    <summary><Pencil aria-hidden="true" />編集</summary>
                    <form action={formAction} className="compact-form">
                      <input type="hidden" name="operation" value="edit" />
                      <input type="hidden" name="todoId" value={todo.id} />
                      <label className="field-label">
                        タイトル
                        <input className="text-input" name="title" defaultValue={todo.title} maxLength={240} required />
                      </label>
                      <label className="field-label">
                        カテゴリ
                        <select className="select-input" name="categoryId" defaultValue={todo.categoryId ?? ""}>
                          <option value="">未分類</option>
                          {activeCategories.map((item) => (
                            <option value={item.id} key={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </label>
                      <button className="secondary-button" type="submit" disabled={isPending}>保存</button>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        <form action={formAction} className="todo-add-form">
          <input type="hidden" name="operation" value="add" />
          <input type="hidden" name="scheduledFor" value={date} />
          <label className="field-label todo-add-form__title">
            ToDoを追加
            <input className="text-input" name="title" maxLength={240} placeholder="例：請求書を送る" required />
          </label>
          <label className="field-label">
            カテゴリ
            <select className="select-input" name="categoryId" defaultValue="">
              <option value="">未分類</option>
              {activeCategories.map((category) => (
                <option value={category.id} key={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={isPending}>
            <Plus aria-hidden="true" />追加
          </button>
        </form>

        {state.reaction ? <p className="cat-reaction pixel-font">{state.reaction}</p> : null}
        {state.error ? <p className="form-feedback form-feedback--error" role="alert">{state.error}</p> : null}
        {!state.error && state.message ? <p className="form-feedback" role="status">{state.message}</p> : null}
      </CardBody>
    </Card>
  );
}
