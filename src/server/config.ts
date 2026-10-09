/*
 * Runtime configuration. This is the only module that reads the environment; values are
 * read on every call so tests can override them.
 */

type Env = Record<string, string | undefined>;

const DEFAULT_BASE_URL = "https://gitlab.com";
const DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "::1"];

/** Split a comma-separated env value into trimmed, lower-cased, non-empty items. */
export function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function gitlabBaseUrl(env: Env = process.env): string {
  return (env.GITLAB_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/** Path segments to skip during discovery (the group/project and everything below it). */
export function excludedSegments(env: Env = process.env): string[] {
  return parseList(env.VARATLAS_EXCLUDE_PATHS);
}

/** The token set on the server (GITLAB_TOKEN), which takes precedence over a pasted one. */
export function serverToken(env: Env = process.env): string | null {
  return env.GITLAB_TOKEN || null;
}

/** How the server process runs. `||`, not `??`: an empty HOST= line must not mean "all interfaces". */
export function serverOptions(env: Env = process.env) {
  return {
    port: Number(env.PORT || 3131),
    host: env.HOST || "127.0.0.1",
    /** development: Vite serves the UI and proxies /api to this server */
    dev: env.VARATLAS_DEV === "1",
    /** serve the built-in demo org instead of GitLab */
    demo: env.VARATLAS_DEMO === "1",
  };
}

/** Hostnames the API answers for. Anything else is rejected (DNS-rebinding guard). */
export function allowedHosts(env: Env = process.env): string[] {
  const hosts = parseList(env.VARATLAS_ALLOWED_HOSTS);
  return hosts.length > 0 ? hosts : DEFAULT_ALLOWED_HOSTS;
}
