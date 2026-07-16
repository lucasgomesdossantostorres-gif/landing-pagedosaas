import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
const PROMPT_VERSION = "four-levels-v3";

function criarClienteOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não está configurada.");
  }

  return new OpenAI({
    apiKey,
  });
}

type RequestBody = {
  answerId?: number;
};

type QuestionRecord = {
  id: number;
  title: string;
  statement: string;
  reference_answer: string | null;
  maximum_score: number;
  language_evaluation_enabled: boolean | null;
  language_formula: string | null;
  language_error_factor: number | null;
  maximum_lines: number | null;
  language_criteria: unknown;
  score_precision: number | null;
};

type AnswerRecord = {
  id: number;
  user_id: string;
  question_id: number;
  answer_text: string;
  status: string;
  questions: QuestionRecord | QuestionRecord[] | null;
};

type EvaluationCriterion = {
  id: number;
  title: string;
  description: string | null;
  maximum_score: number;
  display_order: number;
};

type ErrorTypeRecord = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
};

type LanguageCriterion = {
  code: string;
  name: string;
  description: string;
};

type Level1Result = {
  status:
    | "adequate"
    | "adequate_with_observations"
    | "insufficient_question"
    | "insufficient_reference"
    | "insufficient_answer";
  confidence: number;
  question_assessment: string;
  reference_assessment: string;
  answer_assessment: string;
  guidance_for_content_evaluation: string[];
};

type Level2Criterion = {
  criterion_id: number;
  score: number;
  feedback: string;
  evidence: string;
  improvement: string;
};

type Level2Error = {
  code: string;
  severity: "low" | "medium" | "high";
  explanation: string;
  excerpt: string | null;
};

type Level2Result = {
  general_feedback: string;
  strengths: string;
  weaknesses: string;
  improvement_suggestions: string;
  improved_answer: string;
  criteria: Level2Criterion[];
  identified_errors: Level2Error[];
};

type LanguageOccurrence = {
  excerpt: string;
  explanation: string;
  suggested_correction: string;
};

type Level3Criterion = {
  code: string;
  name: string;
  feedback: string;
  occurrences: LanguageOccurrence[];
};

type Level3Result = {
  total_errors: number;
  general_feedback: string;
  criteria: Level3Criterion[];
};

type CalculationResult = {
  content_score: number;
  content_maximum_score: number;
  language_error_count: number;
  effective_line_count: number;
  language_error_factor: number;
  language_discount: number;
  raw_final_score: number;
  final_score: number;
  question_maximum_score: number;
  formula: string;
  normalized_criteria: Array<{
    criterion_id: number;
    original_score: number;
    normalized_score: number;
    maximum_score: number;
  }>;
};

type Stage =
  | "level_1_validation"
  | "level_2_content"
  | "level_3_language"
  | "level_4_calculation";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function numberBetween(
  value: unknown,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return minimum;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

function parseJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first < 0 || last < 0 || last <= first) {
      throw new Error("A IA não retornou JSON válido.");
    }

    return JSON.parse(cleaned.slice(first, last + 1));
  }
}

function getQuestion(
  value: QuestionRecord | QuestionRecord[] | null
): QuestionRecord | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeLanguageCriteria(value: unknown): LanguageCriterion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: LanguageCriterion[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const code = text(record.code);
    const name = text(record.name);

    if (!code || !name) {
      continue;
    }

    result.push({
      code,
      name,
      description: text(record.description),
    });
  }

  return result;
}

function estimateEffectiveLines(
  answerText: string,
  maximumLines: number | null
): number {
  const paragraphs = answerText
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const estimated = paragraphs.reduce((sum, paragraph) => {
    return sum + Math.max(1, Math.ceil(paragraph.length / 70));
  }, 0);

  const positive = Math.max(estimated, 1);

  if (maximumLines && maximumLines > 0) {
    return Math.min(positive, maximumLines);
  }

  return positive;
}

