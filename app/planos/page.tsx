"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import {
  BILLING_PLANS,
  formatCurrency,
  type BillingPlan,
} from "@/lib/billing/plans";

const planOrder: BillingPlan[] = ["essential", "pro"];

export default function PlanosPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          aria-label="Voltar ao início"
          className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <header className="mx-auto mt-2 max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">
            Planos Simples Aprova.AI
          </span>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Escolha o ritmo ideal para sua preparação
          </h1>

          <p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300">
            Assine mensalmente no cartão ou economize 10% com o plano anual
            pago via Pix.
          </p>
        </header>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {planOrder.map((planKey) => {
            const plan = BILLING_PLANS[planKey];
            const isPro = planKey === "pro";

            return (
              <article
                key={planKey}
                className={[
                  "relative rounded-3xl border bg-white p-7 shadow-sm dark:bg-slate-900 sm:p-9",
                  isPro
                    ? "border-indigo-500 ring-1 ring-indigo-500 dark:border-indigo-400 dark:ring-indigo-400"
                    : "border-slate-200 dark:border-slate-800",
                ].join(" ")}
              >
                {isPro && (
                  <span className="absolute right-6 top-6 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                    Mais completo
                  </span>
                )}

                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {plan.description}
                </p>

                <div className="mt-7">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold tracking-tight">
                      {formatCurrency(plan.monthly)}
                    </span>
                    <span className="pb-1 text-sm text-slate-500 dark:text-slate-400">
                      /mês
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Anual por <strong>{formatCurrency(plan.yearly)}</strong> via
                    Pix — 10% de desconto.
                  </p>
                </div>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200"
                    >
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={
                    planKey === "essential"
                      ? "/checkout/essencial"
                      : "/checkout/pro"
                  }
                  className={[
                    "mt-9 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-semibold transition",
                    isPro
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                      : "border border-slate-300 bg-white text-slate-950 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800",
                  ].join(" ")}
                >
                  Escolher {plan.name}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
