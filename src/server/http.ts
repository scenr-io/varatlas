import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/** An error that maps directly onto an HTTP response status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const message =
    e instanceof HttpError ? e.message : "Unexpected server error";
  if (!(e instanceof HttpError)) console.error(e);
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}
