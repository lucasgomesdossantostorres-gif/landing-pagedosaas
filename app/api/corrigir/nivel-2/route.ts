import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT_VERSION = "nivel-2-gabarito-v2";
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

type ResultadoNivel2LLM = {
  score: number;
  overall_feedback: string;
  covered_points: string[];
  missing_points: string[];
  incorrect_points: string[];
  strengths: string[];
  weaknesses: string[];
  improvement_suggestions: string[];
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

function limitarNota(value: unknown, maximumScore: number) {
  const numero = Number(value);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return arredondar(Math.min(maximumScore, Math.max(0, numero)));
}

function normalizarLista(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function listaComoTexto(items: string[]) {
  return items.length > 0
    ? items.map((item) => `• ${item}`).join("\n")
    : null;
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
    await params.admin.from("correction_runs").insert({
      answer_id: params.answerId,
      correction_id: params.correctionId ?? null,
      stage: "level_2_content",
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
    // A auditoria não deve impedir a correção principal.
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
Você é o Nível 2 de um sistema de correção de respostas discursivas de concursos públicos.

Avalie exclusivamente o conteúdo da resposta do candidato, comparando-a com:
1. o enunciado;
2. o gabarito oficial;
3. a nota máxima da questão.
Por prova pode haver mais de uma questão e gabarito. 
Avalie sobre qual questão a resposta se refere, e assim corrija baseado no gabarito referente a questão respondida.

Regras obrigatórias:
- atribua uma nota entre zero e a nota máxima;
- avalie a proximidade substancial entre a resposta e o padrão oficial;
- reconheça respostas equivalentes mesmo quando usam palavras diferentes;
- não exija repetição literal do gabarito;
- não avalie ortografia, gramática, pontuação ou estilo;
- não desconte erros linguísticos nesta etapa;
- não invente exigências ausentes do enunciado ou do gabarito;
- não premie conteúdo irrelevante;
- identifique os pontos atendidos;
- identifique os pontos ausentes;
- identifique afirmações incorretas;
- explique objetivamente a nota;
- não reproduza integralmente o gabarito.
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
            name: "nivel_2_correcao_direta_gabarito",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                score: { type: "number" },
                overall_feedback: { type: "string" },
                covered_points: {
                  type: "array",
                  items: { type: "string" },
                },
                missing_points: {
                  type: "array",
                  items: { type: "string" },
                },
                incorrect_points: {
                  type: "array",
                  items: { type: "string" },
                },
                strengths: {
                  type: "array",
                  items: { type: "string" },
                },
                weaknesses: {
                  type: "array",
                  items: { type: "string" },
                },
                improvement_suggestions: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "score",
                "overall_feedback",
                "covered_points",
                "missing_points",
                "incorrect_points",
                "strengths",
                "weaknesses",
                "improvement_suggestions",
              ],
            },
          },
        },
      }),
    },
  );

  const body = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message || "A OpenAI recusou a solicitação de correção.",
    );
  }

  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("A OpenAI não retornou o resultado da correção.");
  }

  let resultado: ResultadoNivel2LLM;

  try {
    resultado = JSON.parse(content) as ResultadoNivel2LLM;
  } catch {
    throw new Error("O resultado da correção não pôde ser interpretado.");
  }

  return {
    resultado,
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
  };
}

