import { ArrowLeft, CheckCircle2, Clock3, Coffee } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DailyNoteForm } from "@/components/records/daily-note-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  addAppDays,
  formatAppDateKey,
  formatDateKeyLabel,
  startOfAppDay,
} from "@/lib/datetime";
import { getDailyNote, getReportBundle } from "@/lib/data/app-data";
import { buildDailyReports, formatDuration } from "@/lib/reports/calculations";
import { buildTimeline, formatTimelineTime } from "@/lib/reports/timeline";

type DailyRecordPageProps = {
  params: Promise<{ date: string }>;
};

export default async function DailyRecordPage({ params }: DailyRecordPageProps) {
  const { date } = await params;

  try {
    startOfAppDay(date);
  } catch {
    notFound();
  }

  const endDateExclusive = addAppDays(date, 1);
  const [bundle, note] = await Promise.all([
    getReportBundle(date, endDateExclusive),
    getDailyNote(date),
  ]);
  const report = buildDailyReports({
    startDate: date,
    endDateExclusive,
    nowMilliseconds: Date.parse(bundle.serverNow),
    workSegments: bundle.workSegments,
    breakSegments: bundle.breakSegments,
    todos: bundle.todos,
    categories: bundle.categories,
  })[0];
  const timeline = buildTimeline({
    date,
    sessions: bundle.sessions,
    workSegments: bundle.workSegments,
    breakSegments: bundle.breakSegments,
    categories: bundle.categories,
    todos: bundle.todos,
  });
  const completedTodos = bundle.todos.filter(
    (todo) => todo.completedAt && formatAppDateKey(todo.completedAt) === date,
  );

  return (
    <>
      <Link className="back-link" href="/records">
        <ArrowLeft aria-hidden="true" />記録一覧へ
      </Link>
      <PageHeader
        eyebrow="DAILY RECORD"
        title={formatDateKeyLabel(date)}
        description="勤務と作業内容を、時系列で確認します。"
      />

      <Card>
        <CardBody>
          <dl className="summary-metrics summary-metrics--two">
            <div>
              <dt><Clock3 aria-hidden="true" />実勤務</dt>
              <dd className="pixel-font">{formatDuration(report.workedMilliseconds)}</dd>
            </div>
            <div>
              <dt><Coffee aria-hidden="true" />休憩</dt>
              <dd className="pixel-font">{formatDuration(report.breakMilliseconds)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="record-detail-grid">
        <Card>
          <CardBody>
            <h2 className="card__title">タイムライン</h2>
            {timeline.length === 0 ? (
              <p className="empty-state">この日の勤務イベントはありません。</p>
            ) : (
              <ol className="timeline-list">
                {timeline.map((event, index) => (
                  <li data-kind={event.kind} key={`${event.at}-${index}`}>
                    <time>{formatTimelineTime(event)}</time>
                    <span className="timeline-list__dot" />
                    <div>
                      <strong>{event.label}</strong>
                      {event.detail ? <span>{event.detail}</span> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="card__title">カテゴリ内訳</h2>
            {report.categoryDurations.length === 0 ? (
              <p className="empty-state">作業時間の記録はありません。</p>
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

            <h2 className="card__title record-subheading">完了ToDo</h2>
            {completedTodos.length === 0 ? (
              <p className="empty-state">この日に完了したToDoはありません。</p>
            ) : (
              <ul className="completed-list">
                {completedTodos.map((todo) => (
                  <li key={todo.id}>
                    <CheckCircle2 aria-hidden="true" />
                    <span>{todo.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <DailyNoteForm date={date} body={note} />
        </CardBody>
      </Card>
    </>
  );
}