function normalizeLevel1(value: unknown): Level1Result {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  const allowed: Level1Result["status"][] = [
    "adequate",
    "adequate_with_observations",
    "insufficient_question",
    "insufficient_reference",
    "insufficient_answer",
  ];

  const received = text(record.status);
  const status = allowed.includes(received as Level1Result["status"])
    ? (received as Level1Result["status"])
    : "adequate_with_observations";

  const guidance = Array.isArray(
    record.guidance_for_content_evaluation
  )
    ? record.guidance_for_content_evaluation
        .map((item) => text(item))
        .filter(Boolean)
    : [];

  return {
    status,
    confidence: numberBetween(record.confidence, 0, 1),
    question_assessment: text(
      record.question_assessment,
      "A questão foi analisada."
    ),
    reference_assessment: text(
      record.reference_assessment,
      "O padrão de resposta foi analisado."
    ),
    answer_assessment: text(
      record.answer_assessment,
      "A resposta foi analisada."
    ),
    guidance_for_content_evaluation: guidance,
  };
}

function normalizeLevel2(
  value: unknown,
  criteria: EvaluationCriterion[]
): Level2Result {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  const receivedCriteria = Array.isArray(record.criteria)
    ? record.criteria
    : [];

  const normalizedCriteria = criteria.map((criterion) => {
    const found = receivedCriteria.find((item) => {
      if (typeof item !== "object" || item === null) return false;
      return (
        Number((item as Record<string, unknown>).criterion_id) ===
        criterion.id
      );
    });

    const item =
      typeof found === "object" && found !== null
        ? (found as Record<string, unknown>)
        : {};

    return {
      criterion_id: criterion.id,
      score: numberBetween(
        item.score,
        0,
        Number(criterion.maximum_score)
      ),
      feedback: text(
        item.feedback,
        "Critério avaliado com base na resposta apresentada."
      ),
      evidence: text(
        item.evidence,
        "A avaliação considera o conteúdo efetivamente apresentado."
      ),
      improvement: text(
        item.improvement,
        "Desenvolva este ponto com maior precisão."
      ),
    };
  });

  const errors: Level2Error[] = [];
  const receivedErrors = Array.isArray(record.identified_errors)
    ? record.identified_errors
    : [];

  for (const item of receivedErrors) {
    if (typeof item !== "object" || item === null) continue;

    const error = item as Record<string, unknown>;
    const code = text(error.code).toUpperCase();

    if (!code) continue;

    const rawSeverity = text(error.severity);
    const severity: Level2Error["severity"] =
      rawSeverity === "low" ||
      rawSeverity === "medium" ||
      rawSeverity === "high"
        ? rawSeverity
        : "medium";

    errors.push({
      code,
      severity,
      explanation: text(
        error.explanation,
        "Problema de conteúdo identificado."
      ),
      excerpt: text(error.excerpt) || null,
    });
  }

  return {
    general_feedback: text(
      record.general_feedback,
      "A resposta foi avaliada conforme os critérios de conteúdo."
    ),
    strengths: text(
      record.strengths,
      "Os acertos estão descritos nos critérios."
    ),
    weaknesses: text(
      record.weaknesses,
      "Os pontos de melhoria estão descritos nos critérios."
    ),
    improvement_suggestions: text(
      record.improvement_suggestions,
      "Aprimore a precisão conceitual e o desenvolvimento da resposta."
    ),
    improved_answer: text(record.improved_answer),
    criteria: normalizedCriteria,
    identified_errors: errors,
  };
}

