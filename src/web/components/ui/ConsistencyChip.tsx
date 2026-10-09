/* Whether the copies of a key hold the same value, as a chip or a sentence. */

import type { Consistency } from "@/insights";
import { Chip } from "./Badge";

const COPY: Record<Consistency, { label: string; sentence: string; tone: "neutral" | "warning" }> = {
  same: { label: "Same value", sentence: "Every copy holds the same value.", tone: "neutral" },
  different: { label: "Values differ", sentence: "The copies hold different values.", tone: "warning" },
  unreadable: {
    label: "Hidden values",
    sentence: "The values are hidden by GitLab, so they can't be compared.",
    tone: "neutral",
  },
};

export function ConsistencyChip({ values }: { values: Consistency }) {
  return <Chip tone={COPY[values].tone}>{COPY[values].label}</Chip>;
}

export function consistencySentence(values: Consistency): string {
  return COPY[values].sentence;
}

export function consistencyLabel(values: Consistency): string {
  return COPY[values].label;
}
