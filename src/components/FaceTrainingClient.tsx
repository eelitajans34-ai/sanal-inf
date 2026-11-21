"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { startTrainingAction, type TrainingActionState } from "@/app/actions";

export function VariationGenerator({ characterId, remaining }: { characterId: string; remaining: number }) {
  const router = useRouter();
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Üretilemedi");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input w-auto"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          disabled={busy}
        >
          {[2, 4, 6].map((n) => (
            <option key={n} value={n}>
              {n} görsel
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={run} disabled={busy || remaining === 0}>
          {busy ? `Üretiliyor… (${count} görsel, ~${count * 15} sn)` : "Varyasyon üret"}
        </button>
        <span className="text-xs text-muted">{remaining} hazır sahne kaldı</span>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function StartTrainingButton({
  characterId,
  disabled,
}: {
  characterId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<TrainingActionState, FormData>(
    startTrainingAction.bind(null, characterId),
    null
  );
  return (
    <form action={action}>
      <button className="btn-primary" disabled={disabled || pending}>
        {pending ? "Hazırlanıyor ve yükleniyor…" : "LoRA eğitimini başlat"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
