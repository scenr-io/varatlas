/*
 * Request guards for the API. varatlas has no login of its own — whoever can
 * reach the server acts with the configured GitLab token — so the API only
 * answers requests that provably come from the varatlas page itself:
 *
 *  - Host must be an allowed hostname. Blocks DNS rebinding, where a malicious
 *    site points its own domain at 127.0.0.1 and reads the API same-origin.
 *  - State-changing requests must carry a same-origin Origin header and a JSON
 *    content type. Blocks cross-site form/`text/plain` POSTs, which browsers
 *    send without a CORS preflight.
 */

export type GuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Hostname from a Host header value, without the port. Handles `[::1]:3131`. */
export function hostnameOf(host: string | null): string | null {
  if (!host) return null;
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end > 1 ? h.slice(1, end) : null;
  }
  return h.split(":")[0] || null;
}

function originHostOf(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export function checkApiRequest(
  req: { method: string; headers: Headers },
  allowedHosts: string[],
): GuardResult {
  const host = req.headers.get("host");
  const hostname = hostnameOf(host);
  if (!host || !hostname || !allowedHosts.includes(hostname)) {
    return {
      ok: false,
      status: 403,
      error: "Host not allowed. Set VARATLAS_ALLOWED_HOSTS to serve other hostnames.",
    };
  }

  if (SAFE_METHODS.has(req.method.toUpperCase())) return { ok: true };

  if (originHostOf(req.headers.get("origin")) !== host.trim().toLowerCase()) {
    return { ok: false, status: 403, error: "Cross-origin request blocked" };
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { ok: false, status: 415, error: "Expected application/json" };
  }

  return { ok: true };
}
