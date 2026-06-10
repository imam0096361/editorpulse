import { NextRequest, NextResponse } from "next/server";
import {
  buildAdminCookieOptions,
  createAdminSessionToken,
  getAdminCredentials,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const credentials = getAdminCredentials();

    if (username !== credentials.username || password !== credentials.password) {
      return NextResponse.json({ success: false, error: "Invalid username or password" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: "editorpulse_admin_session",
      value: await createAdminSessionToken(credentials.username),
      ...buildAdminCookieOptions(),
    });
    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Login failed" }, { status: 500 });
  }
}
