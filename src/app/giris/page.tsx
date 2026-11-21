import { login } from "@/app/actions";

type Props = { searchParams: Promise<{ hata?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { hata, next } = await searchParams;
  const noPassword = !process.env.ADMIN_PASSWORD;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form action={login} className="card w-full max-w-sm p-8">
        <h1 className="font-display text-3xl">Panel girişi</h1>
        <p className="mt-1 mb-6 text-sm text-muted">sanal·inf stüdyosu</p>
        <input type="hidden" name="next" value={next || "/panel"} />
        <label className="label" htmlFor="password">
          Parola
        </label>
        <input id="password" name="password" type="password" className="input" autoFocus required />
        {hata && <p className="mt-2 text-sm text-red-600">Parola hatalı.</p>}
        {noPassword && (
          <p className="mt-2 text-sm text-amber-700">
            Sunucuda ADMIN_PASSWORD tanımlı değil. .env dosyasına ekle.
          </p>
        )}
        <button className="btn-primary mt-5 w-full">Giriş yap</button>
      </form>
    </main>
  );
}
