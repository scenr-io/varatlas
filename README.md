# varatlas

**Find, audit and manage every GitLab CI/CD variable across your whole org — in one place.**

GitLab shows CI/CD variables one project or group at a time. Once you have dozens of
groups and hundreds of projects, nobody can answer simple questions any more:

- Where is `AWS_SECRET_ACCESS_KEY` defined, and how many copies are there?
- Which secrets are not masked or not protected?
- What does `production` actually receive, and from which group?

varatlas points at a GitLab token, discovers every group, subgroup and project that
token can see, and puts every CI/CD variable into one searchable table — with full
create / edit / delete support for every GitLab field (type, environment scope,
visibility including masked & hidden, protection, variable expansion, description).

> Built and maintained by [scenr](https://github.com/scenr-io). Runs entirely on your
> machine; your token and variables never leave it except to talk to your GitLab.

## Features

- **Automatic discovery** — member groups → all descendant subgroups → all projects,
  paginated, deduplicated and fetched concurrently. No config file listing projects.
- **One table for the whole org** — filter by group subtree, project, level, environment
  scope, protected / masked / file, or free-text search over keys, values and paths.
- **Duplicate detection** — keys defined in more than one group or project get a `×N` badge.
- **Full CRUD** — every GitLab variable field. Same-key variables in different
  environment scopes are addressed correctly.
- **Safe by default** — values are masked until revealed; masked-and-hidden values are
  never returned by GitLab and are shown as unreadable.
- **Works with gitlab.com and self-managed GitLab.**

## Quick start

Requires Node.js ≥ 20.9 and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/scenr-io/varatlas.git
cd varatlas
pnpm install
pnpm dev            # → http://localhost:3131
```

Paste a GitLab personal access token on the first screen, or set it once:

```bash
cp .env.example .env.local   # then set GITLAB_TOKEN=glpat-…
```

**Token scope:** `api` for read/write, `read_api` for read-only use (edits will fail
with 403). You need the **Maintainer** role on a group or project to read its
variables; anything you can't read is listed in a warning banner.

If you use [just](https://github.com/casey/just): `just on`, `just off`, `just logs`.

## Configuration

All settings are optional environment variables (put them in `.env.local`).

| Variable                 | Default                         | Purpose                                                                                     |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------- |
| `GITLAB_TOKEN`           | —                               | Token to use. If set, the token screen is skipped.                                          |
| `GITLAB_BASE_URL`        | `https://gitlab.com`            | Your GitLab instance.                                                                       |
| `VARATLAS_EXCLUDE_PATHS` | —                               | Comma-separated path segments to skip, e.g. `sandbox,archive`. Matches any segment of a path. |
| `VARATLAS_ALLOWED_HOSTS` | `localhost,127.0.0.1,::1`       | Hostnames the API answers for. See [Security model](#security-model).                       |

## Security model

varatlas is a **single-user, local tool**. Read this before running it anywhere else.

- **There is no login.** Whoever can reach the server acts with the configured GitLab
  token and can read and change every variable it can see. `pnpm dev` and `pnpm start`
  therefore bind to `127.0.0.1` only.
- **The token stays server-side.** It comes from `GITLAB_TOKEN` or an `httpOnly`,
  `SameSite=Strict` cookie and is only ever sent to your GitLab instance.
- **Browser-based attacks are blocked.** API requests must carry an allowed `Host`
  header (stops DNS rebinding), and every state-changing request must be same-origin
  JSON (stops cross-site form posts). Pages cannot be framed.
- **Sharing it with a team?** Put it behind your own authenticating reverse proxy
  (SSO, VPN, etc.), then add that hostname to `VARATLAS_ALLOWED_HOSTS`. Never expose it
  directly.

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## How it works

```
browser ──► Next.js API routes (src/app/api) ──► GitLab REST API v4
             │  proxy.ts: host / origin / content-type guards
             └─ src/server: token resolution, validation, GitLab client
```

```
src/
  app/            Next.js App Router: page, layout, API routes
  proxy.ts        request guards for /api/*
  server/         server-only code
    gitlab/       client (pagination, 429 retry), discovery, variables, user
    auth.ts       token resolution (env or cookie)
    validation.ts request-body validation (only known fields reach GitLab)
    security.ts   host / origin / content-type checks
  lib/            code shared with the browser: types, API client, row & tree logic
  hooks/          useOrgVariables — auth, data loading and mutations
  components/     UI, grouped by feature
```

**GitLab notes**

- "Masked and hidden" can only be set at creation (a GitLab rule).
- Group-level environment scopes require GitLab Premium; GitLab enforces this.

## Development

```bash
pnpm dev          # dev server on http://localhost:3131
pnpm check        # lint + typecheck + tests
pnpm test:watch   # tests in watch mode
pnpm build        # production build
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © scenr
