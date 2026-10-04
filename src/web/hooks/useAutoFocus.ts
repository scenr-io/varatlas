import { useEffect, useRef } from "preact/hooks";

/** Focus an element when it mounts. The `autofocus` attribute is ignored for elements added after page load. */
export function useAutoFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}
