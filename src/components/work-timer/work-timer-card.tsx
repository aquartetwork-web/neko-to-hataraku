"use client";

import { Coffee, LogOut, Play, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";

import {
  performWorkTimerAction,
  switchWorkCategory,
} from "@/app/(app)/actions";
import { Card } from "@/components/ui/card";
import { WORK_TIMER_CONFIG } from "@/config/work-timer";
import { INITIAL_FORM_ACTION_STATE } from "@/lib/forms/action-state";
import type { CategorySummary, TodoSummary } from "@/lib/reports/types";
import { INITIAL_WORK_TIMER_ACTION_STATE } from "@/lib/work-timer/action-state";
import {
  calculateGoalProgress,
  calculateLiveDailyWorkedMilliseconds,
  formatElapsedTime,
  isLongRunningSession,
} from "@/lib/work-timer/calculations";
import { getCatMessage } from "@/lib/work-timer/cat-message";
import type { WorkTimerSnapshot } from "@/lib/work-timer/types";

type WorkTimerCardProps = {
  snapshot: WorkTimerSnapshot;
  categories: CategorySummary[];
  todos: TodoSummary[];
  dailyWorkedMillisecondsAtServerNow: number;
  nextAppDayStartMilliseconds: number;
};

const STATUS_LABEL = {
  not_started: "未勤務",
  working: "勤務中",
  on_break: "休憩中",
  clocked_out: "本日の勤務終了",
} as const;

function formatTarget(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h${remainder}m`;
}

export function WorkTimerCard({
  snapshot,
  categories,
  todos,
  dailyWorkedMillisecondsAtServerNow,
  nextAppDayStartMilliseconds,
}: WorkTimerCardProps) {
  const [actionState, formAction, isPending] = useActionState(
    performWorkTimerAction,
    INITIAL_WORK_TIMER_ACTION_STATE,
  );
  const [nowMilliseconds, setNowMilliseconds] = useState(() =>
    Date.parse(snapshot.serverNow),
  );
  const [categoryState, categoryAction, isCategoryPending] = useActionState(
    switchWorkCategory,
    INITIAL_FORM_ACTION_STATE,
  );

  useEffect(() => {
    if (snapshot.status === "not_started" || snapshot.status === "clocked_out") {
      return;
    }

    const serverBase = Date.parse(snapshot.serverNow);
    const clientBase = Date.now();
    let animationFrameId = 0;
    let lastRenderedTick = Number.NaN;

    const updateClock = () => {
      const nextNow = serverBase + (Date.now() - clientBase);
      const nextTick = Math.floor(
        nextNow / WORK_TIMER_CONFIG.tickIntervalMilliseconds,
      );

      if (nextTick !== lastRenderedTick) {
        lastRenderedTick = nextTick;
        setNowMilliseconds(nextNow);
      }

      animationFrameId = window.requestAnimationFrame(updateClock);
    };

    animationFrameId = window.requestAnimationFrame(updateClock);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [snapshot.serverNow, snapshot.status]);

  const workedMilliseconds = calculateLiveDailyWorkedMilliseconds(
    dailyWorkedMillisecondsAtServerNow,
    snapshot.status,
    Date.parse(snapshot.serverNow),
    nowMilliseconds,
    nextAppDayStartMilliseconds,
  );
  const progress = calculateGoalProgress(
    workedMilliseconds,
    snapshot.dailyTargetMinutes,
  );
  const longRunning = isLongRunningSession(snapshot.session, nowMilliseconds);
  const message = getCatMessage(snapshot, nowMilliseconds, progress);
  const currentSegment = [...snapshot.workSegments]
    .reverse()
    .find((segment) => segment.endedAt === null) ?? snapshot.workSegments.at(-1);
  const currentTodo = currentSegment?.todoId
    ? todos.find((todo) => todo.id === currentSegment.todoId)
    : null;
  const currentCategory = currentSegment?.categoryId
    ? categories.find((category) => category.id === currentSegment.categoryId)
    : null;
  const currentWorkLabel = currentTodo?.title ?? currentCategory?.name ?? "未分類";
  const activeCategories = categories.filter((category) => !category.archived);
  const anyPending = isPending || isCategoryPending;

  return (
    <Card className="work-timer-card" aria-labelledby="work-timer-title">
      <div className="work-timer-card__body">
        <div className="work-timer-card__topline">
          <div>
            <p className="work-timer-card__label" id="work-timer-title">
              今日の実勤務時間
            </p>
            <p
              className="work-timer-card__time pixel-font"
              aria-live="off"
              data-work-timer-clock
              data-clock-status={snapshot.status}
              data-clock-server-now={Date.parse(snapshot.serverNow)}
              data-clock-baseline={dailyWorkedMillisecondsAtServerNow}
              data-clock-reset-at={nextAppDayStartMilliseconds}
            >
              <span data-work-timer-value>
                {formatElapsedTime(workedMilliseconds)}
              </span>
              <span className="work-timer-card__target">
                {" "}/ {formatTarget(snapshot.dailyTargetMinutes)}
              </span>
            </p>
          </div>
          <span className={`timer-status timer-status--${snapshot.status}`}>
            {STATUS_LABEL[snapshot.status]}
          </span>
        </div>

        <div className="current-work">
          <span>現在作業</span>
          <strong>{currentWorkLabel}</strong>
        </div>

        {snapshot.status === "working" ? (
          <form action={categoryAction} className="category-switch-form">
            <label className="field-label">
              作業カテゴリを切り替える
              <select
                className="select-input"
                name="categoryId"
                defaultValue={currentSegment?.categoryId ?? ""}
                disabled={anyPending}
              >
                <option value="">未分類</option>
                {activeCategories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button category-switch-form__button"
              type="submit"
              disabled={anyPending}
            >
              切り替え
            </button>
          </form>
        ) : null}

        <div
          className="timer-gauge"
          role="progressbar"
          aria-label="1日の勤務目標"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className="timer-gauge__rail">
            <div className="timer-gauge__fill" style={{ width: `${progress}%` }} />
            <div className="timer-gauge__cat" style={{ left: `${progress}%` }}>
              <Image
                src="/icons/icon-192.png"
                width={64}
                height={64}
                alt="ゲージを進む白いドット絵の猫"
                priority
              />
            </div>
          </div>
          <div className="timer-gauge__scale" aria-hidden="true">
            <span>0h</span>
            <span>{formatTarget(snapshot.dailyTargetMinutes)}</span>
          </div>
        </div>

        <p className="cat-message pixel-font" aria-live="polite">
          {message}
        </p>

        {longRunning ? (
          <div className="timer-warning" role="alert">
            <TriangleAlert aria-hidden="true" />
            <div>
              <strong>長時間の勤務が続いています。</strong>
              <p>
                {WORK_TIMER_CONFIG.longSessionWarningHours}
                時間以上記録中です。退勤忘れでないか確認してください。
              </p>
            </div>
          </div>
        ) : null}

        <form action={formAction} className="timer-actions">
          {snapshot.status === "not_started" ? (
            <button
              className="primary-button timer-action timer-action--wide"
              type="submit"
              name="operation"
              value="start"
              disabled={anyPending}
            >
              <Play aria-hidden="true" />
              働く
            </button>
          ) : null}

          {snapshot.status === "working" ? (
            <>
              <button
                className="primary-button timer-action"
                type="submit"
                name="operation"
                value="pause"
                disabled={anyPending}
              >
                <Coffee aria-hidden="true" />
                休憩
              </button>
              <button
                className="secondary-button timer-action"
                type="submit"
                name="operation"
                value="stop"
                disabled={anyPending}
              >
                <LogOut aria-hidden="true" />
                退勤
              </button>
            </>
          ) : null}

          {snapshot.status === "on_break" ? (
            <>
              <button
                className="primary-button timer-action"
                type="submit"
                name="operation"
                value="resume"
                disabled={anyPending}
              >
                <Play aria-hidden="true" />
                再開
              </button>
              <button
                className="secondary-button timer-action"
                type="submit"
                name="operation"
                value="stop"
                disabled={anyPending}
              >
                <LogOut aria-hidden="true" />
                退勤
              </button>
            </>
          ) : null}

          {snapshot.status === "clocked_out" ? (
            <button
              className="primary-button timer-action timer-action--wide"
              type="submit"
              name="operation"
              value="start"
              disabled={anyPending}
            >
              <Play aria-hidden="true" />
              また働く
            </button>
          ) : null}
        </form>

        {anyPending ? (
          <p className="timer-feedback" role="status">
            サーバーへ記録しています…
          </p>
        ) : null}
        {actionState.error ? (
          <p className="timer-feedback timer-feedback--error" role="alert">
            {actionState.error}
          </p>
        ) : null}
        {categoryState.error ? (
          <p className="timer-feedback timer-feedback--error" role="alert">
            {categoryState.error}
          </p>
        ) : null}
        {!categoryState.error && categoryState.message ? (
          <p className="timer-feedback" role="status">
            {categoryState.message}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
