"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

const REFRESH_DEBOUNCE_MILLISECONDS = 100;
const LOG_PREFIX = "[work-timer realtime]";

export function WorkTimerRealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (disposed || refreshTimer !== null) {
        return;
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        console.info(`${LOG_PREFIX} router.refresh`);
        router.refresh();
      }, REFRESH_DEBOUNCE_MILLISECONDS);
    };

    const handleChange = (payload: { eventType: string; table: string }) => {
      console.info(`${LOG_PREFIX} event ${payload.table}:${payload.eventType}`);
      scheduleRefresh();
    };

    const subscribe = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (disposed || error || !data.user) {
        if (!disposed) {
          console.error(`${LOG_PREFIX} could not identify the signed-in user`, error);
        }
        return;
      }

      const filter = `user_id=eq.${data.user.id}`;
      channel = supabase
        .channel(`work-timer:${data.user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "work_sessions", filter },
          handleChange,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "work_sessions", filter },
          handleChange,
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "work_segments", filter },
          handleChange,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "work_segments", filter },
          handleChange,
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "break_segments", filter },
          handleChange,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "break_segments", filter },
          handleChange,
        )
        .subscribe((status, subscribeError) => {
          if (status === "SUBSCRIBED") {
            console.info(`${LOG_PREFIX} subscribed`);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`${LOG_PREFIX} ${status}`, subscribeError);
          }
        });
    };

    void subscribe();

    return () => {
      disposed = true;
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [router]);

  return null;
}
