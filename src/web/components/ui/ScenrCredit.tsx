/** Small "by scenr" attribution link. */
export function ScenrCredit({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://github.com/scenr-io"
      target="_blank"
      rel="noreferrer"
      className={`font-mono text-[9px] font-bold tracking-[0.2em] transition-colors ${className}`}
    >
      BY <span className="text-brand">SCENR</span>
    </a>
  );
}
