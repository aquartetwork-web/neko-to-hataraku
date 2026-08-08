import { CheckCircle2, ChevronRight, Clock3 } from "lucide-react";
import Link from "next/link";

import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  addAppDays,
  formatAppDateKey,
  formatDateKeyLabel,
} from "@/lib/datetime";
import { getReportBundle } from "@/lib/data/app-data";
import { buildDailyReports, formatDuration } from "@/lib/reports/calculations";

export default async function RecordsPage() {
  const today = formatAppDateKey(new Date());
  const startDate = addAppDays(today, -30);
  const endDateExclusive = addAppDays(today, 1);
  const bundle = await getReportBundle(startDate, endDateExclusive);
  const reports = buildDailyReports({
    startDate,
    endDateExclusive,
    nowMilliseconds: Date.parse(bundle.serverNow),
    workSegments: bundle.workSegments,
    breakSegments: bundle.breakSegments,
    todos: bundle.todos,
    categories: bundle.categories,
  }).reverse();

  return (
    <>
      <PageHeader
        title="記録"
        description="直近31日分の仕事を、日ごとに振り返ります。"
      />
      <Card>
        <CardBody>
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">HISTORY</p>
              <h2 className="card__title">日別記録</h2>
            </div>
          </div>
          <ol className="record-list">
            {reports.map((report) => (
              <li key={report.date}>
                <Link href={`/records/${report.date}`} className="record-link">
                  <div>
                    <strong>{formatDateKeyLabel(report.date)}</strong>
                    <span className="record-link__meta">
                      <Clock3 aria-hidden="true" />
                      {formatDuration(report.workedMilliseconds)}
                    </span>
                  </div>
                  <span className="record-link__todo">
                    <CheckCircle2 aria-hidden="true" />
                    ToDo {report.completedTodoCount}
                  </span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </>
  );
}
