import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listTemplates } from "@/lib/video/templates";
import { presetById } from "@/lib/video/presets";

export const dynamic = "force-dynamic";

const SHOT: Record<string, string> = { close: "Yakın", medium: "Orta", full: "Boy" };

export default async function TemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.query.characters.findFirst({ where: eq(schema.characters.id, id) });
  if (!c) notFound();
  const templates = await listTemplates(c.id);
  const photos = templates.filter((t) => t.source === "photo");
  const ideas = templates.filter((t) => t.source === "idea");

  return (
    <div className="space-y-10">
      <div>
        <Link href={`/panel/karakter/${c.id}`} className="text-sm text-muted hover:text-brand">
          ← {c.name}
        </Link>
        <h1 className="mt-2 font-display text-4xl">Sahne şablonları</h1>
        <p className="mt-1 max-w-3xl text-muted">
          <b>{photos.length} hazır fotoğraf</b> doğrudan video başlangıç karesi olarak kullanılır (yüz ortalanmış 9:16
          kesim). <b>{ideas.length} senaryo fikri</b> için kare, {c.name}&apos;nın yüzüyle yeniden üretilir. Hareket
          laboratuvarında ve Reels senaryolarında bu şablonlar seçilebilir; senaryo yazarı da bunlardan seçer.
        </p>
      </div>

      <section>
        <h2 className="mb-4 font-display text-2xl">Hazır fotoğraflar</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {photos.map((t) => (
            <figure key={t.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.frameUrl} alt={t.title} className="aspect-[9/16] w-full object-cover" loading="lazy" />
              <figcaption className="space-y-1 p-3 text-xs">
                <p className="font-semibold">{t.title}</p>
                <p className="text-muted">
                  {SHOT[t.shot]} · {t.expression}
                  {t.talkable && " · 🗣 konuşmaya uygun"}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {t.presets.map((p) => (
                    <span key={p} className="badge bg-brand-soft text-brand">
                      {presetById(p)?.label ?? p}
                    </span>
                  ))}
                </div>
                <a href={t.imageUrl} target="_blank" rel="noreferrer" className="block pt-1 text-brand">
                  Orijinali aç ↗
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-display text-2xl">Senaryo fikirleri</h2>
        <p className="mb-4 text-sm text-muted">
          Kolajdaki mekân ve mimikler. Küçük önizlemeler eğitimde kullanılmaz; seçildiğinde sahne {c.name}&apos;nın
          yüzüyle yeniden üretilir.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          {ideas.map((t) => (
            <figure key={t.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.imageUrl} alt={t.title} className="aspect-[6/5] w-full object-cover" loading="lazy" />
              <figcaption className="space-y-1 p-3 text-xs">
                <p className="font-semibold">{t.title}</p>
                <p className="text-muted">{t.expression}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {t.presets.map((p) => (
                    <span key={p} className="badge bg-gray-100 text-gray-700">
                      {presetById(p)?.label ?? p}
                    </span>
                  ))}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
