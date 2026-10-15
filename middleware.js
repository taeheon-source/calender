import { NextResponse } from "next/server";
import { AUTH_COOKIE, createAuthToken, safeEqual } from "./lib/auth";

export async function middleware(request) {
  const password = process.env.SITE_PASSWORD;

  // 비밀번호가 설정되지 않은 경우(로컬 개발 등)에는 보호하지 않는다.
  if (!password) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token && safeEqual(token, await createAuthToken(password))) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
