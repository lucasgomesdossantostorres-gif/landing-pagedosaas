import { NextRequest, NextResponse } from "next/server";

import {
  getPlanAmount,
  type BillingCycle,
  type BillingPlan,
} from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

function normalizeCouponCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
        { success: false, error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      code?: string;
      plan?: BillingPlan;
      billingCycle?: BillingCycle;
    };

    const code = normalizeCouponCode(body.code);
    const plan = body.plan;
    const billingCycle = body.billingCycle;

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Digite um cupom." },
        { status: 400 },
      );
    }

    if (
      (plan !== "essential" && plan !== "pro") ||
      (billingCycle !== "monthly" && billingCycle !== "yearly")
    ) {
      return NextResponse.json(
        { success: false, error: "Plano ou periodicidade inválidos." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
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
      return NextResponse.json(
        { success: false, error: "Cupom inválido ou inativo." },
        { status: 404 },
      );
    }

    if (
      coupon.expires_at &&
      new Date(coupon.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { success: false, error: "Este cupom expirou." },
        { status: 400 },
      );
    }

    if (!coupon.applicable_plans.includes(plan)) {
      return NextResponse.json(
        { success: false, error: "Este cupom não é válido para o plano selecionado." },
        { status: 400 },
      );
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
        .eq("user_id", user.id)
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
      return NextResponse.json(
        { success: false, error: "O limite de usos deste cupom foi atingido." },
        { status: 400 },
      );
    }

    if (
      (userRedemptions ?? 0) >= coupon.max_redemptions_per_user
    ) {
      return NextResponse.json(
        { success: false, error: "Você já utilizou este cupom." },
        { status: 400 },
      );
    }

    const originalAmount = getPlanAmount(plan, billingCycle);
    const discountAmount =
      coupon.discount_type === "percentage"
        ? roundMoney(originalAmount * (coupon.discount_value / 100))
        : Math.min(roundMoney(coupon.discount_value), originalAmount);

    const finalAmount = Math.max(
      roundMoney(originalAmount - discountAmount),
      0,
    );

    return NextResponse.json({
      success: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
      },
      originalAmount,
      discountAmount,
      finalAmount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar o cupom.",
      },
      { status: 500 },
    );
  }
}
