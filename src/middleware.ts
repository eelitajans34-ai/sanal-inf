import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (await isValidToken(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/giris";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/panel/:path*", "/api/ai/:path*", "/api/video/:path*"],
};
