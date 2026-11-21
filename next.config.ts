import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Yerel ikili dosyalar içeren paketler sunucu paketine gömülmesin
  serverExternalPackages: ["ffmpeg-static", "@libsql/client", "libsql"],
  // Altyazı fontları ve ffmpeg, sunucu dosya izlemesine dahil edilsin
  outputFileTracingIncludes: {
    "/api/video/**": ["./assets/fonts/**", "./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
