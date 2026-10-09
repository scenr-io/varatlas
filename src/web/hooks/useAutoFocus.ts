import { useLayoutEffect, useRef } from "preact/hooks";

/** Focus an element when it mounts. The `autofocus` attribute is ignored for elements added after page load. */
export function useAutoFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  // A layout effect, so focus lands as the element mounts rather than after the next paint.
  useLayoutEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}
