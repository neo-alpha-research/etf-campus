const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const segments = context.params.path ?? [];
  const path = Array.isArray(segments) ? segments : [segments];

  if (path.length === 1 && UUID_PATTERN.test(path[0])) {
    const shellUrl = new URL("/community/read/", url.origin);
    return context.next(new Request(shellUrl, context.request));
  }

  return context.next();
}