function normalizeLevel3(
  value: unknown,
  configuredCriteria: LanguageCriterion[]
): Level3Result {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  const receivedCriteria = Array.isArray(record.criteria)
    ? record.criteria
    : [];

  const criteria: Level3Criterion[] = configuredCriteria.map(
    (configured) => {
      const found = receivedCriteria.find((item) => {
        if (typeof item !== "object" || item === null) return false;

        return (
          text((item as Record<string, unknown>).code).toUpperCase() ===
          configured.code.toUpperCase()
        );
      });

      const item =
        typeof found === "object" && found !== null
          ? (found as Record<string, unknown>)
          : {};

      const rawOccurrences = Array.isArray(item.occurrences)
        ? item.occurrences
        : [];

      const occurrences: LanguageOccurrence[] = [];
      const seen = new Set<string>();

      for (const rawOccurrence of rawOccurrences) {
        if (
          typeof rawOccurrence !== "object" ||
          rawOccurrence === null
        ) {
          continue;
        }

        const occurrence = rawOccurrence as Record<string, unknown>;
        const excerpt = text(occurrence.excerpt);
        const explanation = text(occurrence.explanation);
        const suggestedCorrection = text(
          occurrence.suggested_correction
        );

        if (!excerpt || !explanation) continue;

        const key = `${configured.code}|${excerpt}|${explanation}`;

        if (seen.has(key)) continue;
        seen.add(key);

        occurrences.push({
          excerpt,
          explanation,
          suggested_correction: suggestedCorrection,
        });
      }

      return {
        code: configured.code,
        name: configured.name,
        feedback: text(
          item.feedback,
          occurrences.length
            ? `${occurrences.length} ocorrência(s) identificada(s).`
            : "Nenhuma ocorrência identificada."
        ),
        occurrences,
      };
    }
  );

  const totalErrors = criteria.reduce(
    (sum, criterion) => sum + criterion.occurrences.length,
    0
  );

  return {
    total_errors: totalErrors,
    general_feedback: text(
      record.general_feedback,
      totalErrors
        ? `Foram identificadas ${totalErrors} ocorrência(s) linguística(s).`
        : "A resposta apresentou adequação linguística."
    ),
    criteria,
  };
}

