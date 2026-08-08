import { CheckCircle2, Clock3, PiggyBank, Target } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  addAppDays,
  formatDateKeyLabel,
  getAppWeekRange,
} from "@/lib/datetime";
import { getReportBundle } from "@/lib/data/app-data";
import {
  buildDailyReports,
  formatDecimalHours,
  formatDuration,
  formatTimeBank,
  summarizeWeek,
} from "@/lib/reports/calculations";

export default async function WeekPage() {
  const { startDate, endDateExclusive } = getAppWeekRange();
  const bundle = await getReportBundle(startDate, endDateExclusive);
  const reports = buildDailyReports({
    startDate,
    endDateExclusive,
    nowMilliseconds: Date.parse(bundle.serverNow),
    workSegments: bundle.workSegments,
    breakSegments: bundle.breakSegments,
    todos: bundle.todos,
    categories: bundle.categories,
  });
  const summary = summarizeWeek(
    reports,
    bundle.settings.dailyTargetMinutes,
    bundle.settings.weeklyTargetMinutes,
  );
  const weeklyProgress = Math.min(
    100,
    (summary.totalWorked / summary.weeklyTarget) * 100,
  );

  return (
    <>
      <PageHeader
        eyebrow={`${formatDateKeyLabel(startDate)}〜${formatDateKeyLabel(addAppDays(endDateExclusive, -1))}`}
        title="今週"
        description="一週間のペースを、やわらかく見渡します。"
      />

      <Card className="report-hero">
        <CardBody>
          <p className="report-hero__label">今週の勤務時間</p>
          <p className="report-hero__value pixel-font">
            {formatDecimalHours(summary.totalWorked)}
            <span> / {formatDecimalHours(summary.weeklyTarget)}</span>
          </p>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="週間勤務目標"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(weeklyProgress)}
          >
            <span style={{ width: `${weeklyProgress}%` }} />
          </div>
          <p className="report-hero__note">
            {summary.remaining > 0 ? `目標まであと ${formatDuration(summary.remaining)}` : "今週の目標に届いています。"}
          </p>
        </CardBody>
      </Card>

      <dl className="stat-grid stat-grid--four">
        <div className="stat-card"><dt><Target aria-hidden="true" />目標達成日</dt><dd>{summary.targetDays}日</dd></div>
        <div className="stat-card"><dt><PiggyBank aria-hidden="true" />週間バランス</dt><dd data-positive={summary.timeBank >= 0}>{formatTimeBank(summary.timeBank)}</dd></div>
        <div className="stat-card"><dt><CheckCircle2 aria-hidden="true" />完了ToDo</dt><dd>{summary.completedTodos}件</dd></div>
        <div className="stat-card"><dt><Clock3 aria-hidden="true" />週間目標</dt><dd>{formatDecimalHours(summary.weeklyTarget)}</dd></div>
      </dl>

      <div className="report-grid">
        <Card>
          <CardBody>
            <h2 className="card__title">曜日別勤務時間</h2>
            <div className="day-bars">
              {reports.map((report) => {
                const ratio = report.workedMilliseconds / (bundle.settings.dailyTargetMinutes * 60_000);
                const barHeight = ratio <= 0
                  ? 0
                  : Math.max(3, Math.min(100, ratio * 100));
                return (
                  <div className="day-bar" key={report.date}>
                    <span>{formatDateKeyLabel(report.date).slice(-2, -1)}</span>
                    <div className="day-bar__track"><i style={{ height: `${barHeight}%` }} /></div>
                    <strong>{formatDuration(report.workedMilliseconds)}</strong>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="card__title">カテゴリ別（今週）</h2>
            {summary.categoryDurations.length === 0 ? (
              <p className="empty-state">カテゴリ別の記録はまだありません。</p>
            ) : (
              <ul className="rank-list">
                {summary.categoryDurations.map((duration, index) => (
                  <li key={duration.categoryId ?? "uncategorized"}>
                    <span className="rank-list__number">{index + 1}</span>
                    <span className="color-dot" data-color={duration.colorKey} />
                    <span>{duration.name}</span>
                    <strong>{formatDuration(duration.milliseconds)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
