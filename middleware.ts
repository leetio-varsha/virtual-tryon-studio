import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "tryon-auth";
const AUTH_PASSWORD = process.env.APP_PASSWORD;

if (!AUTH_PASSWORD) {
  console.warn("[auth] APP_PASSWORD is not set — password gate is disabled, the app is open to anyone who can reach it");
}

export function middleware(req: NextRequest) {
  // No password configured: skip the gate entirely (see warning above)
  if (!AUTH_PASSWORD) {
    return NextResponse.next();
  }

  // Skip auth for API file serving (images need to load in authenticated pages)
  if (req.nextUrl.pathname.startsWith("/api/files/")) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (authCookie === AUTH_PASSWORD) {
    return NextResponse.next();
  }

  // Login page
  if (req.nextUrl.pathname === "/login") {
    return NextResponse.next();
  }

  // Redirect to login
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
