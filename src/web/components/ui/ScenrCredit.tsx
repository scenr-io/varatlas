/** Small "by scenr" attribution link. */
export function ScenrCredit({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://github.com/scenr-io"
      target="_blank"
      rel="noreferrer"
      className={`text-xs text-fg-3 transition-colors hover:text-fg-2 ${className}`}
    >
      by <span className="font-semibold text-brand">scenr</span>
    </a>
  );
}
