import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { deleteCharacter, updateCharacter } from "@/app/actions";
import { toLocalInput } from "@/lib/format";
import CharacterForm from "@/components/CharacterForm";
import ContentStudio from "@/components/ContentStudio";
import PostRow from "@/components/PostRow";
import { IMAGE_MODE_LABEL, imageMode, type ImageMode } from "@/lib/ai/image";

export const dynamic = "force-dynamic";

export default async function CharacterDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.query.characters.findFirst({
    where: eq(schema.characters.id, id),
    with: { posts: { orderBy: desc(schema.posts.createdAt), limit: 50 } },
  });
  if (!c) notFound();

  const availableModes: ImageMode[] = [
    ...(c.loraVersion ? (["lora"] as const) : []),
    ...(c.referenceImageUrl || c.avatarUrl ? (["reference"] as const) : []),
    "text",
  ];

  // Varsayılan paylaşım zamanı: yarın 19:00 (İstanbul)
  const tomorrow = toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)).slice(0, 10);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-5">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-brand-soft ring-4 ring-brand-soft">
          {c.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <h1 className="font-display text-4xl">{c.name}</h1>
          <p className="text-muted">
            {c.handle} · {c.niche}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href={`/panel/karakter/${c.id}/reels`} className="btn-primary">
            🎬 Reels
          </Link>
          <Link href={`/panel/karakter/${c.id}/video`} className="btn-ghost">
            Ses ve hareket
          </Link>
          <Link href={`/panel/karakter/${c.id}/sablonlar`} className="btn-ghost">
            Şablonlar
          </Link>
          <Link href={`/panel/karakter/${c.id}/yuz`} className="btn-ghost">
            Yüz tutarlılığı · {IMAGE_MODE_LABEL[imageMode(c)]}
          </Link>
          <Link href={`/k/${c.slug}`} className="btn-ghost" target="_blank">
            Tanıtım sayfası ↗
          </Link>
        </div>
      </header>

      <ContentStudio
        characterId={c.id}
        defaultTime={`${tomorrow}T19:00`}
        modes={availableModes.map((m) => ({ value: m, label: IMAGE_MODE_LABEL[m] }))}
        defaultMode={imageMode(c)}
      />

      <section>
        <h2 className="mb-4 font-display text-2xl">Gönderiler</h2>
        {c.posts.length === 0 ? (
          <p className="text-sm text-muted">Henüz gönderi yok.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {c.posts.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>

      <details className="card p-6">
        <summary className="cursor-pointer font-semibold">Karakter ayarları</summary>
        <div className="mt-5">
          <CharacterForm
            action={updateCharacter.bind(null, c.id)}
            character={c}
            submitLabel="Kaydet"
          />
          <form action={deleteCharacter.bind(null, c.id)} className="mt-6 border-t border-line pt-4">
            <button className="btn-danger">Karakteri ve tüm gönderilerini sil</button>
          </form>
        </div>
      </details>
    </div>
  );
}
