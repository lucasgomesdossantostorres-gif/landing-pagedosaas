export type BillingPlan = "essential" | "pro";
export type BillingCycle = "monthly" | "yearly";

export const BILLING_PLANS = {
  essential: {
    name: "Essencial",
    description:
      "Para quem estuda com frequência e precisa acompanhar continuamente sua evolução.",
    monthly: 29.7,
    yearly: 320.76,
    yearlyDiscountLabel: "10% de desconto",
    features: [
  "Ilimitadas correções discursivas por mês",
  "10 mensagens por dia no Mentor IA",
  "+900 questões discursivas de concurso",
  "Feedback detalhado de conteúdo",
  "Estimativa educacional de pontuação",
  "Acompanhamento de desempenho",
],
  },
  pro: {
    name: "Pro",
    description:
      "Para candidatos com rotina intensiva e maior volume de treinamento discursivo.",
    monthly: 47.9,
    yearly: 517.32,
    yearlyDiscountLabel: "10% de desconto",
   features: [
  "Ilimitadas correções discursivas por mês",
  "+900 questões discursivas de concurso",
  "25 mensagens por dia no Mentor IA",
  "Feedback detalhado de conteúdo",
  "Estimativa educacional de pontuação",
  "Acompanhamento de desempenho",
  "Respostas mais extensas no Mentor IA",
],
  },
} as const;

export function getPlanAmount(
  plan: BillingPlan,
  billingCycle: BillingCycle,
) {
  return BILLING_PLANS[plan][billingCycle];
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
