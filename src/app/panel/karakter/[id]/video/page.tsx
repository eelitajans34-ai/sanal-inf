import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listTemplates, templateOption } from "@/lib/video/templates";
import { deleteClipAction, rateClipAction, saveVoice } from "@/app/actions";
import { CATEGORY_LABEL, PRESETS, presetById } from "@/lib/video/presets";
import { DEFAULT_ENGINE, ENGINES, engineById } from "@/lib/video/engines";
import { engineStats } from "@/lib/video/clips";
import { SAMPLE_LINE, VOICE_EMOTIONS, VOICE_PRESETS } from "@/lib/video/voice";
import { replicateEnabled } from "@/lib/ai/replicate";
import { ClipPoller, MotionLab, VoiceTester } from "@/components/VideoClient";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  preparing: "Sırada",
  starting: "Hazırlanıyor",
  running: "Üretiliyor",
  succeeded: "Hazır",
  failed: "Hata",
};

export default async function VideoLabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.query.characters.findFirst({ where: eq(schema.characters.id, id) });
  if (!c) notFound();
  const templates = (await listTemplates(c.id)).map(templateOption);

  const clips = await db.query.clips.findMany({
    where: and(eq(schema.clips.characterId, c.id), isNull(schema.clips.reelId)),
    orderBy: desc(schema.clips.createdAt),
    limit: 60,
  });
  const pending = clips.filter((x) => !["succeeded", "failed"].includes(x.status)).map((x) => x.id);

  const stats = await engineStats(c.id);
  const best: Record<string, string> = {};
  for (const p of PRESETS) {
    const top = stats
      .filter((s) => s.presetId === p.id && s.rated > 0 && engineById(s.engine)?.kind === p.kind)
      .sort((a, b) => b.score - a.score)[0];
    best[p.id] = top && top.score > 0 ? top.engine : DEFAULT_ENGINE[p.kind];
  }

  // Klipleri harekete göre grupla
  const groups = new Map<string, typeof clips>();
  for (const clip of clips) groups.set(clip.presetId, [...(groups.get(clip.presetId) ?? []), clip]);

  const isPresetVoice = VOICE_PRESETS.some((v) => v.id === c.voiceId);
  const sample = SAMPLE_LINE.replace("Luna", c.name);

  return (
    <div className="space-y-8">
      <ClipPoller ids={pending} />
      <div>
        <Link href={`/panel/karakter/${c.id}`} className="text-sm text-muted hover:text-brand">
          ← {c.name}
        </Link>
        <h1 className="mt-2 font-display text-4xl">Ses ve hareket</h1>
        <p className="mt-1 max-w-2xl text-muted">
          {c.name}&apos;nın sesini sabitle, mimik ve hareketlerini farklı motorlarda dene. Beğendiklerin Reels&apos;lerde
          varsayılan olur.{" "}
          <Link href={`/panel/karakter/${c.id}/reels`} className="text-brand">
            Reels oluştur →
          </Link>
        </p>
      </div>

      {!replicateEnabled() && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Demo modu: REPLICATE_API_TOKEN yok. Ses yerine kısa bir ton, video yerine referans fotoğraftan yavaş zoom
          üretilir. Akışı denemek için yeterli; gerçek sonuç için anahtarı ekle.
        </p>
      )}

      {/* Ses kimliği */}
      <section className="card grid gap-6 p-6 lg:grid-cols-2">
        <form action={saveVoice.bind(null, c.id)} className="space-y-3">
          <h2 className="font-display text-2xl">Ses kimliği</h2>
          <p className="text-sm text-muted">Tüm videolarda bu ses ve ayarlar kullanılır.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="voiceId">
                Ses
              </label>
              <input
                id="voiceId"
                name="voiceId"
                list="voice-presets"
                defaultValue={c.voiceId}
                className="input"
                placeholder="Hazır ses veya klonlanmış ses ID"
              />
              <datalist id="voice-presets">
                {VOICE_PRESETS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </datalist>
              <p className="mt-1 text-xs text-muted">
                {isPresetVoice
                  ? `Hazır ses: ${VOICE_PRESETS.find((v) => v.id === c.voiceId)?.label}`
                  : "Özel / klonlanmış ses"}
                · Hazır sesler: {VOICE_PRESETS.map((v) => v.id).join(", ")}
              </p>
            </div>
            <div>
              <label className="label" htmlFor="voiceEmotion">
                Duygu
              </label>
              <select id="voiceEmotion" name="voiceEmotion" defaultValue={c.voiceEmotion} className="input">
                {VOICE_EMOTIONS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="voiceSpeed">
                Hız ({c.voiceSpeed})
              </label>
              <input id="voiceSpeed" name="voiceSpeed" type="number" step="0.05" min="0.5" max="2" defaultValue={c.voiceSpeed} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="voicePitch">
                Perde ({c.voicePitch})
              </label>
              <input id="voicePitch" name="voicePitch" type="number" step="1" min="-12" max="12" defaultValue={c.voicePitch} className="input" />
            </div>
          </div>
          <button className="btn-primary">Sesi kaydet</button>
        </form>
        <div className="space-y-2">
          <span className="label">Dinle</span>
          <VoiceTester characterId={c.id} sample={sample} />
          <p className="text-xs text-muted">
            Önce ayarları kaydet, sonra dinle. Kendine özel bir ses istersen 10+ saniyelik temiz bir kayıttan
            minimax/voice-cloning ile ses klonlayıp çıkan ID&apos;yi buraya yazabilirsin.
          </p>
        </div>
      </section>

      <MotionLab
        characterId={c.id}
        presets={PRESETS.map(({ id, label, category, kind }) => ({ id, label, category, kind }))}
        categories={CATEGORY_LABEL}
        engines={ENGINES.map(({ id, label, kind, note, cost }) => ({ id, label, kind, note, cost }))}
        bestEngine={best}
        sampleLine={sample}
        templates={templates}
      />

      {/* Sonuçlar */}
      <section className="space-y-6">
        <h2 className="font-display text-2xl">Denemeler</h2>
        {groups.size === 0 && <p className="text-sm text-muted">Henüz deneme yok.</p>}
        {[...groups.entries()].map(([presetId, list]) => {
          const preset = presetById(presetId);
          const rows = stats.filter((s) => s.presetId === presetId);
          return (
            <div key={presetId} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-lg font-semibold">{preset?.label ?? presetId}</h3>
                {rows.map((r) => (
                  <span key={r.engine} className="text-xs text-muted">
                    {engineById(r.engine)?.label}: 👍 {r.likes} · 👎 {r.dislikes}
                    {best[presetId] === r.engine && r.rated > 0 && (
                      <span className="badge ml-1 bg-emerald-100 text-emerald-800">varsayılan</span>
                    )}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {list.map((clip) => (
                  <figure
                    key={clip.id}
                    className={`card overflow-hidden ${clip.rating === 1 ? "ring-2 ring-emerald-500" : clip.rating === -1 ? "opacity-60" : ""}`}
                  >
                    <div className="flex aspect-[9/16] items-center justify-center bg-ink/90">
                      {clip.status === "succeeded" ? (
                        <video src={clip.videoUrl} controls playsInline loop className="h-full w-full object-cover" />
                      ) : clip.startImageUrl ? (
                        <div className="relative h-full w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={clip.startImageUrl} alt="" className="h-full w-full object-cover opacity-50" />
                          <span className="absolute inset-0 flex items-center justify-center text-sm text-white">
                            {STATUS[clip.status]}
                            {clip.status !== "failed" && "…"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-white">{STATUS[clip.status]}…</span>
                      )}
                    </div>
                    <figcaption className="space-y-2 p-3 text-xs">
                      <p className="font-semibold">{engineById(clip.engine)?.label ?? clip.engine}</p>
                      {clip.line && <p className="line-clamp-2 text-muted">“{clip.line}”</p>}
                      {clip.error && <p className="line-clamp-3 text-red-600">{clip.error}</p>}
                      <div className="flex gap-1">
                        {clip.status === "succeeded" && (
                          <>
                            <form action={rateClipAction.bind(null, c.id, clip.id, clip.rating === 1 ? 0 : 1)}>
                              <button className={`btn-ghost px-2 py-1 text-xs ${clip.rating === 1 ? "bg-emerald-50" : ""}`}>👍</button>
                            </form>
                            <form action={rateClipAction.bind(null, c.id, clip.id, clip.rating === -1 ? 0 : -1)}>
                              <button className={`btn-ghost px-2 py-1 text-xs ${clip.rating === -1 ? "bg-red-50" : ""}`}>👎</button>
                            </form>
                          </>
                        )}
                        <form action={deleteClipAction.bind(null, c.id, clip.id)} className="ml-auto">
                          <button className="btn-danger px-2 py-1 text-xs">Sil</button>
                        </form>
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
