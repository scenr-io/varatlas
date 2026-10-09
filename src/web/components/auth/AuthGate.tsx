/* Shows the right screen until there is a usable token, then renders the app. */

import type { ComponentChildren } from "preact";
import { Loader2 } from "lucide-preact";
import { AccessScreen } from "@/components/access/AccessProblem";
import {
  GitLabUnreachable,
  ScopeMissing,
  ServerTokenRefused,
  ServerUnreachable,
} from "@/components/access/screens";
import type { OrgVariablesApi } from "@/hooks/useOrgVariables";
import type { AuthStatus } from "@shared/types";
import { TokenGate } from "./TokenGate";

export function AuthGate({
  org,
  children,
}: {
  org: OrgVariablesApi;
  children: (auth: AuthStatus) => ComponentChildren;
}) {
  const { auth, connectionError } = org;
  const retry = () => void org.start();
  const useOther = () => void org.disconnect();

  if (auth === null && connectionError) {
    return (
      <AccessScreen>
        <ServerUnreachable onRetry={retry} />
      </AccessScreen>
    );
  }

  if (auth === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-page">
        <Loader2 className="h-6 w-6 animate-spin text-fg-3" aria-label="Loading" />
      </div>
    );
  }

  if (auth.configured) return <>{children(auth)}</>;

  if (auth.problem === "unreachable") {
    return (
      <AccessScreen>
        <GitLabUnreachable auth={auth} onRetry={retry} />
      </AccessScreen>
    );
  }
  if (auth.problem === "invalid" && auth.source === "env") {
    return (
      <AccessScreen>
        <ServerTokenRefused auth={auth} onRetry={retry} />
      </AccessScreen>
    );
  }
  if (auth.problem === "scope") {
    return (
      <AccessScreen>
        <ScopeMissing auth={auth} onRetry={retry} onUseOther={useOther} />
      </AccessScreen>
    );
  }
  return (
    <TokenGate
      baseUrl={auth.baseUrl}
      onConnected={retry}
      notice={
        auth.problem === "invalid"
          ? "GitLab refused your saved token, so it was removed. It may have expired or been revoked. Paste a new one to continue."
          : undefined
      }
    />
  );
}
