/* HTTP errors that carry the status the API should answer with. */

import type { ContentfulStatusCode } from "hono/utils/http-status";

/** An error that maps directly onto an HTTP response status. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
  }
}

/** Statuses that can't carry a JSON body, so they can't be passed on as an error response. */
const CONTENTLESS = new Set([101, 204, 205, 304]);

/** A status from upstream (GitLab) that we can safely repeat; anything odd becomes 502 Bad Gateway. */
export function toStatus(status: number): ContentfulStatusCode {
  return Number.isInteger(status) && status >= 200 && status <= 599 && !CONTENTLESS.has(status)
    ? (status as ContentfulStatusCode)
    : 502;
}
