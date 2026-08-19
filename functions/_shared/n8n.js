const N8N_TIMEOUT_MS = 5000;

function pickWebhookConfig(env, overrides = {}) {
  return {
    url: String(overrides.url ?? env.N8N_AUTH_WEBHOOK_URL ?? ""),
    secret: String(overrides.secret ?? env.N8N_WEBHOOK_SECRET ?? ""),
    required: overrides.required ?? env.N8N_WEBHOOK_REQUIRED === "true",
  };
}

export async function emitN8nAuthEvent(env, event, data, overrides = {}) {
  const config = pickWebhookConfig(env, overrides);
  if (!config.url) {
    if (config.required) throw new Error("N8N_WEBHOOK_NOT_CONFIGURED");
    return { sent: false, skipped: true };
  }
  if (config.secret.length < 32) throw new Error("N8N_WEBHOOK_SECRET_INVALID");

  const eventId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.secret}`,
        "content-type": "application/json",
        "x-idempotency-key": eventId,
      },
      body: JSON.stringify({
        event,
        eventId,
        occurredAt: new Date().toISOString(),
        data,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`N8N_WEBHOOK_FAILED_${response.status}`);
    return { sent: true, eventId };
  } finally {
    clearTimeout(timeout);
  }
}

export function runInBackground(context, promise, label) {
  const safePromise = Promise.resolve(promise).catch((error) => {
    console.error(label, {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  if (typeof context.waitUntil === "function") {
    context.waitUntil(safePromise);
  }
  return safePromise;
}

export const __testables = { pickWebhookConfig };
