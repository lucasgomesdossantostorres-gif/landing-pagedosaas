import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  dateCreated?: string;
  payment?: {
    id?: string;
    customer?: string;
    subscription?: string | null;
    externalReference?: string | null;
    status?: string;
    billingType?: string;
    value?: number;
    dueDate?: string;
    paymentDate?: string | null;
  };
  subscription?: {
    id?: string;
    customer?: string;
    externalReference?: string | null;
    status?: string;
  };
};

export async function POST(request: NextRequest) {
  const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN;

  if (!configuredToken) {
    console.error("ASAAS_WEBHOOK_TOKEN não configurado.");

    return NextResponse.json(
      { error: "Webhook não configurado." },
      { status: 500 },
    );
  }

  const receivedToken =
    request.headers.get("asaas-access-token");

  if (receivedToken !== configuredToken) {
    console.error("Token inválido recebido no webhook.");

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
      { error: "Evento inválido." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("asaas_webhook_events")
    .insert({
      event_id: payload.id,
      event_type: payload.event,
      payload,
      processed: false,
    });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          received: true,
          duplicate: true,
        },
        { status: 200 },
      );
    }

    console.error(
      "Erro ao registrar webhook no Supabase:",
      error,
    );

    return NextResponse.json(
      { error: "Erro ao registrar evento." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { received: true },
    { status: 200 },
  );
}