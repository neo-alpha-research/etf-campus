export function safeReturnTo(value: string | null | undefined, fallback = "/") {
  const candidate = String(value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  return candidate;
}

export function withReturnTo(path: string, returnTo: string) {
  const target = safeReturnTo(returnTo);
  return `${path}?returnTo=${encodeURIComponent(target)}`;
}
