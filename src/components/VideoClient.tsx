"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function post<T>(url: string, body?: object): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Bir hata oluştu");
  return json as T;
}

// ---------- Bekleyen klipleri ilerlet ----------

/** Bitmemiş klipleri birkaç saniyede bir ilerletir; durum değişince sayfayı yeniler. */
export function ClipPoller({ ids, reelToRender }: { ids: string[]; reelToRender?: string }) {
  const router = useRouter();
  const key = ids.join(",");
  const busy = useRef(false);

  useEffect(() => {
    if (!key && !reelToRender) return;
    let stop = false;
    const tick = async () => {
      if (busy.current || stop) return;
      busy.current = true;
      try {
        let changed = false;
        for (const id of key ? key.split(",") : []) {
          const clip = await post<{ status: string }>(`/api/video/clips/${id}`);
          if (["succeeded", "failed"].includes(clip.status)) changed = true;
        }
        if (reelToRender && !key) {
          await post(`/api/video/reels/${reelToRender}`);
          changed = true;
        }
        if (changed) router.refresh();
      } catch {
        // bir sonraki turda tekrar dener
      } finally {
        busy.current = false;
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [key, reelToRender, router]);

  if (!key && !reelToRender) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      {key ? `${ids.length} klip üretiliyor…` : "Video birleştiriliyor…"}
    </div>
  );
}

// ---------- Ses testi ----------

export function VoiceTester({ characterId, sample }: { characterId: string; sample: string }) {
  const [text, setText] = useState(sample);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await post<{ audioUrl: string }>("/api/video/tts", { characterId, text });
              setUrl(r.audioUrl);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Seslendiriliyor…" : "▶ Kaydedilmiş sesle dinle"}
        </button>
        {url && <audio src={url} controls autoPlay className="h-9" />}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ---------- Hareket laboratuvarı ----------

type PresetOpt = { id: string; label: string; category: string; kind: "talk" | "action" };
export type TemplateOpt = {
  key: string;
  source: "photo" | "idea";
  title: string;
  scene: string;
  shot: string;
  expression: string;
  presets: string[];
  talkable: boolean;
  imageUrl: string;
  frameUrl: string;
};

/** Sahne şablonu seçici: önce hareketle uyumlu olanlar. */
function TemplatePicker({
  templates,
  presetId,
  kind,
  value,
  onChange,
}: {
  templates: TemplateOpt[];
  presetId: string;
  kind: "talk" | "action";
  value: string;
  onChange: (t: TemplateOpt | null) => void;
}) {
  const [all, setAll] = useState(false);
  const fits = (t: TemplateOpt) => t.presets.includes(presetId) && (kind === "action" || t.talkable);
  const list = [...templates]
    .filter((t) => all || fits(t))
    .sort((a, b) => Number(fits(b)) - Number(fits(a)) || (a.source === "photo" ? -1 : 1));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label mb-0">Sahne şablonu</span>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> tümünü göster
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex h-28 w-16 shrink-0 items-center justify-center rounded-lg border text-center text-[10px] ${
            !value ? "border-brand bg-brand-soft text-brand" : "border-line text-muted"
          }`}
        >
          Yeni kare üret
        </button>
        {list.map((t) => (
          <button
            key={t.key}
            type="button"
            title={`${t.title} · ${t.expression}`}
            onClick={() => onChange(t)}
            className={`relative h-28 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
              value === t.key ? "border-brand" : "border-transparent"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.frameUrl || t.imageUrl} alt="" className="h-full w-full object-cover" />
            {t.source === "idea" && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white">fikir</span>
            )}
          </button>
        ))}
        {list.length === 0 && <p className="self-center text-xs text-muted">Bu hareket için uygun şablon yok.</p>}
      </div>
    </div>
  );
}
type EngineOpt = { id: string; label: string; kind: "talk" | "action"; note: string; cost: string };

const SCENES = [
  "sitting in a cozy Istanbul café by the window, cream knit sweater, warm morning light",
  "in her stylish bedroom, sitting on the bed, warm lamp light, black top",
  "walking on a Karaköy street, beige trench coat, golden hour",
  "at home in front of a vanity mirror, natural makeup, soft light",
];

