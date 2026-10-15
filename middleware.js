import { NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth";

// 화면에는 데이터가 없고 모든 일정은 API로 불러오므로 API만 막는다.
// 토큰은 브라우저 메모리에만 있어서 새로고침하면 다시 비밀번호를 물어본다.
export async function middleware(request) {
  const password = process.env.SITE_PASSWORD;

  // 비밀번호가 설정되지 않은 경우(로컬 개발 등)에는 보호하지 않는다.
  if (!password) {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (await verifySessionToken(password, token)) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export const config = {
  matcher: ["/api/((?!login).*)"],
};
