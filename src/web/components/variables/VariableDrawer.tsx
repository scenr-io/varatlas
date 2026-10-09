import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import { Loader2 } from "lucide-preact";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { KEY_PATTERN } from "@shared/variables";
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
  /** key to start with when creating, e.g. "add this key somewhere else" */
  key?: string;
}

interface Props {
  state: DrawerState;
  tree: OrgTree;
  busy: boolean;
  onClose: () => void;
  onSubmit: (target: EntityRef, draft: VariableDraft) => void;
}

type Visibility = "visible" | "masked" | "hidden";

const FORM_ID = "variable-form";

const VISIBILITY_OPTIONS: [Visibility, string, string][] = [
  ["visible", "Visible", "Shown in job logs and in GitLab."],
  ["masked", "Masked", "Replaced by [MASKED] in job logs."],
  ["hidden", "Masked and hidden", "Masked in logs and never shown again, here or in GitLab."],
];

const label = "mb-1.5 block text-[13px] font-medium text-fg";
const hint = "mt-1.5 text-xs leading-relaxed text-fg-3";

function Choice({
  checked,
  disabled = false,
  title,
  children,
  input,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  children: ComponentChildren;
  input: ComponentChildren;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        checked ? "border-accent/50 bg-accent/5" : "border-line hover:border-line-strong"
      } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
    >
      {input}
      <span>
        <span className="block text-[13px] font-medium text-fg">{title}</span>
        <span className="block text-xs leading-relaxed text-fg-3">{children}</span>
      </span>
    </label>
  );
}

