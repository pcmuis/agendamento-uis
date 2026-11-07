import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Puxa o bucket da variável de ambiente ou usa a string direta como fallback
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "uis-agendamento.firebasestorage.app";

    return [
      {
        source: '/storage-proxy/:path*',
        destination: `https://googleapis.com{bucketName}/o/:path*`,
      },
    ];
  },
};

export default nextConfig;
