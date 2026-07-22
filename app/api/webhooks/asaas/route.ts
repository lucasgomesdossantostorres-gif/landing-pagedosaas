import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type Plan = "essential" | "pro";
type BillingCycle = "monthly" | "yearly";

type AsaasPayment = {
  id?: string;
  customer?: string;
  subscription?: string | null;
  externalReference?: string | null;
  status?: string;
  billingType?: string;
  value?: number;
  dueDate?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
};

type AsaasSubscription = {
  id?: string;
  customer?: string;
  externalReference?: string | null;
  status?: string;
  cycle?: string;
  nextDueDate?: string;
};

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  dateCreated?: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
};

type BillingReference = {
  userId: string;
  plan: Plan;
  billingCycle: BillingCycle;
};

type SubscriptionRow = {
  user_id: string;
  plan: string;
  status: string;
  billing_cycle: string | null;
  provider_subscription_id: string | null;
  current_period_end: string | null;
};

const PAYMENT_ACTIVATION_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
]);

const PAYMENT_OVERDUE_EVENTS = new Set([
  "PAYMENT_OVERDUE",
]);

const PAYMENT_REVERSAL_EVENTS = new Set([
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
]);

const SUBSCRIPTION_CANCELED_EVENTS = new Set([
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
]);

function interpretarExternalReference(
  value: unknown,
): BillingReference | null {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value.split(":");

  if (
    parts.length !== 5 ||
    parts[0] !== "billing"
  ) {
    return null;
  }

  const userId = parts[1];
  const plan = parts[2];
  const billingCycle = parts[3];

  /*
   * Compatibilidade com referências que possam ter
   * algum sufixo adicional no futuro.
   */
  const normalizedBillingCycle =
    billingCycle === "monthly" ||
    billingCycle === "yearly"
      ? billingCycle
      : parts[4];

  const validUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    );

  if (!validUuid) {
    return null;
  }

  if (plan !== "essential" && plan !== "pro") {
    return null;
  }

  if (
    normalizedBillingCycle !== "monthly" &&
    normalizedBillingCycle !== "yearly"
  ) {
    return null;
  }

  return {
    userId,
    plan,
    billingCycle: normalizedBillingCycle,
  };
}

function interpretarExternalReferenceLegada(
  value: unknown,
): BillingReference | null {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value.split(":");

  /*
   * O checkout criado anteriormente usa:
   * billing:userId:plan:billingCycle
   */
  if (
    parts.length !== 4 ||
    parts[0] !== "billing"
  ) {
    return null;
  }

  const userId = parts[1];
  const plan = parts[2];
  const billingCycle = parts[3];

  const validUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    );

  if (
    !validUuid ||
    (plan !== "essential" && plan !== "pro") ||
    (billingCycle !== "monthly" &&
      billingCycle !== "yearly")
  ) {
    return null;
  }

  return {
    userId,
    plan,
    billingCycle,
  };
}

function obterReferencia(
  value: unknown,
): BillingReference | null {
  return (
    interpretarExternalReference(value) ||
    interpretarExternalReferenceLegada(value)
  );
}

function converterDataAsaas(
  value: string | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00-03:00`);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  const normalizedValue =
    value.includes("T")
      ? value
      : value.replace(" ", "T");

  const hasTimezone =
    /Z$|[+-]\d{2}:\d{2}$/.test(normalizedValue);

  const date = new Date(
    hasTimezone
      ? normalizedValue
      : `${normalizedValue}-03:00`,
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function adicionarMeses(
  date: Date,
  months: number,
) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function adicionarAnos(
  date: Date,
  years: number,
) {
  const result = new Date(date);
  result.setUTCFullYear(
    result.getUTCFullYear() + years,
  );
  return result;
}

function adicionarDias(
  date: Date,
  days: number,
) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function buscarAssinaturaPorSubscriptionId(
  subscriptionId: string,
): Promise<SubscriptionRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("subscriptions")
    .select(`
      user_id,
      plan,
      status,
      billing_cycle,
      provider_subscription_id,
      current_period_end
    `)
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao localizar assinatura: ${error.message}`,
    );
  }

  return data as SubscriptionRow | null;
}

