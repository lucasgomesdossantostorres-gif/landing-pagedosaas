import { NextRequest, NextResponse } from "next/server";

import {
  buscarLimitesCorrecaoDoUsuario,
  devolverCorrecaoMensal,
  obterInicioMesDaDataBrasil,
  registrarCorrecaoConcluida,
  reservarCorrecaoMensal,
} from "@/lib/correction/usage";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_PENALTY_PER_ERROR = 0.1;
const SCORE_PRECISION = 2;
const MINIMUM_SCORE = 0;

type CorpoRequisicao = {
  answer_id?: number;
};

type RespostaBanco = {
  id: number;
  user_id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
  content_score: number | string | null;
  content_maximum_score: number | string | null;
  language_error_count: number | string | null;
  language_discount: number | string | null;
  calculation_details: unknown;
  total_score: number | string | null;
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

function numeroSeguro(
  valor: number | string | null | undefined,
  valorPadrao = 0,
) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : valorPadrao;
}

function limitar(
  valor: number,
  minimo: number,
  maximo: number,
) {
  return Math.min(
    Math.max(valor, minimo),
    maximo,
  );
}

function arredondar(
  valor: number,
  casas = SCORE_PRECISION,
) {
  const multiplicador = 10 ** casas;

  return (
    Math.round(
      (valor + Number.EPSILON) *
        multiplicador,
    ) / multiplicador
  );
}

