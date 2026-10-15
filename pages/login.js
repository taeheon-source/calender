import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";

function safeNextPath(value) {
  // 외부 사이트로의 리다이렉트를 막기 위해 내부 경로만 허용한다.
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "로그인에 실패했습니다.");
      }

      window.location.replace(safeNextPath(router.query.next));
    } catch (submitError) {
      setError(submitError.message);
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>로그인 | 2026 Calendar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>

      <main className="login-shell">
        <form className="panel login-panel" onSubmit={handleSubmit}>
          <p className="eyebrow">South Korea / KST</p>
          <h1>2026 Monthly Calendar</h1>

          <label className="input-wrap">
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "확인 중..." : "입장"}
          </button>

          {error ? <p className="login-error">{error}</p> : null}
        </form>
      </main>
    </>
  );
}
