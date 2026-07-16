import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function responderErro(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const answerId = Number(id);

    if (!Number.isInteger(answerId) || answerId <= 0) {
      return responderErro(
        "Identificador da resposta inválido.",
        400,
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return responderErro("Usuário não autenticado.", 401);
    }

    const admin = createAdminClient();

    const {
      data: resposta,
      error: respostaError,
    } = await admin
      .from("user_answers")
      .select(`
        id,
        user_id,
        question_id,
        selected_question,
        answer_text,
        status,
        created_at,
        submitted_at
      `)
      .eq("id", answerId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (respostaError) {
      return responderErro(
        `Erro ao buscar a resposta: ${respostaError.message}`,
        500,
      );
    }

    if (!resposta) {
      return responderErro("Resposta não encontrada.", 404);
    }

    const {
      data: questao,
      error: questaoError,
    } = await admin
      .from("questions")
      .select(`
        id,
        title,
        statement,
        reference_answer,
        examining_board,
        exam_name,
        exam_year,
        maximum_score
      `)
      .eq("id", resposta.question_id)
      .maybeSingle();

    if (questaoError) {
      return responderErro(
        `Erro ao buscar a questão: ${questaoError.message}`,
        500,
      );
    }

    if (!questao) {
      return responderErro(
        "Questão vinculada não encontrada.",
        404,
      );
    }

    const {
      data: correcao,
      error: correcaoError,
    } = await admin
      .from("corrections")
      .select(`
        id,
        answer_id,
        total_score,
        summary_feedback,
        strengths,
        weaknesses,
        improvement_suggestions,
        improved_answer,
        validation_status,
        validation_feedback,
        validation_confidence,
        content_score,
        content_maximum_score,
        content_feedback,
        language_error_count,
        effective_line_count,
        language_discount,
        language_feedback,
        calculation_details,
        model_used,
        prompt_version,
        processing_time_ms,
        created_at
      `)
      .eq("answer_id", answerId)
      .maybeSingle();

    if (correcaoError) {
      return responderErro(
        `Erro ao buscar a correção: ${correcaoError.message}`,
        500,
      );
    }

    let errosLinguagem: unknown[] = [];

    if (correcao) {
      const {
        data: errosData,
        error: errosError,
      } = await admin
        .from("language_errors")
        .select(`
          id,
          correction_id,
          criterion_code,
          criterion_name,
          excerpt,
          explanation,
          suggested_correction,
          occurrence_order
        `)
        .eq("correction_id", correcao.id)
        .order("occurrence_order", {
          ascending: true,
        });

      if (errosError) {
        return responderErro(
          `Erro ao buscar as ocorrências linguísticas: ${errosError.message}`,
          500,
        );
      }

      errosLinguagem = errosData ?? [];
    }

    const nivel2Concluido = Boolean(
      correcao?.content_feedback &&
        correcao.content_score !== null,
    );

    return NextResponse.json({
      success: true,

      answer: resposta,

      question: {
        id: questao.id,
        title: questao.title,
        statement: questao.statement,
        examining_board: questao.examining_board,
        exam_name: questao.exam_name,
        exam_year: questao.exam_year,
        maximum_score: questao.maximum_score,

        /*
         * O gabarito só é liberado quando a correção
         * de conteúdo estiver concluída.
         */
        reference_answer: nivel2Concluido
          ? questao.reference_answer
          : null,
      },

      correction: correcao,
      language_errors: errosLinguagem,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao carregar o resultado.";

    return responderErro(message, 500);
  }
}