import { createSessionToken, safeEqual } from "../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const sitePassword = process.env.SITE_PASSWORD;
  const { password } = req.body ?? {};

  // 비밀번호가 설정되지 않은 경우에도 화면 흐름은 같게 유지한다.
  if (!sitePassword) {
    return res.status(200).json(await createSessionToken(""));
  }

  if (!safeEqual(String(password ?? ""), sitePassword)) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  return res.status(200).json(await createSessionToken(sitePassword));
}
