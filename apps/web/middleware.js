"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
const server_1 = require("next/server");
const AUTH_COOKIE_NAME = "access_token";
function isProtectedRoute(pathname) {
    if (pathname === "/" || pathname === "/login" || pathname === "/health") {
        return false;
    }
    return true;
}
function middleware(request) {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname === "/health" ||
        pathname.includes(".")) {
        return server_1.NextResponse.next();
    }
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
    const isAuthenticated = !!authCookie?.value;
    if (!isAuthenticated && isProtectedRoute(pathname)) {
        return server_1.NextResponse.redirect(new URL("/login", request.url));
    }
    if (isAuthenticated && pathname === "/login") {
        return server_1.NextResponse.redirect(new URL("/wallets", request.url));
    }
    return server_1.NextResponse.next();
}
exports.config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
