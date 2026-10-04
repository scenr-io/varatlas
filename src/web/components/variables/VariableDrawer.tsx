
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { Loader2, X } from "lucide-preact";
import type {
  EntityRef,
  EntityType,
  GitLabVariable,
  OrgTree,
  VariableDraft,
  VariableType,
} from "@shared/types";

export interface DrawerState {
  mode: "create" | "edit";
  /** target entity: fixed in edit mode, pickable in create mode */
  target: EntityRef;
  targetPath: string;
  /** original variable when editing */
  original?: GitLabVariable;
}

interface Props {
  state: DrawerState;
  tree: OrgTree;
  busy: boolean;
  onClose: () => void;
  onSubmit: (target: EntityRef, draft: VariableDraft) => void;
}

type Visibility = "visible" | "masked" | "hidden";

const KEY_PATTERN = /^[A-Za-z0-9_]{1,255}$/;
const FORM_ID = "variable-form";

const VISIBILITY_OPTIONS: [Visibility, string, string][] = [
  ["visible", "Visible", "Value shown in job logs and UI."],
  ["masked", "Masked", "Hidden in job logs. Value must satisfy masking rules."],
  [
    "hidden",
    "Masked and hidden",
    "Hidden in logs AND never revealed in the UI/API after creation.",
  ],
];

const label = "mb-1.5 block font-mono text-[10px] font-bold tracking-[0.16em] text-ink/45";
const hint = "mt-1.5 text-[11px] leading-relaxed text-ink/40";

function Checkbox({
  checked,
  onChange,
  title,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  children: ComponentChildren;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.08] bg-white p-3 hover:border-black/20">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="mt-0.5 accent-accent"
      />
      <span>
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="block text-[11px] leading-relaxed text-ink/45">{children}</span>
      </span>
    </label>
  );
}

