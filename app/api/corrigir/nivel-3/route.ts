import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT_VERSION = "nivel-3-cebraspe-fixo-v2";
const MODEL_NAME =
  process.env.OPENAI_LANGUAGE_MODEL ||
  process.env.OPENAI_CONTENT_MODEL ||
  process.env.OPENAI_VALIDATION_MODEL ||
  "gpt-5-mini";

/*
 * Regra fixa do MVP:
 * cada ocorrência linguística válida desconta 0,10 ponto.
 *
 * Não há cálculo por número de linhas.
 */
const FIXED_PENALTY_PER_ERROR = 0.1;

type CorpoRequisicao = {
  answer_id?: number;
};

type RespostaBanco = {
  id: number;
  user_id: string;
  question_id: number;
  answer_text: string;
};

type CorrecaoBanco = {
  id: number;
  answer_id: number;
  content_score: number | null;
  language_error_count: number | null;
  language_discount: number | null;
  language_feedback: string | null;
};

type OcorrenciaLLM = {
  criterion_code:
    | "GRAFIA"
    | "MORFOSSINTAXE"
    | "PROPRIEDADE_VOCABULAR";
  criterion_name: string;
  excerpt: string;
  explanation: string;
  suggested_correction: string;
};

type ResultadoNivel3LLM = {
  occurrences: OcorrenciaLLM[];
  overall_feedback: string;
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
  return Math.round((value + Number.EPSILON) * fator) / fator;
}

