import { NextRequest, NextResponse } from "next/server";

import {
  buscarLimitesCorrecaoDoUsuario,
  devolverCorrecaoMensal,
  reservarCorrecaoMensal,
} from "@/lib/correction/usage";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT_VERSION = "nivel-2-feedback-criterios-v4";

const MODEL_NAME =
  process.env.OPENAI_CONTENT_MODEL ||
  process.env.OPENAI_VALIDATION_MODEL ||
  "gpt-5-mini";

type CorpoRequisicao = {
  answer_id?: number;
};

type RespostaBanco = {
  id: number;
  user_id: string;
  question_id: number;
  answer_text: string;
  status: string | null;
};

type QuestaoBanco = {
  id: number;
  statement: string | null;
  reference_answer: string | null;
  maximum_score: number | null;
};

type StatusCriterio =
  | "atendeu"
  | "atendeu_parcialmente"
  | "nao_atendeu";

type FeedbackPorCriterio = {
  criterion: string;
  evaluation: string;
  status: StatusCriterio;
};

type ResultadoNivel2LLM = {
  score: number;
  feedback: string;
  strengths: string[];
  improvement_priorities: string[];
  criteria_feedback: FeedbackPorCriterio[];
};

type CorrecaoExistenteBanco = {
  id: number;
  content_score: number | string | null;
  content_maximum_score: number | string | null;
  content_feedback: string | null;
  strengths: string | null;
  weaknesses: string | null;
  criteria_feedback: FeedbackPorCriterio[] | null;
};

type OpenAIResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message?: string;
  };
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

function texto(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function arredondar(value: number, casas = 2) {
  const fator = 10 ** casas;

  return (
    Math.round((value + Number.EPSILON) * fator) /
    fator
  );
}

function limitarNota(
  value: unknown,
  maximumScore: number,
) {
  const numero = Number(value);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return arredondar(
    Math.min(maximumScore, Math.max(0, numero)),
  );
}

function normalizarLista(
  value: unknown,
  maximumItems = 5,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, maximumItems);
}

function normalizarFeedbackPorCriterio(
  value: unknown,
): FeedbackPorCriterio[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const statusPermitidos = new Set<StatusCriterio>([
    "atendeu",
    "atendeu_parcialmente",
    "nao_atendeu",
  ]);

  return value
    .map((item): FeedbackPorCriterio | null => {
      if (
        typeof item !== "object" ||
        item === null
      ) {
        return null;
      }

      const dados = item as Record<
        string,
        unknown
      >;

      const criterion = String(
        dados.criterion ?? "",
      ).trim();

      const evaluation = String(
        dados.evaluation ?? "",
      ).trim();

      const status = String(
        dados.status ?? "",
      ).trim() as StatusCriterio;

      if (
        !criterion ||
        !evaluation ||
        !statusPermitidos.has(status)
      ) {
        return null;
      }

      return {
        criterion,
        evaluation,
        status,
      };
    })
    .filter(
      (
        item,
      ): item is FeedbackPorCriterio =>
        item !== null,
    )
    .slice(0, 10);
}

function listaComoTexto(items: string[]) {
  if (items.length === 0) {
    return null;
  }

  return items
    .map((item) => `• ${item}`)
    .join("\n");
}

async function registrarExecucao(params: {
  admin: ReturnType<typeof createAdminClient>;
  answerId: number;
  correctionId?: number | null;
  status: string;
  inputData?: unknown;
  outputData?: unknown;
  processingTimeMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  errorMessage?: string | null;
}) {
  try {
    await params.admin
      .from("correction_runs")
      .insert({
        answer_id: params.answerId,
        correction_id:
          params.correctionId ?? null,
        stage: "level_2_content",
        status: params.status,
        model_used: MODEL_NAME,
        prompt_version: PROMPT_VERSION,
        input_data: params.inputData ?? null,
        output_data: params.outputData ?? null,
        processing_time_ms:
          params.processingTimeMs ?? null,
        input_tokens:
          params.inputTokens ?? null,
        output_tokens:
          params.outputTokens ?? null,
        error_message:
          params.errorMessage ?? null,
        created_at: new Date().toISOString(),
      });
  } catch {
    /*
     * A falha no registro de auditoria não deve impedir
     * a correção principal.
     */
  }
}

