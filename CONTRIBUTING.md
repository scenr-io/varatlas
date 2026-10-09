# Contributing to varatlas

Thanks for helping! Bug reports, ideas and pull requests are all welcome. Everyone taking
part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Getting started

Requires Node.js ≥ 22.12 (see `.nvmrc`) and pnpm.

```bash
pnpm install
cp .env.example .env.local   # optional: set GITLAB_TOKEN
pnpm dev                     # http://localhost:3131
```

`pnpm dev` runs two processes: Vite on :3131 (UI with hot reload) and the API server on
:3132 (restarts on change). Vite proxies `/api` to the API server, so always open :3131.

Before opening a pull request, run:

```bash
pnpm format                   # Prettier; formatting is never done by hand
pnpm check                    # format check, lint, types, tests with coverage, dead code
pnpm build && pnpm test:e2e   # for UI changes: browser tests in demo mode
```

CI runs the same commands and also builds and smoke-tests the Docker image. The browser
tests use your installed Chrome locally; run `pnpm exec playwright install chromium`
if you don't have it.

## Where things live

Start with [docs/architecture.md](docs/architecture.md), and read
[docs/conventions.md](docs/conventions.md) for how code here is written. In short:

- `src/server/`: the Hono server. Anything that touches the GitLab token belongs here.
  esbuild bundles it into `dist/server/index.mjs`.
- `src/web/`: the Preact UI. It runs in the browser: keep it free of secrets and Node APIs.
  Vite builds it into `dist/public`.
- `src/shared/`: types and rules used by both.
- `test/`: shared test helpers, integration tests and the Playwright browser tests.
  Unit and component tests sit next to the code.

## Guidelines

- **Never send the token to the browser** or include it in errors and logs.
- **Validate request bodies** in `src/server/validation.ts`; only known fields may reach GitLab.
- **Keep the UI small.** Prefer plain Preact and a few lines of code over a new dependency.
- **Preact, not React:** use `onInput` for text fields (`onChange` fires on blur), and give
  numeric inline styles explicit units (`` `${n}px` ``), since Preact 11 does not add them.
- **Add tests** for logic changes. Server routes can be tested with `app.request()`; stub
  GitLab with `stubFetch()` from `test/helpers.ts`. Components are tested by role and
  label with Testing Library.
- **Keep pull requests focused:** one change per PR, with a short description of why.

## Testing against a real GitLab

Use a token on a test group you own. Prefer `read_api` unless you are testing edits.
