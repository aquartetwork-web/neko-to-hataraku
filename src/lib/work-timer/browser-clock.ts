import { WORK_TIMER_CONFIG } from "@/config/work-timer";

type WorkTimerClockWindow = Window & {
  __nekoWorkTimerClockInstalled?: boolean;
};

export function installWorkTimerBrowserClock(
  tickMilliseconds = WORK_TIMER_CONFIG.tickIntervalMilliseconds,
): () => void {
  const clockWindow = window as WorkTimerClockWindow;
  if (clockWindow.__nekoWorkTimerClockInstalled) {
    return () => undefined;
  }
  clockWindow.__nekoWorkTimerClockInstalled = true;

  const formatElapsed = (milliseconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  };

  const updateClock = (element: HTMLElement) => {
    const valueElement = element.querySelector<HTMLElement>(
      "[data-work-timer-value]",
    );
    const serverNow = Number(element.dataset.clockServerNow);
    const baseline = Number(element.dataset.clockBaseline);
    const resetAt = Number(element.dataset.clockResetAt);
    const status = element.dataset.clockStatus;

    if (
      !valueElement
      || !Number.isFinite(serverNow)
      || !Number.isFinite(baseline)
      || !Number.isFinite(resetAt)
    ) {
      return;
    }

    const now = Date.now();
    const dayMilliseconds = 24 * 60 * 60 * 1_000;
    const workedMilliseconds = now >= resetAt
      ? status === "working"
        ? Math.max(0, now - resetAt) % dayMilliseconds
        : 0
      : Math.max(0, baseline)
        + (status === "working" ? Math.max(0, now - serverNow) : 0);
    const nextText = formatElapsed(workedMilliseconds);

    if (valueElement.textContent !== nextText) {
      valueElement.textContent = nextText;
    }
    element.dataset.clockEnhanced = "true";
  };

  const updateAllClocks = () => {
    document.querySelectorAll<HTMLElement>("[data-work-timer-clock]")
      .forEach(updateClock);
  };

  updateAllClocks();
  const intervalId = window.setInterval(updateAllClocks, tickMilliseconds);
  const observer = new MutationObserver(updateAllClocks);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      "data-clock-status",
      "data-clock-server-now",
      "data-clock-baseline",
      "data-clock-reset-at",
    ],
    childList: true,
    subtree: true,
  });
  window.addEventListener("pageshow", updateAllClocks);
  document.addEventListener("visibilitychange", updateAllClocks);

  return () => {
    window.clearInterval(intervalId);
    observer.disconnect();
    window.removeEventListener("pageshow", updateAllClocks);
    document.removeEventListener("visibilitychange", updateAllClocks);
    delete clockWindow.__nekoWorkTimerClockInstalled;
  };
}

export const WORK_TIMER_BROWSER_SCRIPT =
  `(${installWorkTimerBrowserClock.toString()})(${WORK_TIMER_CONFIG.tickIntervalMilliseconds});`;
