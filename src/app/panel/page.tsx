import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { characters: C, posts: P } = schema;
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  const [characters, upcoming] = await Promise.all([
    db
      .select({
        id: C.id,
        name: C.name,
        handle: C.handle,
        avatarUrl: C.avatarUrl,
        postCount: count(P.id),
      })
      .from(C)
      .leftJoin(P, eq(P.characterId, C.id))
      .groupBy(C.id)
      .orderBy(asc(C.createdAt)),
    db.query.posts.findMany({
      where: eq(P.status, "SCHEDULED"),
      orderBy: asc(P.scheduledAt),
      limit: 5,
      with: { character: true },
    }),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h1 className="font-display text-3xl">Karakterler</h1>
          <Link href="/panel/karakter/yeni" className="btn-primary">
            + Yeni karakter
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {characters.map((c) => (
            <Link
              key={c.id}
              href={`/panel/karakter/${c.id}`}
              className="card flex items-center gap-4 p-4 transition hover:border-brand"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-soft">
                {c.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{c.name}</p>
                <p className="truncate text-sm text-muted">{c.handle}</p>
                <p className="text-xs text-muted">{c.postCount} gönderi</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <aside className="card h-fit p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Sıradaki paylaşımlar</h2>
          <Link href="/panel/takvim" className="text-xs text-brand">
            Takvim →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">Planlanmış gönderi yok.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((p) => (
              <li key={p.id} className="text-sm">
                <p className="font-medium">
                  {p.character.name} · {fmtDateTime(p.scheduledAt)}
                </p>
                <p className="line-clamp-2 text-muted">{p.caption}</p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