async function runLlmStage(params: {
  stage: Exclude<Stage, "level_4_calculation">;
  answerId: number;
  systemPrompt: string;
  userPrompt: string;
  inputData: Record<string, unknown>;
}): Promise<{ runId: number; output: unknown }> {
  const admin = createAdminClient();

  const { data: run, error: insertError } = await admin
    .from("correction_runs")
    .insert({
      answer_id: params.answerId,
      stage: params.stage,
      status: "processing",
      model_used: MODEL,
      prompt_version: PROMPT_VERSION,
      input_data: params.inputData,
    })
    .select("id")
    .single();

  if (insertError || !run) {
    throw new Error(
      `Não foi possível iniciar ${params.stage}: ${
        insertError?.message ?? "erro desconhecido"
      }`
    );
  }

  const startedAt = Date.now();

  try {
    const openai = criarClienteOpenAI();

    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: params.systemPrompt,
        },
        {
          role: "user",
          content: params.userPrompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error(`${params.stage} retornou resposta vazia.`);
    }

    const output = parseJson(content);
    const usage = response.usage as
      | {
          prompt_tokens?: number;
          completion_tokens?: number;
        }
      | undefined;

    const { error: updateError } = await admin
      .from("correction_runs")
      .update({
        status: "completed",
        output_data: output,
        processing_time_ms: Date.now() - startedAt,
        input_tokens: usage?.prompt_tokens ?? null,
        output_tokens: usage?.completion_tokens ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    if (updateError) {
      throw new Error(
        `Falha ao registrar ${params.stage}: ${updateError.message}`
      );
    }

    return {
      runId: Number(run.id),
      output,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    await admin
      .from("correction_runs")
      .update({
        status: "failed",
        error_message: message,
        processing_time_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    throw error;
  }
}

async function runCalculationStage(params: {
  answerId: number;
  question: QuestionRecord;
  criteria: Array<{
    criterion_id: number;
    score: number;
    maximum_score: number;
  }>;
  languageErrorCount: number;
  effectiveLineCount: number;
}): Promise<{ runId: number; output: CalculationResult }> {
  const admin = createAdminClient();
  const calculatorUrl =
    process.env.PYTHON_CALCULATOR_URL?.trim();

  if (!calculatorUrl) {
    throw new Error(
      "A variável PYTHON_CALCULATOR_URL não foi configurada."
    );
  }

  const payload = {
    question_maximum_score: Number(
      params.question.maximum_score
    ),
    formula:
      params.question.language_evaluation_enabled === false
        ? "CONTENT_ONLY"
        : params.question.language_formula ??
          "NC_MINUS_FACTOR_TIMES_NE_DIVIDED_BY_TL",
    language_evaluation_enabled:
      params.question.language_evaluation_enabled !== false,
    language_error_factor: Number(
      params.question.language_error_factor ?? 0
    ),
    language_error_count: params.languageErrorCount,
    effective_line_count: params.effectiveLineCount,
    score_precision: Number(
      params.question.score_precision ?? 2
    ),
    criteria: params.criteria,
  };

  const { data: run, error: insertError } = await admin
    .from("correction_runs")
    .insert({
      answer_id: params.answerId,
      stage: "level_4_calculation",
      status: "processing",
      model_used: "python-fastapi",
      prompt_version: "calculator-v2",
      input_data: payload,
    })
    .select("id")
    .single();

  if (insertError || !run) {
    throw new Error(
      `Não foi possível iniciar o cálculo: ${
        insertError?.message ?? "erro desconhecido"
      }`
    );
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(calculatorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const raw = await response.text();

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `O serviço Python retornou conteúdo inválido: ${raw}`
      );
    }

    if (!response.ok) {
      const errorRecord =
        typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};

      throw new Error(
        text(
          errorRecord.detail,
          "O serviço Python recusou o cálculo."
        )
      );
    }

    const output = parsed as CalculationResult;

    const { error: updateError } = await admin
      .from("correction_runs")
      .update({
        status: "completed",
        output_data: output,
        processing_time_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    if (updateError) {
      throw new Error(
        `Falha ao registrar o cálculo: ${updateError.message}`
      );
    }

    return {
      runId: Number(run.id),
      output,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    await admin
      .from("correction_runs")
      .update({
        status: "failed",
        error_message: message,
        processing_time_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    throw error;
  }
}
export async function POST(request: Request) {
  const admin = createAdminClient();

  let answerId: number | null = null;
  let userId: string | null = null;
  let correctionId: number | null = null;

  const runIds: number[] = [];

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "A chave da OpenAI não foi configurada." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;
    answerId = Number(body.answerId);

    if (!Number.isInteger(answerId) || answerId <= 0) {
      return NextResponse.json(
        { error: "Identificador da resposta inválido." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    userId = user.id;

    const { data: answerData, error: answerError } =
      await supabase
        .from("user_answers")
        .select(`
          id,
          user_id,
          question_id,
          answer_text,
          status,
          questions (
            id,
            title,
            statement,
            reference_answer,
            maximum_score,
            language_evaluation_enabled,
            language_formula,
            language_error_factor,
            maximum_lines,
            language_criteria,
            score_precision
          )
        `)
        .eq("id", answerId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (answerError) {
      throw new Error(
        `Erro ao buscar resposta: ${answerError.message}`
      );
    }

    if (!answerData) {
      return NextResponse.json(
        { error: "Resposta não encontrada." },
        { status: 404 }
      );
    }

    const answer = answerData as unknown as AnswerRecord;
    const question = getQuestion(answer.questions);

    if (!question) {
      return NextResponse.json(
        { error: "Questão vinculada não encontrada." },
        { status: 404 }
      );
    }

    const {
      data: existingCorrection,
      error: existingCorrectionError,
    } = await admin
      .from("corrections")
      .select("id")
      .eq("answer_id", answerId)
      .maybeSingle();

    if (existingCorrectionError) {
      throw new Error(
        `Erro ao verificar correção existente: ${existingCorrectionError.message}`
      );
    }

    if (existingCorrection) {
      await admin
        .from("user_answers")
        .update({ status: "corrected" })
        .eq("id", answerId);

      return NextResponse.json({
        success: true,
        alreadyCorrected: true,
        correctionId: existingCorrection.id,
      });
    }

    if (answer.status === "processing") {
      return NextResponse.json(
        {
          error:
            "Esta resposta já está sendo corrigida. Aguarde a conclusão.",
        },
        { status: 409 }
      );
    }

    if (!["submitted", "failed"].includes(answer.status)) {
      return NextResponse.json(
        {
          error: `A resposta não pode ser corrigida no status atual: ${answer.status}.`,
        },
        { status: 409 }
      );
    }

    const { data: criteriaData, error: criteriaError } =
      await supabase
        .from("evaluation_criteria")
        .select(`
          id,
          title,
          description,
          maximum_score,
          display_order
        `)
        .eq("question_id", question.id)
        .order("display_order", { ascending: true });

    if (criteriaError) {
      throw new Error(
        `Erro ao buscar critérios: ${criteriaError.message}`
      );
    }

    const criteria =
      (criteriaData ?? []) as EvaluationCriterion[];

    if (!criteria.length) {
      return NextResponse.json(
        {
          error:
            "A questão não possui critérios de conteúdo configurados.",
        },
        { status: 400 }
      );
    }

    const { data: errorTypesData, error: errorTypesError } =
      await admin
        .from("error_types")
        .select(`
          id,
          code,
          name,
          description,
          category
        `)
        .order("id", { ascending: true });

    if (errorTypesError) {
      throw new Error(
        `Erro ao buscar tipos de erro: ${errorTypesError.message}`
      );
    }

    const errorTypes =
      (errorTypesData ?? []) as ErrorTypeRecord[];

    let languageCriteria = normalizeLanguageCriteria(
      question.language_criteria
    );

    if (
      question.language_evaluation_enabled !== false &&
      !languageCriteria.length
    ) {
      languageCriteria = [
        {
          code: "SPELLING",
          name: "Grafia",
          description:
            "Grafia, ortografia, acentuação e emprego de maiúsculas e minúsculas.",
        },
        {
          code: "MORPHOSYNTAX",
          name: "Morfossintaxe",
          description:
            "Concordância, regência, construção sintática e relações gramaticais.",
        },
        {
          code: "VOCABULARY",
          name: "Propriedade vocabular",
          description:
            "Precisão, adequação e propriedade no uso de palavras e expressões.",
        },
      ];
    }

    const { error: processingError } = await admin
      .from("user_answers")
      .update({ status: "processing" })
      .eq("id", answerId)
      .eq("user_id", user.id);

    if (processingError) {
      throw new Error(
        `Erro ao iniciar correção: ${processingError.message}`
      );
    }

    const criteriaPrompt = criteria
      .map(
        (criterion) => `
ID: ${criterion.id}
Título: ${criterion.title}
Descrição: ${criterion.description ?? "Não informada"}
Pontuação máxima: ${criterion.maximum_score}
        `.trim()
      )
      .join("\n\n");

    const level1Execution = await runLlmStage({
      stage: "level_1_validation",
      answerId,
      systemPrompt: `
Você realiza o primeiro nível de avaliação de uma resposta discursiva de concurso público.

Analise conjuntamente o comando, o padrão de resposta, os critérios e a resposta do candidato.

Classifique o material em:
- adequate;
- adequate_with_observations;
- insufficient_question;
- insufficient_reference;
- insufficient_answer.

Considere avaliável toda resposta que contenha material suficiente para julgamento, inclusive quando curta, incompleta ou incorreta.

Produza orientações úteis para o avaliador de conteúdo.

Responda somente com JSON válido no formato:

{
  "status": "adequate",
  "confidence": 0.95,
  "question_assessment": "",
  "reference_assessment": "",
  "answer_assessment": "",
  "guidance_for_content_evaluation": [""]
}
      `.trim(),
      userPrompt: `
QUESTÃO

Título:
${question.title}

Comando:
${question.statement}

PADRÃO DE RESPOSTA

${question.reference_answer ?? "Não informado"}

CRITÉRIOS

${criteriaPrompt}

RESPOSTA DO CANDIDATO

${answer.answer_text}
      `.trim(),
      inputData: {
        question_id: question.id,
        answer_length: answer.answer_text.length,
      },
    });

    runIds.push(level1Execution.runId);
    const level1 = normalizeLevel1(level1Execution.output);

    if (
      level1.status === "insufficient_question" ||
      level1.status === "insufficient_reference"
    ) {
      throw new Error(
        [
          "O Nível 1 identificou problema no material da questão.",
          level1.question_assessment,
          level1.reference_assessment,
        ].join(" ")
      );
    }

    const errorTypesPrompt = errorTypes
      .map(
        (errorType) => `
Código: ${errorType.code}
Nome: ${errorType.name}
Categoria: ${errorType.category}
Descrição: ${errorType.description ?? "Não informada"}
        `.trim()
      )
      .join("\n\n");

    const level2Execution = await runLlmStage({
      stage: "level_2_content",
      answerId,
      systemPrompt: `
Você realiza a correção de conteúdo de respostas discursivas de concursos públicos.

Interprete semanticamente o comando, o padrão de resposta, os critérios e a resposta do candidato.

Para cada critério:
- reconheça o conteúdo efetivamente apresentado;
- atribua nota entre zero e a pontuação máxima;
- justifique a nota;
- apresente uma evidência da resposta;
- apresente orientação de melhoria.

Diferencie conteúdo correto, parcial, ausente, impreciso e conceitualmente incorreto.

Reconheça formulações corretas expressas com palavras diferentes do padrão.

Produza feedback geral, pontos fortes, pontos de melhoria, sugestões e uma resposta aprimorada.

Responda somente com JSON válido no formato:

{
  "general_feedback": "",
  "strengths": "",
  "weaknesses": "",
  "improvement_suggestions": "",
  "improved_answer": "",
  "criteria": [
    {
      "criterion_id": 0,
      "score": 0,
      "feedback": "",
      "evidence": "",
      "improvement": ""
    }
  ],
  "identified_errors": [
    {
      "code": "CONTENT_OMISSION",
      "severity": "medium",
      "explanation": "",
      "excerpt": ""
    }
  ]
}
      `.trim(),
      userPrompt: `
ANÁLISE DO NÍVEL 1

Status:
${level1.status}

Confiança:
${level1.confidence}

Questão:
${level1.question_assessment}

Padrão:
${level1.reference_assessment}

Resposta:
${level1.answer_assessment}

Orientações:
${level1.guidance_for_content_evaluation.join("\n")}

QUESTÃO

${question.statement}

PADRÃO DE RESPOSTA

${question.reference_answer ?? "Não informado"}

CRITÉRIOS

${criteriaPrompt}

TIPOS DE ERRO DISPONÍVEIS

${errorTypesPrompt || "Nenhum tipo configurado"}

RESPOSTA DO CANDIDATO

${answer.answer_text}
      `.trim(),
      inputData: {
        question_id: question.id,
        validation_status: level1.status,
      },
    });

    runIds.push(level2Execution.runId);

    const level2 = normalizeLevel2(
      level2Execution.output,
      criteria
    );

    let level3: Level3Result = {
      total_errors: 0,
      general_feedback:
        "A avaliação linguística não está habilitada para esta questão.",
      criteria: [],
    };

    if (
      question.language_evaluation_enabled !== false &&
      languageCriteria.length
    ) {
      const languageCriteriaPrompt = languageCriteria
        .map(
          (criterion) => `
Código: ${criterion.code}
Nome: ${criterion.name}
Descrição: ${criterion.description}
          `.trim()
        )
        .join("\n\n");

      const level3Execution = await runLlmStage({
        stage: "level_3_language",
        answerId,
        systemPrompt: `
Você realiza a avaliação linguística de uma resposta discursiva segundo os critérios definidos pela banca.

Examine a resposta conforme os critérios fornecidos.

Para cada ocorrência:
- associe-a a um critério;
- transcreva o trecho;
- explique tecnicamente a ocorrência;
- apresente a correção adequada.

Conte cada ocorrência linguística autônoma uma única vez e agrupe as ocorrências pelo critério correspondente.

Responda somente com JSON válido no formato:

{
  "total_errors": 0,
  "general_feedback": "",
  "criteria": [
    {
      "code": "SPELLING",
      "name": "Grafia",
      "feedback": "",
      "occurrences": [
        {
          "excerpt": "",
          "explanation": "",
          "suggested_correction": ""
        }
      ]
    }
  ]
}
        `.trim(),
        userPrompt: `
CRITÉRIOS LINGUÍSTICOS

${languageCriteriaPrompt}

RESPOSTA DO CANDIDATO

${answer.answer_text}
        `.trim(),
        inputData: {
          question_id: question.id,
          language_criteria: languageCriteria,
        },
      });

      runIds.push(level3Execution.runId);

      level3 = normalizeLevel3(
        level3Execution.output,
        languageCriteria
      );
    }

    const effectiveLineCount = estimateEffectiveLines(
      answer.answer_text,
      question.maximum_lines
    );

    const calculationCriteria = level2.criteria.map(
      (criterionResult) => {
        const configured = criteria.find(
          (criterion) =>
            criterion.id === criterionResult.criterion_id
        );

        return {
          criterion_id: criterionResult.criterion_id,
          score: criterionResult.score,
          maximum_score: Number(
            configured?.maximum_score ?? 0
          ),
        };
      }
    );

    const level4Execution = await runCalculationStage({
      answerId,
      question,
      criteria: calculationCriteria,
      languageErrorCount: level3.total_errors,
      effectiveLineCount,
    });

    runIds.push(level4Execution.runId);

    const calculation = level4Execution.output;

    const { data: savedCorrection, error: correctionError } =
      await admin
        .from("corrections")
        .insert({
          answer_id: answerId,
          total_score: calculation.final_score,
          summary_feedback: level2.general_feedback,
          strengths: level2.strengths,
          weaknesses: level2.weaknesses,
          improvement_suggestions:
            level2.improvement_suggestions,
          improved_answer: level2.improved_answer || null,
          model_used: MODEL,
          prompt_version: PROMPT_VERSION,
          validation_status: level1.status,
          validation_feedback: [
            level1.question_assessment,
            level1.reference_assessment,
            level1.answer_assessment,
          ].join("\n\n"),
          validation_confidence: level1.confidence,
          content_score: calculation.content_score,
          content_maximum_score:
            calculation.content_maximum_score,
          content_feedback: level2.general_feedback,
          language_error_count:
            calculation.language_error_count,
          effective_line_count:
            calculation.effective_line_count,
          language_discount: calculation.language_discount,
          language_feedback: level3.general_feedback,
          language_analysis: level3,
          calculation_details: calculation,
        })
        .select("id")
        .single();

    if (correctionError || !savedCorrection) {
      throw new Error(
        `Erro ao salvar correção: ${
          correctionError?.message ?? "erro desconhecido"
        }`
      );
    }

    correctionId = Number(savedCorrection.id);

    const correctionItems = level2.criteria.map(
      (criterionResult) => {
        const normalized = calculation.normalized_criteria.find(
          (item) =>
            item.criterion_id === criterionResult.criterion_id
        );

        return {
          correction_id: correctionId,
          criterion_id: criterionResult.criterion_id,
          score:
            normalized?.normalized_score ??
            criterionResult.score,
          feedback: [
            criterionResult.feedback,
            `Evidência: ${criterionResult.evidence}`,
            `Orientação: ${criterionResult.improvement}`,
          ].join("\n\n"),
        };
      }
    );

    const { error: itemsError } = await admin
      .from("correction_items")
      .insert(correctionItems);

    if (itemsError) {
      throw new Error(
        `Erro ao salvar critérios: ${itemsError.message}`
      );
    }

    const uniqueContentErrors = new Map<string, Level2Error>();

    for (const contentError of level2.identified_errors) {
      if (!uniqueContentErrors.has(contentError.code)) {
        uniqueContentErrors.set(
          contentError.code,
          contentError
        );
      }
    }

    const correctionErrors: Array<{
      correction_id: number;
      error_type_id: number;
      severity: "low" | "medium" | "high";
      explanation: string;
      excerpt: string | null;
    }> = [];

    for (const contentError of uniqueContentErrors.values()) {
      const matchingType = errorTypes.find(
        (errorType) =>
          errorType.code.toUpperCase() ===
          contentError.code.toUpperCase()
      );

      if (!matchingType) continue;

      correctionErrors.push({
        correction_id: correctionId,
        error_type_id: matchingType.id,
        severity: contentError.severity,
        explanation: contentError.explanation,
        excerpt: contentError.excerpt,
      });
    }

    if (correctionErrors.length) {
      const { error: errorInsertError } = await admin
        .from("correction_errors")
        .insert(correctionErrors);

      if (errorInsertError) {
        throw new Error(
          `Erro ao salvar erros de conteúdo: ${errorInsertError.message}`
        );
      }
    }

    const languageErrors = level3.criteria.flatMap(
      (criterion) =>
        criterion.occurrences.map((occurrence, index) => ({
          correction_id: correctionId,
          criterion_code: criterion.code,
          criterion_name: criterion.name,
          excerpt: occurrence.excerpt,
          explanation: occurrence.explanation,
          suggested_correction:
            occurrence.suggested_correction || null,
          occurrence_order: index + 1,
        }))
    );

    if (languageErrors.length) {
      const { error: languageInsertError } = await admin
        .from("language_errors")
        .insert(languageErrors);

      if (languageInsertError) {
        throw new Error(
          `Erro ao salvar erros linguísticos: ${languageInsertError.message}`
        );
      }
    }

    if (runIds.length) {
      const { error: linkError } = await admin
        .from("correction_runs")
        .update({ correction_id: correctionId })
        .in("id", runIds);

      if (linkError) {
        throw new Error(
          `Erro ao vincular auditoria: ${linkError.message}`
        );
      }
    }

    const { error: statusError } = await admin
      .from("user_answers")
      .update({ status: "corrected" })
      .eq("id", answerId)
      .eq("user_id", user.id);

    if (statusError) {
      throw new Error(
        `A correção foi salva, mas o status não foi atualizado: ${statusError.message}`
      );
    }

    return NextResponse.json({
      success: true,
      alreadyCorrected: false,
      correctionId,
      result: {
        validationStatus: level1.status,
        contentScore: calculation.content_score,
        languageErrors: level3.total_errors,
        effectiveLines: calculation.effective_line_count,
        languageDiscount: calculation.language_discount,
        finalScore: calculation.final_score,
      },
    });
  } catch (error) {
    console.error("Erro no motor de correção:", error);

    if (correctionId) {
      await admin
        .from("corrections")
        .delete()
        .eq("id", correctionId);
    }

    if (answerId && userId) {
      await admin
        .from("user_answers")
        .update({ status: "failed" })
        .eq("id", answerId)
        .eq("user_id", userId);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido durante a correção.",
      },
      { status: 500 }
    );
  }
}
