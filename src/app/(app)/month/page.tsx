import { CalendarDays, CheckCircle2, Clock3, Sunrise } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAppMonthRange, startOfAppDay } from "@/lib/datetime";
import { getReportBundle } from "@/lib/data/app-data";
import {
  buildDailyReports,
  formatDecimalHours,
  formatDuration,
  summarizeMonth,
} from "@/lib/reports/calculations";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

export default async function MonthPage() {
  const { startDate, endDateExclusive } = getAppMonthRange();
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
  const summary = summarizeMonth(reports);
  const categories = summary.categoryDurations.slice(0, 5);
  const [year, month] = startDate.split("-");
  const firstWeekdayOffset = (startOfAppDay(startDate).getDay() + 6) % 7;

  return (
    <>
      <PageHeader
        eyebrow={`${year}年${Number(month)}月`}
        title="今月"
        description="今月の働き方を、カレンダーで俯瞰します。"
      />

      <dl className="stat-grid stat-grid--four">
        <div className="stat-card"><dt><Clock3 aria-hidden="true" />月間勤務</dt><dd>{formatDecimalHours(summary.totalWorked)}</dd></div>
        <div className="stat-card"><dt><CalendarDays aria-hidden="true" />稼働日</dt><dd>{summary.activeDays}日</dd></div>
        <div className="stat-card"><dt><Sunrise aria-hidden="true" />平均勤務</dt><dd>{formatDuration(summary.averageWorked)}</dd></div>
        <div className="stat-card"><dt><CheckCircle2 aria-hidden="true" />完了ToDo</dt><dd>{summary.completedTodos}件</dd></div>
      </dl>

      <div className="report-grid report-grid--month">
        <Card>
          <CardBody>
            <h2 className="card__title">勤務時間カレンダー</h2>
            <div className="month-calendar">
              {WEEKDAYS.map((weekday) => <span className="month-calendar__weekday" key={weekday}>{weekday}</span>)}
              {Array.from({ length: firstWeekdayOffset }, (_, index) => (
                <span className="month-calendar__blank" aria-hidden="true" key={`blank-${index}`} />
              ))}
              {reports.map((report) => {
                const targetReached = report.workedMilliseconds >= bundle.settings.dailyTargetMinutes * 60_000;
                return (
                  <div
                    className="month-calendar__day"
                    data-worked={report.workedMilliseconds > 0}
                    data-reached={targetReached}
                    aria-label={`${report.date} ${formatDuration(report.workedMilliseconds)}`}
                    key={report.date}
                  >
                    <strong>{Number(report.date.slice(-2))}</strong>
                    <span>{report.workedMilliseconds > 0 ? formatDuration(report.workedMilliseconds) : "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="calendar-legend">
              <span><i data-color="cyan" />勤務日</span>
              <span><i data-color="main" />目標達成</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="card__title">よく取り組んだこと</h2>
            {categories.length === 0 ? (
              <p className="empty-state">作業記録がたまると、上位カテゴリを表示します。</p>
            ) : (
              <ol className="rank-list">
                {categories.map((duration, index) => (
                  <li key={duration.categoryId ?? "uncategorized"}>
                    <span className="rank-list__number">{index + 1}</span>
                    <span className="color-dot" data-color={duration.colorKey} />
                    <span>{duration.name}</span>
                    <strong>{formatDecimalHours(duration.milliseconds)}</strong>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
