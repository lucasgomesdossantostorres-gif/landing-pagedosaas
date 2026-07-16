import {
  NextResponse,
} from "next/server";

import {
  cancelarAssinaturaNoAsaas,
} from "@/lib/billing/asaas";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionRow = {
  provider_subscription_id:
    | string
    | null;
};

function responderErro(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  );
}

export async function POST() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return responderErro(
        "Usuário não autenticado.",
        401,
      );
    }

    const admin =
      createAdminClient();

    const {
      data: subscriptionData,
      error: subscriptionError,
    } = await admin
      .from("subscriptions")
      .select(
        "provider_subscription_id",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      throw new Error(
        `Não foi possível consultar a assinatura: ${subscriptionError.message}`,
      );
    }

    const subscription =
      subscriptionData as
        | SubscriptionRow
        | null;

    const providerSubscriptionId =
      subscription
        ?.provider_subscription_id
        ?.trim() ?? "";

    if (providerSubscriptionId) {
      await cancelarAssinaturaNoAsaas(
        providerSubscriptionId,
      );
    }

    /*
     * Apaga histórico, correções, consumos e relatos.
     * Mantém a autenticação para o usuário continuar
     * com uma conta vazia no plano gratuito.
     */
    const {
      error: purgeError,
    } = await admin.rpc(
      "purge_user_platform_data",
      {
        p_user_id: user.id,
        p_keep_account: true,
      },
    );

    if (purgeError) {
      throw new Error(
        `A assinatura foi cancelada, mas não foi possível apagar os dados: ${purgeError.message}`,
      );
    }

    const {
      error: updateError,
    } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan: "free",
          status: "canceled",
          provider: "asaas",
          provider_subscription_id:
            null,
          provider_customer_id:
            null,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

    if (updateError) {
      throw new Error(
        `Os dados foram apagados, mas não foi possível atualizar o plano: ${updateError.message}`,
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Assinatura cancelada e dados apagados. Sua conta permanece ativa no plano gratuito.",
    });
  } catch (error) {
    return responderErro(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao cancelar a assinatura.",
      500,
    );
  }
}
