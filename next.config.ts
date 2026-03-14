import type { NextConfig } from "next";

function normalizeServerActionOrigins(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return new URL(item).host;
      } catch {
        return item.replace(/^https?:\/\//, "");
      }
    });
}

const allowedOrigins = normalizeServerActionOrigins(
  process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL,
);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
    ],
  },
};

export default nextConfig;
