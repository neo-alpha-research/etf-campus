export type MutationOutcome = "updated" | "forbidden" | "not_found";

export function readBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

export function mutationOutcome(affected: boolean, resourceExists: boolean): MutationOutcome {
  if (affected) return "updated";
  return resourceExists ? "forbidden" : "not_found";
}

export function errorResponse(
  status: number,
  code: "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "RATE_LIMITED" | "CAPTCHA_REQUIRED" | "CONFIGURATION_ERROR" | "UNAVAILABLE",
  message: string,
) {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function noStoreHeaders(init: HeadersInit = {}) {
  return {
    ...init,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  };
}
