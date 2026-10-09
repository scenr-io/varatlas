/* The whole app: the token check first, then the workspace. */

import { AuthGate } from "@/components/auth/AuthGate";
import { Workspace } from "@/components/Workspace";
import { useOrgVariables } from "@/hooks/useOrgVariables";

export function Dashboard() {
  const org = useOrgVariables();
  return <AuthGate org={org}>{(auth) => <Workspace org={org} auth={auth} />}</AuthGate>;
}
