/*
 * Demo mode (VARATLAS_DEMO=1): a fictional company, Northwind, served from memory
 * instead of GitLab. It exists for screenshots and for trying varatlas without a token.
 * Every finding varatlas knows about shows up at least once. All values are fake.
 * Changes are applied in memory only and vanish on restart.
 */

import type {
  EntityRef,
  EntityVariables,
  GitLabVariable,
  OrgTree,
  VariableChanges,
  VariableDraft,
} from "../shared/types";
import type { Backend } from "./backend";
import type { OrgData } from "./gitlab/org";
import { HttpError } from "./http";

const BASE_URL = "https://gitlab.example.com";

type Spec = [key: string, value: string | null, flags?: string, scope?: string, description?: string];

/** flags: p = protected, m = masked, h = masked and hidden, f = file, r = raw */
function variable([key, value, flags = "", scope = "*", description]: Spec): GitLabVariable {
  return {
    key,
    value: flags.includes("h") ? null : value,
    variable_type: flags.includes("f") ? "file" : "env_var",
    protected: flags.includes("p"),
    masked: flags.includes("m") || flags.includes("h"),
    hidden: flags.includes("h"),
    raw: flags.includes("r"),
    environment_scope: scope,
    description: description ?? null,
  };
}

const GROUPS: [path: string, vars: Spec[]][] = [
  [
    "northwind",
    [
      ["DOCKER_REGISTRY", "registry.northwind.example", "", "*", "Where every pipeline pushes images"],
      ["REGISTRY_PASSWORD", "demo-registry-password-01", "pm"],
      ["SENTRY_DSN", "https://demo@sentry.northwind.example/1"],
      ["SLACK_WEBHOOK_URL", "https://hooks.slack.example/demo/webhook", "pm"],
      ["AWS_DEFAULT_REGION", "eu-west-1"],
      ["AWS_ACCESS_KEY_ID", "DEMOACCESSKEYID0001", "pm"],
      ["AWS_SECRET_ACCESS_KEY", null, "ph"],
    ],
  ],
  [
    "northwind/platform",
    [
      ["TF_STATE_BUCKET", "northwind-terraform-state"],
      ["VAULT_ADDR", "https://vault.northwind.example"],
      ["VAULT_TOKEN", "demo-vault-token-not-real", "m"],
    ],
  ],
  [
    "northwind/platform/infra",
    [
      ["AWS_DEFAULT_REGION", "us-east-1", "", "*", "Infra runs in us-east-1"],
      ["KUBECONFIG", "apiVersion: v1\nkind: Config\nclusters: []", "pf"],
    ],
  ],
  ["northwind/payments", [["PCI_SCOPE", "true", "p"]]],
  ["northwind/web", []],
  ["northwind/data", [["DBT_PROFILES_DIR", "/builds/profiles"]]],
  ["northwind/mobile", []],
];

const PROJECTS: [path: string, vars: Spec[] | "no-access"][] = [
  [
    "northwind/platform/infra/terraform",
    [
      ["TF_VAR_db_password", "demo-prod-db-password", "pm", "production"],
      ["TF_VAR_db_password", "demo-staging-db-password", "pm", "staging"],
    ],
  ],
  [
    "northwind/platform/infra/k8s-clusters",
    [
      ["CLUSTER_NAME", "prod-eu-1", "", "production"],
      ["CLUSTER_NAME", "staging-eu-1", "", "staging"],
    ],
  ],
  ["northwind/platform/ci-templates", []],
  [
    "northwind/payments/payments-api",
    [
      ["STRIPE_SECRET_KEY", "demo-stripe-secret-live", "pm", "production"],
      ["STRIPE_SECRET_KEY", "demo-stripe-secret-test", "m", "staging"],
      ["DATABASE_URL", "postgres://payments@db-prod.northwind.example/payments", "pm", "production"],
      ["DATABASE_URL", "postgres://payments@db-staging.northwind.example/payments", "m", "staging"],
      ["REDIS_URL", "redis://cache.northwind.example:6379"],
    ],
  ],
  [
    "northwind/payments/ledger",
    [
      ["DATABASE_URL", "postgres://ledger@db-prod.northwind.example/ledger", "pm", "production"],
      ["REDIS_URL", "redis://cache.northwind.example:6379"],
    ],
  ],
  [
    "northwind/payments/fraud-checks",
    [
      ["REDIS_URL", "redis://cache.northwind.example:6379"],
      ["FRAUD_MODEL_VERSION", "2026-09"],
    ],
  ],
  [
    "northwind/web/storefront",
    [
      ["NEXT_PUBLIC_API_URL", "https://api.northwind.example"],
      ["STRIPE_PUBLISHABLE_KEY", "demo-publishable-key"],
      ["SENTRY_DSN", "https://demo@sentry.northwind.example/7", "m", "*", "Storefront has its own Sentry project"],
    ],
  ],
  [
    "northwind/web/admin-dashboard",
    [
      ["NEXT_PUBLIC_API_URL", "https://api.northwind.example"],
      ["ADMIN_SESSION_SECRET", "demo-admin-session-secret", "pm"],
    ],
  ],
  [
    "northwind/data/warehouse-etl",
    [
      ["SNOWFLAKE_ACCOUNT", "northwind-demo.eu-west-1"],
      ["SNOWFLAKE_PASSWORD", null, "ph"],
      ["DBT_TARGET", "prod", "", "production"],
      ["DATABASE_URL", "postgres://etl@db-prod.northwind.example/warehouse", "pm", "production"],
    ],
  ],
  ["northwind/data/analytics-api", [["ANALYTICS_CACHE_TTL", "300"]]],
  ["northwind/data/ml-experiments", "no-access"],
  [
    "northwind/mobile/ios-app",
    [
      ["APP_STORE_CONNECT_API_KEY", "-----DEMO KEY-----", "pf"],
      ["FASTLANE_TEAM_ID", "DEMOTEAM01"],
    ],
  ],
  [
    "northwind/mobile/android-app",
    [
      ["GOOGLE_PLAY_SERVICE_ACCOUNT", '{"type":"service_account","demo":true}', "pf"],
      ["KEYSTORE_PASSWORD", "demo-keystore-password", "pm"],
    ],
  ],
];

