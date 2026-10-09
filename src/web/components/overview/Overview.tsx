/* The overview: findings, the atlas, and the protection, environment and key breakdowns. */

import type { Finding } from "@/insights";
import type { OverviewModel } from "@/overview";
import { Atlas } from "./Atlas";
import { ProtectionMeters, RepeatedKeys, ScopeBars, Section } from "./Breakdowns";
import { Findings } from "./Findings";

interface Props extends OverviewModel {
  findings: Finding[];
  onFinding: (f: Finding) => void;
  onGroup: (groupId: number) => void;
  onScope: (scope: string) => void;
  onKey: (key: string) => void;
}

export function Overview(p: Props) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-16 pt-8 md:px-8">
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-fg">{p.headline}</h1>
      <p className="mt-2 max-w-[70ch] text-[15px] text-fg-2">{p.subline}</p>

      <div className="mt-8 grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-labelledby="attention">
          <h2 id="attention" className="text-sm font-semibold text-fg">
            Needs attention
          </h2>
          <p className="mt-0.5 text-xs text-fg-3">Select a finding to see the variables behind it.</p>
          <div className="mt-2">
            <Findings findings={p.findings} onOpen={p.onFinding} />
          </div>
        </section>

        <section
          aria-labelledby="atlas"
          className="rounded-xl border border-line bg-surface p-5 lg:self-start"
        >
          <h2 id="atlas" className="text-sm font-semibold text-fg">
            {p.atlas.title}
          </h2>
          <p className="mb-4 mt-0.5 text-xs text-fg-3">{p.atlas.note}</p>
          <Atlas stats={p.stats} labels={p.atlas.labels} onSelect={p.onGroup} />
        </section>
      </div>

      <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
        <Section title="Protection" note={`Across the ${p.posture.total} variables in view`}>
          <ProtectionMeters posture={p.posture} />
        </Section>
        <Section title="Environments" note="Variables per environment scope">
          <ScopeBars scopes={p.scopes} onPick={p.onScope} />
        </Section>
        <Section title="Repeated keys" note="Keys defined in the most places">
          <RepeatedKeys keys={p.keys} onOpen={p.onKey} />
        </Section>
      </div>
    </div>
  );
}
