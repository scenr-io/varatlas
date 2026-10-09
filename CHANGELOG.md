# Changelog

All notable changes to varatlas are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-10-09

### Fixed

- When the varatlas server can't be reached, the page now says so and offers to retry,
  instead of showing a spinner forever.
- A finding narrowed to a group or project no longer reads "1 variables".
- Escape closes a panel even when pressed right after it opens.
- Side panels move keyboard focus into themselves when they open and give it back when
  they close.

### Changed

- "Report an issue" opens a choice of bug report and feature request forms.
- The codebase follows one set of conventions ([docs/conventions.md](docs/conventions.md)):
  Prettier, stricter types and lint rules, shared UI building blocks, and a smaller
  Dashboard. CI now also runs component, integration and browser tests, with a coverage
  floor.

## [0.1.0] - 2026-10-08

First public release.

- Every CI/CD variable in a GitLab org in one place, loaded through GraphQL with a REST
  fallback for older self-managed GitLab.
- Findings: unmasked or unprotected secrets, drift between copies of a key, shareable
  copies, overrides and places the token can't read.
- The org atlas, protection and environment breakdowns, and a by-key view with every
  copy of a key side by side.
- Add, edit and delete variables, with clear screens for tokens that lack a scope or role.
- Demo mode (`VARATLAS_DEMO=1`) with a made-up org, no token needed.
- Docker image for amd64 and arm64 at `ghcr.io/scenr-io/varatlas`.

[0.1.1]: https://github.com/scenr-io/varatlas/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/scenr-io/varatlas/releases/tag/v0.1.0
