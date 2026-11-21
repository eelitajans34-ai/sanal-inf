import type { Routine } from "@/db/schema";
import { DAY_LABEL, ROUTINE_TYPE_LABEL } from "@/lib/routines";

const TYPE_HINT: Record<Routine["type"], string> = {
  photo: "Konudan fikir + gönderi metni + görsel (Replicate yoksa hazır fotoğraflardan biri).",
  montage: "Hazır fotoğraflardan hareketli Reels montajı. Replicate gerektirmez.",
  reels: "Senaryo + Luna'nın konuşan/hareket eden klipleri + altyazılı video. Replicate gerekir (≈ 2-4 $/video).",
};

export default function RoutineForm({
  action,
  routine,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  routine?: Routine;
  submitLabel: string;
}) {
  const days = routine?.days ?? [0, 1, 2, 3, 4, 5, 6];
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="label">Ad</label>
        <input name="name" className="input" defaultValue={routine?.name} placeholder="ör. Sabah montajı" required />
      </div>
      <div>
        <label className="label">İş türü</label>
        <select name="type" className="input" defaultValue={routine?.type ?? "montage"}>
          {Object.entries(ROUTINE_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          {Object.entries(TYPE_HINT).map(([k, v]) => (
            <span key={k} className="block">
              <b>{ROUTINE_TYPE_LABEL[k as Routine["type"]]}:</b> {v}
            </span>
          ))}
        </p>
      </div>
      <div className="md:col-span-2">
        <span className="label">Günler</span>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <label key={d} className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm">
              <input type="checkbox" name="days" value={d} defaultChecked={days.includes(d)} />
              {DAY_LABEL[d]}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Üretim saati (İstanbul)</label>
        <input type="time" name="time" className="input" defaultValue={routine?.time ?? "10:00"} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Paylaşım</label>
          <select name="publishMode" className="input" defaultValue={routine?.publishMode ?? "draft"}>
            <option value="draft">Onayıma düşsün (taslak)</option>
            <option value="schedule">Otomatik planla</option>
          </select>
        </div>
        <div>
          <label className="label">Paylaşım saati</label>
          <input type="time" name="publishTime" className="input" defaultValue={routine?.publishTime ?? "19:00"} required />
        </div>
      </div>
      <div className="md:col-span-2">
        <label className="label">Konular (her satıra bir konu, sırayla kullanılır)</label>
        <textarea
          name="topics"
          rows={4}
          className="input"
          defaultValue={routine?.topics}
          placeholder={"Karaköy'de sabah kahvesi\nKış kombinlerim\nCilt bakım rutinim\n(boş bırakılırsa AI kendisi seçer)"}
        />
      </div>
      <div className="md:col-span-2">
        <button className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
