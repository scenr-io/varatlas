/* Chips and severity icons. Severity is carried by icon shape and weight, never by color alone. */

import type { ComponentChildren } from "preact";
import { Info, OctagonAlert, TriangleAlert } from "lucide-preact";
import type { Severity } from "@/insights";

const TONES = {
  neutral: "border-line-strong text-fg-2",
  good: "border-line-strong text-fg-2",
  warning: "border-fg/60 font-semibold text-fg",
  serious: "border-fg bg-fg font-semibold text-page",
} as const;

export type Tone = keyof typeof TONES;

/** A small outlined label for a variable setting or a status. */
export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: ComponentChildren;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 text-[11px] font-medium leading-[18px] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const SEVERITY = {
  serious: { Icon: OctagonAlert, className: "text-fg", label: "Serious" },
  warning: { Icon: TriangleAlert, className: "text-fg", label: "Warning" },
  info: { Icon: Info, className: "text-fg-3", label: "Worth a look" },
} as const;

/** Status is never color alone: every severity has its own icon and an accessible label. */
export function SeverityIcon({
  severity,
  className = "h-4 w-4",
}: {
  severity: Severity;
  className?: string;
}) {
  const { Icon, className: tone, label } = SEVERITY[severity];
  return <Icon className={`${className} flex-shrink-0 ${tone}`} aria-label={label} role="img" />;
}
