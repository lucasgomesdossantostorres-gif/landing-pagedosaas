import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarExternalReference } from "@/lib/billing/asaas";

type Plan = "essential" | "pro";
type BillingCycle = "monthly" | "yearly";

type CheckoutRequest = {
  plan?: Plan;
  billingCycle?: BillingCycle;
  cpf?: string;
  phone?: string;
};

const PLANOS = {
  essential: {
    name: "Plano Essencial",
    monthly: 124.73,
    yearly: 1347.08,
  },
  pro: {
    name: "Plano Pro",
    monthly: 172.46,
    yearly: 1655.62,
  },
} as const;

function limparDocumento(value: string) {
  return value.replace(/\D/g, "");
}

function limparTelefone(value: string) {
  return value.replace(/\D/g, "");
}

function obterBaseUrl() {
  return process.env.ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com"
    : "https://api-sandbox.asaas.com";
}

async function asaasFetch<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;

  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada.");
  }

  const response = await fetch(`${obterBaseUrl()}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
      accept: "application/json",
      "content-type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  const body = (await response.json()) as T & {
    errors?: Array<{
      description?: string;
    }>;
  };

  if (!response.ok) {
    throw new Error(
      body.errors?.[0]?.description ||
        "Erro ao comunicar com o Asaas.",
    );
  }

  return body;
}

type AsaasCustomer = {
  id: string;
};

type AsaasCustomerList = {
  data?: AsaasCustomer[];
};

type AsaasCheckout = {
  id: string;
  link?: string;
  url?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as CheckoutRequest;

    const plan = body.plan;
    const billingCycle = body.billingCycle;
    const cpf = limparDocumento(body.cpf ?? "");
    const phone = limparTelefone(body.phone ?? "");

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
        { error: "Informe um CPF válido." },
        { status: 400 },
      );
    }

    if (phone.length < 10 || phone.length > 11) {
      return NextResponse.json(
        { error: "Informe um telefone válido." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: subscription, error: subscriptionError } =
      await admin
        .from("subscriptions")
        .select("provider_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (subscriptionError) {
      throw new Error(subscriptionError.message);
    }

    let customerId =
      subscription?.provider_customer_id ?? null;

    if (!customerId) {
      const existingCustomers =
        await asaasFetch<AsaasCustomerList>(
          `/v3/customers?externalReference=${encodeURIComponent(
            user.id,
          )}`,
          {
            method: "GET",
          },
        );

      customerId =
        existingCustomers.data?.[0]?.id ?? null;
    }

    if (!customerId) {
      const customer =
        await asaasFetch<AsaasCustomer>(
          "/v3/customers",
          {
            method: "POST",
            body: JSON.stringify({
              name:
                user.user_metadata?.name ||
                user.user_metadata?.full_name ||
                user.email ||
                "Cliente Simples Aprova",
              cpfCnpj: cpf,
              email: user.email,
              mobilePhone: phone,
              externalReference: user.id,
              notificationDisabled: false,
            }),
          },
        );

      customerId = customer.id;
    }

    const { error: upsertError } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan: "free",
          status: "active",
          provider: "asaas",
          provider_customer_id: customerId,
        },
        {
          onConflict: "user_id",
        },
      );

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    const selectedPlan = PLANOS[plan];

    const isMonthly = billingCycle === "monthly";

    const checkout =
      await asaasFetch<AsaasCheckout>(
        "/v3/checkouts",
        {
          method: "POST",
          body: JSON.stringify({
            billingTypes: isMonthly
              ? ["CREDIT_CARD"]
              : ["PIX"],

            chargeTypes: isMonthly
              ? ["RECURRENT"]
              : ["DETACHED"],

            minutesToExpire: 60,

            callback: {
              successUrl:
                "https://app.simplesaprova.com.br/configuracoes?checkout=success",
              cancelUrl:
                "https://app.simplesaprova.com.br/planos?checkout=cancel",
              expiredUrl:
                "https://app.simplesaprova.com.br/planos?checkout=expired",
            },

            customer: customerId,

            items: [
              {
                name: isMonthly
                  ? `${selectedPlan.name} mensal`
                  : `${selectedPlan.name} anual`,
                description: isMonthly
                  ? "Assinatura mensal recorrente"
                  : "Acesso anual pago via Pix",
                quantity: 1,
                value: isMonthly
                  ? selectedPlan.monthly
                  : selectedPlan.yearly,
              },
            ],

            externalReference: criarExternalReference(
              user.id,
              plan,
            ),

            ...(isMonthly
              ? {
                  subscription: {
                    cycle: "MONTHLY",
                    nextDueDate: new Date()
                      .toISOString()
                      .slice(0, 10),
                  },
                }
              : {}),
          }),
        },
      );

    const checkoutUrl = checkout.link || checkout.url;

    if (!checkoutUrl) {
      throw new Error(
        "O Asaas não retornou o link do checkout.",
      );
    }

    return NextResponse.json({
      checkoutUrl,
    });
  } catch (error) {
    console.error("Erro ao criar checkout Asaas:", error);

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