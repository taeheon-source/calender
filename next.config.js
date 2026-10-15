/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // 예전 로그인 주소로 들어와도 첫 화면(로그인 화면)으로 보낸다.
    return [{ source: "/login", destination: "/", permanent: false }];
  },
};

module.exports = nextConfig;