const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null);

/** A fresh copy of the demo org, in the same shape the GitLab loader produces. */
export function demoOrg(): { tree: OrgTree; entities: EntityVariables[] } {
  const groupIds = new Map(GROUPS.map(([path], i) => [path, i + 1]));
  const tree: OrgTree = {
    groups: GROUPS.map(([path]) => ({
      id: groupIds.get(path)!,
      name: nameOf(path),
      full_path: path,
      parent_id: groupIds.get(parentOf(path) ?? "") ?? null,
      web_url: `${BASE_URL}/groups/${path}`,
    })),
    projects: PROJECTS.map(([path], i) => ({
      id: 100 + i,
      name: nameOf(path),
      path_with_namespace: path,
      namespace_id: groupIds.get(parentOf(path)!)!,
      web_url: `${BASE_URL}/${path}`,
      archived: false,
    })),
  };
  const entities: EntityVariables[] = [
    ...GROUPS.map(([path, vars]) => ({
      entity: "group" as const,
      id: groupIds.get(path)!,
      path,
      name: nameOf(path),
      web_url: `${BASE_URL}/groups/${path}`,
      variables: vars.map(variable),
    })),
    ...PROJECTS.map(([path, vars], i) => ({
      entity: "project" as const,
      id: 100 + i,
      path,
      name: nameOf(path),
      web_url: `${BASE_URL}/${path}`,
      variables: vars === "no-access" ? [] : vars.map(variable),
      ...(vars === "no-access" ? { error: "No access to CI/CD variables (needs Maintainer)" } : {}),
    })),
  ];
  return { tree, entities };
}

/** The demo backend: one in-memory Northwind shared by everyone using this server. */
export function createDemo(): { backend: Backend; fetchOrg: () => Promise<OrgData> } {
  const org = demoOrg();

  function entity(target: EntityRef): EntityVariables {
    const e = org.entities.find((x) => x.entity === target.entity && x.id === target.id);
    if (!e) throw new HttpError(404, "That group or project isn't part of the demo");
    if (e.error) throw new HttpError(403, "You need the Maintainer role on this group or project to change its variables.");
    return e;
  }
  const find = (e: EntityVariables, key: string, scope: string) =>
    e.variables.findIndex((v) => v.key === key && v.environment_scope === scope);

  const backend: Backend = {
    baseUrl: () => BASE_URL,
    whoAmI: async () => ({ username: "demo", name: "Demo user", avatar_url: null }),
    tokenAccess: async () => ({ name: "demo", scopes: ["api"], expiresAt: null }),

    async createVariable(_token, target, draft: VariableDraft) {
      const e = entity(target);
      if (find(e, draft.key, draft.environment_scope) >= 0) {
        throw new HttpError(400, `${draft.key} already exists for that environment`);
      }
      const hidden = draft.masked_and_hidden === true;
      const created: GitLabVariable = {
        key: draft.key,
        value: hidden ? null : draft.value,
        variable_type: draft.variable_type,
        protected: draft.protected,
        masked: draft.masked || hidden,
        hidden,
        raw: draft.raw,
        environment_scope: draft.environment_scope,
        description: draft.description ?? null,
      };
      e.variables.push(created);
      return created;
    },

    async updateVariable(_token, target, key, scope, changes: VariableChanges) {
      const e = entity(target);
      const i = find(e, key, scope);
      if (i < 0) throw new HttpError(404, `${key} doesn't exist for that environment`);
      const current = e.variables[i];
      const updated: GitLabVariable = {
        ...current,
        ...changes,
        // Hidden values stay unreadable, whatever is written to them.
        value: current.hidden ? null : (changes.value ?? current.value),
        description: changes.description === undefined ? current.description : changes.description || null,
      };
      e.variables[i] = updated;
      return updated;
    },

    async deleteVariable(_token, target, key, scope) {
      const e = entity(target);
      const i = find(e, key, scope);
      if (i < 0) throw new HttpError(404, `${key} doesn't exist for that environment`);
      e.variables.splice(i, 1);
    },
  };

  const fetchOrg = async (): Promise<OrgData> => ({
    tree: structuredClone(org.tree),
    entities: structuredClone(org.entities),
    source: "graphql",
  });

  return { backend, fetchOrg };
}
