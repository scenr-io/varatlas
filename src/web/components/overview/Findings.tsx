/* The overview's list of findings, each one a shortcut to the variables behind it. */

import { ChevronRight, CircleCheck } from "lucide-preact";
import { SeverityIcon } from "@/components/ui/Badge";
import { findingUnit, type Finding } from "@/insights";

const SHOWN_PATHS = 3;

function Paths({ paths }: { paths: string[] }) {
  return (
    <p className="mt-1.5 font-mono text-xs leading-relaxed text-fg-3">
      {paths.slice(0, SHOWN_PATHS).join(", ")}
      {paths.length > SHOWN_PATHS && ` and ${paths.length - SHOWN_PATHS} more`}
    </p>
  );
}

/** The audit: what needs fixing, most serious first. Every finding opens its variables. */
export function Findings({ findings, onOpen }: { findings: Finding[]; onOpen: (f: Finding) => void }) {
  if (findings.length === 0) {
    return (
      <div className="flex items-start gap-3 py-4">
        <CircleCheck className="mt-0.5 h-5 w-5 text-good" aria-label="All clear" role="img" />
        <div>
          <p className="font-medium text-fg">Nothing needs attention here</p>
          <p className="mt-1 text-sm text-fg-2">
            Secret-looking variables are masked and protected, and no key has conflicting copies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {findings.map((f) => {
        const body = (
          <>
            <SeverityIcon severity={f.severity} className="mt-0.5 h-4 w-4" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{f.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{f.detail}</p>
              {f.paths && <Paths paths={f.paths} />}
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-xl font-semibold leading-none text-fg">{f.count}</p>
              <p className="mt-1 text-xs text-fg-3">{findingUnit(f)}</p>
            </div>
          </>
        );
        return (
          <li key={f.id}>
            {f.rowIds.size > 0 ? (
              <button
                onClick={() => onOpen(f)}
                className="group flex w-full items-start gap-3 py-4 text-left transition-colors hover:bg-surface/60"
                aria-label={`${f.title}: ${f.count} ${findingUnit(f)}. Show them.`}
              >
                {body}
                <ChevronRight
                  className="mt-1 h-4 w-4 flex-shrink-0 text-fg-3 transition-colors group-hover:text-accent"
                  aria-hidden="true"
                />
              </button>
            ) : (
              <div className="flex items-start gap-3 py-4 pr-7">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
