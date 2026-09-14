import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthed = Boolean(user);
  const isAdminRoute = path.startsWith("/admin");
  const isAppRoute = path.startsWith("/app");
  const isRegisterDetailsRoute = path.startsWith("/register/details");
  const isProtectedRoute = isAdminRoute || isAppRoute || path === "/pending" || isRegisterDetailsRoute;

  if (!isAuthed && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (isAuthed && isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .single();

    if (profile?.role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/app/dashboard";
      return NextResponse.redirect(url);
    }

    if (path !== "/admin/mfa-setup") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTotp = factors?.totp?.some((f) => f.status === "verified");
      if (!hasVerifiedTotp) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/mfa-setup";
        return NextResponse.redirect(url);
      }
    }
  }

  if (isAuthed && isAppRoute) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!membership) {
      const url = request.nextUrl.clone();
      url.pathname = "/register/details";
      return NextResponse.redirect(url);
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("status")
      .eq("id", membership.org_id)
      .single();

    if (org?.status !== "active") {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
