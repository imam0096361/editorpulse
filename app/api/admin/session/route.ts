import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: await isAdminRequestAuthorized(req) });
}
