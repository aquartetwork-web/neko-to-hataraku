import { CAT_MESSAGES, type CatMessageKey } from "@/config/cat-messages";
import { WORK_TIMER_CONFIG } from "@/config/work-timer";
import type { WorkTimerSnapshot } from "@/lib/work-timer/types";

export function getCatMessageKey(
  snapshot: WorkTimerSnapshot,
  nowMilliseconds: number,
  progress: number,
): CatMessageKey {
  if (snapshot.status === "not_started") {
    return "notWorking";
  }

  if (snapshot.status === "clocked_out") {
    return "clockedOut";
  }

  if (snapshot.status === "on_break") {
    return "resting";
  }

  if (progress >= 100) {
    return "goalReached";
  }

  const sessionStartedAt = snapshot.session
    ? Date.parse(snapshot.session.startedAt)
    : Number.NEGATIVE_INFINITY;
  const startedWindowMilliseconds =
    WORK_TIMER_CONFIG.startedMessageWindowSeconds * 1_000;

  if (nowMilliseconds - sessionStartedAt < startedWindowMilliseconds) {
    return "started";
  }

  return "working";
}

export function getCatMessage(
  snapshot: WorkTimerSnapshot,
  nowMilliseconds: number,
  progress: number,
): string {
  return CAT_MESSAGES[getCatMessageKey(snapshot, nowMilliseconds, progress)][0];
}