async function resolverAssinatura(
  payload: AsaasWebhookPayload,
): Promise<{
  userId: string;
  plan: Plan;
  billingCycle: BillingCycle;
} | null> {
  const externalReference =
    payload.payment?.externalReference ??
    payload.subscription?.externalReference;

  const reference =
    obterReferencia(externalReference);

  if (reference) {
    return reference;
  }

  const subscriptionId =
    payload.payment?.subscription ??
    payload.subscription?.id;

  if (!subscriptionId) {
    return null;
  }

  const existing =
    await buscarAssinaturaPorSubscriptionId(
      subscriptionId,
    );

  if (!existing) {
    return null;
  }

  if (
    existing.plan !== "essential" &&
    existing.plan !== "pro"
  ) {
    return null;
  }

  const billingCycle =
    existing.billing_cycle === "yearly"
      ? "yearly"
      : "monthly";

  return {
    userId: existing.user_id,
    plan: existing.plan,
    billingCycle,
  };
}

async function processarAssinaturaCriada(
  payload: AsaasWebhookPayload,
) {
  const subscription = payload.subscription;

  if (!subscription?.id) {
    return;
  }

  const reference =
    obterReferencia(
      subscription.externalReference,
    );

  if (!reference) {
    return;
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: reference.userId,
        plan: reference.plan,
        status: "pending",
        provider: "asaas",
        provider_customer_id:
          subscription.customer ?? null,
        provider_subscription_id:
          subscription.id,
        billing_cycle: "monthly",
        payment_method: "credit_card",
        last_payment_status:
          payload.event ?? null,
        cancel_at_period_end: false,
      },
      {
        onConflict: "user_id",
      },
    );

  if (error) {
    throw new Error(
      `Erro ao registrar assinatura: ${error.message}`,
    );
  }
}

async function processarPagamentoConfirmado(
  payload: AsaasWebhookPayload,
) {
  const payment = payload.payment;

  if (!payment?.id) {
    return;
  }

  const resolved =
    await resolverAssinatura(payload);

  if (!resolved) {
    throw new Error(
      "Não foi possível relacionar o pagamento a um usuário.",
    );
  }

  const startDate =
    converterDataAsaas(payment.dueDate) ??
    converterDataAsaas(payment.paymentDate) ??
    converterDataAsaas(
      payment.clientPaymentDate,
    ) ??
    converterDataAsaas(
      payment.confirmedDate,
    ) ??
    new Date();

  const endDate =
    resolved.billingCycle === "yearly"
      ? adicionarAnos(startDate, 1)
      : adicionarMeses(startDate, 1);

  const paymentMethod =
    resolved.billingCycle === "yearly"
      ? "pix"
      : "credit_card";

  const admin = createAdminClient();

  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: resolved.userId,
        plan: resolved.plan,
        status: "active",
        provider: "asaas",
        provider_customer_id:
          payment.customer ?? null,
        provider_subscription_id:
          payment.subscription ?? null,
        provider_payment_id: payment.id,
        billing_cycle:
          resolved.billingCycle,
        payment_method: paymentMethod,
        current_period_start:
          startDate.toISOString(),
        current_period_end:
          endDate.toISOString(),
        grace_period_end: null,
        last_payment_status:
          payload.event ?? payment.status ?? null,
        cancel_at_period_end: false,
        cancellation_requested_at: null,
      },
      {
        onConflict: "user_id",
      },
    );

  if (error) {
    throw new Error(
      `Erro ao ativar o plano: ${error.message}`,
    );
  }
}

async function processarPagamentoVencido(
  payload: AsaasWebhookPayload,
) {
  const resolved =
    await resolverAssinatura(payload);

  if (!resolved) {
    return;
  }

  const dueDate =
    converterDataAsaas(
      payload.payment?.dueDate,
    ) ?? new Date();

  const gracePeriodEnd =
    adicionarDias(dueDate, 10);

  const admin = createAdminClient();

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "past_due",
      grace_period_end:
        gracePeriodEnd.toISOString(),
      last_payment_status:
        payload.event ?? "PAYMENT_OVERDUE",
    })
    .eq("user_id", resolved.userId);

  if (error) {
    throw new Error(
      `Erro ao registrar atraso: ${error.message}`,
    );
  }
}

async function processarPagamentoRevertido(
  payload: AsaasWebhookPayload,
) {
  const resolved =
    await resolverAssinatura(payload);

  if (!resolved) {
    return;
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "expired",
      grace_period_end: null,
      last_payment_status:
        payload.event ?? "PAYMENT_REFUNDED",
    })
    .eq("user_id", resolved.userId);

  if (error) {
    throw new Error(
      `Erro ao reverter o plano: ${error.message}`,
    );
  }
}

