import { NextResponse, type NextRequest } from "next/server";
import type { OrgVariables } from "@/lib/types";
import { requireToken } from "@/server/auth";
import { discoverTree } from "@/server/gitlab/discovery";
import {
  createVariable,
  deleteVariable,
  fetchAllVariables,
  updateVariable,
} from "@/server/gitlab/variables";
import { errorResponse, readJson } from "@/server/http";
import {
  parseCreateRequest,
  parseDeleteRequest,
  parseUpdateRequest,
} from "@/server/validation";

/** GET /api/variables — the org tree plus every variable, grouped by entity. */
export async function GET() {
  try {
    const token = await requireToken();
    const tree = await discoverTree(token);
    const entities = await fetchAllVariables(token, tree);
    return NextResponse.json<OrgVariables>({ tree, entities });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/variables — create a variable on a group or project. */
export async function POST(req: NextRequest) {
  try {
    const token = await requireToken();
    const { entity, id, draft } = parseCreateRequest(await readJson(req));
    const variable = await createVariable(token, { entity, id }, draft);
    return NextResponse.json({ variable });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PUT /api/variables — update the variable identified by key + environment scope. */
export async function PUT(req: NextRequest) {
  try {
    const token = await requireToken();
    const { entity, id, key, scope, changes } = parseUpdateRequest(
      await readJson(req),
    );
    const variable = await updateVariable(token, { entity, id }, key, scope, changes);
    return NextResponse.json({ variable });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/variables — delete the variable identified by key + environment scope. */
export async function DELETE(req: NextRequest) {
  try {
    const token = await requireToken();
    const { entity, id, key, scope } = parseDeleteRequest(await readJson(req));
    await deleteVariable(token, { entity, id }, key, scope);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
