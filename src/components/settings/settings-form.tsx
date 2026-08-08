"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import { saveSettings } from "@/app/(app)/settings-actions";
import { Card, CardBody } from "@/components/ui/card";
import { INITIAL_FORM_ACTION_STATE } from "@/lib/forms/action-state";
import type { AppSettings } from "@/lib/reports/types";

type SettingsFormProps = {
  settings: AppSettings;
};

export function SettingsForm({ settings }: SettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveSettings,
    INITIAL_FORM_ACTION_STATE,
  );

  return (
    <Card>
      <CardBody>
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">PROFILE & GOALS</p>
            <h2 className="card__title">猫と目標</h2>
          </div>
        </div>
        <form action={formAction} className="settings-form">
          <label className="field-label settings-form__wide">
            猫の名前
            <input className="text-input" name="catName" defaultValue={settings.catName} maxLength={40} required />
          </label>
          <label className="field-label">
            1日の最低ライン（分）
            <input className="text-input" name="dailyMinimumMinutes" type="number" min="0" max="1440" step="15" defaultValue={settings.dailyMinimumMinutes} required />
          </label>
          <label className="field-label">
            1日の目標（分）
            <input className="text-input" name="dailyTargetMinutes" type="number" min="1" max="1440" step="15" defaultValue={settings.dailyTargetMinutes} required />
          </label>
          <label className="field-label settings-form__wide">
            週間目標（分）
            <input className="text-input" name="weeklyTargetMinutes" type="number" min="1" max="10080" step="30" defaultValue={settings.weeklyTargetMinutes} required />
          </label>
          <button className="primary-button settings-form__wide" type="submit" disabled={isPending}>
            <Save aria-hidden="true" />設定を保存
          </button>
          {state.error ? <p className="form-feedback form-feedback--error settings-form__wide" role="alert">{state.error}</p> : null}
          {!state.error && state.message ? <p className="form-feedback settings-form__wide" role="status">{state.message}</p> : null}
        </form>
      </CardBody>
    </Card>
  );
}
