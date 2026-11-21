// Basit panel koruması: ADMIN_PASSWORD ile giriş, çerezde parolanın özeti tutulur.
// Edge (middleware) ve Node'da çalışsın diye Web Crypto kullanılıyor.
export const AUTH_COOKIE = "si_auth";

export async function authToken(password: string) {
  const data = new TextEncoder().encode(`sanal-inf:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidToken(token: string | undefined) {
  const pw = process.env.ADMIN_PASSWORD;
  // Parola tanımlı değilse: yerelde panel açık, canlıda kilitli.
  if (!pw) return process.env.NODE_ENV !== "production";
  return token === (await authToken(pw));
}
