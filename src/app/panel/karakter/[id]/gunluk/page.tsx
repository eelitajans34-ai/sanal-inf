import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ensureSettings } from "@/lib/config";
import { replicateEnabled } from "@/lib/ai/replicate";
import { textAiEnabled } from "@/lib/ai/text";
import { DAY_LABEL, ROUTINE_TYPE_LABEL, istanbulNow } from "@/lib/routines";
import { addStarterRoutines, deleteRoutine, runRoutineNow, saveRoutine, toggleRoutine } from "@/app/actions";
import RoutineForm from "@/components/RoutineForm";

export const dynamic = "force-dynamic";

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  started: { label: "Devam ediyor", cls: "bg-amber-100 text-amber-800" },
  done: { label: "Tamam", cls: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Hata", cls: "bg-red-100 text-red-700" },
};

export default async function RoutinesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSettings();
  const c = await db.query.characters.findFirst({ where: eq(schema.characters.id, id) });
  if (!c) notFound();

  const list = await db.query.routines.findMany({
    where: eq(schema.routines.characterId, c.id),
    orderBy: schema.routines.time,
  });
  const runs = list.length
    ? await db.query.routineRuns.findMany({
        where: inArray(
          schema.routineRuns.routineId,
          list.map((r) => r.id)
        ),
        orderBy: desc(schema.routineRuns.createdAt),
        limit: 20,
      })
    : [];
  const name = new Map(list.map((r) => [r.id, r.name]));
  const now = istanbulNow();

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/panel/karakter/${c.id}`} className="text-sm text-muted hover:text-brand">
          ← {c.name}
        </Link>
        <h1 className="mt-2 font-display text-4xl">Günlük işler</h1>
        <p className="mt-1 max-w-3xl text-muted">
          Belirlediğin gün ve saatte {c.name} kendi içeriğini üretir. &quot;Onayıma düşsün&quot; seçeneğinde içerik
          takvimde taslak olarak bekler; &quot;Otomatik planla&quot; seçeneğinde paylaşım saatinde Instagram&apos;a
          gönderilir. Uygulama açık olduğu sürece her dakika kontrol edilir. Şu an: {DAY_LABEL[now.weekday]} {now.time}
        </p>
      </div>

      {(!textAiEnabled() || !replicateEnabled()) && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {!textAiEnabled() && "Claude bağlı değil: metinler örnek olur. "}
          {!replicateEnabled() && "Replicate bağlı değil: konuşan Reels demo olur, fotoğraf gönderilerinde hazır fotoğraflar kullanılır. "}
          <Link href="/panel/ayarlar" className="font-semibold underline">
            Bağla →
          </Link>
        </p>
      )}

      {list.length === 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-semibold">Hızlı başlangıç</p>
            <p className="text-sm text-muted">
              Her gün 09:00&apos;da fotoğraflı gönderi, Pzt/Çar/Cum montaj, Sal/Cmt konuşan Reels. Hepsi onayına düşer,
              sonra düzenleyebilirsin.
            </p>
          </div>
          <form action={addStarterRoutines.bind(null, c.id)}>
            <button className="btn-primary">Örnek planı ekle</button>
          </form>
        </section>
      )}

      <section className="space-y-4">
        {list.map((r) => (
          <details key={r.id} className={`card p-5 ${r.enabled ? "" : "opacity-60"}`}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="font-semibold">{r.name}</span>
              <span className="badge bg-brand-soft text-brand">{ROUTINE_TYPE_LABEL[r.type]}</span>
              <span className="text-sm text-muted">
                {r.days.length === 7 ? "Her gün" : [1, 2, 3, 4, 5, 6, 0].filter((d) => r.days.includes(d)).map((d) => DAY_LABEL[d]).join(", ")} ·{" "}
                {r.time} → {r.publishMode === "schedule" ? `${r.publishTime}'da paylaş` : "onaya düşer"}
              </span>
              {r.lastStatus && (
                <span className={`badge ${RUN_STATUS[r.lastStatus]?.cls ?? ""}`}>
                  Son: {r.lastRunDate} {RUN_STATUS[r.lastStatus]?.label}
                </span>
              )}
              <span className="ml-auto flex gap-2">
                <form action={runRoutineNow.bind(null, c.id, r.id)}>
                  <button className="btn-ghost px-3 py-1 text-xs">▶ Şimdi çalıştır</button>
                </form>
                <form action={toggleRoutine.bind(null, c.id, r.id, !r.enabled)}>
                  <button className="btn-ghost px-3 py-1 text-xs">{r.enabled ? "Durdur" : "Etkinleştir"}</button>
                </form>
                <form action={deleteRoutine.bind(null, c.id, r.id)}>
                  <button className="btn-danger px-3 py-1 text-xs">Sil</button>
                </form>
              </span>
            </summary>
            {r.lastMessage && <p className="mt-2 line-clamp-2 text-xs text-muted">{r.lastMessage}</p>}
            <div className="mt-4 border-t border-line pt-4">
              <RoutineForm action={saveRoutine.bind(null, c.id, r.id)} routine={r} submitLabel="Kaydet" />
            </div>
          </details>
        ))}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-display text-2xl">Yeni günlük iş</h2>
        <RoutineForm action={saveRoutine.bind(null, c.id, null)} submitLabel="Ekle" />
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl">Son çalışmalar</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted">Henüz çalışma yok.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li key={run.id} className="card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className={`badge ${RUN_STATUS[run.status]?.cls ?? ""}`}>{RUN_STATUS[run.status]?.label ?? run.status}</span>
                <span className="font-semibold">{name.get(run.routineId)}</span>
                <span className="text-muted">{run.date}</span>
                {run.topic && <span>“{run.topic}”</span>}
                <span className="line-clamp-2 max-w-xl text-muted">{run.message}</span>
                {run.reelId && (
                  <Link href={`/panel/karakter/${c.id}/reels`} className="ml-auto text-brand">
                    Videoyu gör →
                  </Link>
                )}
                {!run.reelId && run.postId && (
                  <Link href="/panel/takvim" className="ml-auto text-brand">
                    Takvimde gör →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
