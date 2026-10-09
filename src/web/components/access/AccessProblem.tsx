/* The shared layout for every "this token can't be used" message: a token check, fixes and actions. */

import type { ComponentChildren } from "preact";
import { Check, CircleHelp, ExternalLink, Minus, RefreshCw, X } from "lucide-preact";
import { Button, buttonClass } from "@/components/ui/Button";
import { ScenrCredit } from "@/components/ui/ScenrCredit";
import { newTokenUrl } from "@/access";
import type { AuthStatus } from "@shared/types";

type CheckStatus = "ok" | "fail" | "unknown" | "skip";

export interface TokenCheck {
  label: string;
  detail?: ComponentChildren;
  status: CheckStatus;
}

const STATUS = {
  ok: { Icon: Check, className: "text-fg", label: "Passes" },
  fail: { Icon: X, className: "bg-fg text-page rounded-full p-0.5", label: "Fails" },
  unknown: { Icon: CircleHelp, className: "text-fg-3", label: "Unknown" },
  skip: { Icon: Minus, className: "text-fg-3", label: "Not checked yet" },
} as const;

/** What varatlas needs from a token, and whether this one has it. */
function TokenChecks({ checks }: { checks: TokenCheck[] }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line" aria-label="Token check">
      {checks.map((c) => {
        const { Icon, className, label } = STATUS[c.status];
        return (
          <li key={c.label} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center">
              <Icon className={`h-4 w-4 ${className}`} aria-label={label} role="img" />
            </span>
            <div className="min-w-0">
              <p className={`text-[13px] ${c.status === "fail" ? "font-semibold text-fg" : "text-fg-2"}`}>
                {c.label}
              </p>
              {c.detail && <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{c.detail}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const scopeList = (scopes: string[] | null | undefined) =>
  scopes?.length ? (
    <>
      This token has <span className="font-mono text-fg-2">{scopes.join(", ")}</span>.
    </>
  ) : undefined;

/** The token check rows for a given failure point. */
export function checksFor(auth: AuthStatus, failing: "accepted" | "read" | "role" | "groups"): TokenCheck[] {
  const scopes = auth.token?.scopes ?? null;
  const known = scopes !== null;
  const order = ["accepted", "read", "groups", "role"] as const;
  const at = order.indexOf(failing);
  const status = (i: number, okWhenKnown = true): CheckStatus =>
    i < at ? (okWhenKnown ? "ok" : "unknown") : i === at ? "fail" : "skip";

  return [
    {
      label: "GitLab accepts the token",
      detail: failing === "accepted" ? "Tokens stop working when they expire or are revoked." : undefined,
      status: status(0),
    },
    {
      label: "Scope to read CI/CD variables: api or read_api",
      detail:
        scopeList(scopes) ?? (at > 1 && !known ? "GitLab didn't report scopes for this token." : undefined),
      status: status(1, known || at <= 1),
    },
    {
      label: "Member of at least one group",
      detail: failing === "groups" ? "varatlas starts from the groups your account belongs to." : undefined,
      status: status(2),
    },
    {
      label: "Maintainer role where the variables live",
      detail: "GitLab only shows CI/CD variables to Maintainers and Owners.",
      status: status(3),
    },
  ];
}

interface Props {
  title: string;
  children: ComponentChildren;
  checks?: TokenCheck[];
  /** places involved, e.g. groups where the role is too low */
  paths?: string[];
  actions: ComponentChildren;
}

const SHOWN_PATHS = 5;

/** Explains why the token can't be used and how to fix it. */
export function AccessProblem({ title, children, checks, paths, actions }: Props) {
  return (
    <div className="max-w-[600px]">
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-fg">{title}</h1>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-fg-2">{children}</div>

      {checks && (
        <section className="mt-7" aria-labelledby="token-check">
          <h2 id="token-check" className="mb-2 text-sm font-semibold text-fg">
            Token check
          </h2>
          <TokenChecks checks={checks} />
        </section>
      )}

      {paths && paths.length > 0 && (
        <section className="mt-7" aria-labelledby="places">
          <h2 id="places" className="mb-2 text-sm font-semibold text-fg">
            Where your role is too low
          </h2>
          <ul className="space-y-1 font-mono text-xs text-fg-2">
            {paths.slice(0, SHOWN_PATHS).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {paths.length > SHOWN_PATHS && (
            <p className="mt-1 text-xs text-fg-3">and {paths.length - SHOWN_PATHS} more</p>
          )}
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
    </div>
  );
}

/** A full page for problems that block everything (no usable token yet). */
export function AccessScreen({ children }: { children: ComponentChildren }) {
  return (
    <main className="flex min-h-screen flex-col bg-page px-6 py-8 md:px-16">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[26px] leading-none text-fg">varatlas</span>
        <ScenrCredit />
      </div>
      <div className="flex flex-1 items-center py-12">{children}</div>
    </main>
  );
}

/* ---------------- shared actions ---------------- */

export function CreateTokenLink({ baseUrl, scope = "api" }: { baseUrl: string; scope?: "api" | "read_api" }) {
  return (
    <a href={newTokenUrl(baseUrl, scope)} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
      Create a token in GitLab
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

export function CheckAgain({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      Check again
    </Button>
  );
}

/** How to replace a token that comes from the server environment. */
export function EnvTokenFix() {
  return (
    <p>
      This token comes from <span className="font-mono text-fg">GITLAB_TOKEN</span> on the server, so it can't
      be changed here. Set a new one where varatlas runs (for example in{" "}
      <span className="font-mono text-fg">.env.local</span> or your container's environment), restart
      varatlas, then check again.
    </p>
  );
}
