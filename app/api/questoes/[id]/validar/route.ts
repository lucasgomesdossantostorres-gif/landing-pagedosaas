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

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const questionId = Number(id);

    if (!Number.isInteger(questionId) || questionId <= 0) {
      return responderErro(
        "Identificador da questão inválido.",
        400,
      );
    }

    const supabase = await createClient();

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

    const admin = createAdminClient();

    const {
      data: questao,
      error: questaoError,
    } = await admin
      .from("questions")
      .select(`
        id,
        statement,
        reference_answer,
        status
      `)
      .eq("id", questionId)
      .maybeSingle();

    if (questaoError) {
      return responderErro(
        `Não foi possível verificar a questão: ${questaoError.message}`,
        500,
      );
    }

    if (!questao) {
      return responderErro(
        "Questão não encontrada.",
        404,
      );
    }

    /*
     * Não há mais análise por IA.
     * Toda questão existente é considerada válida.
     */
    const validatedAt = new Date().toISOString();

    const validationPayload = {
      question_id: questionId,
      status: "approved",
      semantic_valid: true,
      confidence: 1,
      feedback:
        "Questão liberada automaticamente para resposta.",
      inconsistencies: [],
      validated_at: validatedAt,
    };

    const {
      data: validacaoExistente,
      error: consultaError,
    } = await admin
      .from("question_validations")
      .select("id")
      .eq("question_id", questionId)
      .maybeSingle();

    if (consultaError) {
      return responderErro(
        `Não foi possível consultar a validação: ${consultaError.message}`,
        500,
      );
    }

    let validationId: number;

    if (validacaoExistente) {
      const {
        data: validacaoAtualizada,
        error: updateError,
      } = await admin
        .from("question_validations")
        .update({
          status: validationPayload.status,
          semantic_valid: validationPayload.semantic_valid,
          confidence: validationPayload.confidence,
          feedback: validationPayload.feedback,
          inconsistencies: validationPayload.inconsistencies,
          validated_at: validationPayload.validated_at,
        })
        .eq("id", validacaoExistente.id)
        .select("id")
        .single();

      if (updateError || !validacaoAtualizada) {
        return responderErro(
          `Não foi possível atualizar a validação: ${
            updateError?.message ??
            "O banco não retornou o registro atualizado."
          }`,
          500,
        );
      }

      validationId = Number(validacaoAtualizada.id);
    } else {
      const {
        data: novaValidacao,
        error: insertError,
      } = await admin
        .from("question_validations")
        .insert(validationPayload)
        .select("id")
        .single();

      if (insertError || !novaValidacao) {
        return responderErro(
          `Não foi possível registrar a validação: ${
            insertError?.message ??
            "O banco não retornou o registro criado."
          }`,
          500,
        );
      }

      validationId = Number(novaValidacao.id);
    }

    return NextResponse.json({
      success: true,
      status: "approved",
      approved: true,
      cached: Boolean(validacaoExistente),
      confidence: 1,
      feedback:
        "Questão disponível para resposta.",
      inconsistencies: [],
      validated_at: validatedAt,
      validation_id: validationId,
      validation_mode: "automatic",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao liberar a questão.";

    return responderErro(message, 500);
  }
}