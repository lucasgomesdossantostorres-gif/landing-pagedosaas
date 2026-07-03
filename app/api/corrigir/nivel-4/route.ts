import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGE = "level_4_calculation";
const PROMPT_VERSION = "nivel-4-calculo-direto-v2";
const FIXED_PENALTY_PER_ERROR = 0.1;

type RequestBody = {
  answer_id?: number;
};

type AnswerRow = {
  id: number;
  user_id: string;
  question_id: number;
  status: string;
};

type CorrectionRow = {
  id: number;
  answer_id: number;
  content_score: number | null;
  content_maximum_score: number | null;
  language_error_count: number | null;
  language_discount: number | null;
  total_score: number | null;
  calculation_details: unknown;
};

type CalculatorResponse = {
  content_score: number;
  question_maximum_score: number;
  language_error_count: number;
  fixed_penalty_per_error: number;
  language_discount: number;
  raw_final_score: number;
  final_score: number;
  formula: string;
};

type CalculationDetails = {
  content_score?: number;
  content_maximum_score?: number;
  language_error_count?: number;
  fixed_penalty_per_error?: number;
  language_discount?: number;
  raw_final_score?: number;
  final_score?: number;
  question_maximum_score?: number;
  formula?: string;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

function numbersMatch(
  first: number | null | undefined,
  second: number | null | undefined,
) {
  if (first === null || first === undefined) {
    return false;
  }

  if (second === null || second === undefined) {
    return false;
  }

  return Math.abs(Number(first) - Number(second)) < 0.0001;
}

function normalizeCalculatorUrl() {
  const configuredUrl = process.env.PYTHON_CALCULATOR_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "A variável PYTHON_CALCULATOR_URL não está configurada.",
    );
  }

  if (configuredUrl.endsWith("/calculate")) {
    return configuredUrl;
  }

  return `${configuredUrl.replace(/\/+$/, "")}/calculate`;
}

function normalizeCalculationDetails(value: unknown): CalculationDetails {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as CalculationDetails;
}

