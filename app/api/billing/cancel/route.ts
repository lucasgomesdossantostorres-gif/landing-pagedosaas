import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelarAssinaturaNoAsaas } from "@/lib/billing/asaas";

type SubscriptionRow = {
  plan: string;
  status: string;
  billing_cycle: string | null;
  provider_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export async function POST() {
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
        },
        { status: 401 },
      );
    }

    const admin = createAdminClient();

    const {
      data,
      error: subscriptionError,
    } = await admin
      .from("subscriptions")
      .select(`
        plan,
        status,
        billing_cycle,
        provider_subscription_id,
        current_period_end,
        cancel_at_period_end
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(
        `Não foi possível consultar a assinatura: ${subscriptionError.message}`,
      );
    }

    const subscription =
      data as SubscriptionRow | null;

    if (!subscription) {
      return NextResponse.json(
        {
          error: "Nenhuma assinatura foi encontrada.",
        },
        { status: 404 },
      );
    }

    if (
      subscription.plan === "free" ||
      subscription.status === "expired" ||
      subscription.status === "canceled"
    ) {
      return NextResponse.json(
        {
          error: "Não existe assinatura ativa para cancelar.",
        },
        { status: 400 },
      );
    }

    if (subscription.cancel_at_period_end) {
      return NextResponse.json({
        success: true,
        alreadyCanceled: true,
        currentPeriodEnd:
          subscription.current_period_end,
      });
    }

    /*
     * O plano anual via Pix não possui assinatura recorrente
     * no Asaas. Nesse caso, apenas registramos que o acesso
     * terminará ao final do período anual.
     */
    if (
      subscription.billing_cycle === "monthly"
    ) {
      const subscriptionId =
        subscription.provider_subscription_id;

      if (!subscriptionId) {
        throw new Error(
          "O identificador da assinatura no Asaas não foi encontrado.",
        );
      }

      await cancelarAssinaturaNoAsaas(
        subscriptionId,
      );
    }

    const cancellationRequestedAt =
      new Date().toISOString();

    const {
      error: updateError,
    } = await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        cancellation_requested_at:
          cancellationRequestedAt,
        last_payment_status:
          "CANCELLATION_REQUESTED",
      })
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(
        `Não foi possível registrar o cancelamento: ${updateError.message}`,
      );
    }

    return NextResponse.json({
      success: true,
      currentPeriodEnd:
        subscription.current_period_end,
    });
  } catch (error) {
    console.error(
      "Erro ao cancelar assinatura:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível cancelar a assinatura.",
      },
      { status: 500 },
    );
  }
}