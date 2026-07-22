import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type Plan = "essential" | "pro";
type BillingCycle = "monthly" | "yearly";

type CheckoutRequest = {
  plan?: Plan;
  billingCycle?: BillingCycle;
  cpf?: string;
  phone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
};

type AsaasCheckoutResponse = {
  id?: string;
  link?: string;
  status?: string;
  errors?: Array<{
    code?: string;
    description?: string;
  }>;
};

const PLANOS = {
  essential: {
    name: "Plano Essencial",
    monthly: 124.73,
    yearly: 1347.76,
  },
  pro: {
    name: "Plano Pro",
    monthly: 172.46,
    yearly: 1657.52,
  },
} as const;

function limparNumeros(value: string) {
  return value.replace(/\D/g, "");
}

function obterBaseUrlAsaas() {
  return process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com"
    : "https://api-sandbox.asaas.com";
}

function obterAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.simplesaprova.com.br"
  ).replace(/\/$/, "");
}

function obterDataAtualBrasil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function criarReferenciaExterna(
  userId: string,
  plan: Plan,
  billingCycle: BillingCycle,
) {
  return `billing:${userId}:${plan}:${billingCycle}`;
}

async function criarCheckoutNoAsaas(
  payload: Record<string, unknown>,
): Promise<AsaasCheckoutResponse> {
  const apiKey = process.env.ASAAS_API_KEY;

  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não está configurada.");
  }

  const response = await fetch(
    `${obterBaseUrlAsaas()}/v3/checkouts`,
    {
      method: "POST",
      headers: {
        access_token: apiKey,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "SimplesAprova/1.0",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  let result: AsaasCheckoutResponse;

  try {
    result =
      (await response.json()) as AsaasCheckoutResponse;
  } catch {
    throw new Error(
      "O Asaas retornou uma resposta inválida.",
    );
  }

  if (!response.ok) {
    throw new Error(
      result.errors?.[0]?.description ||
        "Não foi possível criar o checkout no Asaas.",
    );
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Usuário não autenticado.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 },
      );
    }

    const body =
      (await request.json()) as CheckoutRequest;

    const plan = body.plan;
    const billingCycle = body.billingCycle;

    const cpf = limparNumeros(body.cpf ?? "");
    const phone = limparNumeros(body.phone ?? "");
    const postalCode = limparNumeros(
      body.postalCode ?? "",
    );

    const address = body.address?.trim() ?? "";
    const addressNumber =
      body.addressNumber?.trim() ?? "";
    const complement = body.complement?.trim() ?? "";
    const province = body.province?.trim() ?? "";
    const city = body.city?.trim() ?? "";

    if (plan !== "essential" && plan !== "pro") {
      return NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 },
      );
    }

    if (
      billingCycle !== "monthly" &&
      billingCycle !== "yearly"
    ) {
      return NextResponse.json(
        { error: "Periodicidade inválida." },
        { status: 400 },
      );
    }

    if (cpf.length !== 11) {
      return NextResponse.json(
        { error: "Informe um CPF com 11 números." },
        { status: 400 },
      );
    }

    if (phone.length < 10 || phone.length > 11) {
      return NextResponse.json(
        {
          error:
            "Informe um telefone com DDD válido.",
        },
        { status: 400 },
      );
    }

    if (postalCode.length !== 8) {
      return NextResponse.json(
        { error: "Informe um CEP válido." },
        { status: 400 },
      );
    }

    if (!address) {
      return NextResponse.json(
        { error: "Informe o endereço." },
        { status: 400 },
      );
    }

    if (!addressNumber) {
      return NextResponse.json(
        { error: "Informe o número do endereço." },
        { status: 400 },
      );
    }

    if (!province) {
      return NextResponse.json(
        { error: "Informe o bairro." },
        { status: 400 },
      );
    }

    if (!city) {
      return NextResponse.json(
        { error: "Informe a cidade." },
        { status: 400 },
      );
    }

    const selectedPlan = PLANOS[plan];
    const isMonthly = billingCycle === "monthly";
    const appUrl = obterAppUrl();

    const name =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Cliente Simples Aprova";

    const externalReference =
      criarReferenciaExterna(
        user.id,
        plan,
        billingCycle,
      );

    const customerData: Record<string, unknown> = {
      name,
      cpfCnpj: cpf,
      email: user.email,
      phone,
      postalCode,
      address,
      addressNumber,
      province,
    };

    /*
     * O Asaas aceita "city" como identificador numérico.
     * Como o formulário recebe o nome da cidade, não o enviamos
     * diretamente para evitar rejeição. O CEP ajuda o Asaas
     * a completar os dados do município.
     */
    if (complement) {
      customerData.complement = complement;
    }

    const payload: Record<string, unknown> = {
      billingTypes: isMonthly
        ? ["CREDIT_CARD"]
        : ["PIX"],

      chargeTypes: isMonthly
        ? ["RECURRENT"]
        : ["DETACHED"],

      minutesToExpire: 60,

      externalReference,

      callback: {
        successUrl:
          `${appUrl}/configuracoes?checkout=success`,
        cancelUrl:
          `${appUrl}/checkout/${
            plan === "essential"
              ? "essencial"
              : "pro"
          }?checkout=cancel`,
        expiredUrl:
          `${appUrl}/checkout/${
            plan === "essential"
              ? "essencial"
              : "pro"
          }?checkout=expired`,
      },

      customerData,

      items: [
        {
          externalReference: `${plan}:${billingCycle}`,
          name: isMonthly
            ? `${selectedPlan.name} mensal`
            : `${selectedPlan.name} anual`,
          description: isMonthly
            ? "Assinatura mensal recorrente no cartão"
            : "Acesso anual com pagamento via Pix",
          quantity: 1,
          value: isMonthly
            ? selectedPlan.monthly
            : selectedPlan.yearly,
        },
      ],

      ...(isMonthly
        ? {
            subscription: {
              cycle: "MONTHLY",
              nextDueDate: obterDataAtualBrasil(),
            },
          }
        : {}),
    };

    const checkout =
      await criarCheckoutNoAsaas(payload);

    if (!checkout.id) {
      throw new Error(
        "O Asaas não retornou o identificador do checkout.",
      );
    }

    const checkoutUrl =
      checkout.link ||
      `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(
        checkout.id,
      )}`;

    return NextResponse.json({
      checkoutId: checkout.id,
      checkoutUrl,
    });
  } catch (error) {
    console.error(
      "Erro ao criar checkout Asaas:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar o pagamento.",
      },
      { status: 500 },
    );
  }
}