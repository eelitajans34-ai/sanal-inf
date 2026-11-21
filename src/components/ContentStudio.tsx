"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePost } from "@/app/actions";

async function api<T>(path: string, body: object): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Bir hata oluştu");
  return json as T;
}

export default function ContentStudio({
  characterId,
  defaultTime,
}: {
  characterId: string;
  defaultTime: string;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [idea, setIdea] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultTime);
  const [busy, setBusy] = useState<"" | "ideas" | "caption" | "image">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, startSaving] = useTransition();

  async function run<T>(kind: typeof busy, fn: () => Promise<T>) {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  const getIdeas = () =>
    run("ideas", async () => {
      const r = await api<{ ideas: string[] }>("/api/ai/ideas", { characterId, theme, count: 5 });
      setIdeas(r.ideas);
    });

  const writeCaption = (text = idea) =>
    run("caption", async () => {
      const r = await api<{ caption: string; hashtags: string; imagePrompt: string }>(
        "/api/ai/caption",
        { characterId, idea: text }
      );
      setCaption(r.caption);
      setHashtags(r.hashtags);
      setImagePrompt(r.imagePrompt);
    });

  const makeImage = () =>
    run("image", async () => {
      const r = await api<{ imageUrl: string }>("/api/ai/image", {
        characterId,
        scene: imagePrompt || idea,
      });
      setImageUrl(r.imageUrl);
    });

  function save(mode: "draft" | "schedule" | "publish") {
    setError("");
    startSaving(async () => {
      try {
        await savePost({ characterId, idea, caption, hashtags, imagePrompt, imageUrl, scheduledAt, mode });
        setNotice(
          mode === "draft" ? "Taslak kaydedildi." : mode === "schedule" ? "Gönderi planlandı 📅" : "Paylaşıldı 🎉"
        );
        setIdea("");
        setCaption("");
        setHashtags("");
        setImagePrompt("");
        setImageUrl("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-2xl">İçerik stüdyosu</h2>
      <p className="mb-5 text-sm text-muted">Fikir bul → metni yaz → görseli üret → planla.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          {/* 1. Fikir */}
          <div>
            <span className="label">1 · Fikir</span>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Tema (isteğe bağlı): ör. kış kombinleri"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              />
              <button className="btn-ghost shrink-0" onClick={getIdeas} disabled={!!busy}>
                {busy === "ideas" ? "Düşünüyor…" : "Fikir üret"}
              </button>
            </div>
            {ideas.length > 0 && (
              <ul className="mt-3 space-y-2">
                {ideas.map((i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        setIdea(i);
                        writeCaption(i);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition hover:border-brand ${
                        idea === i ? "border-brand bg-brand-soft" : "border-line"
                      }`}
                    >
                      {i}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <textarea
              className="input mt-3"
              rows={2}
              placeholder="…ya da kendi fikrini yaz"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
          </div>

          {/* 2. Metin */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="label mb-0">2 · Gönderi metni</span>
              <button
                className="text-xs font-medium text-brand disabled:opacity-50"
                onClick={() => writeCaption()}
                disabled={!idea || !!busy}
              >
                {busy === "caption" ? "Yazıyor…" : caption ? "Yeniden yaz" : "AI ile yaz"}
              </button>
            </div>
            <textarea
              className="input"
              rows={8}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Merhaba arkadaşlar! 💜 …"
            />
            <input
              className="input mt-2"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#etiketler"
            />
          </div>
        </div>

        <div className="space-y-5">
          {/* 3. Görsel */}
          <div>
            <span className="label">3 · Görsel</span>
            <textarea
              className="input"
              rows={3}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Sahne tarifi (İngilizce daha iyi sonuç verir). Karakterin görünüşü otomatik eklenir."
            />
            <div className="mt-2 flex gap-2">
              <button
                className="btn-ghost"
                onClick={makeImage}
                disabled={(!imagePrompt && !idea) || !!busy}
              >
                {busy === "image" ? "Görsel üretiliyor…" : imageUrl ? "Yeniden üret" : "Görsel üret"}
              </button>
            </div>
            <div className="mt-3 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-paper">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-muted">Görsel burada görünecek</span>
              )}
            </div>
          </div>

          {/* 4. Kaydet / planla */}
          <div>
            <span className="label">4 · Planla</span>
            <input
              type="datetime-local"
              className="input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">Türkiye saati</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!caption || saving} onClick={() => save("schedule")}>
                Planla
              </button>
              <button className="btn-ghost" disabled={!caption || saving} onClick={() => save("draft")}>
                Taslak kaydet
              </button>
              <button className="btn-ghost" disabled={!caption || saving} onClick={() => save("publish")}>
                Şimdi paylaş
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    </div>
  );
}
