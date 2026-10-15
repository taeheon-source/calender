export const SESSION_MINUTES = 30;

// Edge(middleware)와 Node(API route) 양쪽에서 동작하도록 Web Crypto를 사용한다.
// 비밀번호를 서명 키로 쓰므로 비밀번호를 바꾸면 기존 로그인은 모두 무효화된다.
async function sign(password, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`calendar-auth:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return Array.from(new Uint8Array(signature))
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

// 토큰 형식: "<만료시각(ms)>.<서명>"
export async function createSessionToken(password) {
  const expiresAt = Date.now() + SESSION_MINUTES * 60 * 1000;
  return { token: `${expiresAt}.${await sign(password, String(expiresAt))}`, expiresAt };
}

export async function verifySessionToken(password, token) {
  const [expiresAt, signature] = String(token ?? "").split(".");

  if (!expiresAt || !signature || Number(expiresAt) <= Date.now()) {
    return false;
  }

  return safeEqual(signature, await sign(password, expiresAt));
}
