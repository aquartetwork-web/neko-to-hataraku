import { TodaySummary } from "@/components/reports/today-summary";
import { TodayTodoCard } from "@/components/todo/today-todo-card";
import { WorkTimerCard } from "@/components/work-timer/work-timer-card";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  addAppDays,
  formatAppDate,
  formatAppDateKey,
  startOfAppDay,
} from "@/lib/datetime";
import { getReportBundle } from "@/lib/data/app-data";
import { buildDailyReports } from "@/lib/reports/calculations";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getWorkTimerSnapshot } from "@/lib/work-timer/data";

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  let snapshot = null;
  let reportBundle = null;
  let loadFailed = false;
  const today = formatAppDateKey(new Date());

  if (configured) {
    try {
      [snapshot, reportBundle] = await Promise.all([
        getWorkTimerSnapshot(),
        getReportBundle(today, addAppDays(today, 1)),
      ]);
    } catch (error) {
      loadFailed = true;
      console.error("Failed to load work timer state", error);
    }
  }

  const data = !loadFailed && snapshot && reportBundle
    ? { snapshot, reportBundle }
    : null;
  const todayTodos = reportBundle?.todos
    .filter((todo) => todo.scheduledFor === today)
    .sort((left, right) => left.sortOrder - right.sortOrder) ?? [];
  const todayReport = data
    ? buildDailyReports({
        startDate: today,
        endDateExclusive: addAppDays(today, 1),
        nowMilliseconds: Date.parse(data.snapshot.serverNow),
        workSegments: data.reportBundle.workSegments,
        breakSegments: data.reportBundle.breakSegments,
        todos: data.reportBundle.todos,
        categories: data.reportBundle.categories,
      })[0]
    : null;

  const timerContent = !configured ? (
    <Card>
      <CardBody>
        <h2 className="card__title">Supabaseの接続設定が必要です</h2>
        <p className="card__description">
          .env.localにHosted SupabaseのURLとPublishable Keyを設定すると、勤務タイマーを利用できます。
        </p>
        <div className="notice">接続未設定のため、勤務操作は無効です。</div>
      </CardBody>
    </Card>
  ) : !data ? (
    <Card>
      <CardBody>
        <h2 className="card__title">勤務状態を読み込めませんでした</h2>
        <p className="card__description">
          Phase 2 migrationが適用済みか、Supabaseへの接続を確認してください。
        </p>
        <div className="notice notice--error">
          状態を推測せず、サーバーの記録を取得できるまで操作を停止しています。
        </div>
      </CardBody>
    </Card>
  ) : (
    <WorkTimerCard
      snapshot={data.snapshot}
      categories={data.reportBundle.categories}
      todos={data.reportBundle.todos}
      dailyWorkedMillisecondsAtServerNow={todayReport?.workedMilliseconds ?? 0}
      nextAppDayStartMilliseconds={startOfAppDay(addAppDays(today, 1)).getTime()}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow={formatAppDate(new Date())}
        title="今日の仕事"
        description="猫と一緒に、今日の勤務を記録します。"
      />
      {timerContent}
      {data && todayReport ? (
        <div className="home-detail-grid">
          <TodayTodoCard
            date={today}
            todos={todayTodos}
            categories={data.reportBundle.categories}
          />
          <TodaySummary
            report={todayReport}
            dailyTargetMinutes={data.reportBundle.settings.dailyTargetMinutes}
            completedTodoCount={todayTodos.filter((todo) => todo.status === "done").length}
            todoCount={todayTodos.length}
          />
        </div>
      ) : null}
    </>
  );
}
