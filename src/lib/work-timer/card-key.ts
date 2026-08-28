import type { WorkTimerSnapshot } from "@/lib/work-timer/types";

export function getWorkTimerCardKey(snapshot: WorkTimerSnapshot): string {
  return [
    snapshot.session?.id ?? "no-session",
    snapshot.status,
    snapshot.workSegments.at(-1)?.id ?? "no-work-segment",
    snapshot.breakSegments.at(-1)?.id ?? "no-break-segment",
  ].join(":");
}
