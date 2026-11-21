import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ensureSettings } from "@/lib/config";
import {
  deleteTrainingImage,
  refreshTrainingAction,
  removeLora,
  setReferenceImage,
  toggleTrainingImage,
} from "@/app/actions";
import { IMAGE_MODE_LABEL, imageAiEnabled, imageMode } from "@/lib/ai/image";
import {
  DATASET_SCENES,
  MIN_TRAINING_IMAGES,
  RECOMMENDED_TRAINING_IMAGES,
  listTrainingImages,
  triggerWordFor,
} from "@/lib/ai/training";
import { StartTrainingButton, VariationGenerator } from "@/components/FaceTrainingClient";

export const dynamic = "force-dynamic";

const TRAINING_LABEL: Record<string, { label: string; cls: string }> = {
  starting: { label: "Başlıyor", cls: "bg-amber-100 text-amber-800" },
  processing: { label: "Eğitiliyor", cls: "bg-amber-100 text-amber-800" },
  succeeded: { label: "Hazır", cls: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Başarısız", cls: "bg-red-100 text-red-700" },
  canceled: { label: "İptal edildi", cls: "bg-gray-100 text-gray-700" },
};

export default async function FacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSettings();
  const c = await db.query.characters.findFirst({ where: eq(schema.characters.id, id) });
  if (!c) notFound();

  const images = await listTrainingImages(c.id);
  const reference = c.referenceImageUrl || c.avatarUrl;
  const selected = images.filter((i) => i.selected && !i.imageUrl.startsWith("data:image/svg"));
  const total = new Set([...selected.map((i) => i.imageUrl), ...(reference ? [reference] : [])]).size;
  const usedScenes = new Set(images.map((i) => i.scene));
  const remaining = DATASET_SCENES.filter((s) => !usedScenes.has(s)).length;
  const mode = imageMode(c);
  const training = TRAINING_LABEL[c.trainingStatus];
  const active = ["starting", "processing"].includes(c.trainingStatus);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/panel/karakter/${c.id}`} className="text-sm text-muted hover:text-brand">
          ← {c.name}
        </Link>
        <h1 className="mt-2 font-display text-4xl">Yüz tutarlılığı</h1>
        <p className="mt-1 max-w-2xl text-muted">
          {c.name}&apos;nın her görselde aynı kişi olarak görünmesi için. Şu an kullanılan yöntem:{" "}
          <span className="badge bg-brand-soft text-brand">{IMAGE_MODE_LABEL[mode]}</span>
        </p>
      </div>

      {/* Adımlar */}
      <ol className="grid gap-4 md:grid-cols-3">
        {[
          ["Referans fotoğraf", "Kontext, yeni görselleri bu fotoğraftaki yüze bakarak üretir. Tek fotoğrafla bile çalışır."],
          ["Eğitim seti", `Farklı sahnelerde varyasyonlar üret, yüzü tutmayanları çıkar. ${RECOMMENDED_TRAINING_IMAGES}-18 görsel ideal.`],
          ["LoRA eğitimi", "Seçilen görsellerle karaktere özel model eğitilir (~20-30 dk, ~2-3 $). Sonrasında tüm görseller bu modelle üretilir."],
        ].map(([t, d], i) => (
          <li key={t} className="card p-5">
            <span className="text-xs font-semibold text-brand">ADIM {i + 1}</span>
            <p className="mt-1 font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ol>

      {!imageAiEnabled() && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          REPLICATE_API_TOKEN olmadan varyasyonlar demo görsel olarak üretilir ve eğitim başlatılamaz.
        </p>
      )}

      {/* LoRA durumu */}
      <section className="card flex flex-wrap items-center gap-4 p-6">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-brand-soft">
          {reference && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reference} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Referans fotoğraf ve model</p>
          <p className="text-sm text-muted">
            Tetikleyici kelime: <code>{c.loraTrigger || triggerWordFor(c)}</code>
            {c.loraVersion && (
              <>
                {" "}
                · Model: <code className="break-all">{c.loraVersion}</code>
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {training ? (
              <span className={`badge ${training.cls}`}>Eğitim: {training.label}</span>
            ) : (
              <span className="badge bg-gray-100 text-gray-700">Henüz eğitim yok</span>
            )}
            {c.trainingError && <span className="text-xs text-red-600">{c.trainingError}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.trainingId && (
            <form action={refreshTrainingAction.bind(null, c.id)}>
              <button className="btn-ghost">Durumu yenile</button>
            </form>
          )}
          {c.loraVersion && (
            <form action={removeLora.bind(null, c.id)}>
              <button className="btn-danger">Modeli kaldır</button>
            </form>
          )}
        </div>
      </section>

      {/* Eğitim seti */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">Eğitim seti</h2>
            <p className="text-sm text-muted">
              Seçili: <b>{total}</b> görsel (referans dahil) · en az {MIN_TRAINING_IMAGES}, ideal{" "}
              {RECOMMENDED_TRAINING_IMAGES}-18. Yüzü farklı çıkanların seçimini kaldır veya sil.
            </p>
          </div>
          <VariationGenerator characterId={c.id} remaining={remaining} />
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full ${total >= MIN_TRAINING_IMAGES ? "bg-emerald-500" : "bg-brand"}`}
            style={{ width: `${Math.min(100, (total / RECOMMENDED_TRAINING_IMAGES) * 100)}%` }}
          />
        </div>

        {images.length === 0 ? (
          <p className="text-sm text-muted">Henüz varyasyon yok. &quot;Varyasyon üret&quot; ile başla.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {images.map((img) => (
              <figure
                key={img.id}
                className={`card overflow-hidden transition ${img.selected ? "ring-2 ring-brand" : "opacity-50"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.imageUrl} alt="" className="aspect-[4/5] w-full object-cover" />
                <figcaption className="space-y-2 p-3">
                  <p className="line-clamp-2 text-xs text-muted" title={img.scene}>
                    {img.scene}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <form action={toggleTrainingImage.bind(null, c.id, img.id, !img.selected)}>
                      <button className="btn-ghost px-2 py-1 text-xs">
                        {img.selected ? "✓ Seçili" : "Seç"}
                      </button>
                    </form>
                    <form action={setReferenceImage.bind(null, c.id, img.imageUrl)}>
                      <button className="btn-ghost px-2 py-1 text-xs" title="Referans fotoğraf yap">
                        Referans
                      </button>
                    </form>
                    <form action={deleteTrainingImage.bind(null, c.id, img.id)}>
                      <button className="btn-danger px-2 py-1 text-xs">Sil</button>
                    </form>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-sm text-muted">
            Eğitim Replicate hesabında <code>{c.slug}-lora</code> adında özel bir model oluşturur. Bittiğinde{" "}
            {c.name}&apos;nın tüm yeni görselleri otomatik olarak bu modelle üretilir.
          </p>
          <StartTrainingButton
            characterId={c.id}
            disabled={active || total < MIN_TRAINING_IMAGES || !imageAiEnabled()}
          />
        </div>
      </section>
    </div>
  );
}
