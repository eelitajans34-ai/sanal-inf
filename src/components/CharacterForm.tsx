import type { Character } from "@/db/schema";

type Field = {
  name: keyof Character;
  label: string;
  hint?: string;
  rows?: number;
  placeholder?: string;
  required?: boolean;
};

const FIELDS: Field[] = [
  { name: "name", label: "İsim", placeholder: "Luna", required: true },
  { name: "handle", label: "Kullanıcı adı", placeholder: "@luna.istanbul", required: true },
  { name: "city", label: "Şehir", placeholder: "İstanbul" },
  { name: "niche", label: "Alan", placeholder: "Moda, güzellik ve günlük hayat", required: true },
  { name: "bio", label: "Bio", rows: 2, hint: "Tanıtım sitesinde görünür.", required: true },
  {
    name: "personality",
    label: "Kişilik ve ton",
    rows: 3,
    hint: "AI bu tarife göre karakterin ağzından yazar.",
    required: true,
  },
  {
    name: "voiceRules",
    label: "Yazım kuralları",
    rows: 3,
    hint: "İmza, emoji alışkanlıkları, kaçınılacak konular. Örn: 'Öpüyorum! 💋' ile bitirir.",
  },
  {
    name: "appearance",
    label: "Görünüş tarifi",
    rows: 3,
    hint: "Her görsele eklenir; karakterin tüm fotoğraflarda aynı görünmesini sağlar.",
    required: true,
  },
  { name: "avatarUrl", label: "Profil görseli URL", placeholder: "/luna.jpg" },
  {
    name: "instagramUserId",
    label: "Instagram kullanıcı ID",
    hint: "Otomatik paylaşım için (Instagram Business hesabının ID'si). Boşsa demo modunda paylaşılır.",
  },
];

export default function CharacterForm({
  action,
  character,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  character?: Character;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((f) => {
        const value = character ? String(character[f.name] ?? "") : "";
        const wide = Boolean(f.rows) || f.name === "avatarUrl" || f.name === "instagramUserId";
        return (
          <div key={f.name} className={wide ? "sm:col-span-2" : ""}>
            <label className="label" htmlFor={f.name}>
              {f.label}
            </label>
            {f.rows ? (
              <textarea
                id={f.name}
                name={f.name}
                rows={f.rows}
                defaultValue={value}
                required={f.required}
                className="input"
              />
            ) : (
              <input
                id={f.name}
                name={f.name}
                defaultValue={value}
                placeholder={f.placeholder}
                required={f.required}
                className="input"
              />
            )}
            {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
          </div>
        );
      })}
      <div className="sm:col-span-2">
        <button className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
