"use client";

import { Archive, Pencil, Plus } from "lucide-react";
import { useActionState } from "react";

import { performCategoryAction } from "@/app/(app)/category-actions";
import { Card, CardBody } from "@/components/ui/card";
import { INITIAL_FORM_ACTION_STATE } from "@/lib/forms/action-state";
import type { CategoryColor, CategorySummary } from "@/lib/reports/types";

const COLORS: Array<{ value: CategoryColor; label: string }> = [
  { value: "main", label: "青緑" },
  { value: "cyan", label: "水色" },
  { value: "yellow", label: "黄色" },
  { value: "pink", label: "ピンク" },
  { value: "purple", label: "紫" },
  { value: "gray", label: "グレー" },
];

type CategoryManagerProps = {
  categories: CategorySummary[];
};

export function CategoryManager({ categories }: CategoryManagerProps) {
  const [state, formAction, isPending] = useActionState(
    performCategoryAction,
    INITIAL_FORM_ACTION_STATE,
  );
  const active = categories.filter((category) => !category.archived);
  const archived = categories.filter((category) => category.archived);

  return (
    <Card>
      <CardBody>
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">CATEGORIES</p>
            <h2 className="card__title">作業カテゴリ</h2>
          </div>
          <span className="count-chip">{active.length}</span>
        </div>

        <ul className="category-manager-list">
          {active.map((category) => (
            <li key={category.id}>
              <span className="color-dot" data-color={category.colorKey} />
              <strong>{category.name}</strong>
              <details>
                <summary className="icon-button"><Pencil aria-hidden="true" /><span className="sr-only">{category.name}を編集</span></summary>
                <form action={formAction} className="compact-form category-edit-form">
                  <input type="hidden" name="operation" value="edit" />
                  <input type="hidden" name="categoryId" value={category.id} />
                  <label className="field-label">カテゴリ名<input className="text-input" name="name" defaultValue={category.name} maxLength={80} required /></label>
                  <label className="field-label">色<select className="select-input" name="colorKey" defaultValue={category.colorKey}>{COLORS.map((color) => <option value={color.value} key={color.value}>{color.label}</option>)}</select></label>
                  <button className="secondary-button" type="submit" disabled={isPending}>変更を保存</button>
                </form>
              </details>
              <form action={formAction}>
                <input type="hidden" name="operation" value="archive" />
                <input type="hidden" name="categoryId" value={category.id} />
                <button className="icon-button icon-button--danger" type="submit" disabled={isPending} aria-label={`${category.name}をアーカイブ`}>
                  <Archive aria-hidden="true" />
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={formAction} className="category-add-form">
          <input type="hidden" name="operation" value="add" />
          <label className="field-label">カテゴリ名<input className="text-input" name="name" maxLength={80} placeholder="例：資料作り" required /></label>
          <label className="field-label">色<select className="select-input" name="colorKey" defaultValue="cyan">{COLORS.map((color) => <option value={color.value} key={color.value}>{color.label}</option>)}</select></label>
          <button className="primary-button" type="submit" disabled={isPending}><Plus aria-hidden="true" />追加</button>
        </form>

        {archived.length > 0 ? (
          <details className="archived-categories">
            <summary>アーカイブ済み（{archived.length}）</summary>
            <ul>{archived.map((category) => <li key={category.id}><span className="color-dot" data-color="gray" />{category.name}</li>)}</ul>
          </details>
        ) : null}
        {state.error ? <p className="form-feedback form-feedback--error" role="alert">{state.error}</p> : null}
        {!state.error && state.message ? <p className="form-feedback" role="status">{state.message}</p> : null}
      </CardBody>
    </Card>
  );
}
