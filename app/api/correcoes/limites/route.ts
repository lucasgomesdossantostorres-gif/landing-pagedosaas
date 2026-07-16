import {
  NextResponse,
} from "next/server";

import {
  buscarLimitesCorrecaoDoUsuario,
  consultarUsoMensal,
} from "@/lib/correction/usage";

import {
  createClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function respostaErro(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    },
  );
}

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return respostaErro(
        "Usuário não autenticado.",
        401,
      );
    }

    const [
      limits,
      usage,
    ] = await Promise.all([
      buscarLimitesCorrecaoDoUsuario(
        user.id,
      ),
      consultarUsoMensal(
        user.id,
      ),
    ]);

    const remaining = Math.max(
      limits.monthlyCorrections -
        usage.usedCorrections,
      0,
    );

    return NextResponse.json({
      success: true,
      plan: limits.plan,
      plan_name:
        limits.displayName,
      monthly_limit:
        limits.monthlyCorrections,
      used_this_month:
        usage.usedCorrections,
      remaining_this_month:
        remaining,
      period_start:
        usage.periodStart,
    });
  } catch (error) {
    return respostaErro(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao consultar o limite.",
      500,
    );
  }
}
