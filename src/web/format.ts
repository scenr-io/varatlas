/* Small formatting helpers shared by the UI. */

/** "1 variable", "3 variables"; pass `many` for irregular plurals. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** `n` as a CSS percentage of `max`. */
export function pct(n: number, max: number): string {
  return `${max === 0 ? 0 : (n / max) * 100}%`;
}

/** A CSS pixel length. Preact 11 does not append "px" to numeric style values. */
export function px(n: number): string {
  return `${n}px`;
}

/** An environment scope as a label: "* (all)" or the scope itself. */
export function scopeLabel(scope: string): string {
  return scope === "*" ? "* (all)" : scope;
}

/** An environment scope in a sentence: "all environments" or "the production environment". */
export function scopePhrase(scope: string): string {
  return scope === "*" ? "all environments" : `the ${scope} environment`;
}
