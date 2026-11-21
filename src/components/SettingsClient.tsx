"use client";

import { useState } from "react";
import { linkInstagramAccount } from "@/app/actions";

type Account = { id: string; username: string; page: string };

export function TestButton({ settingKey, characters }: { settingKey: string; characters?: { id: string; name: string; instagramUserId: string }[] }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; message: string; data?: { accounts?: Account[] } } | null>(null);
  const [linked, setLinked] = useState("");

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setRes(null);
          try {
            const r = await fetch("/api/settings/test", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: settingKey }),
            });
            setRes(await r.json());
          } catch (e) {
            setRes({ ok: false, message: e instanceof Error ? e.message : String(e) });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Test ediliyor…" : "Bağlantıyı test et"}
      </button>
      {res && (
        <p className={`rounded-xl px-3 py-2 text-sm ${res.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {res.ok ? "✓ " : "✗ "}
          {res.message}
        </p>
      )}
      {res?.ok && res.data?.accounts && characters && res.data.accounts.length > 0 && (
        <div className="rounded-xl border border-line p-3 text-sm">
          <p className="mb-2 font-semibold">Instagram hesabını karaktere bağla</p>
          {characters.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 py-1">
              <span className="w-24">{c.name}</span>
              {res.data!.accounts!.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`btn-ghost px-3 py-1 text-xs ${c.instagramUserId === a.id || linked === `${c.id}:${a.id}` ? "bg-emerald-50" : ""}`}
                  onClick={async () => {
                    await linkInstagramAccount(c.id, a.id);
                    setLinked(`${c.id}:${a.id}`);
                  }}
                >
                  @{a.username}
                  {(c.instagramUserId === a.id || linked === `${c.id}:${a.id}`) && " ✓"}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
