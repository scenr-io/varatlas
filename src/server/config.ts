/* Runtime configuration, read from the environment on every call so tests can override it. */

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

/** Hostnames the API answers for. Anything else is rejected (DNS-rebinding guard). */
export function allowedHosts(env: Env = process.env): string[] {
  const hosts = parseList(env.VARATLAS_ALLOWED_HOSTS);
  return hosts.length > 0 ? hosts : DEFAULT_ALLOWED_HOSTS;
}
