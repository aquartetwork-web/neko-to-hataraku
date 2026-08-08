"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import { saveDailyNote } from "@/app/(app)/record-actions";
import { INITIAL_FORM_ACTION_STATE } from "@/lib/forms/action-state";

type DailyNoteFormProps = {
  date: string;
  body: string;
};

export function DailyNoteForm({ date, body }: DailyNoteFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveDailyNote,
    INITIAL_FORM_ACTION_STATE,
  );

  return (
    <form action={formAction} className="note-form">
      <input type="hidden" name="noteDate" value={date} />
      <label className="field-label">
        メモ
        <textarea
          className="textarea-input"
          name="body"
          defaultValue={body}
          maxLength={2_000}
          rows={5}
          placeholder="今日のことを短く残せます。"
        />
      </label>
      <button className="secondary-button" type="submit" disabled={isPending}>
        <Save aria-hidden="true" />
        メモを保存
      </button>
      {state.error ? <p className="form-feedback form-feedback--error" role="alert">{state.error}</p> : null}
      {!state.error && state.message ? <p className="form-feedback" role="status">{state.message}</p> : null}
    </form>
  );
}
