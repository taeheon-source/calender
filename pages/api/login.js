import {
  AUTH_COOKIE,
  AUTH_MAX_AGE,
  createAuthToken,
  safeEqual,
} from "../../lib/auth";

function buildCookie(value, maxAge) {
  const parts = [
    `${AUTH_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const sitePassword = process.env.SITE_PASSWORD;
    const { password } = req.body ?? {};

    if (!sitePassword) {
      return res.status(200).json({ ok: true });
    }

    const expected = await createAuthToken(sitePassword);
    const submitted = await createAuthToken(String(password ?? ""));

    if (!safeEqual(submitted, expected)) {
      return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
    }

    res.setHeader("Set-Cookie", buildCookie(expected, AUTH_MAX_AGE));
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", buildCookie("", 0));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
