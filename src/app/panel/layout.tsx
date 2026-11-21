import Link from "next/link";
import { logout } from "@/app/actions";
import { ensureSettings } from "@/lib/config";
import { textAiEnabled } from "@/lib/ai/text";
import { imageAiEnabled } from "@/lib/ai/image";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await ensureSettings();
  const missing = [!textAiEnabled() && "Claude", !imageAiEnabled() && "Replicate"].filter(Boolean);
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
          <Link href="/panel/ayarlar" className="text-sm hover:text-brand">
            Kurulum
          </Link>
          <Link href="/" className="text-sm hover:text-brand">
            Site
          </Link>
          <form action={logout} className="ml-auto">
            <button className="text-sm text-muted hover:text-brand">Çıkış</button>
          </form>
        </div>
      </nav>
      {missing.length > 0 && (
        <div className="bg-amber-50 px-6 py-2 text-center text-xs text-amber-800">
          Demo modu: {missing.join(" ve ")} bağlı değil, ilgili kısımlar örnek içerik üretir.{" "}
          <Link href="/panel/ayarlar" className="font-semibold underline">
            Anahtarları bağla →
          </Link>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
