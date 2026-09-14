import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google/oauth";
import { isGoogleService } from "@/lib/constants/google";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const service = request.nextUrl.searchParams.get("service");
  if (!isGoogleService(service)) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }

  const nonce = randomBytes(16).toString("hex");
  const state = `${nonce}.${service}`;

  cookies().set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthUrl(service, state));
}
