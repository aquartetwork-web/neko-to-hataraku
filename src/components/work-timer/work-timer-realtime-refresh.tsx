"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

const REFRESH_DEBOUNCE_MILLISECONDS = 100;

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
        router.refresh();
      }, REFRESH_DEBOUNCE_MILLISECONDS);
    };

    const subscribe = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (disposed || error || !data.user) {
        return;
      }

      const filter = `user_id=eq.${data.user.id}`;
      channel = supabase
        .channel(`work-timer:${data.user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "work_sessions", filter },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "work_sessions", filter },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "work_segments", filter },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "work_segments", filter },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "break_segments", filter },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "break_segments", filter },
          scheduleRefresh,
        )
        .subscribe();
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
