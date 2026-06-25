import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionToken } from "@/lib/admin-auth";

const ADMIN_PATH_PREFIX = "/admin";
const PROTECTED_API_PREFIXES = ["/api/upload", "/api/admin"];
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login", "/api/admin/session"];

function isProtectedApiPath(pathname: string) {
  return PROTECTED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicAdminPath(pathname: string) {
  return PUBLIC_ADMIN_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("editorpulse_admin_session")?.value;
  const isAuthed = await verifyAdminSessionToken(token);

  if (isPublicAdminPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith(ADMIN_PATH_PREFIX)) {
    if (!isAuthed) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isProtectedApiPath(pathname) && req.method !== "GET") {
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/upload/:path*", "/api/admin/:path*"],
};
