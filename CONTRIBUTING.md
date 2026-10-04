# Contributing to varatlas

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

## Getting started

Requires Node.js ≥ 22.12 and pnpm.

```bash
pnpm install
cp .env.example .env.local   # optional: set GITLAB_TOKEN
pnpm dev                     # http://localhost:3131
```

`pnpm dev` runs two processes: Vite on :3131 (UI with hot reload) and the API server on
:3132 (restarts on change). Vite proxies `/api` to the API server, so always open :3131.

Before opening a pull request, run:

```bash
pnpm check   # lint + typecheck + tests
pnpm build
```

CI runs the same commands and also builds and smoke-tests the Docker image.

## Where things live

- `src/server/`: the Hono server. Anything that touches the GitLab token belongs here.
  esbuild bundles it into `dist/server/index.mjs`.
- `src/web/`: the Preact UI. It runs in the browser: keep it free of secrets and Node APIs.
  Vite builds it into `dist/public`.
- `src/shared/`: types used by both.

## Guidelines

- **Never send the token to the browser** or include it in errors and logs.
- **Validate request bodies** in `src/server/validation.ts`; only known fields may reach GitLab.
- **Keep the UI small.** Prefer plain Preact and a few lines of code over a new dependency.
- **Preact, not React:** use `onInput` for text fields (`onChange` fires on blur), and give
  numeric inline styles explicit units (`` `${n}px` ``), since Preact 11 does not add them.
- **Add tests** for logic changes. Server routes can be tested with `app.request()`; mock
  `fetch` for GitLab calls.
- **Keep pull requests focused:** one change per PR, with a short description of why.

## Testing against a real GitLab

Use a token on a test group you own. Prefer `read_api` unless you are testing edits.
