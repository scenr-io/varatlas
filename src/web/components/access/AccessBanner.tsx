/* Notes shown above the workspace when the token works but has limits. */

import { Clock, Eye, FlaskConical } from "lucide-preact";
import { newTokenUrl } from "@/access";

/** Non-blocking notes about the token: read-only access and an upcoming expiry. */
export function AccessBanner({
  readOnly,
  expiresInDays,
  baseUrl,
  demo = false,
}: {
  readOnly: boolean;
  expiresInDays: number | null;
  baseUrl: string;
  demo?: boolean;
}) {
  if (!readOnly && expiresInDays === null && !demo) return null;
  return (
    <div
      className="flex flex-col gap-1.5 border-b border-line bg-surface px-4 py-2.5 text-[13px] md:px-8"
      role="status"
    >
      {demo && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-2">
          <FlaskConical className="h-4 w-4 flex-shrink-0 text-fg" aria-hidden="true" />
          <span className="font-medium text-fg">Demo mode.</span>
          <span>
            Northwind is a made-up company with sample data. Changes stay in memory and never reach GitLab.
          </span>
        </p>
      )}
      {readOnly && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-2">
          <Eye className="h-4 w-4 flex-shrink-0 text-fg" aria-hidden="true" />
          <span className="font-medium text-fg">Read-only token.</span>
          <span>You can browse everything, but changing variables needs the api scope.</span>
          <a
            href={newTokenUrl(baseUrl, "api")}
            target="_blank"
            rel="noreferrer"
            className="text-fg underline underline-offset-2 hover:no-underline"
          >
            Create a token with api
          </a>
        </p>
      )}
      {expiresInDays !== null && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-2">
          <Clock className="h-4 w-4 flex-shrink-0 text-fg" aria-hidden="true" />
          <span className="font-medium text-fg">
            {expiresInDays === 0
              ? "Your token expires today."
              : `Your token expires in ${expiresInDays} ${expiresInDays === 1 ? "day" : "days"}.`}
          </span>
          <span>After that varatlas can't reach GitLab until you replace it.</span>
        </p>
      )}
    </div>
  );
}
