import { NextResponse, type NextRequest } from "next/server";

/**
 * Applies secure HTTP headers to every response and enforces same-origin
 * requests for state-changing API calls (a lightweight CSRF mitigation —
 * the session cookie is SameSite=Lax + httpOnly, and this adds defense in
 * depth against cross-site POSTs from browsers that ignore SameSite).
 */
export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: { code: "cross_origin_request", message: "Cross-origin requests are not allowed." } },
        { status: 403 }
      );
    }
  }

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
