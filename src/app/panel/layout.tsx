import Link from "next/link";
import { logout } from "@/app/actions";
import { textAiEnabled } from "@/lib/ai/text";
import { imageAiEnabled } from "@/lib/ai/image";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const demo = !textAiEnabled() || !imageAiEnabled();
  return (
    <div className="min-h-screen">
      <nav className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/panel" className="font-display text-lg">
            sanal·inf <span className="text-sm text-muted">stüdyo</span>
          </Link>
          <Link href="/panel" className="text-sm hover:text-brand">
            Karakterler
          </Link>
          <Link href="/panel/takvim" className="text-sm hover:text-brand">
            Takvim
          </Link>
          <Link href="/" className="text-sm hover:text-brand">
            Site
          </Link>
          <form action={logout} className="ml-auto">
            <button className="text-sm text-muted hover:text-brand">Çıkış</button>
          </form>
        </div>
      </nav>
      {demo && (
        <div className="bg-amber-50 px-6 py-2 text-center text-xs text-amber-800">
          Demo modu: {!textAiEnabled() && "ANTHROPIC_API_KEY "}
          {!imageAiEnabled() && "REPLICATE_API_TOKEN "}
          eksik, örnek içerik üretiliyor. Anahtarları .env dosyasına ekleyince gerçek AI devreye girer.
        </div>
      )}
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
