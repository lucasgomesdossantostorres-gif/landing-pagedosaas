import {
  NextRequest,
  NextResponse,
} from "next/server";

import OpenAI from "openai";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  buscarLimitesDoUsuario,
  obterDataDeUsoBrasil,
} from "@/lib/billing/asaas";

import {
  criarPromptMentor,
} from "@/lib/mentor/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_NAME =
  process.env.MISTRAL_MENTOR_MODEL ||
  "mistral-small-2603";

type MentorMessage = {
  role: "user" | "assistant";
  content: string;
};

type MentorRequestBody = {
  messages?: MentorMessage[];
};

type UsageRow = {
  reserved_messages: number | null;
};

type ReservationRow = {
  allowed: boolean;
  used: number;
  remaining: number;
  reason: string;
};

function responderErro(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...extra,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function criarClienteMistral() {
  const apiKey =
    process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new Error(
      "MISTRAL_API_KEY não está configurada.",
    );
  }

  return new OpenAI({
    apiKey,
    baseURL:
      "https://api.mistral.ai/v1",
  });
}

function validarMensagens(
  value: unknown,
): MentorMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-30)
    .map((item) => {
      if (
        typeof item !== "object" ||
        item === null
      ) {
        return null;
      }

      const dados =
        item as Record<string, unknown>;

      const role =
        dados.role;

      const content =
        String(
          dados.content ?? "",
        ).trim();

      if (
        (
          role !== "user" &&
          role !== "assistant"
        ) ||
        !content
      ) {
        return null;
      }

      return {
        role,
        content,
      } satisfies MentorMessage;
    })
    .filter(
      (
        item,
      ): item is MentorMessage =>
        item !== null,
    );
}