export async function POST(
  request: NextRequest,
) {
  const inicio = Date.now();

  let answerId: number | null = null;
  let userId = "";
  let reservaAtiva = false;
  let periodoReservado = "";

  try {
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

    userId = user.id;

    let body: CorpoRequisicao;

    try {
      body =
        (await request.json()) as CorpoRequisicao;
    } catch {
      return responderErro(
        "Corpo da requisição inválido.",
        400,
      );
    }

    answerId = Number(body.answer_id);

    if (
      !Number.isInteger(answerId) ||
      answerId <= 0
    ) {
      return responderErro(
        "Identificador da resposta inválido.",
        400,
      );
    }

    const admin = createAdminClient();

    const {
      data: respostaData,
      error: respostaError,
    } = await admin
      .from("user_answers")
      .select(`
        id,
        user_id,
        status,
        submitted_at,
        created_at
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

    if (!respostaData) {
      return responderErro(
        "Resposta não encontrada.",
        404,
      );
    }

    const resposta =
      respostaData as RespostaBanco;

    const jaEstavaCorrigida =
      resposta.status === "corrected";

    const {
      data: correcaoData,
      error: correcaoError,
    } = await admin
      .from("corrections")
      .select(`
        id,
        answer_id,
        content_score,
        content_maximum_score,
        language_error_count,
        language_discount,
        calculation_details,
        total_score
      `)
      .eq("answer_id", answerId)
      .maybeSingle();

    if (correcaoError) {
      return responderErro(
        `Erro ao buscar a correção: ${correcaoError.message}`,
        500,
      );
    }

    if (!correcaoData) {
      return responderErro(
        "A análise de conteúdo ainda não foi concluída.",
        409,
      );
    }

    const correcao =
      correcaoData as CorrecaoBanco;

    if (
      correcao.content_score === null ||
      correcao.content_score === undefined
    ) {
      return responderErro(
        "A nota de conteúdo ainda não foi calculada.",
        409,
      );
    }

    if (
      correcao.content_maximum_score === null ||
      correcao.content_maximum_score === undefined
    ) {
      return responderErro(
        "A nota máxima de conteúdo não foi registrada.",
        409,
      );
    }

    if (
      correcao.language_error_count === null ||
      correcao.language_error_count === undefined
    ) {
      return responderErro(
        "A análise linguística ainda não foi concluída.",
        409,
      );
    }

    const limites =
      await buscarLimitesCorrecaoDoUsuario(
        user.id,
      );

    const periodoDaResposta =
      obterInicioMesDaDataBrasil(
        resposta.submitted_at ??
          resposta.created_at,
      );

    const reserva =
      await reservarCorrecaoMensal(
        user.id,
        limites.monthlyCorrections,
        answerId,
        periodoDaResposta,
      );

    if (!reserva.allowed) {
      return responderErro(
        `Você atingiu o limite mensal de ${limites.monthlyCorrections} correções do plano ${limites.displayName}.`,
        429,
      );
    }

    reservaAtiva =
      reserva.reservationStatus === "reserved";
    periodoReservado = reserva.periodStart;

    const notaMaxima = numeroSeguro(
      correcao.content_maximum_score,
    );

    if (notaMaxima <= 0) {
      return responderErro(
        "A nota máxima registrada é inválida.",
        422,
      );
    }

    const notaConteudo = limitar(
      numeroSeguro(correcao.content_score),
      MINIMUM_SCORE,
      notaMaxima,
    );

    const quantidadeErros = Math.max(
      0,
      Math.trunc(
        numeroSeguro(
          correcao.language_error_count,
        ),
      ),
    );

    const descontoBruto =
      quantidadeErros *
      FIXED_PENALTY_PER_ERROR;

    const descontoLinguistico =
      arredondar(
        Math.min(
          descontoBruto,
          notaConteudo,
        ),
      );

    const notaAntesDoLimite =
      notaConteudo -
      descontoLinguistico;

    const notaFinal = arredondar(
      limitar(
        notaAntesDoLimite,
        MINIMUM_SCORE,
        notaMaxima,
      ),
    );

    const calculoDetalhado = {
      content_score: notaConteudo,
      content_maximum_score: notaMaxima,
      language_error_count:
        quantidadeErros,
      fixed_penalty_per_error:
        FIXED_PENALTY_PER_ERROR,
      language_discount:
        descontoLinguistico,
      raw_final_score:
        notaAntesDoLimite,
      final_score: notaFinal,
      score_precision:
        SCORE_PRECISION,
      minimum_score:
        MINIMUM_SCORE,
      formula:
        "content_score - (language_error_count * 0.10)",
      calculation_engine:
        "nextjs-fixed-language-penalty-v1",
      calculated_at:
        new Date().toISOString(),
    };

    const {
      data: correcaoAtualizada,
      error: updateCorrectionError,
    } = await admin
      .from("corrections")
      .update({
        total_score: notaFinal,
        language_discount:
          descontoLinguistico,
        calculation_details:
          calculoDetalhado,
        processing_time_ms:
          Date.now() - inicio,
      })
      .eq("id", correcao.id)
      .select(`
        id,
        total_score,
        language_discount,
        calculation_details
      `)
      .single();

    if (
      updateCorrectionError ||
      !correcaoAtualizada
    ) {
      return responderErro(
        `Não foi possível salvar a nota final: ${
          updateCorrectionError?.message ??
          "O banco não retornou a correção atualizada."
        }`,
        500,
      );
    }

    const {
      error: updateAnswerError,
    } = await admin
      .from("user_answers")
      .update({
        status: "corrected",
      })
      .eq("id", resposta.id)
      .eq("user_id", user.id);

    if (updateAnswerError) {
      return responderErro(
        `A nota foi calculada, mas não foi possível atualizar o status da resposta: ${updateAnswerError.message}`,
        500,
      );
    }

    /*
     * A função do banco é idempotente: executar o Nível 4
     * novamente não consome um segundo crédito.
     */
    await registrarCorrecaoConcluida(
      user.id,
      periodoDaResposta,
      answerId,
    );

    reservaAtiva = false;

    return NextResponse.json({
      success: true,
      cached: jaEstavaCorrigida,
      correction_id: correcao.id,
      content_score:
        notaConteudo,
      content_maximum_score:
        notaMaxima,
      language_error_count:
        quantidadeErros,
      fixed_penalty_per_error:
        FIXED_PENALTY_PER_ERROR,
      language_discount:
        descontoLinguistico,
      raw_final_score:
        notaAntesDoLimite,
      final_score:
        notaFinal,
      total_score:
        notaFinal,
      score_precision:
        SCORE_PRECISION,
      calculation_details:
        calculoDetalhado,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao calcular a nota final.";

    if (
      reservaAtiva &&
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

    return responderErro(message, 500);
  }
}
