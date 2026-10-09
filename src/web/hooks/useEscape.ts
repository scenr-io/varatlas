/* Close something when Escape is pressed. */

import { useLayoutEffect } from "preact/hooks";

/**
 * A layout effect, not a plain effect: it attaches while the dialog mounts, so an
 * Escape pressed immediately after opening is never missed. (Plain effects wait for
 * the next paint, which left a short window where Escape did nothing.)
 */
export function useEscape(onEscape: () => void): void {
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}
