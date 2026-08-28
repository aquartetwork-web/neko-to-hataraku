import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkTimerRealtimeRefresh } from "@/components/work-timer/work-timer-realtime-refresh";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  getUser: vi.fn(),
  refresh: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
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
  const callbacks = new Map<string, () => void>();
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks.clear();
    channel.on.mockReset();
    channel.subscribe.mockReset();
    channel.on.mockImplementation(
      (
        _type: string,
        filter: { event: string; table: string },
        callback: () => void,
      ) => {
        callbacks.set(`${filter.table}:${filter.event}`, callback);
        return channel;
      },
    );
    channel.subscribe.mockReturnValue(channel);
    mocks.channel.mockReset().mockReturnValue(channel);
    mocks.getUser.mockReset().mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mocks.refresh.mockReset();
    mocks.removeChannel.mockReset().mockResolvedValue("ok");
  });

  afterEach(() => {
    vi.useRealTimers();
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

    act(() => {
      callbacks.get("work_sessions:INSERT")?.();
      callbacks.get("work_segments:INSERT")?.();
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

    act(() => callbacks.get("work_sessions:UPDATE")?.());
    rendered!.unmount();
    act(() => vi.advanceTimersByTime(100));

    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });
});
