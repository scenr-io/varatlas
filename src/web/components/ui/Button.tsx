/* Buttons and button-styled links, in the four variants the UI uses. */

import type { ButtonHTMLAttributes, ComponentChildren } from "preact";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40";

const VARIANTS: Record<Variant, string> = {
  /** the main action: soft white on black */
  primary: "bg-accent font-semibold text-accent-ink hover:opacity-90",
  /** a secondary action: outlined */
  secondary: "border border-line-strong font-medium text-fg hover:bg-raised",
  /** a quiet action, such as Cancel */
  ghost: "font-medium text-fg-2 hover:bg-raised hover:text-fg",
  /** a destructive confirmation */
  danger: "bg-fg font-semibold text-page hover:opacity-90",
};

export function buttonClass(variant: Variant = "secondary", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "class" | "className"> & {
  variant?: Variant;
  className?: string;
  children: ComponentChildren;
};

export function Button({ variant = "secondary", className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}

/** A square, icon-only button; give it an `aria-label`. */
export function iconButtonClass(tone: "neutral" | "danger" = "neutral"): string {
  return `rounded-md p-1.5 text-fg-3 transition-colors ${
    tone === "danger" ? "hover:bg-critical/15 hover:text-critical" : "hover:bg-raised hover:text-fg"
  }`;
}
