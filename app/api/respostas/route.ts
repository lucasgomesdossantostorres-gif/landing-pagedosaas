import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buscarLimitesCorrecaoDoUsuario,
  devolverCorrecaoMensal,
  reservarCorrecaoMensal,
} from "@/lib/correction/usage";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CorpoRequisicao = {
  question_id?: number;
  selected_question?: number;
  answer_text?: string;
};

function respostaErro(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...extra,
    },
    {
      status,
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  let answerId: number | null = null;
  let reservaCriada = false;
  let periodoReservado = "";
  let userId = "";

  try {
    const supabase = await createClient();

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

    userId = user.id;

    let body: CorpoRequisicao;

    try {
      body =
        (await request.json()) as CorpoRequisicao;
    } catch {
      return respostaErro(
        "Corpo da requisição inválido.",
        400,
      );
    }

    const questionId = Number(body.question_id);
    const selectedQuestion = Number(body.selected_question);
    const answerText =
      typeof body.answer_text === "string"
        ? body.answer_text.trim()
        : "";

    if (
      !Number.isInteger(questionId) ||
      questionId <= 0
    ) {
      return respostaErro(
        "Identificador da prova inválido.",
        400,
      );
    }

    if (
      !Number.isInteger(selectedQuestion) ||
      selectedQuestion < 1 ||
      selectedQuestion > 4
    ) {
      return respostaErro(
        "Selecione uma questão válida entre 1 e 4.",
        400,
      );
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
        `Não foi possível verificar a liberação da prova: ${validacaoError.message}`,
        500,
      );
    }

    if (
      !validacao ||
      validacao.status !== "approved" ||
      validacao.semantic_valid !== true
    ) {
      return respostaErro(
        "Esta prova ainda não está disponível para envio de respostas.",
        409,
      );
    }

    const {
      data: questao,
      error: questaoError,
    } = await admin
      .from("questions")
      .select(`
        id,
        status
      `)
      .eq("id", questionId)
      .maybeSingle();

    if (questaoError) {
      return respostaErro(
        `Não foi possível verificar a prova: ${questaoError.message}`,
        500,
      );
    }

    if (!questao) {
      return respostaErro(
        "Prova não encontrada.",
        404,
      );
    }

    if (
      questao.status &&
      questao.status !== "published"
    ) {
      return respostaErro(
        "Esta prova não está disponível para respostas.",
        409,
      );
    }

    const limites =
      await buscarLimitesCorrecaoDoUsuario(
        user.id,
      );

    const submittedAt =
      new Date().toISOString();

    const {
      data: resposta,
      error: respostaError,
    } = await admin
      .from("user_answers")
      .insert({
        user_id: user.id,
        question_id: questionId,
        selected_question:
          selectedQuestion,
        answer_text: answerText,
        status: "submitted",
        submitted_at: submittedAt,
      })
      .select(`
        id,
        question_id,
        selected_question,
        status,
        submitted_at
      `)
      .single();

    if (
      respostaError ||
      !resposta
    ) {
      return respostaErro(
        `Não foi possível salvar a resposta: ${
          respostaError?.message ??
          "O banco não retornou o identificador da resposta."
        }`,
        500,
      );
    }

    answerId = Number(resposta.id);

    const reserva =
      await reservarCorrecaoMensal(
        user.id,
        limites.monthlyCorrections,
        answerId,
      );

    if (!reserva.allowed) {
      await admin
        .from("user_answers")
        .delete()
        .eq("id", answerId)
        .eq("user_id", user.id);

      return respostaErro(
        `Você atingiu o limite mensal de ${limites.monthlyCorrections} correções do plano ${limites.displayName}.`,
        429,
        {
          plan: limites.plan,
          plan_name:
            limites.displayName,
          monthly_limit:
            limites.monthlyCorrections,
          used_this_month:
            reserva.used,
          remaining_this_month:
            reserva.remaining,
        },
      );
    }

    reservaCriada = true;
    periodoReservado =
      reserva.periodStart;

    return NextResponse.json(
      {
        success: true,
        answer_id: resposta.id,
        id: resposta.id,
        question_id:
          resposta.question_id,
        selected_question:
          resposta.selected_question,
        status: resposta.status,
        submitted_at:
          resposta.submitted_at,

        limits: {
          plan: limites.plan,
          plan_name:
            limites.displayName,
          monthly_limit:
            limites.monthlyCorrections,
          used_this_month:
            reserva.used,
          remaining_this_month:
            reserva.remaining,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao salvar a resposta.";

    if (
      reservaCriada &&
      userId &&
      periodoReservado &&
      answerId !== null
    ) {
      await devolverCorrecaoMensal(
        userId,
        periodoReservado,
        answerId,
        message,
      );
    }

    if (
      !reservaCriada &&
      userId &&
      answerId !== null
    ) {
      try {
        const admin = createAdminClient();

        await admin
          .from("user_answers")
          .delete()
          .eq("id", answerId)
          .eq("user_id", userId);
      } catch {
        // Mantém o erro original.
      }
    }

    return respostaErro(
      message,
      500,
    );
  }
}
