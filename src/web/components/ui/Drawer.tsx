/* A panel that slides in from the right, with a header, a scrolling body and an optional footer. */

import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
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
  const panelRef = useRef<HTMLDivElement>(null);
  // Read during the first render, before anything inside the drawer takes focus.
  const [opener] = useState(() => document.activeElement);

  // Move focus into the drawer (unless a field inside already took it), and give it back on close.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [opener]);

  return (
    <div className={`fixed inset-0 flex justify-end ${layer === "top" ? "z-[55]" : "z-50"}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
        className={`drawer-in relative outline-none flex h-full w-full flex-col border-l border-line bg-page shadow-2xl shadow-black/60 ${
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
