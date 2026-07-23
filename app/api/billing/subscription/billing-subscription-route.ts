import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SubscriptionRow = {
  plan: "free" | "essential" | "pro";
  status: "active" | "pending" | "past_due" | "canceled" | "expired";
  billing_cycle: "monthly" | "yearly" | null;
  payment_method: "credit_card" | "pix" | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_end: string | null;
  cancel_at_period_end: boolean;
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuário não autenticado.",
        },
        { status: 401 },
      );
    }

    const admin = createAdminClient();

    const {
      data,
      error,
    } = await admin
      .from("subscriptions")
      .select(`
        plan,
        status,
        billing_cycle,
        payment_method,
        current_period_start,
        current_period_end,
        grace_period_end,
        cancel_at_period_end
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Não foi possível consultar a assinatura: ${error.message}`,
      );
    }

    const subscription =
      data as SubscriptionRow | null;

    if (!subscription) {
      return NextResponse.json({
        success: true,
        subscription: {
          plan: "free",
          status: "active",
          billing_cycle: null,
          payment_method: null,
          current_period_start: null,
          current_period_end: null,
          grace_period_end: null,
          cancel_at_period_end: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error(
      "Erro ao consultar assinatura:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a assinatura.",
      },
      { status: 500 },
    );
  }
}
