type SiteOriginOptions = {
  configuredSiteUrl?: string;
  vercelUrl?: string;
  requestOrigin?: string | null;
};

function normalizeHttpOrigin(value?: string | null): string | null {
  const candidate = value?.trim();

  if (!candidate) {
    return null;
  }

  const withProtocol = candidate.startsWith("http://") || candidate.startsWith("https://")
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function resolveSiteOrigin({
  configuredSiteUrl,
  vercelUrl,
  requestOrigin,
}: SiteOriginOptions): string | null {
  return (
    normalizeHttpOrigin(configuredSiteUrl) ??
    normalizeHttpOrigin(vercelUrl) ??
    normalizeHttpOrigin(requestOrigin)
  );
}

export function buildAuthConfirmUrl(origin: string): string {
  return new URL("/auth/confirm", origin).toString();
}
