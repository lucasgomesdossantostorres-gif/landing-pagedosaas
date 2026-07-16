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

export async function DELETE() {
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

    /*
     * A conta só será excluída depois que a recorrência
     * tiver sido encerrada, evitando cobrança futura.
     */
    if (providerSubscriptionId) {
      await cancelarAssinaturaNoAsaas(
        providerSubscriptionId,
      );
    }

    const {
      error: purgeError,
    } = await admin.rpc(
      "purge_user_platform_data",
      {
        p_user_id: user.id,
        p_keep_account: false,
      },
    );

    if (purgeError) {
      throw new Error(
        `Não foi possível apagar os dados da conta: ${purgeError.message}`,
      );
    }

    const {
      error: deleteUserError,
    } =
      await admin.auth.admin.deleteUser(
        user.id,
        false,
      );

    if (deleteUserError) {
      throw new Error(
        `Os dados foram apagados, mas não foi possível remover o acesso: ${deleteUserError.message}`,
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Conta excluída definitivamente.",
    });
  } catch (error) {
    return responderErro(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao excluir a conta.",
      500,
    );
  }
}
