import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, buildAdminCookieOptions } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    ...buildAdminCookieOptions(),
    maxAge: 0,
  });
  return response;
}
