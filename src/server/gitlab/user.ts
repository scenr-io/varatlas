import type { GitLabUser } from "../../shared/types";
import { glJson } from "./client";

export async function whoAmI(token: string): Promise<GitLabUser> {
  const user = await glJson<GitLabUser>(token, "/user");
  return { username: user.username, name: user.name, avatar_url: user.avatar_url };
}
