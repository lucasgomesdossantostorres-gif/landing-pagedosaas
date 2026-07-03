import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CorpoRequisicao = {
  question_id?: number;
  answer_text?: string;
};

function respostaErro(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return respostaErro("Usuário não autenticado.", 401);
    }

    let body: CorpoRequisicao;

    try {
      body = (await request.json()) as CorpoRequisicao;
    } catch {
      return respostaErro("Corpo da requisição inválido.", 400);
    }

    const questionId = Number(body.question_id);
    const answerText =
      typeof body.answer_text === "string"
        ? body.answer_text.trim()
        : "";

    if (!Number.isInteger(questionId) || questionId <= 0) {
      return respostaErro("Identificador da questão inválido.", 400);
    }

    if (answerText.length < 30) {
      return respostaErro(
        "A resposta precisa ter pelo menos 30 caracteres.",
        400,
      );
    }

    const admin = createAdminClient();

    const {
      data: validacao,
      error: validacaoError,
    } = await admin
      .from("question_validations")
      .select(`
        status,
        semantic_valid,
        validated_at
      `)
      .eq("question_id", questionId)
      .maybeSingle();

    if (validacaoError) {
      return respostaErro(
        `Não foi possível verificar a validação da questão: ${validacaoError.message}`,
        500,
      );
    }

    if (
      !validacao ||
      validacao.status !== "approved" ||
      validacao.semantic_valid !== true
    ) {
      return respostaErro(
        "A questão ainda não foi aprovada na validação semântica.",
        409,
      );
    }

    const {
      data: questao,
      error: questaoError,
    } = await admin
      .from("questions")
      .select("id")
      .eq("id", questionId)
      .maybeSingle();

    if (questaoError) {
      return respostaErro(
        `Não foi possível verificar a questão: ${questaoError.message}`,
        500,
      );
    }

    if (!questao) {
      return respostaErro("Questão não encontrada.", 404);
    }

    const submittedAt = new Date().toISOString();

    const {
      data: resposta,
      error: respostaError,
    } = await admin
      .from("user_answers")
      .insert({
        user_id: user.id,
        question_id: questionId,
        answer_text: answerText,
        status: "submitted",
        submitted_at: submittedAt,
      })
      .select("id")
      .single();

    if (respostaError || !resposta) {
      return respostaErro(
        `Não foi possível salvar a resposta: ${
          respostaError?.message ??
          "O banco não retornou o identificador da resposta."
        }`,
        500,
      );
    }

    return NextResponse.json(
      {
        success: true,
        answer_id: resposta.id,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao salvar a resposta.";

    return respostaErro(message, 500);
  }
}
