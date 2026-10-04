# Security policy

varatlas handles GitLab tokens and CI/CD secrets, so we take reports seriously.

## Reporting a vulnerability

Please **do not open a public issue.** Use GitHub's
[private vulnerability reporting](https://github.com/scenr-io/varatlas/security/advisories/new)
for this repository. We aim to acknowledge reports within 3 working days.

Include what you found, how to reproduce it, and the impact you expect.

## Threat model

varatlas is designed as a **single-user tool running on the user's own machine**.

In scope:

- Leaking the GitLab token to the browser, logs, or any host other than the configured GitLab.
- A web page in the user's browser reading or changing variables through a locally
  running varatlas (CSRF, DNS rebinding, clickjacking, CORS mistakes).
- Request parameters reaching GitLab that the user did not intend.

Out of scope:

- Anyone who can already reach the varatlas server directly — by design they act with
  its token. Deployments shared over a network must sit behind an authenticating proxy
  (see the README).
- Vulnerabilities in GitLab itself.
