import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

function readSource(relativeUrl: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeUrl, import.meta.url)),
    "utf-8",
  );
}

describe("HomePage server/client boundaries", () => {
  it("executes the card key helper from a shared module, not a Client Component", () => {
    const pageSource = readSource("./page.tsx");
    const cardSource = readSource(
      "../../components/work-timer/work-timer-card.tsx",
    );
    const keySource = readSource("../../lib/work-timer/card-key.ts");

    expect(pageSource).toContain(
      'import { getWorkTimerCardKey } from "@/lib/work-timer/card-key";',
    );
    expect(pageSource).not.toMatch(
      /getWorkTimerCardKey[\s\S]*from "@\/components\/work-timer\/work-timer-card"/,
    );
    expect(cardSource.trimStart()).toMatch(/^"use client";/);
    expect(cardSource).not.toContain("getWorkTimerCardKey");
    expect(keySource.trimStart()).not.toMatch(/^["']use client["'];/);
  });
});
