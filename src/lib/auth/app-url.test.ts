import { describe, expect, it } from "vitest";

import { buildAuthConfirmUrl, resolveSiteOrigin } from "@/lib/auth/app-url";

describe("resolveSiteOrigin", () => {
  it("prefers an explicitly configured production URL", () => {
    expect(
      resolveSiteOrigin({
        configuredSiteUrl: "https://neko.example.com/path",
        vercelUrl: "preview.vercel.app",
        requestOrigin: "http://localhost:3000",
      }),
    ).toBe("https://neko.example.com");
  });

  it("uses the Vercel URL when no site URL is configured", () => {
    expect(resolveSiteOrigin({ vercelUrl: "neko-preview.vercel.app" })).toBe(
      "https://neko-preview.vercel.app",
    );
  });

  it("uses the request origin during local development", () => {
    expect(resolveSiteOrigin({ requestOrigin: "http://localhost:3000" })).toBe(
      "http://localhost:3000",
    );
  });

  it("returns null for unsupported URLs", () => {
    expect(resolveSiteOrigin({ configuredSiteUrl: "javascript:alert(1)" })).toBeNull();
  });
});

describe("buildAuthConfirmUrl", () => {
  it("builds the server-side email confirmation endpoint", () => {
    expect(buildAuthConfirmUrl("https://neko.example.com")).toBe(
      "https://neko.example.com/auth/confirm",
    );
  });
});