async function registrarExecucao(params: {
  admin: ReturnType<typeof createAdminClient>;
  answerId: number;
  correctionId: number | null;
  status: string;
  inputData?: unknown;
  outputData?: unknown;
  processingTimeMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  errorMessage?: string | null;
}) {
  try {
    await params.admin.from("correction_runs").insert({
      answer_id: params.answerId,
      correction_id: params.correctionId,
      stage: "level_3_language",
      status: params.status,
      model_used: MODEL_NAME,
      prompt_version: PROMPT_VERSION,
      input_data: params.inputData ?? null,
      output_data: params.outputData ?? null,
      processing_time_ms: params.processingTimeMs ?? null,
      input_tokens: params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      error_message: params.errorMessage ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // A falha de auditoria não impede a análise principal.
  }
}

async function chamarOpenAI(answerText: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("A variável OPENAI_API_KEY não está configurada.");
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
Você é o Nível 3 de um sistema de correção de respostas discursivas inspirado nos critérios linguísticos utilizados pelo Cebraspe.

Analise exclusivamente a linguagem da resposta do candidato.

Categorias permitidas:

1. GRAFIA
- ortografia;
- acentuação;
- emprego de maiúsculas e minúsculas;
- segmentação gráfica de palavras.

2. MORFOSSINTAXE
- concordância nominal e verbal;
- regência nominal e verbal;
- colocação pronominal;
- construção sintática;
- emprego de conectivos;
- pontuação quando produzir erro sintático, ambiguidade ou quebra estrutural.

3. PROPRIEDADE_VOCABULAR
- escolha lexical inadequada;
- palavra empregada em sentido incompatível;
- imprecisão vocabular;
- ambiguidade lexical relevante;
- inadequação vocabular objetiva.

Regras obrigatórias:

- não avalie conteúdo técnico, jurídico ou temático;
- não altere a nota de conteúdo;
- não invente erros;
- registre somente ocorrências objetivamente identificáveis;
- cada ocorrência deve conter um trecho curto e literal da resposta;
- explique por que o trecho está inadequado;
- forneça uma correção sugerida;
- não registre a mesma ocorrência duas vezes;
- não trate preferência estilística como erro;
- não trate mera repetição como erro;
- não penalize informalidade quando ela não gerar incorreção;
- não conte duas vezes um único problema que afete a mesma construção;
- não inclua comentários sobre caligrafia, formatação ou quantidade de linhas;
- use somente os códigos:
  GRAFIA,
  MORFOSSINTAXE,
  PROPRIEDADE_VOCABULAR.

Caso não existam erros, devolva occurrences como lista vazia e informe isso no feedback geral.

A penalidade não é calculada por você.
O sistema aplicará desconto fixo de 0,10 ponto por ocorrência válida.
            `.trim(),
          },
          {
            role: "user",
            content: `
RESPOSTA DO CANDIDATO:

${answerText}
            `.trim(),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "nivel_3_cebraspe_fixo",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                occurrences: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      criterion_code: {
                        type: "string",
                        enum: [
                          "GRAFIA",
                          "MORFOSSINTAXE",
                          "PROPRIEDADE_VOCABULAR",
                        ],
                      },
                      criterion_name: {
                        type: "string",
                      },
                      excerpt: {
                        type: "string",
                      },
                      explanation: {
                        type: "string",
                      },
                      suggested_correction: {
                        type: "string",
                      },
                    },
                    required: [
                      "criterion_code",
                      "criterion_name",
                      "excerpt",
                      "explanation",
                      "suggested_correction",
                    ],
                  },
                },
                overall_feedback: {
                  type: "string",
                },
              },
              required: ["occurrences", "overall_feedback"],
            },
          },
        },
      }),
    },
  );

  const body = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message ||
        "A OpenAI recusou a solicitação de análise linguística.",
    );
  }

  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "A OpenAI não retornou o resultado da análise linguística.",
    );
  }

  let result: ResultadoNivel3LLM;

  try {
    result = JSON.parse(content) as ResultadoNivel3LLM;
  } catch {
    throw new Error(
      "O resultado da análise linguística não pôde ser interpretado.",
    );
  }

  return {
    result,
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  let answerId: number | null = null;
  let correctionId: number | null = null;

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return responderErro("Usuário não autenticado.", 401);
    }

    let body: CorpoRequisicao;

    try {
      body = (await request.json()) as CorpoRequisicao;
    } catch {
      return responderErro("Corpo da requisição inválido.", 400);
    }

    answerId = Number(body.answer_id);

    if (!Number.isInteger(answerId) || answerId <= 0) {
      return responderErro(
        "Identificador da resposta inválido.",
        400,
      );
    }

    const admin = createAdminClient();

    const {
      data: answerData,
      error: answerError,
    } = await admin
      .from("user_answers")
      .select(`
        id,
        user_id,
        question_id,
        answer_text
      `)
      .eq("id", answerId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (answerError) {
      return responderErro(
        `Erro ao buscar a resposta: ${answerError.message}`,
        500,
      );
    }

    if (!answerData) {
      return responderErro("Resposta não encontrada.", 404);
    }

    const answer = answerData as RespostaBanco;
    const answerText = texto(answer.answer_text);

    if (!answerText) {
      return responderErro("A resposta está vazia.", 422);
    }

    const {
      data: correctionData,
      error: correctionError,
    } = await admin
      .from("corrections")
      .select(`
        id,
        answer_id,
        content_score,
        language_error_count,
        language_discount,
        language_feedback
      `)
      .eq("answer_id", answerId)
      .maybeSingle();

    if (correctionError) {
      return responderErro(
        `Erro ao buscar a correção: ${correctionError.message}`,
        500,
      );
    }

    if (!correctionData) {
      return responderErro(
        "O Nível 2 precisa ser concluído antes do Nível 3.",
        409,
      );
    }

    const correction = correctionData as CorrecaoBanco;
    correctionId = Number(correction.id);

    if (correction.content_score === null) {
      return responderErro(
        "O Nível 2 ainda não possui uma nota de conteúdo.",
        409,
      );
    }

    if (
      correction.language_feedback !== null &&
      correction.language_error_count !== null &&
      correction.language_discount !== null
    ) {
      const {
        data: existingErrors,
        error: existingErrorsError,
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
        .eq("correction_id", correctionId)
        .order("occurrence_order", { ascending: true });

      if (existingErrorsError) {
        return responderErro(
          `Erro ao carregar ocorrências existentes: ${existingErrorsError.message}`,
          500,
        );
      }

      return NextResponse.json({
        success: true,
        cached: true,
        correction_id: correctionId,
        language_error_count: correction.language_error_count,
        language_discount: correction.language_discount,
        language_feedback: correction.language_feedback,
        fixed_penalty_per_error: FIXED_PENALTY_PER_ERROR,
        errors: existingErrors ?? [],
      });
    }

    await registrarExecucao({
      admin,
      answerId,
      correctionId,
      status: "processing",
      inputData: {
        answer_length: answerText.length,
        fixed_penalty_per_error: FIXED_PENALTY_PER_ERROR,
      },
    });

    const {
      result,
      inputTokens,
      outputTokens,
    } = await chamarOpenAI(answerText);

    const allowedCodes = new Set([
      "GRAFIA",
      "MORFOSSINTAXE",
      "PROPRIEDADE_VOCABULAR",
    ]);

    const occurrences = Array.isArray(result.occurrences)
      ? result.occurrences
          .filter((item) =>
            allowedCodes.has(String(item.criterion_code)),
          )
          .map((item, index) => ({
            correction_id: correctionId,
            criterion_code: String(item.criterion_code),
            criterion_name:
              texto(item.criterion_name) ||
              String(item.criterion_code),
            excerpt: texto(item.excerpt),
            explanation: texto(item.explanation),
            suggested_correction:
              texto(item.suggested_correction) || null,
            occurrence_order: index + 1,
          }))
          .filter(
            (item) =>
              item.excerpt.length > 0 &&
              item.explanation.length > 0,
          )
      : [];

    const languageErrorCount = occurrences.length;

    const languageDiscount = arredondar(
      languageErrorCount * FIXED_PENALTY_PER_ERROR,
    );

    const languageFeedback =
      texto(result.overall_feedback) ||
      (languageErrorCount === 0
        ? "Nenhuma ocorrência linguística foi identificada."
        : `${languageErrorCount} ocorrência(s) linguística(s) identificada(s), com desconto fixo total de ${languageDiscount.toFixed(2)} ponto(s).`);

    const {
      error: deleteError,
    } = await admin
      .from("language_errors")
      .delete()
      .eq("correction_id", correctionId);

    if (deleteError) {
      throw new Error(
        `Não foi possível remover ocorrências antigas: ${deleteError.message}`,
      );
    }

    if (occurrences.length > 0) {
      const {
        error: insertErrorsError,
      } = await admin
        .from("language_errors")
        .insert(occurrences);

      if (insertErrorsError) {
        throw new Error(
          `Não foi possível salvar os erros linguísticos: ${insertErrorsError.message}`,
        );
      }
    }

    const {
      error: updateCorrectionError,
    } = await admin
      .from("corrections")
      .update({
        language_error_count: languageErrorCount,
        effective_line_count: null,
        language_discount: languageDiscount,
        language_feedback: languageFeedback,
      })
      .eq("id", correctionId);

    if (updateCorrectionError) {
      throw new Error(
        `Não foi possível atualizar a correção: ${updateCorrectionError.message}`,
      );
    }

    await registrarExecucao({
      admin,
      answerId,
      correctionId,
      status: "completed",
      inputData: {
        answer_length: answerText.length,
        fixed_penalty_per_error: FIXED_PENALTY_PER_ERROR,
      },
      outputData: {
        language_error_count: languageErrorCount,
        language_discount: languageDiscount,
        fixed_penalty_per_error: FIXED_PENALTY_PER_ERROR,
        occurrences,
      },
      processingTimeMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
    });

    return NextResponse.json({
      success: true,
      cached: false,
      correction_id: correctionId,
      language_error_count: languageErrorCount,
      language_discount: languageDiscount,
      language_feedback: languageFeedback,
      fixed_penalty_per_error: FIXED_PENALTY_PER_ERROR,
      errors: occurrences,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado durante a análise linguística.";

    if (answerId !== null && answerId > 0) {
      try {
        const admin = createAdminClient();

        await registrarExecucao({
          admin,
          answerId,
          correctionId,
          status: "error",
          processingTimeMs: Date.now() - startedAt,
          errorMessage: message,
        });
      } catch {
        // Mantém o erro principal.
      }
    }

    return responderErro(message, 500);
  }
}
