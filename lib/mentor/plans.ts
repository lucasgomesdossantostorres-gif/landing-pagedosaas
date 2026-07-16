export type MentorPlan =
  | "free"
  | "essential"
  | "pro";

export type MentorPlanLimits = {
  plan: MentorPlan;
  displayName: string;
  dailyMessages: number;
  maximumUserCharacters: number;
  contextMessages: number;
  maximumOutputTokens: number;
};

export const MENTOR_PLAN_LIMITS: Record<
  MentorPlan,
  MentorPlanLimits
> = {
  free: {
    plan: "free",
    displayName: "Gratuito",
    dailyMessages: 2,
    maximumUserCharacters: 1000,
    contextMessages: 4,
    maximumOutputTokens: 500,
  },

  essential: {
    plan: "essential",
    displayName: "Essencial",
    dailyMessages: 20,
    maximumUserCharacters: 2000,
    contextMessages: 6,
    maximumOutputTokens: 875,
  },

  pro: {
    plan: "pro",
    displayName: "Pro",
    dailyMessages: 60,
    maximumUserCharacters: 4000,
    contextMessages: 10,
    maximumOutputTokens: 1250,
  },
};

export function obterLimitesDoPlano(
  value: unknown,
): MentorPlanLimits {
  if (value === "pro") {
    return MENTOR_PLAN_LIMITS.pro;
  }

  if (value === "essential") {
    return MENTOR_PLAN_LIMITS.essential;
  }

  return MENTOR_PLAN_LIMITS.free;
}