async function chamarOpenAI(params: {
  enunciado: string;
  gabarito: string;
  respostaAluno: string;
  maximumScore: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "A variável OPENAI_API_KEY não está configurada.",
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "system",
            content: `
Você corrige exclusivamente o conteúdo de respostas discursivas de concursos públicos.

Utilize somente:
- o enunciado fornecido;
- o gabarito oficial fornecido;
- a resposta do candidato;
- a nota máxima informada.

Principal desafio:
- entender a profundidade do gabarito para avaliar a resposta de forma precisa, evitando notas excessivamente altas.

Sua tarefa é:
1. atribuir uma nota entre zero e a nota máxima;
2. escrever uma explicação completa e estruturada da nota;
3. indicar cinco pontos fortes;
4. indicar cinco prioridades de melhoria;
5. avaliar separadamente cada exigência relevante do enunciado, apresentando feedback por critério.

Regras obrigatórias:
- caso aja incompatibilidade enunciado/gabarito, não respoda e informe o erro;
- seja acertivo, mas crie grandes respostas;
- não exija reprodução literal do padrão oficial;
- não desconte erros linguísticos;
- relacione claramente a explicação com a nota atribuída;
- em "criteria_feedback", crie um item para cada exigência ou critério relevante do enunciado;
- o campo "criterion" deve identificar o critério avaliado;
- o campo "evaluation" deve explicar o que o candidato acertou, omitiu ou desenvolveu parcialmente;
- o campo "status" deve ser exatamente "atendeu", "atendeu_parcialmente" ou "nao_atendeu";
- não repita integralmente o feedback geral dentro dos critérios;
- mantenha os pontos fortes e as prioridades de melhoria, específicos e sem repetição.

            `.trim(),
          },
          {
            role: "user",
            content: `
ENUNCIADO:

${params.enunciado}

GABARITO OFICIAL:

${params.gabarito}

NOTA MÁXIMA:

${params.maximumScore}

RESPOSTA DO CANDIDATO:

${params.respostaAluno}
            `.trim(),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "nivel_2_feedback_criterios",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                score: {
                  type: "number",
                },
                feedback: {
                  type: "string",
                },
                strengths: {
                  type: "array",
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: "string",
                  },
                },
                improvement_priorities: {
                  type: "array",
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: "string",
                  },
                },
                criteria_feedback: {
                  type: "array",
                  minItems: 1,
                  maxItems: 10,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      criterion: {
                        type: "string",
                      },
                      evaluation: {
                        type: "string",
                      },
                      status: {
                        type: "string",
                        enum: [
                          "atendeu",
                          "atendeu_parcialmente",
                          "nao_atendeu",
                        ],
                      },
                    },
                    required: [
                      "criterion",
                      "evaluation",
                      "status",
                    ],
                  },
                },
              },
              required: [
                "score",
                "feedback",
                "strengths",
                "improvement_priorities",
                "criteria_feedback",
              ],
            },
          },
        },
      }),
    },
  );

  const body =
    (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message ||
        "A OpenAI recusou a solicitação de correção.",
    );
  }

  const content =
    body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "A OpenAI não retornou o resultado da correção.",
    );
  }

  let resultado: ResultadoNivel2LLM;

  try {
    resultado =
      JSON.parse(content) as ResultadoNivel2LLM;
  } catch {
    throw new Error(
      "O resultado da correção não pôde ser interpretado.",
    );
  }

  return {
    resultado,
    inputTokens:
      body.usage?.prompt_tokens ?? null,
    outputTokens:
      body.usage?.completion_tokens ?? null,
  };
}

