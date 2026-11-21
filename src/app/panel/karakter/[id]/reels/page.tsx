import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listTemplates, templateOption } from "@/lib/video/templates";
import { deleteReelAction, reelToPost } from "@/app/actions";
import { PRESETS, presetById } from "@/lib/video/presets";
import { engineById } from "@/lib/video/engines";
import { reelClips } from "@/lib/video/reels";
import { toLocalInput } from "@/lib/format";
import { ClipPoller, MontageBuilder, ReelBuilder } from "@/components/VideoClient";

export const dynamic = "force-dynamic";

const REEL_STATUS: Record<string, { label: string; cls: string }> = {
  generating: { label: "Klipler üretiliyor", cls: "bg-amber-100 text-amber-800" },
  rendering: { label: "Birleştiriliyor", cls: "bg-amber-100 text-amber-800" },
  ready: { label: "Hazır", cls: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Hata", cls: "bg-red-100 text-red-700" },
  draft: { label: "Taslak", cls: "bg-gray-100 text-gray-700" },
};

export default async function ReelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.query.characters.findFirst({ where: eq(schema.characters.id, id) });
  if (!c) notFound();
  const templates = (await listTemplates(c.id)).map(templateOption);

  const reels = await db.query.reels.findMany({
    where: eq(schema.reels.characterId, c.id),
    orderBy: desc(schema.reels.createdAt),
    limit: 20,
  });
  const withClips = await Promise.all(reels.map(async (r) => ({ reel: r, clips: await reelClips(r.id) })));

  const pending = withClips.flatMap(({ clips }) =>
    clips.filter((x) => !["succeeded", "failed"].includes(x.status)).map((x) => x.id)
  );
  // Tüm klipleri hazır olan ilk reels'i otomatik birleştir
  const toRender = withClips.find(
    ({ reel, clips }) => reel.status === "generating" && clips.length > 0 && clips.every((x) => x.status === "succeeded")
  )?.reel.id;

  const defaultTime = toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)).slice(0, 10) + "T19:00";

  return (
    <div className="space-y-8">
      <ClipPoller ids={pending} reelToRender={pending.length ? undefined : toRender} />
      <div>
        <Link href={`/panel/karakter/${c.id}`} className="text-sm text-muted hover:text-brand">
          ← {c.name}
        </Link>
        <h1 className="mt-2 font-display text-4xl">Reels</h1>
        <p className="mt-1 text-muted">
          Senaryo → sahne klipleri (ses + dudak senkronu + hareket) → 9:16 birleştirme ve altyazı.{" "}
          <Link href={`/panel/karakter/${c.id}/video`} className="text-brand">
            Ses ve hareket ayarları →
          </Link>
        </p>
      </div>

      <MontageBuilder characterId={c.id} photos={templates.filter((t) => t.source === "photo")} />

      <ReelBuilder
        characterId={c.id}
        presets={PRESETS.map(({ id, label, category, kind }) => ({ id, label, category, kind }))}
        templates={templates}
      />

      {withClips.map(({ reel, clips }) => {
        const st = REEL_STATUS[reel.status] ?? REEL_STATUS.draft;
        const failed = clips.filter((x) => x.status === "failed");
        return (
          <section key={reel.id} className="card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl">{reel.title}</h2>
              <span className="badge bg-gray-100 text-gray-700">{reel.kind === "montage" ? "Fotoğraf montajı" : "AI video"}</span>
              <span className={`badge ${st.cls}`}>{st.label}</span>
              <form action={deleteReelAction.bind(null, c.id, reel.id)} className="ml-auto">
                <button className="btn-danger px-3 py-1 text-xs">Sil</button>
              </form>
            </div>
            {reel.error && <p className="mt-2 text-sm text-red-600">{reel.error}</p>}
            {failed.length > 0 && (
              <p className="mt-2 text-sm text-red-600">
                {failed.length} sahne üretilemedi: {failed[0].error}. Reels&apos;i silip senaryoyu tekrar üretebilirsin.
              </p>
            )}

            <div className="mt-5 grid gap-6 lg:grid-cols-[300px_1fr]">
              <div>
                {reel.status === "ready" ? (
                  <div className="space-y-3">
                    <video
                      src={reel.videoUrl}
                      poster={reel.coverUrl}
                      controls
                      playsInline
                      className="aspect-[9/16] w-full rounded-2xl bg-ink object-cover"
                    />
                    <a href={reel.videoUrl} download={`${c.slug}-reels.mp4`} className="btn-ghost w-full">
                      ⬇ MP4 indir
                    </a>
                  </div>
                ) : (
                  <div className="flex aspect-[9/16] w-full items-center justify-center rounded-2xl bg-ink/90 text-sm text-white">
                    {st.label}…
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {reel.hook && (
                  <p className="text-sm">
                    <b>Hook:</b> {reel.hook}
                  </p>
                )}
                {reel.kind === "montage" && (
                  <div className="flex gap-2 overflow-x-auto">
                    {reel.slides.map((sl, i) => (
                      <figure key={i} className="w-20 shrink-0 text-center text-[10px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sl.imageUrl} alt="" className="aspect-[9/16] w-full rounded-lg object-cover" />
                        <figcaption className="mt-1 line-clamp-2">{sl.text}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {clips.map((clip) => (
                    <li key={clip.id} className="flex gap-3 rounded-xl border border-line p-3 text-xs">
                      <div className="h-24 w-14 shrink-0 overflow-hidden rounded-lg bg-ink/80">
                        {clip.status === "succeeded" ? (
                          <video src={clip.videoUrl} muted playsInline className="h-full w-full object-cover" />
                        ) : clip.startImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={clip.startImageUrl} alt="" className="h-full w-full object-cover opacity-60" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {(clip.shotIndex ?? 0) + 1}. {presetById(clip.presetId)?.label}
                        </p>
                        <p className="text-muted">
                          {engineById(clip.engine)?.label} ·{" "}
                          {clip.status === "succeeded" ? "✓" : clip.status === "failed" ? "✗ hata" : "üretiliyor…"}
                        </p>
                        {clip.line && <p className="mt-1 line-clamp-3">“{clip.line}”</p>}
                      </div>
                    </li>
                  ))}
                </ol>

                {reel.status === "ready" && (
                  <div className="rounded-xl bg-paper p-4">
                    <p className="text-sm whitespace-pre-line">{reel.caption}</p>
                    <p className="mt-2 text-sm text-brand">{reel.hashtags}</p>
                    <form action={reelToPost.bind(null, reel.id)} className="mt-4 flex flex-wrap items-center gap-2">
                      <input type="datetime-local" name="scheduledAt" defaultValue={defaultTime} className="input w-auto" />
                      <button className="btn-primary">Instagram Reels olarak planla</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
