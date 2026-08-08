import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

import { GET } from "@/app/(auth)/auth/confirm/route";

function createRequest(search = ""): NextRequest {
  return new NextRequest(`http://127.0.0.1:3000/auth/confirm${search}`);
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.createClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mocks.exchangeCodeForSession,
      },
    });
    mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  });

  it("exchanges the PKCE code and redirects to a safe app path", async () => {
    const request = createRequest("?code=auth-code&next=%2Frecords");
    const response = await GET(request);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledOnce();
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(response.headers.get("location")).toBe(new URL("/records", request.url).toString());
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects a callback without a code", async () => {
    const request = createRequest();
    const response = await GET(request);

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      new URL("/login?error=confirm-failed", request.url).toString(),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("redirects to the login error when the code exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: new Error("Code exchange failed"),
    });

    const request = createRequest("?code=invalid-code");
    const response = await GET(request);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("invalid-code");
    expect(response.headers.get("location")).toBe(
      new URL("/login?error=confirm-failed", request.url).toString(),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects an external next URL", async () => {
    const request = createRequest(
      "?code=auth-code&next=https%3A%2F%2Fevil.example%2Fstolen",
    );
    const response = await GET(request);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(response.headers.get("location")).toBe(new URL("/", request.url).toString());
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