export function MotionLab({
  characterId,
  presets,
  categories,
  engines,
  bestEngine,
  sampleLine,
  templates,
}: {
  characterId: string;
  presets: PresetOpt[];
  categories: Record<string, string>;
  engines: EngineOpt[];
  bestEngine: Record<string, string>;
  sampleLine: string;
  templates: TemplateOpt[];
}) {
  const router = useRouter();
  const [presetId, setPresetId] = useState(presets[0].id);
  const [templateKey, setTemplateKey] = useState("");
  const preset = presets.find((p) => p.id === presetId)!;
  const kindEngines = engines.filter((e) => e.kind === preset.kind);
  const [selected, setSelected] = useState<string[]>([]);
  const [scene, setScene] = useState(SCENES[0]);
  const [line, setLine] = useState(sampleLine);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chosen = selected.filter((s) => kindEngines.some((e) => e.id === s));
  const effective = chosen.length ? chosen : [bestEngine[preset.id] || kindEngines[0].id];

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h2 className="font-display text-2xl">Hareket laboratuvarı</h2>
        <p className="text-sm text-muted">
          Bir hareket seç, aynı başlangıç karesinden birkaç motorda üret, en doğal olanı 👍 ile işaretle. Reels&apos;lerde
          her hareket için en çok beğenilen motor otomatik kullanılır.
        </p>
      </div>

      {Object.entries(categories).map(([cat, label]) => (
        <div key={cat}>
          <span className="label">{label}</span>
          <div className="flex flex-wrap gap-2">
            {presets
              .filter((p) => p.category === cat)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    p.id === presetId ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
                  }`}
                >
                  {p.label}
                </button>
              ))}
          </div>
        </div>
      ))}

      <TemplatePicker
        templates={templates}
        presetId={presetId}
        kind={preset.kind}
        value={templateKey}
        onChange={(t) => {
          setTemplateKey(t?.key ?? "");
          if (t) setScene(t.scene);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <span className="label">Sahne (İngilizce)</span>
            <textarea className="input" rows={2} value={scene} onChange={(e) => setScene(e.target.value)} />
            <div className="mt-1 flex flex-wrap gap-1">
              {SCENES.map((s, i) => (
                <button key={s} type="button" className="text-xs text-brand hover:underline" onClick={() => setScene(s)}>
                  Örnek {i + 1}
                </button>
              ))}
            </div>
          </div>
          {preset.kind === "talk" && (
            <div>
              <span className="label">Replik (Türkçe, 1-2 cümle)</span>
              <textarea className="input" rows={2} value={line} onChange={(e) => setLine(e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <span className="label">Motorlar (en fazla 3)</span>
          <div className="space-y-2">
            {kindEngines.map((e) => {
              const on = effective.includes(e.id);
              return (
                <label
                  key={e.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${on ? "border-brand bg-brand-soft" : "border-line"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={on}
                    onChange={() =>
                      setSelected((cur) => {
                        const base = cur.filter((s) => kindEngines.some((k) => k.id === s));
                        const start = base.length ? base : effective;
                        return start.includes(e.id) ? start.filter((x) => x !== e.id) : [...start, e.id].slice(0, 3);
                      })
                    }
                  />
                  <span className="text-sm">
                    <b>{e.label}</b>
                    {bestEngine[preset.id] === e.id && (
                      <span className="badge ml-2 bg-emerald-100 text-emerald-800">Bu hareket için en iyi</span>
                    )}
                    <br />
                    <span className="text-muted">
                      {e.note} · {e.cost}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          disabled={busy || (preset.kind === "talk" && !line.trim())}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await post("/api/video/clips", {
                characterId,
                presetId,
                engines: effective,
                scene,
                line,
                templateKey: templateKey || undefined,
              });
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Başlatılıyor…"
            : `Üret (${effective.length} motor${templates.find((t) => t.key === templateKey)?.source === "photo" ? ", hazır fotoğrafla" : ""})`}
        </button>
        <span className="text-xs text-muted">Video üretimi motor başına genellikle 1-4 dakika sürer.</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ---------- Reels oluşturucu ----------

type Shot = { kind: "talk" | "action"; presetId: string; scene: string; line: string; templateKey?: string };
type Plan = { title: string; hook: string; caption: string; hashtags: string; shots: Shot[] };

export function ReelBuilder({
  characterId,
  presets,
  templates,
}: {
  characterId: string;
  presets: PresetOpt[];
  templates: TemplateOpt[];
}) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<"" | "plan" | "create">("");
  const [error, setError] = useState("");

  const setShot = (i: number, patch: Partial<Shot>) =>
    setPlan((p) => (p ? { ...p, shots: p.shots.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : p));

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h2 className="font-display text-2xl">Yeni Reels</h2>
        <p className="text-sm text-muted">Konuyu yaz, senaryoyu AI hazırlasın; istediğin sahneyi düzenle ve videoyu üret.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1"
          placeholder="Konu: ör. Karaköy'de sabah kahvesi, kış kombini önerisi…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <button
          className="btn-ghost"
          disabled={!!busy}
          onClick={async () => {
            setBusy("plan");
            setError("");
            try {
              setPlan(await post<Plan>("/api/video/reels/plan", { characterId, topic }));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy("");
            }
          }}
        >
          {busy === "plan" ? "Senaryo yazılıyor…" : plan ? "Yeniden yaz" : "Senaryo yaz"}
        </button>
      </div>

      {plan && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="label">Başlık</span>
              <input className="input" value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} />
            </div>
            <div>
              <span className="label">Ekrandaki giriş yazısı (hook)</span>
              <input className="input" value={plan.hook} onChange={(e) => setPlan({ ...plan, hook: e.target.value })} />
            </div>
          </div>

          <ol className="space-y-3">
            {plan.shots.map((s, i) => (
              <li key={i} className="rounded-xl border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="badge bg-brand-soft text-brand">Sahne {i + 1}</span>
                  <select
                    className="input w-auto py-1"
                    value={s.presetId}
                    onChange={(e) => {
                      const p = presets.find((x) => x.id === e.target.value)!;
                      setShot(i, { presetId: p.id, kind: p.kind, line: p.kind === "talk" ? s.line : "" });
                    }}
                  >
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.kind === "talk" ? "🗣 " : "🎬 "}
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="ml-auto text-xs text-red-600"
                    onClick={() => setPlan({ ...plan, shots: plan.shots.filter((_, j) => j !== i) })}
                  >
                    Sahneyi sil
                  </button>
                </div>
                {s.kind === "talk" && (
                  <textarea
                    className="input mb-2"
                    rows={2}
                    value={s.line}
                    placeholder="Luna'nın repliği"
                    onChange={(e) => setShot(i, { line: e.target.value })}
                  />
                )}
                <TemplatePicker
                  templates={templates}
                  presetId={s.presetId}
                  kind={s.kind}
                  value={s.templateKey || ""}
                  onChange={(t) => setShot(i, t ? { templateKey: t.key, scene: t.scene } : { templateKey: undefined })}
                />
                <input
                  className="input text-xs"
                  value={s.scene}
                  onChange={(e) => setShot(i, { scene: e.target.value })}
                  placeholder="Sahne tarifi (İngilizce) — şablon seçilmezse bu tariften yeni kare üretilir"
                />
              </li>
            ))}
          </ol>
          <button
            className="text-sm text-brand"
            onClick={() =>
              setPlan({ ...plan, shots: [...plan.shots, { kind: "action", presetId: "smile-soft", scene: "", line: "" }] })
            }
          >
            + Sahne ekle
          </button>

          <div>
            <span className="label">Gönderi metni</span>
            <textarea
              className="input"
              rows={4}
              value={plan.caption}
              onChange={(e) => setPlan({ ...plan, caption: e.target.value })}
            />
            <input
              className="input mt-2"
              value={plan.hashtags}
              onChange={(e) => setPlan({ ...plan, hashtags: e.target.value })}
            />
          </div>

          <button
            className="btn-primary"
            disabled={!!busy || plan.shots.length === 0}
            onClick={async () => {
              setBusy("create");
              setError("");
              try {
                await post("/api/video/reels", { characterId, topic, plan });
                setPlan(null);
                setTopic("");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy("");
              }
            }}
          >
            {busy === "create" ? "Başlatılıyor…" : `🎬 Videoyu üret (${plan.shots.length} sahne)`}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
