import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const characters = await db.select().from(schema.characters).orderBy(asc(schema.characters.createdAt));

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-14 flex items-center justify-between">
        <span className="font-display text-xl">sanal·inf</span>
        <Link href="/panel" className="btn-ghost">
          Panele git
        </Link>
      </header>

      <section className="mb-16 max-w-2xl">
        <h1 className="font-display text-5xl leading-tight">
          Yapay zekâyla yaşayan <span className="text-brand">influencer&apos;lar</span>
        </h1>
        <p className="mt-4 text-lg text-muted">
          Her biri kendi tarzı, sesi ve hikâyesi olan sanal karakterler. Tanışın, takip edin.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((c) => (
          <Link
            key={c.id}
            href={`/k/${c.slug}`}
            className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="aspect-[4/5] overflow-hidden bg-brand-soft">
              {c.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.avatarUrl}
                  alt={c.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              )}
            </div>
            <div className="p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-2xl">{c.name}</h2>
                <span className="text-sm text-muted">{c.handle}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{c.niche}</p>
            </div>
          </Link>
        ))}
        {characters.length === 0 && (
          <p className="text-muted">Henüz karakter yok. Panelden ilk karakterini oluştur.</p>
        )}
      </section>
    </main>
  );
}
