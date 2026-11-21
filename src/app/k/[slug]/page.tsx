import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { characters, posts } = schema;
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await db.query.characters.findFirst({ where: eq(characters.slug, slug) });
  if (!c) return {};
  return {
    title: `${c.name} (${c.handle})`,
    description: c.bio,
    openGraph: { title: c.name, description: c.bio, images: c.avatarUrl ? [c.avatarUrl] : [] },
  };
}

export default async function CharacterPage({ params }: Props) {
  const { slug } = await params;
  const c = await db.query.characters.findFirst({
    where: eq(characters.slug, slug),
    with: {
      posts: { where: eq(posts.status, "PUBLISHED"), orderBy: desc(posts.publishedAt), limit: 30 },
    },
  });
  if (!c) notFound();

  const igHandle = c.handle.replace(/^@/, "");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm text-muted hover:text-brand">
        ← Tüm karakterler
      </Link>

      <section className="mt-8 flex flex-col items-center gap-8 sm:flex-row sm:items-start">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-full ring-4 ring-brand-soft">
          {c.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="font-display text-5xl">{c.name}</h1>
          <p className="mt-1 text-muted">
            {c.handle} · {c.city}
          </p>
          <p className="mt-4 max-w-xl text-lg whitespace-pre-line">{c.bio}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
            <a
              href={`https://instagram.com/${igHandle}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Instagram&apos;da takip et
            </a>
            <span className="badge bg-brand-soft text-brand">{c.niche}</span>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-5 font-display text-2xl">Son paylaşımlar</h2>
        {c.posts.length === 0 ? (
          <p className="text-muted">Henüz paylaşım yok, çok yakında 💜</p>
        ) : (
          <div className="grid items-start gap-6 sm:grid-cols-2">
            {c.posts.map((p) => (
              <article key={p.id} className="card overflow-hidden">
                {p.videoUrl ? (
                  <video
                    src={p.videoUrl}
                    poster={p.imageUrl || undefined}
                    controls
                    playsInline
                    className="aspect-[9/16] w-full bg-ink object-cover"
                  />
                ) : (
                  p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="aspect-[4/5] w-full object-cover" />
                  )
                )}
                <div className="p-5">
                  <p className="text-sm whitespace-pre-line">{p.caption}</p>
                  {p.hashtags && <p className="mt-3 text-sm text-brand">{p.hashtags}</p>}
                  <p className="mt-3 text-xs text-muted">{fmtDateTime(p.publishedAt)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
