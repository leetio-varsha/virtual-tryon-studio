import { NextRequest, NextResponse } from "next/server";

const AUTH_PASSWORD = process.env.APP_PASSWORD || "stimstix2024";

export function middleware(req: NextRequest) {
  // Skip auth for API file serving (images need to load in authenticated pages)
  if (req.nextUrl.pathname.startsWith("/api/files/")) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get("stim-auth")?.value;
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