export async function POST(
  request: NextRequest,
) {
  const inicio = Date.now();

  let answerId: number | null = null;
  let correctionId: number | null = null;
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
        question_id,
        answer_text,
        status
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

    const respostaAluno =
      texto(resposta.answer_text);

    if (!respostaAluno) {
      return responderErro(
        "A resposta está vazia.",
        422,
      );
    }

    const {
      data: validacao,
      error: validacaoError,
    } = await admin
      .from("question_validations")
      .select(`
        status,
        semantic_valid,
        feedback,
        confidence
      `)
      .eq(
        "question_id",
        resposta.question_id,
      )
      .maybeSingle();

    if (validacaoError) {
      return responderErro(
        `Erro ao verificar a validação da questão: ${validacaoError.message}`,
        500,
      );
    }

    if (
      !validacao ||
      validacao.status !== "approved" ||
      validacao.semantic_valid !== true
    ) {
      return responderErro(
        "A questão não está aprovada no Nível 1.",
        409,
      );
    }

    const {
      data: correcaoExistenteData,
      error: correcaoExistenteError,
    } = await admin
      .from("corrections")
      .select(`
        id,
        content_score,
        content_maximum_score,
        content_feedback,
        strengths,
        weaknesses,
        criteria_feedback
      `)
      .eq("answer_id", answerId)
      .maybeSingle();

    if (correcaoExistenteError) {
      return responderErro(
        `Erro ao consultar a correção: ${correcaoExistenteError.message}`,
        500,
      );
    }

    const correcaoExistente =
      correcaoExistenteData as
        | CorrecaoExistenteBanco
        | null;

    if (
      correcaoExistente &&
      correcaoExistente.content_feedback &&
      correcaoExistente.content_score !== null &&
      Array.isArray(
        correcaoExistente.criteria_feedback,
      ) &&
      correcaoExistente.criteria_feedback.length > 0
    ) {
      return NextResponse.json({
        success: true,
        cached: true,
        correction_id:
          correcaoExistente.id,
        content_score: Number(
          correcaoExistente.content_score ?? 0,
        ),
        content_maximum_score: Number(
          correcaoExistente
            .content_maximum_score ?? 0,
        ),
        content_feedback:
          correcaoExistente.content_feedback,
        strengths:
          correcaoExistente.strengths,
        improvement_priorities:
          correcaoExistente.weaknesses,
        criteria_feedback:
          correcaoExistente.criteria_feedback,
      });
    }

    const {
      data: questaoData,
      error: questaoError,
    } = await admin
      .from("questions")
      .select(`
        id,
        statement,
        reference_answer,
        maximum_score
      `)
      .eq(
        "id",
        resposta.question_id,
      )
      .single();

    if (questaoError || !questaoData) {
      return responderErro(
        "Questão não encontrada.",
        404,
      );
    }

    const questao =
      questaoData as QuestaoBanco;

    const enunciado =
      texto(questao.statement);

    const gabarito =
      texto(questao.reference_answer);

    const maximumScore =
      Number(questao.maximum_score ?? 0);

    if (!enunciado || !gabarito) {
      return responderErro(
        "A questão não possui enunciado ou gabarito disponível.",
        422,
      );
    }

    if (
      !Number.isFinite(maximumScore) ||
      maximumScore <= 0
    ) {
      return responderErro(
        "A questão não possui nota máxima válida.",
        422,
      );
    }

    const limites =
      await buscarLimitesCorrecaoDoUsuario(
        user.id,
      );

    const reserva =
      await reservarCorrecaoMensal(
        user.id,
        limites.monthlyCorrections,
        answerId,
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

    await registrarExecucao({
      admin,
      answerId,
      correctionId: null,
      status: "processing",
      inputData: {
        question_id:
          resposta.question_id,
        maximum_score: maximumScore,
        correction_mode:
          "single_complete_feedback_with_criteria",
      },
    });

    const {
      resultado,
      inputTokens,
      outputTokens,
    } = await chamarOpenAI({
      enunciado,
      gabarito,
      respostaAluno,
      maximumScore,
    });

    const contentScore = limitarNota(
      resultado.score,
      maximumScore,
    );

    const contentFeedback =
      texto(resultado.feedback) ||
      "Correção de conteúdo concluída.";

    const strengths = normalizarLista(
      resultado.strengths,
      5,
    );

    const improvementPriorities =
      normalizarLista(
        resultado.improvement_priorities,
        5,
      );

    const criteriaFeedback =
      normalizarFeedbackPorCriterio(
        resultado.criteria_feedback,
      );

    if (criteriaFeedback.length === 0) {
      throw new Error(
        "A OpenAI não retornou o feedback por critério.",
      );
    }

    const correctionPayload = {
      content_score: contentScore,
      content_maximum_score:
        maximumScore,

      /*
       * A explicação completa aparece somente
       * em content_feedback.
       */
      content_feedback:
        contentFeedback,

      /*
       * Evita repetir a mesma explicação no topo
       * e novamente na seção de conteúdo.
       */
      summary_feedback: null,

      strengths:
        listaComoTexto(strengths),

      /*
       * Reutilizamos weaknesses como prioridades
       * de melhoria para não alterar o banco agora.
       */
      weaknesses:
        listaComoTexto(
          improvementPriorities,
        ),

      /*
       * Nova seção de avaliação individual
       * por critério do enunciado.
       */
      criteria_feedback:
        criteriaFeedback,

      /*
       * Não haverá uma segunda lista redundante.
       */
      improvement_suggestions: null,

      validation_status: "adequate",
      validation_feedback:
        validacao.feedback ??
        "Questão aprovada no Nível 1.",
      validation_confidence: Number(
        validacao.confidence ?? 0,
      ),

      total_score: contentScore,
      calculation_details: null,
      model_used: MODEL_NAME,
      prompt_version: PROMPT_VERSION,
      processing_time_ms:
        Date.now() - inicio,
    };

    if (correcaoExistente) {
      correctionId = Number(
        correcaoExistente.id,
      );

      const { error: updateError } =
        await admin
          .from("corrections")
          .update(correctionPayload)
          .eq("id", correctionId);

      if (updateError) {
        throw new Error(
          `Não foi possível atualizar a correção: ${updateError.message}`,
        );
      }
    } else {
      const {
        data: novaCorrecao,
        error: insertCorrectionError,
      } = await admin
        .from("corrections")
        .insert({
          answer_id: answerId,
          ...correctionPayload,
        })
        .select("id")
        .single();

      if (
        insertCorrectionError ||
        !novaCorrecao
      ) {
        throw new Error(
          `Não foi possível criar a correção: ${
            insertCorrectionError?.message ??
            "O banco não retornou o identificador."
          }`,
        );
      }

      correctionId = Number(
        novaCorrecao.id,
      );
    }

    await admin
      .from("user_answers")
      .update({
        status: "processing",
      })
      .eq("id", answerId);

    await registrarExecucao({
      admin,
      answerId,
      correctionId,
      status: "completed",
      inputData: {
        question_id:
          resposta.question_id,
        maximum_score: maximumScore,
        correction_mode:
          "single_complete_feedback_with_criteria",
      },
      outputData: {
        content_score: contentScore,
        content_maximum_score:
          maximumScore,
        strengths,
        improvement_priorities:
          improvementPriorities,
        criteria_feedback:
          criteriaFeedback,
      },
      processingTimeMs:
        Date.now() - inicio,
      inputTokens,
      outputTokens,
    });

    return NextResponse.json({
      success: true,
      cached: false,
      correction_id: correctionId,
      content_score: contentScore,
      content_maximum_score:
        maximumScore,
      content_feedback:
        contentFeedback,
      strengths,
      improvement_priorities:
        improvementPriorities,
      criteria_feedback:
        criteriaFeedback,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado durante a correção de conteúdo.";

    if (
      answerId !== null &&
      answerId > 0
    ) {
      try {
        const admin =
          createAdminClient();

        await registrarExecucao({
          admin,
          answerId,
          correctionId,
          status: "error",
          processingTimeMs:
            Date.now() - inicio,
          errorMessage: message,
        });
      } catch {
        // Preserva o erro principal.
      }
    }

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

    return responderErro(
      message,
      500,
    );
  }
}