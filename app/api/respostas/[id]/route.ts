import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responderErro(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  );
}

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const {
      id: rawAnswerId,
    } = await context.params;

    const answerId =
      Number(rawAnswerId);

    if (
      !Number.isInteger(answerId) ||
      answerId <= 0
    ) {
      return responderErro(
        "Identificador da resposta inválido.",
        400,
      );
    }

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return responderErro(
        "Usuário não autenticado.",
        401,
      );
    }

    const admin =
      createAdminClient();

    const {
      data: answer,
      error: answerError,
    } = await admin
      .from("user_answers")
      .select("id")
      .eq("id", answerId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (answerError) {
      throw new Error(
        `Não foi possível verificar a resposta: ${answerError.message}`,
      );
    }

    if (!answer) {
      return responderErro(
        "Resposta não encontrada.",
        404,
      );
    }

    const {
      error: deleteError,
    } = await admin
      .from("user_answers")
      .delete()
      .eq("id", answerId)
      .eq("user_id", user.id);

    if (deleteError) {
      throw new Error(
        `Não foi possível excluir a resposta: ${deleteError.message}`,
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Resposta excluída do histórico.",
    });
  } catch (error) {
    return responderErro(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao excluir a resposta.",
      500,
    );
  }
}