function montarLimitesResposta(
  params: {
    plan: string;
    planName: string;
    dailyLimit: number;
    usedToday: number;
    maximumCharacters: number;
    contextMessages: number;
    maximumOutputTokens: number;
  },
) {
  return {
    plan: params.plan,
    plan_name:
      params.planName,
    daily_limit:
      params.dailyLimit,
    used_today:
      params.usedToday,
    remaining_today:
      Math.max(
        params.dailyLimit -
          params.usedToday,
        0,
      ),
    maximum_characters:
      params.maximumCharacters,
    context_messages:
      params.contextMessages,
    maximum_output_tokens:
      params.maximumOutputTokens,
  };
}

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return responderErro(
        "Usuário não autenticado.",
        401,
      );
    }

    const limits =
      await buscarLimitesDoUsuario(
        user.id,
      );

    const admin =
      createAdminClient();

    const usageDate =
      obterDataDeUsoBrasil();

    const {
      data,
      error,
    } = await admin
      .from("mentor_daily_usage")
      .select(
        "reserved_messages",
      )
      .eq(
        "user_id",
        user.id,
      )
      .eq(
        "usage_date",
        usageDate,
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `Não foi possível consultar o consumo: ${error.message}`,
      );
    }

    const usage =
      data as UsageRow | null;

    const usedToday =
      Number(
        usage
          ?.reserved_messages ??
          0,
      );

    return NextResponse.json(
      {
        success: true,
        limits:
          montarLimitesResposta({
            plan:
              limits.plan,
            planName:
              limits.displayName,
            dailyLimit:
              limits.dailyMessages,
            usedToday,
            maximumCharacters:
              limits.maximumUserCharacters,
            contextMessages:
              limits.contextMessages,
            maximumOutputTokens:
              limits.maximumOutputTokens,
          }),
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Erro no GET /api/mentor:",
      error,
    );

    return responderErro(
      error instanceof Error
        ? error.message
        : "Erro ao carregar os limites.",
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  let reservationCreated =
    false;

  let usageDate = "";
  let authenticatedUserId =
    "";

  try {
    const mistral =
      criarClienteMistral();

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return responderErro(
        "Usuário não autenticado.",
        401,
      );
    }

    authenticatedUserId =
      user.id;

    let body:
      MentorRequestBody;

    try {
      body =
        (await request.json()) as MentorRequestBody;
    } catch {
      return responderErro(
        "Corpo da requisição inválido.",
        400,
      );
    }

    const messages =
      validarMensagens(
        body.messages,
      );

    const lastMessage =
      messages.at(-1);

    if (
      !lastMessage ||
      lastMessage.role !==
        "user"
    ) {
      return responderErro(
        "Digite uma mensagem.",
        400,
      );
    }

    const limits =
      await buscarLimitesDoUsuario(
        user.id,
      );

    if (
      lastMessage.content
        .length >
      limits
        .maximumUserCharacters
    ) {
      return responderErro(
        `Sua mensagem deve ter no máximo ${limits.maximumUserCharacters} caracteres no plano ${limits.displayName}.`,
        400,
      );
    }

    usageDate =
      obterDataDeUsoBrasil();

    const admin =
      createAdminClient();

    const {
      data:
        reservationData,
      error:
        reservationError,
    } = await admin.rpc(
      "reserve_mentor_message",
      {
        p_user_id:
          user.id,
        p_usage_date:
          usageDate,
        p_daily_limit:
          limits.dailyMessages,
      },
    );

    if (reservationError) {
      throw new Error(
        `Não foi possível validar o limite: ${reservationError.message}`,
      );
    }

    const reservation =
      (
        Array.isArray(
          reservationData,
        )
          ? reservationData[0]
          : null
      ) as
        | ReservationRow
        | null;

    if (
      !reservation?.allowed
    ) {
      const message =
        reservation?.reason ===
        "rate_limit"
          ? "Aguarde alguns segundos antes de enviar outra mensagem."
          : `Você atingiu o limite diário do plano ${limits.displayName}.`;

      return responderErro(
        message,
        429,
        {
          limits:
            montarLimitesResposta({
              plan:
                limits.plan,
              planName:
                limits.displayName,
              dailyLimit:
                limits.dailyMessages,
              usedToday:
                Number(
                  reservation
                    ?.used ?? 0,
                ),
              maximumCharacters:
                limits
                  .maximumUserCharacters,
              contextMessages:
                limits
                  .contextMessages,
              maximumOutputTokens:
                limits
                  .maximumOutputTokens,
            }),
        },
      );
    }

    reservationCreated =
      true;

    const limitedContext =
      messages.slice(
        -limits.contextMessages,
      );

    const userName =
      String(
        user.user_metadata
          ?.full_name ||
          user.user_metadata
            ?.name ||
          user.email
            ?.split("@")[0] ||
          "candidato",
      ).trim();

    const prompt =
      criarPromptMentor(
        userName,
        limits
          .maximumOutputTokens,
      );

    const response =
      await mistral
        .chat
        .completions
        .create({
          model:
            MODEL_NAME,
          messages: [
            {
              role:
                "system",
              content:
                prompt,
            },
            ...limitedContext.map(
              (message) => ({
                role:
                  message.role,
                content:
                  message.content,
              }),
            ),
          ],
          max_tokens:
            limits
              .maximumOutputTokens,
          temperature: 0.4,
        });

    const content =
      response.choices[0]
        ?.message?.content;

    const assistantMessage =
      typeof content ===
      "string"
        ? content.trim()
        : "";

    if (!assistantMessage) {
      throw new Error(
        "O Mentor não retornou uma resposta válida.",
      );
    }

    const {
      error:
        completionError,
    } = await admin.rpc(
      "complete_mentor_message",
      {
        p_user_id:
          user.id,
        p_usage_date:
          usageDate,
        p_input_tokens:
          Number(
            response.usage
              ?.prompt_tokens ??
              0,
          ),
        p_output_tokens:
          Number(
            response.usage
              ?.completion_tokens ??
              0,
          ),
      },
    );

    if (completionError) {
      console.error(
        "Não foi possível registrar o uso concluído do Mentor:",
        completionError.message,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          assistantMessage,
        limits:
          montarLimitesResposta({
            plan:
              limits.plan,
            planName:
              limits.displayName,
            dailyLimit:
              limits.dailyMessages,
            usedToday:
              Number(
                reservation.used,
              ),
            maximumCharacters:
              limits
                .maximumUserCharacters,
            contextMessages:
              limits
                .contextMessages,
            maximumOutputTokens:
              limits
                .maximumOutputTokens,
          }),
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Erro no POST /api/mentor:",
      error,
    );

    if (
      reservationCreated &&
      authenticatedUserId &&
      usageDate
    ) {
      try {
        const admin =
          createAdminClient();

        await admin.rpc(
          "fail_mentor_message",
          {
            p_user_id:
              authenticatedUserId,
            p_usage_date:
              usageDate,
          },
        );
      } catch (
        releaseError
      ) {
        console.error(
          "Não foi possível devolver a mensagem do Mentor:",
          releaseError,
        );
      }
    }

    const status =
      typeof error ===
        "object" &&
      error !== null &&
      "status" in error
        ? Number(
            (
              error as {
                status?: unknown;
              }
            ).status,
          )
        : 500;

    return responderErro(
      error instanceof Error
        ? error.message
        : "Erro inesperado no Mentor.",
      Number.isInteger(
        status,
      ) &&
        status >= 400 &&
        status <= 599
        ? status
        : 500,
    );
  }
}
