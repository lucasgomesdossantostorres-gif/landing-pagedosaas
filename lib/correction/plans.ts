export type CorrectionPlan =
  | "free"
  | "essential"
  | "pro";

export type CorrectionPlanLimits = {
  plan: CorrectionPlan;
  displayName: string;
  monthlyCorrections: number;
};

export const CORRECTION_PLAN_LIMITS: Record<
  CorrectionPlan,
  CorrectionPlanLimits
> = {
  free: {
    plan: "free",
    displayName: "Gratuito",
    monthlyCorrections: 3,
  },

  essential: {
    plan: "essential",
    displayName: "Essencial",
    monthlyCorrections: 20,
  },

  pro: {
    plan: "pro",
    displayName: "Pro",
    monthlyCorrections: 40,
  },
};

export function obterLimitesCorrecao(
  value: unknown,
): CorrectionPlanLimits {
  if (value === "pro") {
    return CORRECTION_PLAN_LIMITS.pro;
  }

  if (value === "essential") {
    return CORRECTION_PLAN_LIMITS.essential;
  }

  return CORRECTION_PLAN_LIMITS.free;
}
