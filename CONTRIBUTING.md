# Contributing to varatlas

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # optional: set GITLAB_TOKEN
pnpm dev                     # http://localhost:3131
```

Before opening a pull request, run:

```bash
pnpm check   # lint + typecheck + tests
pnpm build
```

CI runs the same commands.

## Where things live

- `src/server/` — server-only code. Anything that touches the GitLab token belongs here
  and must start with `import "server-only"`.
- `src/lib/` — code shared with the browser. Keep it free of secrets and Node APIs.
- `src/components/` — UI, grouped by feature.

## Guidelines

- **Never send the token to the browser** or include it in errors and logs.
- **Validate request bodies** in `src/server/validation.ts`; only known fields may reach GitLab.
- **Add tests** for logic changes. Pure functions in `src/lib` and `src/server` are easy to
  test with Vitest; mock `fetch` for GitLab calls.
- **Keep pull requests focused** — one change per PR, with a short description of why.

## Testing against a real GitLab

Use a token on a test group you own. Prefer `read_api` unless you are testing edits.
