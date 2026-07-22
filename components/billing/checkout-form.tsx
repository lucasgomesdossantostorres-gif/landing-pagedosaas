"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "essential" | "pro";
type BillingCycle = "monthly" | "yearly";

type CheckoutFormProps = {
  plan: Plan;
};

const PLANOS = {
  essential: {
    name: "Essencial",
    monthly: "R$ 124,73",
    yearly: "R$ 1.347,76",
    yearlyDiscount: "10% de desconto",
    description:
      "Para quem estuda com frequência e precisa acompanhar continuamente sua evolução.",
    features: [
      "50 correções discursivas por mês",
      "30 mensagens por dia no Mentor IA",
      "Feedback detalhado de conteúdo",
      "Estimativa educacional de pontuação",
      "Acompanhamento de desempenho",
    ],
  },
  pro: {
    name: "Pro",
    monthly: "R$ 172,46",
    yearly: "R$ 1.657,52",
    yearlyDiscount: "20% de desconto",
    description:
      "Para candidatos com rotina intensiva e maior volume de treinamento discursivo.",
    features: [
      "70 correções discursivas por mês",
      "60 mensagens por dia no Mentor IA",
      "Feedback detalhado de conteúdo",
      "Estimativa educacional de pontuação",
      "Acompanhamento de desempenho",
      "Respostas mais extensas no Mentor IA",
    ],
  },
} as const;

function formatarCpf(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  return numbers
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(
      /^(\d{3})\.(\d{3})\.(\d{3})(\d)/,
      "$1.$2.$3-$4",
    );
}

function formatarTelefone(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  if (numbers.length <= 10) {
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return numbers
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function CheckoutForm({
  plan,
}: CheckoutFormProps) {
  const router = useRouter();

  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = PLANOS[plan];

  const displayedPrice = useMemo(() => {
    return billingCycle === "monthly"
      ? selectedPlan.monthly
      : selectedPlan.yearly;
  }, [
    billingCycle,
    selectedPlan.monthly,
    selectedPlan.yearly,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/billing/checkout",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            plan,
            billingCycle,
            cpf,
            phone,
          }),
        },
      );

      const result = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
        code?: string;
      };

      if (response.status === 401) {
        const returnPath =
          plan === "essential"
            ? "/checkout/essencial"
            : "/checkout/pro";

        router.push(
          `/login?redirect=${encodeURIComponent(
            returnPath,
          )}`,
        );
        return;
      }

      if (!response.ok || !result.checkoutUrl) {
        throw new Error(
          result.error ||
            "Não foi possível abrir o pagamento.",
        );
      }

      window.location.assign(result.checkoutUrl);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível iniciar o checkout.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Plano {selectedPlan.name}
          </span>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Confirme sua assinatura
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {selectedPlan.description}
          </p>

          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-950">
              O plano inclui:
            </p>

            <ul className="mt-5 space-y-3">
              {selectedPlan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-sm leading-6 text-slate-600"
                >
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600">
                    ✓
                  </span>

                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-9 rounded-2xl bg-slate-100 p-5">
            <p className="text-sm leading-6 text-slate-600">
              O plano será liberado somente depois da
              confirmação do pagamento pelo Asaas.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-7">
          <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold text-slate-950">
              Pagamento
            </h2>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() =>
                  setBillingCycle("monthly")
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  billingCycle === "monthly"
                    ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">
                      Mensal
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Cartão de crédito recorrente
                    </p>
                  </div>

                  <p className="font-bold text-slate-950">
                    {selectedPlan.monthly}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setBillingCycle("yearly")
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  billingCycle === "yearly"
                    ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">
                      Anual
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Pix à vista
                    </p>
                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {selectedPlan.yearlyDiscount}
                    </span>
                  </div>

                  <p className="font-bold text-slate-950">
                    {selectedPlan.yearly}
                  </p>
                </div>
              </button>
            </div>

            <div className="mt-7 space-y-5">
              <div>
                <label
                  htmlFor="cpf"
                  className="text-sm font-semibold text-slate-900"
                >
                  CPF
                </label>

                <input
                  id="cpf"
                  name="cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cpf}
                  onChange={(event) =>
                    setCpf(
                      formatarCpf(event.target.value),
                    )
                  }
                  placeholder="000.000.000-00"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="text-sm font-semibold text-slate-900"
                >
                  Telefone com DDD
                </label>

                <input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      formatarTelefone(
                        event.target.value,
                      ),
                    )
                  }
                  placeholder="(11) 99999-9999"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                {error}
              </div>
            )}

            <div className="mt-7 border-t border-slate-200 pt-6">
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Total
                </span>

                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-950">
                    {displayedPrice}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {billingCycle === "monthly"
                      ? "por mês"
                      : "pagamento anual único"}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Abrindo pagamento..."
                  : "Continuar para o pagamento"}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                O pagamento será concluído no ambiente
                seguro do Asaas.
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}