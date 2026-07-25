import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } =
    new URL(request.url);

  const code = searchParams.get("code");
  const nextParam =
    searchParams.get("next");

  const next =
    nextParam?.startsWith("/") &&
    !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  if (code) {
    const supabase =
      await createClient();

    const { error } =
      await supabase.auth.exchangeCodeForSession(
        code,
      );

    if (!error) {
      return NextResponse.redirect(
        `${origin}${next}`,
      );
    }

    console.error(
      "Erro ao trocar código por sessão:",
      error,
    );
  }

  return NextResponse.redirect(
    `${origin}/login?erro=callback`,
  );
}