export async function POST(request: NextRequest) {
  const inicio = Date.now();

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
      return responderErro("Identificador da resposta inválido.", 400);
    }

    const admin = createAdminClient();

    const { data: respostaData, error: respostaError } = await admin
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
      return responderErro("Resposta não encontrada.", 404);
    }

    const resposta = respostaData as RespostaBanco;
    const respostaAluno = texto(resposta.answer_text);

    if (!respostaAluno) {
      return responderErro("A resposta está vazia.", 422);
    }

    const { data: validacao, error: validacaoError } = await admin
      .from("question_validations")
      .select(`
        status,
        semantic_valid,
        feedback,
        confidence
      `)
      .eq("question_id", resposta.question_id)
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
      return responderErro("A questão não está aprovada no Nível 1.", 409);
    }

    const { data: correcaoExistente, error: correcaoExistenteError } =
      await admin
        .from("corrections")
        .select(`
          id,
          content_score,
          content_maximum_score,
          content_feedback,
          strengths,
          weaknesses,
          improvement_suggestions
        `)
        .eq("answer_id", answerId)
        .maybeSingle();

    if (correcaoExistenteError) {
      return responderErro(
        `Erro ao consultar a correção: ${correcaoExistenteError.message}`,
        500,
      );
    }

    if (
      correcaoExistente &&
      correcaoExistente.content_feedback &&
      correcaoExistente.content_score !== null
    ) {
      return NextResponse.json({
        success: true,
        cached: true,
        correction_id: correcaoExistente.id,
        content_score: Number(correcaoExistente.content_score ?? 0),
        content_maximum_score: Number(
          correcaoExistente.content_maximum_score ?? 0,
        ),
        content_feedback: correcaoExistente.content_feedback,
        strengths: correcaoExistente.strengths,
        weaknesses: correcaoExistente.weaknesses,
        improvement_suggestions:
          correcaoExistente.improvement_suggestions,
      });
    }

    const { data: questaoData, error: questaoError } = await admin
      .from("questions")
      .select(`
        id,
        statement,
        reference_answer,
        maximum_score
      `)
      .eq("id", resposta.question_id)
      .single();

    if (questaoError || !questaoData) {
      return responderErro("Questão não encontrada.", 404);
    }

    const questao = questaoData as QuestaoBanco;
    const enunciado = texto(questao.statement);
    const gabarito = texto(questao.reference_answer);
    const maximumScore = Number(questao.maximum_score ?? 0);

    if (!enunciado || !gabarito) {
      return responderErro(
        "A questão não possui enunciado ou gabarito disponível.",
        422,
      );
    }

    if (!Number.isFinite(maximumScore) || maximumScore <= 0) {
      return responderErro("A questão não possui nota máxima válida.", 422);
    }

    await registrarExecucao({
      admin,
      answerId,
      correctionId: null,
      status: "processing",
      inputData: {
        question_id: resposta.question_id,
        maximum_score: maximumScore,
        correction_mode: "direct_reference_answer",
      },
    });

    const { resultado, inputTokens, outputTokens } = await chamarOpenAI({
      enunciado,
      gabarito,
      respostaAluno,
      maximumScore,
    });

    const contentScore = limitarNota(resultado.score, maximumScore);
    const coveredPoints = normalizarLista(resultado.covered_points);
    const missingPoints = normalizarLista(resultado.missing_points);
    const incorrectPoints = normalizarLista(resultado.incorrect_points);
    const strengths = normalizarLista(resultado.strengths);
    const weaknesses = normalizarLista(resultado.weaknesses);
    const improvementSuggestions = normalizarLista(
      resultado.improvement_suggestions,
    );

    const feedbackParts = [
      texto(resultado.overall_feedback) || "Correção de conteúdo concluída.",
    ];

    if (coveredPoints.length > 0) {
      feedbackParts.push(
        `Pontos atendidos:\n${coveredPoints
          .map((item) => `• ${item}`)
          .join("\n")}`,
      );
    }

    if (missingPoints.length > 0) {
      feedbackParts.push(
        `Pontos ausentes:\n${missingPoints
          .map((item) => `• ${item}`)
          .join("\n")}`,
      );
    }

    if (incorrectPoints.length > 0) {
      feedbackParts.push(
        `Pontos incorretos:\n${incorrectPoints
          .map((item) => `• ${item}`)
          .join("\n")}`,
      );
    }

    const contentFeedback = feedbackParts.join("\n\n");

    const correctionPayload = {
      content_score: contentScore,
      content_maximum_score: maximumScore,
      content_feedback: contentFeedback,
      validation_status: "adequate",
      validation_feedback:
        validacao.feedback ?? "Questão aprovada no Nível 1.",
      validation_confidence: Number(validacao.confidence ?? 0),
      total_score: contentScore,
      summary_feedback:
        texto(resultado.overall_feedback) || "Correção de conteúdo concluída.",
      strengths: listaComoTexto(strengths),
      weaknesses: listaComoTexto(weaknesses),
      improvement_suggestions: listaComoTexto(improvementSuggestions),
      calculation_details: null,
    };

    if (correcaoExistente) {
      correctionId = Number(correcaoExistente.id);

      const { error: updateError } = await admin
        .from("corrections")
        .update(correctionPayload)
        .eq("id", correctionId);

      if (updateError) {
        throw new Error(
          `Não foi possível atualizar a correção: ${updateError.message}`,
        );
      }
    } else {
      const { data: novaCorrecao, error: insertCorrectionError } = await admin
        .from("corrections")
        .insert({
          answer_id: answerId,
          ...correctionPayload,
        })
        .select("id")
        .single();

      if (insertCorrectionError || !novaCorrecao) {
        throw new Error(
          `Não foi possível criar a correção: ${
            insertCorrectionError?.message ??
            "O banco não retornou o identificador."
          }`,
        );
      }

      correctionId = Number(novaCorrecao.id);
    }

    await admin
      .from("user_answers")
      .update({ status: "processing" })
      .eq("id", answerId);

    await registrarExecucao({
      admin,
      answerId,
      correctionId,
      status: "completed",
      inputData: {
        question_id: resposta.question_id,
        maximum_score: maximumScore,
        correction_mode: "direct_reference_answer",
      },
      outputData: {
        content_score: contentScore,
        content_maximum_score: maximumScore,
        covered_points: coveredPoints,
        missing_points: missingPoints,
        incorrect_points: incorrectPoints,
      },
      processingTimeMs: Date.now() - inicio,
      inputTokens,
      outputTokens,
    });

    return NextResponse.json({
      success: true,
      cached: false,
      correction_id: correctionId,
      content_score: contentScore,
      content_maximum_score: maximumScore,
      content_feedback: contentFeedback,
      covered_points: coveredPoints,
      missing_points: missingPoints,
      incorrect_points: incorrectPoints,
      strengths,
      weaknesses,
      improvement_suggestions: improvementSuggestions,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado durante a correção de conteúdo.";

    if (answerId !== null && answerId > 0) {
      try {
        const admin = createAdminClient();

        await registrarExecucao({
          admin,
          answerId,
          correctionId,
          status: "error",
          processingTimeMs: Date.now() - inicio,
          errorMessage: message,
        });
      } catch {
        // Preserva o erro principal.
      }
    }

    return responderErro(message, 500);
  }
}
