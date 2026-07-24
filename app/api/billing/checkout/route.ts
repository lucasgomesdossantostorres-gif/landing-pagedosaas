import { NextRequest, NextResponse } from "next/server";

import {
  getPlanAmount,
  type BillingCycle,
  type BillingPlan,
} from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CheckoutRequest = {
  plan?: BillingPlan;
  billingCycle?: BillingCycle;
  couponCode?: string;
  cpf?: string;
  phone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
};

type CouponRow = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  applicable_plans: string[];
  active: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  max_redemptions_per_user: number;
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

function limparNumeros(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeCouponCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  plan: BillingPlan,
  billingCycle: BillingCycle,
  checkoutSessionId: string,
) {
  return `billing:${userId}:${plan}:${billingCycle}:${checkoutSessionId}`;
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
    result = (await response.json()) as AsaasCheckoutResponse;
  } catch {
    throw new Error("O Asaas retornou uma resposta inválida.");
  }

  if (!response.ok) {
    throw new Error(
      result.errors?.[0]?.description ||
        "Não foi possível criar o checkout no Asaas.",
    );
  }

  return result;
}

async function validarCupom(params: {
  admin: ReturnType<typeof createAdminClient>;
  code: string;
  plan: BillingPlan;
  userId: string;
}) {
  const { admin, code, plan, userId } = params;

  const { data, error } = await admin
    .from("coupons")
    .select(`
      id,
      code,
      discount_type,
      discount_value,
      applicable_plans,
      active,
      expires_at,
      max_redemptions,
      max_redemptions_per_user
    `)
    .eq("code", code)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível consultar o cupom: ${error.message}`);
  }

  const coupon = data as CouponRow | null;

  if (!coupon || !coupon.active) {
    throw new Error("Cupom inválido ou inativo.");
  }

  if (
    coupon.expires_at &&
    new Date(coupon.expires_at).getTime() <= Date.now()
  ) {
    throw new Error("Este cupom expirou.");
  }

  if (!coupon.applicable_plans.includes(plan)) {
    throw new Error("Este cupom não é válido para o plano selecionado.");
  }

  const [
    { count: totalRedemptions, error: totalError },
    { count: userRedemptions, error: userError },
  ] = await Promise.all([
    admin
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("status", "confirmed"),
    admin
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("user_id", userId)
      .eq("status", "confirmed"),
  ]);

  if (totalError || userError) {
    throw new Error(
      `Não foi possível verificar o uso do cupom: ${
        totalError?.message || userError?.message
      }`,
    );
  }

  if (
    coupon.max_redemptions !== null &&
    (totalRedemptions ?? 0) >= coupon.max_redemptions
  ) {
    throw new Error("O limite de usos deste cupom foi atingido.");
  }

  if (
    (userRedemptions ?? 0) >= coupon.max_redemptions_per_user
  ) {
    throw new Error("Você já utilizou este cupom.");
  }

  return coupon;
}

export async function POST(request: NextRequest) {
  let localSessionId: string | null = null;

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

    const body = (await request.json()) as CheckoutRequest;
    const plan = body.plan;
    const billingCycle = body.billingCycle;
    const couponCode = normalizeCouponCode(body.couponCode);

    const cpf = limparNumeros(body.cpf ?? "");
    const phone = limparNumeros(body.phone ?? "");
    const postalCode = limparNumeros(body.postalCode ?? "");
    const address = body.address?.trim() ?? "";
    const addressNumber = body.addressNumber?.trim() ?? "";
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
        { error: "Informe um telefone com DDD válido." },
        { status: 400 },
      );
    }

    if (postalCode.length !== 8) {
      return NextResponse.json(
        { error: "Informe um CEP válido." },
        { status: 400 },
      );
    }

    if (!address || !addressNumber || !province || !city) {
      return NextResponse.json(
        { error: "Preencha todos os dados obrigatórios do endereço." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const originalAmount = getPlanAmount(plan, billingCycle);

    let coupon: CouponRow | null = null;
    let discountAmount = 0;

    if (couponCode) {
      coupon = await validarCupom({
        admin,
        code: couponCode,
        plan,
        userId: user.id,
      });

      discountAmount =
        coupon.discount_type === "percentage"
          ? roundMoney(
              originalAmount * (coupon.discount_value / 100),
            )
          : Math.min(
              roundMoney(coupon.discount_value),
              originalAmount,
            );
    }

    const finalAmount = Math.max(
      roundMoney(originalAmount - discountAmount),
      0,
    );

    if (finalAmount < 5) {
      return NextResponse.json(
        {
          error:
            "O valor final ficou abaixo do mínimo permitido para este checkout.",
        },
        { status: 400 },
      );
    }

    const { data: sessionData, error: sessionError } = await admin
      .from("billing_checkout_sessions")
      .insert({
        user_id: user.id,
        plan,
        billing_cycle: billingCycle,
        coupon_id: coupon?.id ?? null,
        coupon_code: coupon?.code ?? null,
        original_amount: originalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        status: "pending",
      })
      .select("id")
      .single();

    if (sessionError || !sessionData?.id) {
      throw new Error(
        `Não foi possível registrar o checkout: ${
          sessionError?.message || "identificador não retornado"
        }`,
      );
    }

    localSessionId = String(sessionData.id);

    const isMonthly = billingCycle === "monthly";
    const appUrl = obterAppUrl();

    const name =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Cliente Simples Aprova";

    const externalReference = criarReferenciaExterna(
      user.id,
      plan,
      billingCycle,
      localSessionId,
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

    if (complement) {
      customerData.complement = complement;
    }

    const planName =
      plan === "essential" ? "Plano Essencial" : "Plano Pro";

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
            plan === "essential" ? "essencial" : "pro"
          }?checkout=cancel`,
        expiredUrl:
          `${appUrl}/checkout/${
            plan === "essential" ? "essencial" : "pro"
          }?checkout=expired`,
      },
      customerData,
      items: [
        {
          externalReference,
          name: isMonthly
            ? `${planName} mensal`
            : `${planName} anual`,
          description: coupon
            ? `${isMonthly ? "Assinatura mensal" : "Acesso anual"} com cupom ${coupon.code}`
            : isMonthly
              ? "Assinatura mensal recorrente no cartão"
              : "Acesso anual com pagamento via Pix",
          quantity: 1,
          value: finalAmount,
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

    const checkout = await criarCheckoutNoAsaas(payload);

    if (!checkout.id) {
      throw new Error(
        "O Asaas não retornou o identificador do checkout.",
      );
    }

    const { error: updateError } = await admin
      .from("billing_checkout_sessions")
      .update({
        asaas_checkout_id: checkout.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localSessionId);

    if (updateError) {
      console.error(
        "Checkout criado, mas a sessão local não foi atualizada:",
        updateError.message,
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
      originalAmount,
      discountAmount,
      finalAmount,
      couponCode: coupon?.code ?? null,
    });
  } catch (error) {
    if (localSessionId) {
      try {
        const admin = createAdminClient();
        await admin
          .from("billing_checkout_sessions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", localSessionId);
      } catch {
        // O erro principal será devolvido ao usuário.
      }
    }

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