export default function VariableDrawer({ state, tree, busy, onClose, onSubmit }: Props) {
  const isEdit = state.mode === "edit";
  const orig = state.original;

  const keyRef = useAutoFocus<HTMLInputElement>(!isEdit);
  const [target, setTarget] = useState(`${state.target.entity}:${state.target.id}`);
  const [key, setKey] = useState(orig?.key ?? "");
  const [value, setValue] = useState(orig?.value ?? "");
  const [type, setType] = useState<VariableType>(orig?.variable_type ?? "env_var");
  const [scope, setScope] = useState(orig?.environment_scope ?? "*");
  const [visibility, setVisibility] = useState<Visibility>(
    orig?.hidden ? "hidden" : orig?.masked ? "masked" : "visible",
  );
  const [prot, setProt] = useState(orig?.protected ?? false);
  // GitLab UI: "Expand variable reference" checked ⇔ raw === false
  const [expand, setExpand] = useState(orig ? !orig.raw : true);
  const [description, setDescription] = useState(orig?.description ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const targets = useMemo(
    () => ({
      groups: tree.groups.map((g) => ({ value: `group:${g.id}`, label: g.full_path })),
      projects: tree.projects.map((p) => ({
        value: `project:${p.id}`,
        label: p.path_with_namespace,
      })),
    }),
    [tree],
  );

  const keyValid = KEY_PATTERN.test(key);
  /** Hidden values can't be read back; an empty value keeps the current one. */
  const valueLocked = isEdit && orig?.hidden === true;
  const needsValue = visibility !== "visible" && !valueLocked;
  const canSubmit = keyValid && !busy && (!needsValue || value.length > 0);

  function submit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    const [entity, id] = target.split(":");
    onSubmit(
      { entity: entity as EntityType, id: Number(id) },
      {
        key,
        value,
        variable_type: type,
        protected: prot,
        masked: visibility !== "visible",
        masked_and_hidden: !isEdit && visibility === "hidden",
        raw: !expand,
        environment_scope: scope.trim() || "*",
        description: description || undefined,
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit variable" : "Add variable"}
        className="drawer-in relative flex h-full w-full max-w-[480px] flex-col border-l border-black/[0.08] bg-paper shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-black/[0.06] px-6">
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-ink/35">
              <span className="text-accent">/</span> {isEdit ? "EDIT VARIABLE" : "ADD VARIABLE"}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-ink/55">
              {state.targetPath}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-black/5 hover:text-ink"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form id={FORM_ID} onSubmit={submit} className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {/* Target (create only) */}
          {!isEdit && (
            <div>
              <label className={label} htmlFor="var-target">
                TARGET
              </label>
              <select
                id="var-target"
                value={target}
                onChange={(e) => setTarget(e.currentTarget.value)}
                className="glass-input w-full font-mono text-[12.5px]"
              >
                <optgroup label="Groups">
                  {targets.groups.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Projects">
                  {targets.projects.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className={hint}>Group variables are inherited by every project under the group.</p>
            </div>
          )}

          {/* Key */}
          <div>
            <label className={label} htmlFor="var-key">
              KEY
            </label>
            <input
              id="var-key"
              value={key}
              onInput={(e) => setKey(e.currentTarget.value)}
              disabled={isEdit}
              ref={keyRef}
              placeholder="TF_VAR_cluster_name"
              className="glass-input w-full font-mono text-[13px] disabled:opacity-55"
            />
            {key && !keyValid && (
              <p className="mt-1.5 text-[11px] font-semibold text-accent">
                Letters, digits and underscore only.
              </p>
            )}
          </div>

          {/* Value */}
          <div>
            <label className={label} htmlFor="var-value">
              VALUE
            </label>
            {valueLocked && (
              <div className="mb-2 rounded-xl border border-black/[0.08] bg-mist px-4 py-3 font-mono text-[12.5px] text-ink/40">
                •••••••• hidden. The value cannot be read back; enter a new value to rotate it.
              </div>
            )}
            <textarea
              id="var-value"
              value={value}
              onInput={(e) => setValue(e.currentTarget.value)}
              rows={type === "file" ? 8 : 4}
              placeholder={valueLocked ? "New value (leave empty to keep current)" : "Value"}
              className="glass-input w-full resize-y font-mono text-[12.5px]"
              spellcheck={false}
            />
            {visibility !== "visible" && (
              <p className={hint}>Masked values must be ≥ 8 chars, single line, Base64-safe charset.</p>
            )}
          </div>

          {/* Type */}
          <div>
            <span className={label}>TYPE</span>
            <div className="flex gap-2">
              {(
                [
                  ["env_var", "Variable (default)"],
                  ["file", "File"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={type === v}
                  onClick={() => setType(v)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition-colors ${
                    type === v
                      ? "border-accent/50 bg-accent/[0.06] text-accent"
                      : "border-black/[0.08] bg-white text-ink/55 hover:border-black/20"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className={hint}>File type writes the value to a temp file and sets the variable to its path.</p>
          </div>

          {/* Environments */}
          <div>
            <label className={label} htmlFor="var-scope">
              ENVIRONMENTS
            </label>
            <input
              id="var-scope"
              value={scope}
              onInput={(e) => setScope(e.currentTarget.value)}
              placeholder="*"
              className="glass-input w-full font-mono text-[12.5px]"
            />
            <p className={hint}>
              <span className="font-mono">*</span> = all environments. Use names like{" "}
              <span className="font-mono">production</span> or wildcards like{" "}
              <span className="font-mono">review/*</span>.
            </p>
          </div>

          {/* Visibility */}
          <fieldset>
            <legend className={label}>VISIBILITY</legend>
            <div className="space-y-1.5">
              {VISIBILITY_OPTIONS.map(([v, l, d]) => {
                const disabled = valueLocked || (isEdit && v === "hidden");
                return (
                  <label
                    key={v}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      visibility === v
                        ? "border-accent/50 bg-accent/[0.05]"
                        : "border-black/[0.08] bg-white hover:border-black/20"
                    } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      checked={visibility === v}
                      disabled={disabled}
                      onChange={() => setVisibility(v)}
                      className="mt-0.5 accent-accent"
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{l}</span>
                      <span className="block text-[11px] leading-relaxed text-ink/45">{d}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {isEdit && !valueLocked && (
              <p className={hint}>“Masked and hidden” can only be set when a variable is created.</p>
            )}
          </fieldset>

          {/* Flags */}
          <fieldset>
            <legend className={label}>FLAGS</legend>
            <div className="space-y-1.5">
              <Checkbox checked={prot} onChange={setProt} title="Protect variable">
                Only exposed to pipelines on protected branches and tags.
              </Checkbox>
              <Checkbox checked={expand} onChange={setExpand} title="Expand variable reference">
                <span className="font-mono">$</span> is treated as the start of another
                variable&apos;s reference.
              </Checkbox>
            </div>
          </fieldset>

          {/* Description */}
          <div>
            <label className={label} htmlFor="var-description">
              DESCRIPTION <span className="text-ink/25">(OPTIONAL)</span>
            </label>
            <input
              id="var-description"
              value={description}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="What is this variable for?"
              className="glass-input w-full text-[13px]"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-black/[0.06] bg-mist/60 px-6 py-4">
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-ink/55 transition-colors hover:bg-black/5 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add variable"}
          </button>
        </div>
      </div>
    </div>
  );
}
