import Link from "next/link";
import { and, asc, desc, gte, inArray, lt, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { posts: P } = schema;
import { dayKey } from "@/lib/format";
import PostRow from "@/components/PostRow";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

type Props = { searchParams: Promise<{ ay?: string }> };

export default async function CalendarPage({ searchParams }: Props) {
  const { ay } = await searchParams;
  const today = dayKey(new Date());
  const [y, m] = (ay && /^\d{4}-\d{2}$/.test(ay) ? ay : today.slice(0, 7)).split("-").map(Number);

  // Ayın sınırları (İstanbul saati, UTC+3)
  const start = new Date(Date.UTC(y, m - 1, 1, -3));
  const end = new Date(Date.UTC(y, m, 1, -3));

  const posts = await db.query.posts.findMany({
    where: or(
      and(gte(P.scheduledAt, start), lt(P.scheduledAt, end)),
      and(gte(P.publishedAt, start), lt(P.publishedAt, end))
    ),
    with: { character: true },
    orderBy: asc(P.scheduledAt),
  });
  const drafts = await db.query.posts.findMany({
    where: inArray(P.status, ["DRAFT", "FAILED"]),
    with: { character: true },
    orderBy: desc(P.createdAt),
    limit: 20,
  });

  const byDay = new Map<string, typeof posts>();
  for (const p of posts) {
    const when = p.status === "PUBLISHED" ? p.publishedAt : p.scheduledAt;
    if (!when) continue;
    const k = dayKey(when);
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Pazartesi = 0
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;

  const dot: Record<string, string> = {
    SCHEDULED: "bg-amber-400",
    PUBLISHED: "bg-emerald-500",
    FAILED: "bg-red-500",
    DRAFT: "bg-gray-400",
  };

  const upcoming = posts.filter((p) => p.status === "SCHEDULED");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">
          {MONTHS[m - 1]} {y}
        </h1>
        <div className="flex gap-2">
          <Link href={`/panel/takvim?ay=${prev}`} className="btn-ghost">←</Link>
          <Link href="/panel/takvim" className="btn-ghost">Bugün</Link>
          <Link href={`/panel/takvim?ay=${next}`} className="btn-ghost">→</Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-paper text-center text-xs font-semibold text-muted">
          {DAYS.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const k = d ? `${y}-${pad(m)}-${pad(d)}` : "";
            const items = d ? byDay.get(k) ?? [] : [];
            return (
              <div key={i} className="min-h-24 border-r border-b border-line p-1.5 text-xs">
                {d && (
                  <>
                    <div className={`mb-1 font-semibold ${k === today ? "text-brand" : "text-muted"}`}>{d}</div>
                    <div className="space-y-1">
                      {items.map((p) => (
                        <Link
                          key={p.id}
                          href={`/panel/karakter/${p.characterId}`}
                          className="flex items-center gap-1 truncate rounded bg-paper px-1 py-0.5 hover:bg-brand-soft"
                          title={p.caption}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[p.status]}`} />
                          <span className="truncate">{p.character.name}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold">Bu ay planlananlar</h2>
          <div className="space-y-3">
            {upcoming.length === 0 && <p className="text-sm text-muted">Yok.</p>}
            {upcoming.map((p) => (
              <PostRow key={p.id} post={p} character={p.character} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-semibold">Taslaklar ve hatalılar</h2>
          <div className="space-y-3">
            {drafts.length === 0 && <p className="text-sm text-muted">Yok.</p>}
            {drafts.map((p) => (
              <PostRow key={p.id} post={p} character={p.character} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
