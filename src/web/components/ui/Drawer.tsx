/* A panel that slides in from the right, with a header, a scrolling body and an optional footer. */

import type { ComponentChildren } from "preact";
import { X } from "lucide-preact";
import { useEscape } from "@/hooks/useEscape";
import { iconButtonClass } from "./Button";

export function Drawer({
  titleId,
  title,
  subtitle,
  onClose,
  footer,
  wide = false,
  layer = "base",
  children,
}: {
  /** id of the element that names the dialog, for screen readers */
  titleId: string;
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  onClose: () => void;
  footer?: ComponentChildren;
  wide?: boolean;
  /** "top" stacks above another open drawer, e.g. editing from a key's detail panel */
  layer?: "base" | "top";
  children: ComponentChildren;
}) {
  useEscape(onClose);
  return (
    <div className={`fixed inset-0 flex justify-end ${layer === "top" ? "z-[55]" : "z-50"}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`drawer-in relative flex h-full w-full flex-col border-l border-line bg-page shadow-2xl shadow-black/60 ${
          wide ? "max-w-[560px]" : "max-w-[480px]"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <div id={titleId}>{title}</div>
            {subtitle}
          </div>
          <button onClick={onClose} aria-label="Close" className={iconButtonClass()}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
