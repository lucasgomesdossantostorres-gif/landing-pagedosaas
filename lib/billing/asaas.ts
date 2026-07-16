import { createAdminClient } from "@/lib/supabase/admin";

import {
  obterLimitesDoPlano,
  type MentorPlan,
} from "@/lib/mentor/plans";

type SubscriptionRow = {
  plan: string;
  status: string;
};

type AsaasSubscriptionResponse = {
  id?: string;
  customer?: string;
  externalReference?: string | null;
  status?: string;
};

export type AsaasExternalReference = {
  userId: string;
  plan: Exclude<MentorPlan, "free">;
};

export function obterDataDeUsoBrasil() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date());
}

export function interpretarExternalReference(
  value: unknown,
): AsaasExternalReference | null {
  if (typeof value !== "string") {
    return null;
  }

  const partes = value.split(":");

  if (
    partes.length !== 3 ||
    partes[0] !== "mentor"
  ) {
    return null;
  }

  const userId = partes[1];
  const plan = partes[2];

  const uuidValido =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    );

  if (
    !uuidValido ||
    (plan !== "essential" && plan !== "pro")
  ) {
    return null;
  }

  return {
    userId,
    plan,
  };
}

export function criarExternalReference(
  userId: string,
  plan: Exclude<MentorPlan, "free">,
) {
  return `mentor:${userId}:${plan}`;
}

export async function buscarAssinaturaNoAsaas(
  subscriptionId: string,
) {
  const apiKey = process.env.ASAAS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ASAAS_API_KEY não está configurada.",
    );
  }

  const ambiente =
    process.env.ASAAS_ENVIRONMENT === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com";

  const response = await fetch(
    `${ambiente}/v3/subscriptions/${subscriptionId}`,
    {
      method: "GET",
      headers: {
        access_token: apiKey,
        accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const body =
    (await response.json()) as AsaasSubscriptionResponse & {
      errors?: Array<{
        description?: string;
      }>;
    };

  if (!response.ok) {
    throw new Error(
      body.errors?.[0]?.description ||
        "Não foi possível consultar a assinatura no Asaas.",
    );
  }

  return body;
}


export async function cancelarAssinaturaNoAsaas(
  subscriptionId: string,
) {
  const id = subscriptionId.trim();

  if (!id) {
    throw new Error(
      "O identificador da assinatura do Asaas não foi informado.",
    );
  }

  const apiKey = process.env.ASAAS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ASAAS_API_KEY não está configurada.",
    );
  }

  const ambiente =
    process.env.ASAAS_ENVIRONMENT === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com";

  const response = await fetch(
    `${ambiente}/v3/subscriptions/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        access_token: apiKey,
        accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.ok) {
    return;
  }

  let mensagem =
    "Não foi possível cancelar a assinatura no Asaas.";

  try {
    const body =
      (await response.json()) as {
        errors?: Array<{
          description?: string;
        }>;
      };

    mensagem =
      body.errors?.[0]?.description ||
      mensagem;
  } catch {
    // O Asaas pode devolver uma resposta sem corpo.
  }

  /*
   * Se a assinatura já não existe, consideramos que a recorrência
   * já foi encerrada e permitimos continuar a limpeza local.
   */
  if (response.status === 404) {
    return;
  }

  throw new Error(mensagem);
}

export async function buscarLimitesDoUsuario(
  userId: string,
) {
  const admin = createAdminClient();

  const {
    data,
    error,
  } = await admin
    .from("subscriptions")
    .select(`
      plan,
      status
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível verificar a assinatura: ${error.message}`,
    );
  }

  const assinatura =
    data as SubscriptionRow | null;

  const planoAtivo =
    assinatura?.status === "active"
      ? assinatura.plan
      : "free";

  return obterLimitesDoPlano(planoAtivo);
}