async function registerRun(params: {
  admin: ReturnType<typeof createAdminClient>;
  answerId: number;
  correctionId: number;
  status: string;
  inputData?: unknown;
  outputData?: unknown;
  processingTimeMs?: number | null;
  errorMessage?: string | null;
}) {
  try {
    await params.admin.from("correction_runs").insert({
      answer_id: params.answerId,
      correction_id: params.correctionId,
      stage: STAGE,
      status: params.status,
      model_used: "python-fastapi",
      prompt_version: PROMPT_VERSION,
      input_data: params.inputData ?? null,
      output_data: params.outputData ?? null,
      processing_time_ms: params.processingTimeMs ?? null,
      input_tokens: null,
      output_tokens: null,
      error_message: params.errorMessage ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // A auditoria não deve impedir o cálculo principal.
  }
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
      return errorResponse("Usuário não autenticado.", 401);
    }

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return errorResponse("Corpo da requisição inválido.", 400);
    }

    answerId = Number(body.answer_id);

    if (!Number.isInteger(answerId) || answerId <= 0) {
      return errorResponse("Identificador da resposta inválido.", 400);
    }

    const admin = createAdminClient();

    const { data: answerData, error: answerError } = await admin
      .from("user_answers")
      .select(`
        id,
        user_id,
        question_id,
        status
      `)
      .eq("id", answerId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (answerError) {
      return errorResponse(
        `Erro ao buscar a resposta: ${answerError.message}`,
        500,
      );
    }

    if (!answerData) {
      return errorResponse("Resposta não encontrada.", 404);
    }

    const answer = answerData as AnswerRow;

    const { data: correctionData, error: correctionError } = await admin
      .from("corrections")
      .select(`
        id,
        answer_id,
        content_score,
        content_maximum_score,
        language_error_count,
        language_discount,
        total_score,
        calculation_details
      `)
      .eq("answer_id", answerId)
      .maybeSingle();

    if (correctionError) {
      return errorResponse(
        `Erro ao buscar a correção: ${correctionError.message}`,
        500,
      );
    }

    if (!correctionData) {
      return errorResponse(
        "O Nível 2 precisa ser concluído antes do Nível 4.",
        409,
      );
    }

    const correction = correctionData as CorrectionRow;
    correctionId = Number(correction.id);

    if (
      correction.content_score === null ||
      correction.content_maximum_score === null
    ) {
      return errorResponse(
        "O Nível 2 ainda não possui nota de conteúdo completa.",
        409,
      );
    }

    if (correction.language_error_count === null) {
      return errorResponse(
        "O Nível 3 precisa ser concluído antes do Nível 4.",
        409,
      );
    }

    const existingDetails = normalizeCalculationDetails(
      correction.calculation_details,
    );

    const existingCalculationIsCurrent =
      existingDetails.formula === "NC_MINUS_FIXED_PENALTY_TIMES_NE" &&
      numbersMatch(existingDetails.content_score, correction.content_score) &&
      numbersMatch(
        existingDetails.language_error_count,
        correction.language_error_count,
      ) &&
      numbersMatch(existingDetails.final_score, correction.total_score);

    if (existingCalculationIsCurrent) {
      return NextResponse.json({
        success: true,
        cached: true,
        correction_id: correctionId,
        ...existingDetails,
      });
    }

    const calculatorInput = {
      content_score: Number(correction.content_score),
      question_maximum_score: Number(
        correction.content_maximum_score,
      ),
      language_error_count: Number(correction.language_error_count),
      score_precision: 2,
    };

    await registerRun({
      admin,
      answerId,
      correctionId,
      status: "processing",
      inputData: calculatorInput,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let calculatorResponse: Response;

    try {
      calculatorResponse = await fetch(normalizeCalculatorUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calculatorInput),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }

    const calculatorBody = await calculatorResponse.json();

    if (!calculatorResponse.ok) {
      const calculatorMessage =
        typeof calculatorBody?.detail === "string"
          ? calculatorBody.detail
          : "O serviço Python recusou o cálculo.";

      throw new Error(calculatorMessage);
    }

    const result = calculatorBody as CalculatorResponse;

    const expectedDiscount =
      Number(correction.language_error_count) * FIXED_PENALTY_PER_ERROR;

    if (!numbersMatch(result.language_discount, expectedDiscount)) {
      throw new Error(
        "O serviço Python retornou um desconto incompatível com a regra fixa de 0,10 por erro.",
      );
    }

    const calculationDetails = {
      content_score: Number(result.content_score),
      content_maximum_score: Number(result.question_maximum_score),
      language_error_count: Number(result.language_error_count),
      effective_line_count: null,
      fixed_penalty_per_error: Number(result.fixed_penalty_per_error),
      language_error_factor: null,
      language_discount: Number(result.language_discount),
      raw_final_score: Number(result.raw_final_score),
      final_score: Number(result.final_score),
      question_maximum_score: Number(result.question_maximum_score),
      formula: result.formula,
    };

    const { error: updateCorrectionError } = await admin
      .from("corrections")
      .update({
        content_score: result.content_score,
        content_maximum_score: result.question_maximum_score,
        language_error_count: result.language_error_count,
        effective_line_count: null,
        language_discount: result.language_discount,
        total_score: result.final_score,
        calculation_details: calculationDetails,
      })
      .eq("id", correctionId);

    if (updateCorrectionError) {
      throw new Error(
        `Não foi possível salvar o cálculo: ${updateCorrectionError.message}`,
      );
    }

    const { error: updateAnswerError } = await admin
      .from("user_answers")
      .update({ status: "corrected" })
      .eq("id", answer.id);

    if (updateAnswerError) {
      throw new Error(
        `A nota foi calculada, mas o status da resposta não pôde ser atualizado: ${updateAnswerError.message}`,
      );
    }

    await registerRun({
      admin,
      answerId,
      correctionId,
      status: "completed",
      inputData: calculatorInput,
      outputData: calculationDetails,
      processingTimeMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      cached: false,
      correction_id: correctionId,
      ...calculationDetails,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "O serviço Python demorou mais de 15 segundos para responder."
          : error.message
        : "Erro inesperado durante o cálculo da nota.";

    if (
      answerId !== null &&
      answerId > 0 &&
      correctionId !== null &&
      correctionId > 0
    ) {
      try {
        const admin = createAdminClient();

        await registerRun({
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

    return errorResponse(message, 500);
  }
}
