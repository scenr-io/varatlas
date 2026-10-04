# varatlas

**Find, audit and manage every GitLab CI/CD variable across your whole org, in one place.**

GitLab shows CI/CD variables one project or group at a time. Once you have dozens of
groups and hundreds of projects, nobody can answer simple questions any more:

- Where is `AWS_SECRET_ACCESS_KEY` defined, and how many copies are there?
- Which secrets are not masked or not protected?
- What does `production` actually receive, and from which group?

varatlas points at a GitLab token, discovers every group, subgroup and project that
token can see, and puts every CI/CD variable into one searchable table, with full
create / edit / delete support for every GitLab field (type, environment scope,
visibility including masked & hidden, protection, variable expansion, description).

> Built and maintained by [scenr](https://github.com/scenr-io). Runs entirely on your
> machine; your token and variables never leave it except to talk to your GitLab.

## Features

- **Automatic discovery.** Every group, subgroup and project the token can see. No
  config file listing projects.
- **Fast.** The whole org loads in a few GraphQL queries instead of one REST call per
  project; reopening is instant from an in-memory snapshot that refreshes in the background.
- **One table for the whole org.** Filter by group subtree, project, level, environment
  scope, protected / masked / file, or free-text search over keys, values and paths.
  Virtualized, so thousands of variables scroll smoothly.
- **Duplicate detection.** Keys defined in more than one group or project get a `×N` badge.
- **Full CRUD.** Every GitLab variable field. Same-key variables in different
  environment scopes are addressed correctly.
- **Safe by default.** Values are masked until revealed; masked-and-hidden values are
  never returned by GitLab and are shown as unreadable.
- **Tiny.** A ~23 KB web UI and a single-file server. The container image is ~50 MB.
- **Works with gitlab.com and self-managed GitLab.**

## Quick start

### Docker

```bash
docker build -t varatlas https://github.com/scenr-io/varatlas.git
docker run --rm -p 127.0.0.1:3131:3131 -e GITLAB_TOKEN=glpat-… varatlas
# → http://localhost:3131
```

Or with Compose, from a clone: `GITLAB_TOKEN=glpat-… docker compose up -d`.

Always publish the port on `127.0.0.1` as shown (see [Security model](#security-model)).

### From source

Requires Node.js ≥ 22.12 and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/scenr-io/varatlas.git
cd varatlas
pnpm install
pnpm build && pnpm start      # → http://localhost:3131
```

Paste a GitLab personal access token on the first screen, or set it once:

```bash
cp .env.example .env.local   # then set GITLAB_TOKEN=glpat-…
```

**Token scope:** `api` for read/write, `read_api` for read-only use (edits will fail
with 403). You need the **Maintainer** role on a group or project to read its
variables; anything you can't read is listed in a warning banner.

## Configuration

All settings are optional environment variables (or lines in `.env.local`).

| Variable                 | Default                   | Purpose                                                                                       |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------------- |
| `GITLAB_TOKEN`           | (none)                    | Token to use. Skips the token screen and loads the org at startup.                            |
| `GITLAB_BASE_URL`        | `https://gitlab.com`      | Your GitLab instance.                                                                         |
| `VARATLAS_EXCLUDE_PATHS` | (none)                    | Comma-separated path segments to skip, e.g. `sandbox,archive`. Matches any segment of a path. |
| `VARATLAS_ALLOWED_HOSTS` | `localhost,127.0.0.1,::1` | Hostnames the API answers for. See [Security model](#security-model).                         |
| `HOST`                   | `127.0.0.1`               | Listen address (`0.0.0.0` in the container image).                                            |
| `PORT`                   | `3131`                    | Listen port.                                                                                  |

## Security model

varatlas is a **single-user, local tool**. Read this before running it anywhere else.

- **There is no login.** Whoever can reach the server acts with the configured GitLab
  token and can read and change every variable it can see. The server listens on
  `127.0.0.1` by default; publish container ports on `127.0.0.1` only.
- **The token stays server-side.** It comes from `GITLAB_TOKEN` or an `httpOnly`,
  `SameSite=Strict` cookie and is only ever sent to your GitLab instance. Snapshots are
  kept in memory only, never written to disk.
- **Browser-based attacks are blocked.** API requests must carry an allowed `Host`
  header (stops DNS rebinding), and every state-changing request must be same-origin
  JSON (stops cross-site form posts). A strict Content-Security-Policy allows only
  same-origin scripts, and pages cannot be framed.
- **Hardened container.** Distroless image, no shell, runs as a non-root user, works with
  a read-only filesystem and all capabilities dropped (see `compose.yaml`).
- **Sharing it with a team?** Put it behind your own authenticating reverse proxy
  (SSO, VPN, etc.), then add that hostname to `VARATLAS_ALLOWED_HOSTS`. Never expose it
  directly.

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## How it works

```
browser (Preact UI, ~23 KB) ──► Hono server (one bundled file)
                                 ├─ guards: host / origin / content-type
                                 ├─ snapshot cache (memory, per token)
                                 └─ GitLab: GraphQL for loading, REST for edits
```

- **Loading:** one REST call lists your groups, then a few paginated GraphQL queries per
  root group fetch every subgroup, project and variable. If GraphQL is unavailable (older
  self-managed GitLab), varatlas falls back to REST automatically.
- **Caching:** the server keeps the last snapshot in memory. Opening the UI shows it
  instantly and refreshes it in the background when it is older than 30 seconds. Edits
  update the snapshot in place.

```
src/
  server/          Hono app, run as dist/server/index.mjs
    gitlab/        GitLab client (REST + GraphQL, 429 retry), loaders, variable CRUD
    snapshot.ts    in-memory snapshot cache
    security.ts    request guards
    validation.ts  request-body validation (only known fields reach GitLab)
  shared/          types shared by server and browser
  web/             Preact + Tailwind UI, built by Vite into dist/public
```

**GitLab notes**

- "Masked and hidden" can only be set at creation (a GitLab rule).
- Group-level environment scopes require GitLab Premium; GitLab enforces this.

## Development

```bash
pnpm dev          # UI with hot reload + API server → http://localhost:3131
pnpm check        # lint + typecheck + tests
pnpm test:watch   # tests in watch mode
pnpm build        # production build → dist/
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Scenr Technologies Private Limited
