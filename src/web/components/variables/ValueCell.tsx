import { useState } from "preact/hooks";
import { Check, Copy, Eye, EyeOff } from "lucide-preact";
import { useToast } from "@/components/ui/Toast";
import type { GitLabVariable } from "@shared/types";

const iconButton =
  "rounded p-1 text-fg-3 opacity-0 transition hover:bg-raised hover:text-fg group-hover/val:opacity-100 focus-visible:opacity-100";

/** A value masked by default, with reveal and copy. Masked-and-hidden values can never be read. */
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
      toast("err", "Copying needs clipboard access in this browser");
    }
  }

  if (unreadable) {
    return <span className="text-xs italic text-fg-3">Hidden by GitLab</span>;
  }

  return (
    <div className="group/val flex min-w-0 items-center gap-1">
      <span className={`truncate font-mono text-xs ${visible ? "text-fg" : "text-fg-3"}`}>
        {visible
          ? v.value || <span className="italic text-fg-3">empty</span>
          : "•".repeat(Math.min(Math.max(v.value?.length ?? 8, 6), 14))}
      </span>
      {!revealAll && (
        <button
          onClick={() => setShown((s) => !s)}
          title={shown ? "Hide value" : "Show value"}
          aria-label={shown ? `Hide value of ${v.key}` : `Show value of ${v.key}`}
          className={iconButton}
        >
          {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      <button
        onClick={() => void copy()}
        title="Copy value"
        aria-label={`Copy value of ${v.key}`}
        className={iconButton}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
