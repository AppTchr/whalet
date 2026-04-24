import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// NOTE: This middleware is a UX-only guard. It checks cookie presence only —
// it cannot verify JWT signatures in the Edge runtime. All authorization is
// enforced server-side by the API on every request.
const AUTH_COOKIE_NAME = "access_token";

function isProtectedRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login" || pathname === "/health") {
    return false;
  }
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/health" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
  const isAuthenticated = !!authCookie?.value;

  if (!isAuthenticated && isProtectedRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/wallets", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
