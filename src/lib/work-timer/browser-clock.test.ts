import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installWorkTimerBrowserClock } from "@/lib/work-timer/browser-clock";

const SERVER_NOW = Date.parse("2026-08-08T12:00:00.000Z");

describe("work timer browser clock", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(SERVER_NOW);
    document.body.innerHTML = `
      <p
        data-work-timer-clock
        data-clock-status="working"
        data-clock-server-now="${SERVER_NOW}"
        data-clock-baseline="5000"
        data-clock-reset-at="${SERVER_NOW + 12 * 60 * 60 * 1000}"
      >
        <span data-work-timer-value>00:00:05</span>
      </p>
    `;
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("updates the server-based elapsed time without React hydration", () => {
    cleanup = installWorkTimerBrowserClock(1_000);

    vi.advanceTimersByTime(1_000);

    expect(document.querySelector("[data-work-timer-value]")).toHaveTextContent(
      "00:00:06",
    );
    expect(document.querySelector("[data-work-timer-clock]")).toHaveAttribute(
      "data-clock-enhanced",
      "true",
    );
  });
});
