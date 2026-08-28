import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkTimerRealtimeRefresh } from "@/components/work-timer/work-timer-realtime-refresh";
import { WorkTimerCard } from "@/components/work-timer/work-timer-card";
import { getWorkTimerCardKey } from "@/lib/work-timer/card-key";
import type { WorkTimerSnapshot } from "@/lib/work-timer/types";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  getUser: vi.fn(),
  refresh: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("next/navigation", () => {
  const router = { refresh: mocks.refresh };
  return { useRouter: () => router };
});

vi.mock("@/app/(app)/actions", () => ({
  performWorkTimerAction: async () => ({ error: null }),
  switchWorkCategory: async () => ({ error: null, message: null, reaction: null }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
}));

describe("WorkTimerRealtimeRefresh", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const callbacks = new Map<
    string,
    (payload: { eventType: string; table: string }) => void
  >();
  let subscriptionStatusCallback:
    | ((status: string, error?: unknown) => void)
    | undefined;
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks.clear();
    subscriptionStatusCallback = undefined;
    channel.on.mockReset();
    channel.subscribe.mockReset();
    channel.on.mockImplementation(
      (
        _type: string,
        filter: { event: string; table: string },
        callback: (payload: { eventType: string; table: string }) => void,
      ) => {
        callbacks.set(`${filter.table}:${filter.event}`, callback);
        return channel;
      },
    );
    channel.subscribe.mockImplementation((callback) => {
      subscriptionStatusCallback = callback;
      return channel;
    });
    mocks.channel.mockReset().mockReturnValue(channel);
    mocks.getUser.mockReset().mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mocks.refresh.mockReset();
    mocks.removeChannel.mockReset().mockResolvedValue("ok");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("subscribes only to the current user's timer tables and refreshes once", async () => {
    let rendered: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<WorkTimerRealtimeRefresh />);
      await Promise.resolve();
    });

    expect(mocks.channel).toHaveBeenCalledWith(`work-timer:${userId}`);
    expect(channel.on).toHaveBeenCalledTimes(6);
    expect(channel.on.mock.calls.map((call) => call[1])).toEqual([
      { event: "INSERT", schema: "public", table: "work_sessions", filter: `user_id=eq.${userId}` },
      { event: "UPDATE", schema: "public", table: "work_sessions", filter: `user_id=eq.${userId}` },
      { event: "INSERT", schema: "public", table: "work_segments", filter: `user_id=eq.${userId}` },
      { event: "UPDATE", schema: "public", table: "work_segments", filter: `user_id=eq.${userId}` },
      { event: "INSERT", schema: "public", table: "break_segments", filter: `user_id=eq.${userId}` },
      { event: "UPDATE", schema: "public", table: "break_segments", filter: `user_id=eq.${userId}` },
    ]);

    act(() => subscriptionStatusCallback?.("SUBSCRIBED"));
    expect(console.info).toHaveBeenCalledWith(
      "[work-timer realtime] subscribed",
    );

    act(() => {
      callbacks.get("work_sessions:INSERT")?.({
        eventType: "INSERT",
        table: "work_sessions",
      });
      callbacks.get("work_segments:INSERT")?.({
        eventType: "INSERT",
        table: "work_segments",
      });
      vi.advanceTimersByTime(100);
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    rendered!.unmount();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("cancels a pending refresh when unmounted", async () => {
    let rendered: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(<WorkTimerRealtimeRefresh />);
      await Promise.resolve();
    });

    act(() => callbacks.get("work_sessions:UPDATE")?.({
      eventType: "UPDATE",
      table: "work_sessions",
    }));
    rendered!.unmount();
    act(() => vi.advanceTimersByTime(100));

    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("applies refreshed timer props after a Realtime event", async () => {
    const serverNow = Date.parse("2026-08-08T12:00:00.000Z");
    const workingSnapshot: WorkTimerSnapshot = {
      serverNow: new Date(serverNow).toISOString(),
      dailyTargetMinutes: 360,
      session: {
        id: "session-1",
        workDate: "2026-08-08",
        startedAt: new Date(serverNow - 5_000).toISOString(),
        endedAt: null,
      },
      workSegments: [{
        id: "segment-1",
        startedAt: new Date(serverNow - 5_000).toISOString(),
        endedAt: null,
        categoryId: null,
        todoId: null,
      }],
      breakSegments: [],
      status: "working",
    };
    const stoppedAt = serverNow + 3_000;
    const clockedOutSnapshot: WorkTimerSnapshot = {
      ...workingSnapshot,
      serverNow: new Date(stoppedAt).toISOString(),
      session: workingSnapshot.session
        ? { ...workingSnapshot.session, endedAt: new Date(stoppedAt).toISOString() }
        : null,
      workSegments: workingSnapshot.workSegments.map((segment) => ({
        ...segment,
        endedAt: new Date(stoppedAt).toISOString(),
      })),
      status: "clocked_out",
    };
    vi.spyOn(Date, "now").mockReturnValue(serverNow);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const timerView = (snapshot: WorkTimerSnapshot, workedMilliseconds: number) => (
      <>
        <WorkTimerRealtimeRefresh />
        <WorkTimerCard
          key={getWorkTimerCardKey(snapshot)}
          snapshot={snapshot}
          categories={[]}
          todos={[]}
          dailyWorkedMillisecondsAtServerNow={workedMilliseconds}
          nextAppDayStartMilliseconds={serverNow + 12 * 60 * 60 * 1_000}
        />
      </>
    );

    let rendered: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(timerView(workingSnapshot, 5_000));
      await Promise.resolve();
    });
    mocks.refresh.mockImplementation(() => {
      rendered.rerender(timerView(clockedOutSnapshot, 8_000));
    });

    act(() => {
      callbacks.get("work_sessions:UPDATE")?.({
        eventType: "UPDATE",
        table: "work_sessions",
      });
      vi.advanceTimersByTime(100);
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText("本日の勤務終了")).toBeInTheDocument();
    expect(screen.getByText("00:00:08", { exact: false })).toBeInTheDocument();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