async function processarAssinaturaCancelada(
  payload: AsaasWebhookPayload,
) {
  const resolved =
    await resolverAssinatura(payload);

  if (!resolved) {
    return;
  }

  const admin = createAdminClient();

  const { data, error: readError } =
    await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", resolved.userId)
      .maybeSingle();

  if (readError) {
    throw new Error(
      `Erro ao consultar período: ${readError.message}`,
    );
  }

  const currentPeriodEnd =
    converterDataAsaas(
      data?.current_period_end,
    );

  const stillHasAccess =
    currentPeriodEnd !== null &&
    currentPeriodEnd.getTime() >
      Date.now();

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: stillHasAccess
        ? "active"
        : "canceled",
      cancel_at_period_end: true,
      cancellation_requested_at:
        new Date().toISOString(),
      last_payment_status:
        payload.event ?? null,
    })
    .eq("user_id", resolved.userId);

  if (error) {
    throw new Error(
      `Erro ao cancelar assinatura: ${error.message}`,
    );
  }
}

async function processarEvento(
  payload: AsaasWebhookPayload,
) {
  const event = payload.event;

  if (!event) {
    return;
  }

  if (
    event === "SUBSCRIPTION_CREATED" ||
    event === "SUBSCRIPTION_UPDATED"
  ) {
    await processarAssinaturaCriada(payload);
    return;
  }

  if (PAYMENT_ACTIVATION_EVENTS.has(event)) {
    await processarPagamentoConfirmado(payload);
    return;
  }

  if (PAYMENT_OVERDUE_EVENTS.has(event)) {
    await processarPagamentoVencido(payload);
    return;
  }

  if (PAYMENT_REVERSAL_EVENTS.has(event)) {
    await processarPagamentoRevertido(payload);
    return;
  }

  if (
    SUBSCRIPTION_CANCELED_EVENTS.has(event)
  ) {
    await processarAssinaturaCancelada(payload);
  }
}

export async function POST(
  request: NextRequest,
) {
  const configuredToken =
    process.env.ASAAS_WEBHOOK_TOKEN;

  if (!configuredToken) {
    console.error(
      "ASAAS_WEBHOOK_TOKEN não configurado.",
    );

    return NextResponse.json(
      { error: "Webhook não configurado." },
      { status: 500 },
    );
  }

  const receivedToken =
    request.headers.get(
      "asaas-access-token",
    );

  if (receivedToken !== configuredToken) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    );
  }

  let payload: AsaasWebhookPayload;

  try {
    payload =
      (await request.json()) as AsaasWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "JSON inválido." },
      { status: 400 },
    );
  }

  if (!payload.id || !payload.event) {
    return NextResponse.json(
      {
        error:
          "Evento sem identificador ou tipo.",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  /*
   * Primeiro verificamos se o evento já existe.
   * Se já foi processado, respondemos sucesso.
   * Se existe, mas falhou anteriormente, tentamos de novo.
   */
  const {
    data: existingEvent,
    error: existingEventError,
  } = await admin
    .from("asaas_webhook_events")
    .select("event_id, processed")
    .eq("event_id", payload.id)
    .maybeSingle();

  if (existingEventError) {
    console.error(
      "Erro ao consultar evento:",
      existingEventError,
    );

    return NextResponse.json(
      { error: "Erro ao consultar evento." },
      { status: 500 },
    );
  }

  if (existingEvent?.processed === true) {
    return NextResponse.json(
      {
        received: true,
        duplicate: true,
      },
      { status: 200 },
    );
  }

  if (!existingEvent) {
    const { error: insertError } =
      await admin
        .from("asaas_webhook_events")
        .insert({
          event_id: payload.id,
          event_type: payload.event,
          payload,
          processed: false,
        });

    if (insertError) {
      console.error(
        "Erro ao registrar webhook:",
        insertError,
      );

      return NextResponse.json(
        {
          error:
            "Erro ao registrar evento.",
        },
        { status: 500 },
      );
    }
  }

  try {
    await processarEvento(payload);

    const { error: updateError } =
      await admin
        .from("asaas_webhook_events")
        .update({
          processed: true,
          processed_at:
            new Date().toISOString(),
          processing_error: null,
        })
        .eq("event_id", payload.id);

    if (updateError) {
      throw new Error(
        `Erro ao finalizar evento: ${updateError.message}`,
      );
    }

    return NextResponse.json(
      { received: true },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido.";

    console.error(
      "Erro ao processar webhook Asaas:",
      message,
    );

    await admin
      .from("asaas_webhook_events")
      .update({
        processed: false,
        processing_error: message,
      })
      .eq("event_id", payload.id);

    /*
     * Retornamos 500 para que o Asaas tente novamente.
     */
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}