/** Create or edit one variable. */
export function VariableDrawer({ state, tree, busy, onClose, onSubmit }: Props) {
  const isEdit = state.mode === "edit";
  const orig = state.original;

  const keyRef = useAutoFocus<HTMLInputElement>(!isEdit && !state.key);
  const [target, setTarget] = useState(`${state.target.entity}:${state.target.id}`);
  const [key, setKey] = useState(orig?.key ?? state.key ?? "");
  const [value, setValue] = useState(orig?.value ?? "");
  const [type, setType] = useState<VariableType>(orig?.variable_type ?? "env_var");
  const [scope, setScope] = useState(orig?.environment_scope ?? "*");
  const [visibility, setVisibility] = useState<Visibility>(
    orig?.hidden ? "hidden" : orig?.masked ? "masked" : "visible",
  );
  const [prot, setProt] = useState(orig?.protected ?? false);
  // GitLab's "Expand variable reference" is checked when raw is false.
  const [expand, setExpand] = useState(orig ? !orig.raw : true);
  const [description, setDescription] = useState(orig?.description ?? "");

  const targets = useMemo(
    () => ({
      groups: tree.groups.map((g) => ({ value: `group:${g.id}`, label: g.full_path })),
      projects: tree.projects.map((p) => ({ value: `project:${p.id}`, label: p.path_with_namespace })),
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
    <Drawer
      titleId="drawer-title"
      layer="top"
      onClose={onClose}
      title={
        <h2 className="text-base font-semibold text-fg">{isEdit ? `Edit ${orig?.key}` : "Add a variable"}</h2>
      }
      subtitle={isEdit && <p className="mt-1 truncate font-mono text-xs text-fg-3">{state.targetPath}</p>}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={!canSubmit}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isEdit ? "Save changes" : "Add variable"}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {!isEdit && (
          <div>
            <label className={label} htmlFor="var-target">
              Where
            </label>
            <select
              id="var-target"
              value={target}
              onChange={(e) => setTarget(e.currentTarget.value)}
              className="field w-full font-mono text-[13px]"
            >
              <optgroup label="Groups (inherited by every project below)">
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
          </div>
        )}

        <div>
          <label className={label} htmlFor="var-key">
            Key
          </label>
          <input
            id="var-key"
            ref={keyRef}
            value={key}
            onInput={(e) => setKey(e.currentTarget.value)}
            disabled={isEdit}
            placeholder="DATABASE_URL"
            className="field w-full font-mono text-sm disabled:opacity-55"
          />
          {key && !keyValid && (
            <p className="mt-1.5 text-xs text-serious" role="alert">
              Use letters, digits and underscores only.
            </p>
          )}
        </div>

        <div>
          <label className={label} htmlFor="var-value">
            Value
          </label>
          {valueLocked && (
            <p className="mb-2 text-xs leading-relaxed text-fg-3">
              This value is hidden and can't be read back. Leave the field empty to keep it, or enter a new
              value to replace it.
            </p>
          )}
          <textarea
            id="var-value"
            value={value}
            onInput={(e) => setValue(e.currentTarget.value)}
            rows={type === "file" ? 8 : 4}
            placeholder={valueLocked ? "New value" : ""}
            className="field w-full resize-y font-mono text-[13px]"
            spellcheck={false}
          />
          {visibility !== "visible" && (
            <p className={hint}>Masked values need at least 8 characters on one line, without spaces.</p>
          )}
        </div>

        <div>
          <label className={label} htmlFor="var-scope">
            Environments
          </label>
          <input
            id="var-scope"
            value={scope}
            onInput={(e) => setScope(e.currentTarget.value)}
            placeholder="*"
            className="field w-full font-mono text-[13px]"
          />
          <p className={hint}>
            <span className="font-mono text-fg-2">*</span> means every environment. Use a name like{" "}
            <span className="font-mono text-fg-2">production</span> or a pattern like{" "}
            <span className="font-mono text-fg-2">review/*</span>.
          </p>
        </div>

        <fieldset>
          <legend className={label}>Visibility</legend>
          <div className="space-y-2">
            {VISIBILITY_OPTIONS.map(([v, title, detail]) => {
              const disabled = valueLocked || (isEdit && v === "hidden");
              return (
                <Choice
                  key={v}
                  checked={visibility === v}
                  disabled={disabled}
                  title={title}
                  input={
                    <input
                      type="radio"
                      name="visibility"
                      checked={visibility === v}
                      disabled={disabled}
                      onChange={() => setVisibility(v)}
                      className="mt-0.5 accent-accent"
                    />
                  }
                >
                  {detail}
                </Choice>
              );
            })}
          </div>
          {isEdit && !valueLocked && (
            <p className={hint}>GitLab only allows "masked and hidden" when a variable is created.</p>
          )}
        </fieldset>

        <fieldset>
          <legend className={label}>Options</legend>
          <div className="space-y-2">
            <Choice
              checked={prot}
              title="Protected branches and tags only"
              input={
                <input
                  type="checkbox"
                  checked={prot}
                  onChange={(e) => setProt(e.currentTarget.checked)}
                  className="mt-0.5 accent-accent"
                />
              }
            >
              Keeps the value out of pipelines on other branches and merge requests.
            </Choice>
            <Choice
              checked={expand}
              title="Expand variable references"
              input={
                <input
                  type="checkbox"
                  checked={expand}
                  onChange={(e) => setExpand(e.currentTarget.checked)}
                  className="mt-0.5 accent-accent"
                />
              }
            >
              Treats <span className="font-mono text-fg-2">$NAME</span> in the value as a reference to another
              variable.
            </Choice>
            <div>
              <span className="mb-2 mt-4 block text-[13px] font-medium text-fg">Type</span>
              <div
                className="flex overflow-hidden rounded-md border border-line"
                role="group"
                aria-label="Type"
              >
                {(
                  [
                    ["env_var", "Environment variable"],
                    ["file", "File"],
                  ] as const
                ).map(([t, l]) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={type === t}
                    onClick={() => setType(t)}
                    className={`flex-1 px-3 py-2 text-[13px] transition-colors ${
                      type === t ? "bg-raised font-medium text-fg" : "text-fg-2 hover:text-fg"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className={hint}>A file variable writes the value to a temporary file and holds its path.</p>
            </div>
          </div>
        </fieldset>

        <div>
          <label className={label} htmlFor="var-description">
            Description <span className="font-normal text-fg-3">(optional)</span>
          </label>
          <input
            id="var-description"
            value={description}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="What uses this variable?"
            className="field w-full text-sm"
          />
        </div>
      </form>
    </Drawer>
  );
}
