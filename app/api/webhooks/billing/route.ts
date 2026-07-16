import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  buscarAssinaturaNoAsaas,
  interpretarExternalReference,
} from "@/lib/billing/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AsaasPayment = {
  id?: string;
  customer?: string;
  subscription?: string | null;
  externalReference?: string | null;
};

type AsaasSubscription = {
  id?: string;
  customer?: string;
  externalReference?: string | null;
};

type AsaasWebhookBody = {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
};

type LocalSubscriptionRow = {
  user_id: string;
  plan: string | null;
};

function responder(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(
    body,
    { status },
  );
}

function analisarEvento(
  event: string,
) {
  if (
    event === "PAYMENT_CONFIRMED" ||
    event === "PAYMENT_RECEIVED"
  ) {
    return {
      status: "active",
      apagarDados: false,
    };
  }

  if (event === "PAYMENT_OVERDUE") {
    return {
      status: "past_due",
      apagarDados: false,
    };
  }

  if (
    event === "PAYMENT_REFUNDED" ||
    event === "PAYMENT_DELETED" ||
    event ===
      "PAYMENT_CHARGEBACK_REQUESTED"
  ) {
    return {
      status: "canceled",
      apagarDados: false,
    };
  }

  /*
   * Somente eventos próprios da assinatura provocam
   * exclusão automática dos dados. Eventos de pagamento
   * não apagam conteúdo de forma irreversível.
   */
  if (
    event ===
      "SUBSCRIPTION_INACTIVATED" ||
    event ===
      "SUBSCRIPTION_DELETED"
  ) {
    return {
      status: "canceled",
      apagarDados: true,
    };
  }

  return null;
}

export async function POST(
  request: NextRequest,
) {
  try {
    const expectedToken =
      process.env.ASAAS_WEBHOOK_TOKEN;

    if (!expectedToken) {
      return responder(
        {
          success: false,
          error:
            "ASAAS_WEBHOOK_TOKEN não está configurado.",
        },
        500,
      );
    }

    const receivedToken =
      request.headers.get(
        "asaas-access-token",
      );

    if (
      !receivedToken ||
      receivedToken !== expectedToken
    ) {
      return responder(
        {
          success: false,
          error: "Token inválido.",
        },
        401,
      );
    }

    let body: AsaasWebhookBody;

    try {
      body =
        (await request.json()) as AsaasWebhookBody;
    } catch {
      return responder(
        {
          success: false,
          error: "JSON inválido.",
        },
        400,
      );
    }

    const eventId =
      String(body.id ?? "").trim();

    const event =
      String(body.event ?? "").trim();

    if (!eventId || !event) {
      return responder(
        {
          success: false,
          error:
            "Evento do Asaas inválido.",
        },
        400,
      );
    }

    const admin =
      createAdminClient();

    const {
      data: existingEvent,
      error: existingEventError,
    } = await admin
      .from("asaas_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEventError) {
      throw new Error(
        existingEventError.message,
      );
    }

    if (existingEvent) {
      return responder({
        success: true,
        duplicated: true,
      });
    }

    const eventInfo =
      analisarEvento(event);

    if (!eventInfo) {
      await admin
        .from("asaas_webhook_events")
        .insert({
          event_id: eventId,
          event_type: event,
        });

      return responder({
        success: true,
        ignored: true,
      });
    }

    const subscriptionId =
      body.subscription?.id ||
      body.payment?.subscription ||
      null;

    let customerId =
      body.subscription?.customer ||
      body.payment?.customer ||
      null;

    let externalReference =
      body.subscription
        ?.externalReference ||
      body.payment
        ?.externalReference ||
      null;

    /*
     * Primeiro tenta localizar a assinatura no banco local.
     * Isso também funciona quando o Asaas já removeu a assinatura
     * e a consulta remota passa a devolver 404.
     */
    let localSubscription:
      | LocalSubscriptionRow
      | null = null;

    if (subscriptionId) {
      const {
        data,
        error,
      } = await admin
        .from("subscriptions")
        .select("user_id, plan")
        .eq(
          "provider_subscription_id",
          subscriptionId,
        )
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      localSubscription =
        data as
          | LocalSubscriptionRow
          | null;
    }

    if (
      subscriptionId &&
      !externalReference &&
      !localSubscription
    ) {
      try {
        const subscription =
          await buscarAssinaturaNoAsaas(
            subscriptionId,
          );

        externalReference =
          subscription
            .externalReference ??
          null;

        customerId =
          customerId ||
          subscription.customer ||
          null;
      } catch {
        /*
         * O evento de exclusão pode chegar depois que o recurso
         * remoto já deixou de existir. Nesse caso, dependemos do
         * vínculo salvo no banco local.
         */
      }
    }

    const reference =
      interpretarExternalReference(
        externalReference,
      );

    const userId =
      reference?.userId ||
      localSubscription?.user_id ||
      null;

    const originalPlan =
      reference?.plan ||
      (localSubscription?.plan ===
        "essential" ||
      localSubscription?.plan === "pro"
        ? localSubscription.plan
        : null);

    if (!userId) {
      await admin
        .from("asaas_webhook_events")
        .insert({
          event_id: eventId,
          event_type: event,
        });

      return responder({
        success: true,
        ignored: true,
        reason:
          "Não foi possível identificar o usuário.",
      });
    }

    const {
      error: subscriptionError,
    } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan:
            eventInfo.status === "active"
              ? originalPlan ?? "free"
              : "free",
          status:
            eventInfo.status,
          provider: "asaas",
          provider_customer_id:
            eventInfo.apagarDados
              ? null
              : customerId,
          provider_subscription_id:
            eventInfo.apagarDados
              ? null
              : subscriptionId,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

    if (subscriptionError) {
      throw new Error(
        subscriptionError.message,
      );
    }

    if (eventInfo.apagarDados) {
      const {
        error: purgeError,
      } = await admin.rpc(
        "purge_user_platform_data",
        {
          p_user_id: userId,
          p_keep_account: true,
        },
      );

      if (purgeError) {
        throw new Error(
          `Não foi possível apagar os dados após o cancelamento: ${purgeError.message}`,
        );
      }
    }

    const {
      error: eventError,
    } = await admin
      .from("asaas_webhook_events")
      .insert({
        event_id: eventId,
        event_type: event,
      });

    if (eventError) {
      throw new Error(
        eventError.message,
      );
    }

    return responder({
      success: true,
      data_deleted:
        eventInfo.apagarDados,
    });
  } catch (error) {
    return responder(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado no webhook.",
      },
      500,
    );
  }
}
