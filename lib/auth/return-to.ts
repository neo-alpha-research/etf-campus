const DISALLOWED_PREFIXES = ["/api/", "/api", "/login", "/register", "/auth/"];
const MAX_RETURN_TO_LENGTH = 512;

export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value || typeof value !== "string") return fallback;
  const candidate = value.trim();

  // 1. Length constraint
  if (candidate.length === 0 || candidate.length > MAX_RETURN_TO_LENGTH) {
    return fallback;
  }

  // 2. Control characters or encoded path bypasses
  if (/[\x00-\x1F\x7F]/.test(candidate)) {
    return fallback;
  }
  if (/%0[0-9a-fA-F]|%1[0-9a-fA-F]/i.test(candidate)) {
    return fallback;
  }

  // 3. Must strictly begin with a single slash, no backslashes, no scheme-relative //
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }

  // 4. Decode checks for hidden backslashes or double slashes
  try {
    const decoded = decodeURIComponent(candidate);
    if (decoded.includes("\\") || decoded.startsWith("//")) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  // 5. URL normalization to ensure origin is strictly retained
  try {
    const baseOrigin = "http://localhost";
    const parsed = new URL(candidate, baseOrigin);
    if (parsed.origin !== baseOrigin) {
      return fallback;
    }

    const normalizedPath = parsed.pathname;

    // 6. Block sensitive endpoints from being returnTo targets
    for (const disallowed of DISALLOWED_PREFIXES) {
      if (normalizedPath === disallowed || normalizedPath.startsWith(disallowed.endsWith("/") ? disallowed : `${disallowed}/`)) {
        return fallback;
      }
    }

    const destination = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return destination;
  } catch {
    return fallback;
  }
}

export function withReturnTo(path: string, returnTo: string): string {
  const target = safeReturnTo(returnTo);
  return `${path}?returnTo=${encodeURIComponent(target)}`;
}
