import { NextResponse, type NextRequest } from "next/server";

import { sessionCookieName } from "@/src/lib/auth/constants";

const publicPaths = ["/login"];
const publicApiPrefixes = ["/api/auth"];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicApiPath(pathname: string) {
  return publicApiPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !hasSessionCookie) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (isPublicPath(pathname)) {
    if (hasSessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};
