import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sanal Influencer Stüdyosu",
  description: "Sanal influencer karakterleri oluştur, içerik üret, planla ve paylaş.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
