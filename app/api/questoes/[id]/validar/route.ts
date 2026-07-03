import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT_VERSION = "nivel-1-gabarito-v2";
const MODEL_NAME = process.env.OPENAI_VALIDATION_MODEL || "gpt-5-mini";

type RouteContext = {
  params:
    | Promise<{ id: string }>
    | { id: string };
};

type QuestaoBanco = {
  id: number;
  statement: string | null;
  reference_answer: string | null;
};

type ResultadoValidacaoLLM = {
  compatible: boolean;
  confidence: number;
  summary: string;
  inconsistencies: string[];
};

type OpenAIChatResponse = {
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

function respostaErro(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      status: "error",
      approved: false,
      error: message,
    },
    { status },
  );
}

function normalizarTexto(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function limitarEntreZeroEUm(value: unknown) {
  const numero = Number(value);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.min(1, Math.max(0, numero));
}

function criarContentHash(params: {
  questionId: number;
  enunciado: string;
  gabarito: string;
}) {
  const conteudo = JSON.stringify({
    question_id: params.questionId,
    enunciado: params.enunciado,
    gabarito: params.gabarito,
    prompt_version: PROMPT_VERSION,
  });

  return createHash("sha256")
    .update(conteudo, "utf8")
    .digest("hex");
}

async function chamarOpenAI(params: {
  enunciado: string;
  gabarito: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("A variável OPENAI_API_KEY não está configurada.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
Você é o Nível 1 de um sistema de correção de questões discursivas de concursos públicos.

Sua única tarefa é verificar se o gabarito oficial é semanticamente compatível com o enunciado apresentado, mas podem ter mais de uma questão e gabarito por prova.

Considere compatível quando:
- o gabarito responde ao comando central do enunciado;
- o gabarito trata do mesmo assunto da questão;
- os pontos centrais solicitados aparecem no gabarito;
- não existe contradição material relevante;
- o gabarito parece pertencer àquela questão.

Considere incompatível quando:
- o gabarito parece pertencer a outra questão;
- o gabarito trata de assunto diferente;
- o gabarito não responde ao comando central;
- existe contradição material relevante.

Regras:
- seja moderado, apenas invalide quando for realmente necessário;
- não exija repetição literal;
- não reprove por diferenças de estilo, organização ou redação;
- não reproduza integralmente o gabarito no resumo.
          `.trim(),
        },
        {
          role: "user",
          content: `
ENUNCIADO:

${params.enunciado}

GABARITO OFICIAL:

${params.gabarito}
          `.trim(),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "validacao_semantica_questao_gabarito",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              compatible: { type: "boolean" },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              summary: { type: "string" },
              inconsistencies: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "compatible",
              "confidence",
              "summary",
              "inconsistencies",
            ],
          },
        },
      },
    }),
  });

  const body = (await response.json()) as OpenAIChatResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message || "A OpenAI recusou a solicitação de validação.",
    );
  }

  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("A OpenAI não retornou o resultado da validação.");
  }

  let resultado: ResultadoValidacaoLLM;

  try {
    resultado = JSON.parse(content) as ResultadoValidacaoLLM;
  } catch {
    throw new Error(
      "O resultado retornado pela OpenAI não pôde ser interpretado.",
    );
  }

  return {
    resultado,
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
  };
}

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  const inicio = Date.now();

  let questionId: number | null = null;
  let contentHash: string | null = null;

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return respostaErro("Usuário não autenticado.", 401);
    }

    const params = await context.params;
    questionId = Number(params.id);

    if (!Number.isInteger(questionId) || questionId <= 0) {
      return respostaErro("Identificador da questão inválido.", 400);
    }

    const admin = createAdminClient();

    const { data: questaoData, error: questaoError } = await admin
      .from("questions")
      .select(`
        id,
        statement,
        reference_answer
      `)
      .eq("id", questionId)
      .single();

    if (questaoError || !questaoData) {
      return respostaErro("Questão não encontrada.", 404);
    }

    const questao = questaoData as QuestaoBanco;
    const enunciado = normalizarTexto(questao.statement);
    const gabarito = normalizarTexto(questao.reference_answer);

    if (!enunciado || !gabarito) {
      return respostaErro(
        "Não foi possível executar a validação porque o enunciado ou o gabarito está vazio.",
        422,
      );
    }

    contentHash = criarContentHash({
      questionId,
      enunciado,
      gabarito,
    });

    const {
      data: validacaoExistente,
      error: validacaoExistenteError,
    } = await admin
      .from("question_validations")
      .select(`
        status,
        semantic_valid,
        feedback,
        inconsistencies,
        confidence,
        content_hash,
        validated_at
      `)
      .eq("question_id", questionId)
      .maybeSingle();

    if (validacaoExistenteError) {
      return respostaErro(
        `Erro ao consultar a validação existente: ${validacaoExistenteError.message}`,
        500,
      );
    }

    const podeReutilizar =
      validacaoExistente &&
      validacaoExistente.content_hash === contentHash &&
      (validacaoExistente.status === "approved" ||
        validacaoExistente.status === "rejected");

    if (podeReutilizar) {
      const approved =
        validacaoExistente.status === "approved" &&
        validacaoExistente.semantic_valid === true;

      return NextResponse.json({
        success: true,
        status: validacaoExistente.status,
        approved,
        cached: true,
        confidence: Number(validacaoExistente.confidence ?? 0),
        feedback:
          validacaoExistente.feedback ?? "Validação semântica concluída.",
        inconsistencies: Array.isArray(validacaoExistente.inconsistencies)
          ? validacaoExistente.inconsistencies
          : [],
        validated_at: validacaoExistente.validated_at,
      });
    }

    const agora = new Date().toISOString();

    const { error: processingError } = await admin
      .from("question_validations")
      .upsert(
        {
          question_id: questionId,
          status: "processing",
          semantic_valid: null,
          feedback: "Validação semântica em processamento.",
          inconsistencies: [],
          confidence: null,
          content_hash: contentHash,
          model_used: MODEL_NAME,
          prompt_version: PROMPT_VERSION,
          processing_time_ms: null,
          input_tokens: null,
          output_tokens: null,
          error_message: null,
          validated_at: null,
          updated_at: agora,
        },
        { onConflict: "question_id" },
      );

    if (processingError) {
      return respostaErro(
        `Não foi possível iniciar a validação: ${processingError.message}`,
        500,
      );
    }

    const { resultado, inputTokens, outputTokens } = await chamarOpenAI({
      enunciado,
      gabarito,
    });

    const inconsistencias = Array.isArray(resultado.inconsistencies)
      ? resultado.inconsistencies
          .map((item) => String(item).trim())
          .filter(Boolean)
      : [];

    const confidence = limitarEntreZeroEUm(resultado.confidence);
    const approved = resultado.compatible === true;
    const status = approved ? "approved" : "rejected";

    const feedback =
      normalizarTexto(resultado.summary) ||
      (approved
        ? "O enunciado e o gabarito foram considerados compatíveis."
        : "Foram identificadas incompatibilidades entre o enunciado e o gabarito.");

    const finalizadoEm = new Date().toISOString();

    const { error: saveError } = await admin
      .from("question_validations")
      .upsert(
        {
          question_id: questionId,
          status,
          semantic_valid: approved,
          feedback,
          inconsistencies: inconsistencias,
          confidence,
          content_hash: contentHash,
          model_used: MODEL_NAME,
          prompt_version: PROMPT_VERSION,
          processing_time_ms: Date.now() - inicio,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          error_message: null,
          validated_at: finalizadoEm,
          updated_at: finalizadoEm,
        },
        { onConflict: "question_id" },
      );

    if (saveError) {
      throw new Error(
        `A validação foi executada, mas não pôde ser salva: ${saveError.message}`,
      );
    }

    return NextResponse.json({
      success: true,
      status,
      approved,
      cached: false,
      confidence,
      feedback,
      inconsistencies: inconsistencias,
      validated_at: finalizadoEm,
    });
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Erro inesperado durante a validação.";

    if (
      questionId !== null &&
      Number.isInteger(questionId) &&
      questionId > 0
    ) {
      try {
        const admin = createAdminClient();

        await admin
          .from("question_validations")
          .upsert(
            {
              question_id: questionId,
              status: "error",
              semantic_valid: null,
              feedback: "Não foi possível validar a questão neste momento.",
              inconsistencies: [],
              confidence: null,
              content_hash: contentHash ?? `erro-${questionId}`,
              model_used: MODEL_NAME,
              prompt_version: PROMPT_VERSION,
              processing_time_ms: Date.now() - inicio,
              input_tokens: null,
              output_tokens: null,
              error_message: mensagem,
              validated_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "question_id" },
          );
      } catch {
        // Preserva o erro original.
      }
    }

    return respostaErro(mensagem, 500);
  }
}
