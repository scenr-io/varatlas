import { NextResponse, type NextRequest } from "next/server";
import { allowedHosts } from "@/server/config";
import { checkApiRequest } from "@/server/security";

export function proxy(req: NextRequest) {
  const verdict = checkApiRequest(req, allowedHosts());
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
