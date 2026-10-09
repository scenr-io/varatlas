/* One screen per reason the token can't be used, each saying what's wrong and how to fix it. */

import { Button } from "@/components/ui/Button";
import { plural } from "@/format";
import type { AuthStatus } from "@shared/types";
import { AccessProblem, CheckAgain, checksFor, CreateTokenLink, EnvTokenFix } from "./AccessProblem";

const hostOf = (auth: AuthStatus) => new URL(auth.baseUrl).host;

/** Offered when the token came from the session cookie, so a different one can be pasted. */
function UseOtherToken({ auth, onUseOther }: { auth: AuthStatus; onUseOther: () => void }) {
  return auth.source === "cookie" ? <Button onClick={onUseOther}>Use a different token</Button> : null;
}

/** The page loaded, but the varatlas server itself isn't answering. */
export function ServerUnreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <AccessProblem title="Can't reach varatlas" actions={<CheckAgain onClick={onRetry} />}>
      <p>
        This page loaded, but the varatlas server isn't answering. It may be restarting, or the container or
        proxy in front of it may be down.
      </p>
      <p>Check that varatlas is running, then try again.</p>
    </AccessProblem>
  );
}

export function GitLabUnreachable({ auth, onRetry }: { auth: AuthStatus; onRetry: () => void }) {
  return (
    <AccessProblem title={`Can't reach GitLab at ${hostOf(auth)}`} actions={<CheckAgain onClick={onRetry} />}>
      <p>
        varatlas couldn't connect to GitLab, so it can't check your token yet. Make sure{" "}
        <span className="font-mono text-fg">GITLAB_BASE_URL</span> points at your GitLab, and that this
        machine can reach it (VPN, proxy or firewall).
      </p>
    </AccessProblem>
  );
}

/** GitLab refused the token from GITLAB_TOKEN, which can only be fixed on the server. */
export function ServerTokenRefused({ auth, onRetry }: { auth: AuthStatus; onRetry: () => void }) {
  return (
    <AccessProblem
      title="GitLab refused the server's token"
      checks={checksFor(auth, "accepted")}
      actions={
        <>
          <CreateTokenLink baseUrl={auth.baseUrl} />
          <CheckAgain onClick={onRetry} />
        </>
      }
    >
      <p>It may have expired, been revoked, or been copied incompletely.</p>
      <EnvTokenFix />
    </AccessProblem>
  );
}

export function ScopeMissing({
  auth,
  onRetry,
  onUseOther,
}: {
  auth: AuthStatus;
  onRetry: () => void;
  onUseOther: () => void;
}) {
  const fromEnv = auth.source === "env";
  return (
    <AccessProblem
      title="This token can't read CI/CD variables"
      checks={checksFor(auth, "read")}
      actions={
        <>
          <CreateTokenLink baseUrl={auth.baseUrl} />
          {fromEnv ? <CheckAgain onClick={onRetry} /> : <UseOtherToken auth={auth} onUseOther={onUseOther} />}
        </>
      }
    >
      <p>
        GitLab accepts it, but not for CI/CD variables. Create a token with the{" "}
        <span className="font-mono text-fg">api</span> scope to browse and edit, or{" "}
        <span className="font-mono text-fg">read_api</span> to browse only.
      </p>
      {fromEnv && <EnvTokenFix />}
    </AccessProblem>
  );
}

export function RoleMissing({
  auth,
  paths,
  onRetry,
  onUseOther,
}: {
  auth: AuthStatus;
  paths: string[];
  onRetry: () => void;
  onUseOther: () => void;
}) {
  return (
    <AccessProblem
      title="Your account can't read CI/CD variables here"
      checks={checksFor(auth, "role")}
      paths={paths}
      actions={
        <>
          <CheckAgain onClick={onRetry} />
          <UseOtherToken auth={auth} onUseOther={onUseOther} />
        </>
      }
    >
      <p>
        You can see {plural(paths.length, "group or project", "groups and projects")}, but GitLab only shows
        CI/CD variables to Maintainers and Owners, and your role is lower in all of them.
      </p>
      <p>Ask an Owner to make you a Maintainer, or connect a token from an account that already is one.</p>
      {auth.source === "env" && <EnvTokenFix />}
    </AccessProblem>
  );
}

export function NoGroups({
  auth,
  onRetry,
  onUseOther,
}: {
  auth: AuthStatus;
  onRetry: () => void;
  onUseOther: () => void;
}) {
  return (
    <AccessProblem
      title="This account isn't in any groups"
      checks={checksFor(auth, "groups")}
      actions={
        <>
          <CheckAgain onClick={onRetry} />
          <UseOtherToken auth={auth} onUseOther={onUseOther} />
        </>
      }
    >
      <p>
        varatlas starts from the groups your account belongs to on {hostOf(auth)}, and this account has none.
        Join a group, or connect a token from an account that is a member of one.
      </p>
    </AccessProblem>
  );
}
