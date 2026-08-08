import { CheckCircle2, Clock3, Coffee } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import {
  calculateTimeBank,
  formatDuration,
  formatTimeBank,
} from "@/lib/reports/calculations";
import type { DailyReport } from "@/lib/reports/types";

type TodaySummaryProps = {
  report: DailyReport;
  dailyTargetMinutes: number;
  completedTodoCount: number;
  todoCount: number;
};

export function TodaySummary({
  report,
  dailyTargetMinutes,
  completedTodoCount,
  todoCount,
}: TodaySummaryProps) {
  const timeBank = calculateTimeBank(
    report.workedMilliseconds,
    dailyTargetMinutes,
  );

  return (
    <Card className="today-summary" aria-labelledby="today-summary-title">
      <CardBody>
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">REVIEW</p>
            <h2 className="card__title" id="today-summary-title">
              今日の振り返り
            </h2>
          </div>
          <span className="time-bank" data-positive={timeBank >= 0}>
            {formatTimeBank(timeBank)}
          </span>
        </div>

        <dl className="summary-metrics">
          <div>
            <dt><Clock3 aria-hidden="true" />実勤務</dt>
            <dd className="pixel-font">{formatDuration(report.workedMilliseconds)}</dd>
          </div>
          <div>
            <dt><Coffee aria-hidden="true" />休憩</dt>
            <dd className="pixel-font">{formatDuration(report.breakMilliseconds)}</dd>
          </div>
          <div>
            <dt><CheckCircle2 aria-hidden="true" />完了ToDo</dt>
            <dd className="pixel-font">{completedTodoCount} / {todoCount}</dd>
          </div>
        </dl>

        <div className="category-breakdown">
          <h3>カテゴリ別作業時間</h3>
          {report.categoryDurations.length === 0 ? (
            <p className="empty-state">勤務を始めると、ここに内訳が表示されます。</p>
          ) : (
            <ul className="duration-list">
              {report.categoryDurations.map((duration) => (
                <li key={duration.categoryId ?? "uncategorized"}>
                  <span className="color-dot" data-color={duration.colorKey} />
                  <span>{duration.name}</span>
                  <strong>{formatDuration(duration.milliseconds)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
