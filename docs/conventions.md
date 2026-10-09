# Conventions

How code in this repository is written. Most of it is enforced by `pnpm check`; the rest
is here so reviews don't have to argue about it. For where things live, see
[architecture.md](architecture.md).

## Formatting

- Prettier formats everything (`printWidth` 110). Run `pnpm format`; don't format by hand.
- EditorConfig sets indentation and line endings for editors that don't run Prettier.
- Node version: `.nvmrc` (22).

## Files and names

| Kind                | File name                     | Example                         |
| ------------------- | ----------------------------- | ------------------------------- |
| Component           | `PascalCase.tsx`, by feature  | `components/variables/KeyTable` |
| Hook                | `useThing.ts` in `web/hooks/` | `hooks/useEscape.ts`            |
| Other modules       | `camelCase.ts`                | `insights.ts`, `gitlab/org.ts`  |
| Unit/component test | next to the code, `.test.ts*` | `rows.test.ts`                  |
| Integration test    | `test/integration/`           | `workspace.test.tsx`            |
| Browser test        | `test/e2e/*.spec.ts`          | `edit.spec.ts`                  |

- **Named exports only.** No default exports in `src` or `test` (config files are the
  exception, because their tools require them). A component file's main export has the
  file's name.
- **Imports.** In the web app, use `@/` for `src/web` and `@shared/` for `src/shared`. The
  server uses relative paths, since it is bundled separately.
- **Shared rules live in `src/shared`.** If the server and the browser both need a rule
  (a valid key, what makes two variables the same), it belongs there, not in two copies.

## Comments

- Every module starts with a short `/* ... */` header saying what it is for.
- Exported functions and types get a `/** ... */` comment when the name doesn't say it all.
- Comments explain why, not what. A workaround says what it works around.

## Types

- No `any`, no non-null assertions (`!`). Values from JSON are `unknown` until checked.
- `noUncheckedIndexedAccess` is on: an index lookup may be `undefined`, so handle it.
  In tests, `defined(value, "what")` from `test/helpers.ts` fails with a clear message.
- Catch callbacks take `(e: unknown)`.
- No floating promises. In event handlers, call async work as `void submit(e)` and handle
  errors inside it.
- `switch` over a union covers every case; the linter checks it.

## Server

- `config.ts` is the only module that reads `process.env`. Other code takes values from it.
- Errors meant for people are thrown as `HttpError(status, message)` from `http.ts`.
- Request bodies are parsed in `validation.ts`; only known fields reach GitLab.
- The token never leaves the server: not in responses, errors or logs.

## Web

- **Build from the primitives in `components/ui`:** `Button` / `buttonClass` for actions,
  `Drawer` for side panels, `Centered` for empty and loading states, `Chip` and
  `SeverityIcon` for status. New one-off button styles or panel shells are a review flag.
- **Styling.** Tailwind classes using the design tokens by role (`text-fg-2`, `bg-surface`,
  `border-line`). No raw colors in components; add a token in `styles.css` if one is missing.
- **Text helpers.** Counts go through `plural()`, environment scopes through
  `scopeLabel()` / `scopePhrase()`, percentages through `pct()`, from `format.ts`.
- **Preact specifics:**
  - Text fields use `onInput`; Preact's `onChange` fires on blur.
  - Numeric inline styles need units; use `px(n)`. Preact 11 doesn't add `px`.
  - Listeners and focus that must work on the first frame (Escape to close, autofocus)
    attach in `useLayoutEffect`. `useEffect` runs after paint, which can be late.
- **Accessibility.** Status is never shown by color alone. Dialogs and panels have a
  label, close on Escape and move focus into themselves.

## Writing

- Sentence case for headings, buttons and labels.
- Plain words and contractions: "Couldn't reach GitLab", not "Could not reach GitLab".
- No em dashes, in code or prose. Use a colon, a comma or two sentences.
- Error messages say what happened and what to do next.

## Tests

- Test behaviour through the public surface: routes with `app.request()`, components by
  role and label (Testing Library), not by class names.
- Stub GitLab with `stubFetch()` and build fixtures with `variable()`, `entity()`,
  `fakeOrg()` and `authStatus()` from `test/helpers.ts`.
- Component and hook tests start with `// @vitest-environment happy-dom`.
- Browser tests run against demo mode. They share one server, so a test that changes data
  puts it back.
- Coverage may only go up: when it rises, raise the floor in `vite.config.ts`.

## Commits and pull requests

- Commit subjects are short, imperative and sentence case ("Fix the endless spinner when
  the server is unreachable"). The body says why.
- One change per pull request. `pnpm check` passes before review.
- Formatting-only commits go in `.git-blame-ignore-revs`. Pull requests are merged with a
  merge commit, so those hashes stay valid.
