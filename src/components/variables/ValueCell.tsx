"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { GitLabVariable } from "@/lib/types";

const iconButton =
  "rounded p-1 text-ink/30 opacity-0 transition-all hover:bg-black/5 hover:text-ink group-hover/val:opacity-100 focus-visible:opacity-100";

/** A masked-by-default value with reveal and copy. Hidden variables can never be revealed. */
export function ValueCell({ v, revealAll }: { v: GitLabVariable; revealAll: boolean }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const unreadable = v.hidden === true || v.value === null;
  const visible = revealAll || shown;

  async function copy() {
    if (v.value === null) return;
    try {
      await navigator.clipboard.writeText(v.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast("err", "Clipboard unavailable");
    }
  }

  return (
    <div className="group/val flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-[12px] text-ink/70">
        {unreadable
          ? "••••••••"
          : visible
            ? v.value
            : "•".repeat(Math.min(Math.max(v.value?.length ?? 8, 6), 14))}
      </span>
      {!unreadable && (
        <>
          {!revealAll && (
            <button
              onClick={() => setShown((s) => !s)}
              title={shown ? "Hide value" : "Reveal value"}
              aria-label={shown ? "Hide value" : "Reveal value"}
              className={iconButton}
            >
              {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={copy}
            title="Copy value"
            aria-label="Copy value"
            className={iconButton}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-pass" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </>
      )}
    </div>
  );
}
