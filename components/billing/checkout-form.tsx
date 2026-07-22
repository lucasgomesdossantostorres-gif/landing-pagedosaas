"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
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
  const numbers = value
    .replace(/\D/g, "")
    .slice(0, 11);

  return numbers
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(
      /^(\d{3})\.(\d{3})(\d)/,
      "$1.$2.$3",
    )
    .replace(
      /^(\d{3})\.(\d{3})\.(\d{3})(\d)/,
      "$1.$2.$3-$4",
    );
}

function formatarTelefone(value: string) {
  const numbers = value
    .replace(/\D/g, "")
    .slice(0, 11);

  if (numbers.length <= 10) {
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return numbers
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatarCep(value: string) {
  const numbers = value
    .replace(/\D/g, "")
    .slice(0, 8);

  return numbers.replace(
    /^(\d{5})(\d)/,
    "$1-$2",
  );
}

export function CheckoutForm({
  plan,
}: CheckoutFormProps) {
  const router = useRouter();

  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");

  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] =
    useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] =
    useState("");
  const [complement, setComplement] =
    useState("");
  const [province, setProvince] =
    useState("");
  const [city, setCity] = useState("");

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
            postalCode,
            address,
            addressNumber,
            complement,
            province,
            city,
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

  function optionClass(
    selected: boolean,
  ) {
    return [
      "rounded-2xl border p-4 text-left transition",
      selected
        ? [
            "border-indigo-500",
            "bg-indigo-50",
            "ring-1 ring-indigo-500",
            "dark:bg-indigo-500/15",
            "dark:ring-indigo-400",
          ].join(" ")
        : [
            "border-slate-200",
            "bg-white",
            "hover:border-slate-300",
            "dark:border-slate-700",
            "dark:bg-slate-900/30",
            "dark:hover:border-slate-600",
          ].join(" "),
    ].join(" ");
  }

  const inputClass = [
    "mt-2 w-full rounded-2xl border px-4 py-3.5 outline-none transition",
    "border-slate-300 bg-white text-slate-950",
    "placeholder:text-slate-400",
    "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100",
    "dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100",
    "dark:placeholder:text-slate-500",
    "dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20",
  ].join(" ");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-9">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">
            Plano {selectedPlan.name}
          </span>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Confirme sua assinatura
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            {selectedPlan.description}
          </p>

          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
              O plano inclui:
            </p>

            <ul className="mt-5 space-y-3">
              {selectedPlan.features.map(
                (feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
                  >
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                      ✓
                    </span>

                    <span>{feature}</span>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="mt-9 rounded-2xl bg-slate-100 p-5 dark:bg-slate-800/70">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              O plano será liberado somente depois da
              confirmação do pagamento pelo Asaas.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-7">
          <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Pagamento
            </h2>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() =>
                  setBillingCycle("monthly")
                }
                className={optionClass(
                  billingCycle === "monthly",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      Mensal
                    </p>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                      Cartão de crédito recorrente
                    </p>
                  </div>

                  <p className="font-bold text-slate-950 dark:text-white">
                    {selectedPlan.monthly}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setBillingCycle("yearly")
                }
                className={optionClass(
                  billingCycle === "yearly",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      Anual
                    </p>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                      Pix à vista
                    </p>

                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {
                        selectedPlan.yearlyDiscount
                      }
                    </span>
                  </div>

                  <p className="font-bold text-slate-950 dark:text-white">
                    {selectedPlan.yearly}
                  </p>
                </div>
              </button>
            </div>

            <div className="mt-7 space-y-5">
              <div>
                <label
                  htmlFor="cpf"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
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
                      formatarCpf(
                        event.target.value,
                      ),
                    )
                  }
                  placeholder="000.000.000-00"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
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
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="postalCode"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  CEP
                </label>

                <input
                  id="postalCode"
                  name="postalCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={postalCode}
                  onChange={(event) =>
                    setPostalCode(
                      formatarCep(
                        event.target.value,
                      ),
                    )
                  }
                  placeholder="00000-000"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="address"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Endereço
                </label>

                <input
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target.value,
                    )
                  }
                  placeholder="Rua, avenida..."
                  required
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="addressNumber"
                    className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Número
                  </label>

                  <input
                    id="addressNumber"
                    name="addressNumber"
                    value={addressNumber}
                    onChange={(event) =>
                      setAddressNumber(
                        event.target.value,
                      )
                    }
                    placeholder="123"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="province"
                    className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Bairro
                  </label>

                  <input
                    id="province"
                    name="province"
                    value={province}
                    onChange={(event) =>
                      setProvince(
                        event.target.value,
                      )
                    }
                    placeholder="Centro"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="complement"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Complemento
                  <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                    opcional
                  </span>
                </label>

                <input
                  id="complement"
                  name="complement"
                  value={complement}
                  onChange={(event) =>
                    setComplement(
                      event.target.value,
                    )
                  }
                  placeholder="Apartamento, bloco..."
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Cidade
                </label>

                <input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  value={city}
                  onChange={(event) =>
                    setCity(event.target.value)
                  }
                  placeholder="São Paulo"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
              >
                {error}
              </div>
            )}

            <div className="mt-7 border-t border-slate-200 pt-6 dark:border-slate-700">
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm text-slate-500 dark:text-slate-300">
                  Total
                </span>

                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">
                    {displayedPrice}
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    {billingCycle === "monthly"
                      ? "por mês"
                      : "pagamento anual único"}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                {loading
                  ? "Abrindo pagamento..."
                  : "Continuar para o pagamento"}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-500 dark:text-slate-300">
                O pagamento será concluído no
                ambiente seguro do Asaas.
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}