import type { ComponentChildren } from "preact";

const TONES = {
  neutral: "bg-black/[0.05] text-ink/55",
  warn: "bg-warn/10 text-warn",
  accent: "bg-accent/[0.08] text-accent",
  pass: "bg-pass/10 text-pass",
} as const;

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ComponentChildren;
  tone?: keyof typeof TONES;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
