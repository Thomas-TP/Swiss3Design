import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // www.swiss3design.ch → swiss3design.ch (canonique)
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = new URL(request.url);
    url.host = host.slice(4);
    return NextResponse.redirect(url, 301);
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
