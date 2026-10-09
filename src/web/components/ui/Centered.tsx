/* Centers an empty, loading or error state inside a table area. */

import type { ComponentChildren } from "preact";

export function Centered({ children }: { children: ComponentChildren }) {
  return (
    <div className="grid h-full min-h-60 place-items-center p-10">
      <div className="max-w-sm text-center">{children}</div>
    </div>
  );
}
