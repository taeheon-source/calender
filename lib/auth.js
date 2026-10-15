export const AUTH_COOKIE = "calendar_auth";

// Edge(middleware)와 Node(API route) 양쪽에서 동작하도록 Web Crypto를 사용한다.
// 비밀번호를 바꾸면 토큰도 바뀌므로 기존 로그인은 모두 무효화된다.
export async function createAuthToken(password) {
  const data = new TextEncoder().encode(`calendar-auth:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}
